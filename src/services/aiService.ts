import * as vscode from 'vscode';
import * as https from 'https';

export type AITaskType =
    | 'completion'
    | 'fix'
    | 'explain'
    | 'optimize'
    | 'refactor'
    | 'test'
    | 'document'
    | 'widget'
    | 'review';


export interface CodeFix {
    range: vscode.Range;
    newText: string;
    description: string;
    confidence: number;
}

export interface Refactoring {
    description: string;
    code: string;
    confidence: number;
    rationale: string;
}

export interface AIRequestOptions {
    taskType: AITaskType;
    maxTokens?: number;
    stream?: boolean;
    /** Abort signal — cancel mid-stream when user types again */
    signal?: AbortSignal;
    /** Override system prompt for specialised tasks */
    systemOverride?: string;
}

export interface RequestMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHits: number;
    offlineFallbacks: number;
    averageResponseTimeMs: number;
    queueHighWaterMark: number;
}

// ─── LRU Cache ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
    hits: number;
}


class LRUCache<T> {
    private readonly map = new Map<string, CacheEntry<T>>();

    constructor(
        private readonly maxSize: number,
        private readonly ttlMs: number
    ) { }

    get(key: string): T | undefined {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) { this.map.delete(key); return undefined; }
        // Refresh position
        this.map.delete(key);
        entry.hits++;
        this.map.set(key, entry);
        return entry.data;
    }

    set(key: string, data: T): void {
        if (this.map.has(key)) this.map.delete(key);
        else if (this.map.size >= this.maxSize) {
            this.map.delete(this.map.keys().next().value!);
        }
        this.map.set(key, { data, expiresAt: Date.now() + this.ttlMs, hits: 0 });
    }

    stats() {
        const entries = [...this.map.values()];
        return {
            size: this.map.size,
            maxSize: this.maxSize,
            totalHits: entries.reduce((s, e) => s + e.hits, 0),
            utilizationPct: ((this.map.size / this.maxSize) * 100).toFixed(1),
        };
    }

    clear() { this.map.clear(); }
}

// ─── Request Queue ────────────────────────────────────────────────────────────

type QueuedTask<T> = {
    fn: () => Promise<T>;
    resolve: (v: T) => void;
    reject: (e: unknown) => void;
    signal?: AbortSignal;
};

class RequestQueue {
    private readonly queue: QueuedTask<any>[] = [];
    private running = 0;
    private highWaterMark = 0;

    constructor(private readonly concurrency: number) { }

    enqueue<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ fn, resolve, reject, signal });
            this.highWaterMark = Math.max(this.highWaterMark, this.queue.length);
            this._drain();
        });
    }

    private _drain(): void {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const task = this.queue.shift()!;
            if (task.signal?.aborted) { task.reject(new DOMException('Aborted', 'AbortError')); continue; }
            this.running++;
            task.fn()
                .then(task.resolve)
                .catch(task.reject)
                .finally(() => { this.running--; this._drain(); });
        }
    }

    get hwm() { return this.highWaterMark; }
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Dart and Flutter developer assistant embedded in VS Code.
You are helping a freelance Flutter developer in Uganda who:
- Builds cross-platform Android/iOS apps targeting the Ugandan market
- Uses MTN/Airtel Mobile Money (UGX currency, +256 prefix) for payments
- Works with Firebase (Firestore, Auth, Storage), Hive, Provider, Riverpod, Dio
- Prefers concise, production-ready code with null safety
- Works on Windows with VS Code; avoids Android Studio
- Values offline-friendly patterns due to connectivity constraints

Rules:
- Always use Dart null safety (?, ??, !, late final)
- Prefer const constructors on widgets
- Use async/await over .then() chains
- Use super.key in widget constructors
- Prefer flutter_secure_storage over SharedPreferences for sensitive data
- When relevant, use UGX for currency and +256 for phone prefixes
- Never output markdown fences unless explicitly asked
- Be concise: return only what was asked for`;

const PROMPTS: Record<AITaskType, (payload: string) => string> = {
    completion: (ctx) =>
        `Complete the following Dart/Flutter code. Output only the completion text to insert, nothing else.\n\n${ctx}`,

    fix: (ctx) =>
        `Fix the Dart error below. Output only the corrected code for the affected line(s), nothing else.\n\n${ctx}`,

    explain: (ctx) =>
        `Explain the following Dart/Flutter code clearly and concisely. Cover what it does, key patterns used, and any gotchas.\n\n${ctx}`,

    optimize: (ctx) =>
        `Optimize the following Dart/Flutter code for performance, readability, and best practices. Output only the optimized code.\n\n${ctx}`,

    refactor: (ctx) =>
        `Suggest 3 refactoring options for the following Dart code. Respond ONLY with a JSON array where each item has: description (string), code (string), confidence (0-100), rationale (string). No markdown fences.\n\n${ctx}`,

    test: (ctx) =>
        `Generate a comprehensive Flutter/Dart test file for the following code. Include: happy path, edge cases, error scenarios. Use flutter_test or test package as appropriate. Output only the complete test file.\n\n${ctx}`,

    document: (ctx) =>
        `Add Dart doc comments (///) to the following code. Preserve all existing logic exactly. Output only the documented code.\n\n${ctx}`,

    widget: (ctx) =>
        `Generate a complete Flutter widget based on this description. Use null safety, const constructors, super.key. Output only the Dart code.\n\n${ctx}`,

    review: (ctx) =>
        `Review the following Dart/Flutter code. Identify: bugs, null safety issues, performance problems, security risks, and style violations. Format as a JSON array where each item has: severity ('error'|'warning'|'info'), category (string), message (string), line (number or null). No markdown fences.\n\n${ctx}`,
};



// ─── Offline Fallbacks ────────────────────────────────────────────────────────

function offlineFallback(taskType: AITaskType, payload: string): string {
    switch (taskType) {
        case 'completion':
            if (/Future|async/.test(payload)) return 'async {\n  // TODO: implement\n}';
            if (/class\s+\w+\s*\{/.test(payload)) return '  // TODO: add members\n}';
            return '// TODO: implement';

        case 'fix':
            if (/semicolon|Expected/i.test(payload)) return payload.replace(/([^;{\n])(\s*)$/, '$1;$2');
            if (/null/i.test(payload)) return '// Add null check: value?.method() or value!.method()';
            if (/await/i.test(payload)) return '// Add await keyword before the Future expression';
            return '// Unable to auto-fix offline — check Dart docs';

        case 'explain':
            return 'AI explanation unavailable offline. Connect to the internet and configure your Anthropic API key in settings (dartAI.anthropicApiKey).';

        case 'optimize':
            // Apply safe offline transformations
            return payload
                .replace(/\bnew\s+/g, '')
                .replace(/var\s+(\w+)\s*=\s*"([^"]*)"/g, "String $1 = '$2'")
                .replace(/var\s+(\w+)\s*=\s*(\d+\.\d+)/g, 'double $1 = $2')
                .replace(/var\s+(\w+)\s*=\s*(\d+)\b/g, 'int $1 = $2');

        case 'test':
            return `import 'package:flutter_test/flutter_test.dart';\n\nvoid main() {\n  group('TODO', () {\n    test('basic test', () {\n      // Arrange\n      // Act\n      // Assert\n      expect(true, isTrue);\n    });\n  });\n}`;

        case 'document':
            return payload; // return unchanged — can't doc offline

        case 'widget':
            return `class MyWidget extends StatelessWidget {\n  const MyWidget({super.key});\n\n  @override\n  Widget build(BuildContext context) {\n    return const Placeholder();\n  }\n}`;

        case 'refactor':
            return JSON.stringify([{
                description: 'Extract method',
                code: payload,
                confidence: 50,
                rationale: 'Offline — connect to AI for real suggestions.',
            }]);

        case 'review':
            return JSON.stringify([{
                severity: 'info',
                category: 'offline',
                message: 'AI review unavailable offline. Configure dartAI.anthropicApiKey.',
                line: null,
            }]);

        default:
            return '// AI unavailable offline';
    }
}

// ─── AIService ────────────────────────────────────────────────────────────────

/**
 * Production AI service for the dart-ai-assistant VS Code extension.
 *
 * Improvements over v1:
 * - Native https module replaces axios — no extra dependency, works in offline-hostile envs.
 * - Streaming support: streams Claude responses token-by-token to the caller callback.
 * - Request queue (concurrency: 2) prevents pile-up on slow connections.
 * - Per-task AbortController support: cancels in-flight request when user types again.
 * - Typed prompt templates per AITaskType — consistent, auditable prompts.
 * - Flutter/Uganda-aware system prompt injected on every request.
 * - Offline detection: pings reachability before calling API; falls back gracefully.
 * - Structured JSON parsing with fallback for refactor/review tasks.
 * - Exponential backoff retry (3 attempts, server errors only).
 * - LRU cache keyed on (taskType + content hash), TTL 1 hour.
 * - Metrics: tracks offline fallbacks and queue high-water mark.
 * - dispose() cancels all pending requests cleanly on extension deactivation.
 */

export class AIService {
    private apiKey: string | undefined;
    private readonly cache = new LRUCache<string>(500, 3_600_000);
    private readonly queue = new RequestQueue(2);
    private readonly activeControllers = new Set<AbortController>();
    private readonly responseTimes: number[] = [];
    private metrics: RequestMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cacheHits: 0,
        offlineFallbacks: 0,
        averageResponseTimeMs: 0,
        queueHighWaterMark: 0,
    };

    private readonly MODEL = 'claude-sonnet-4-6';
    private readonly API_URL = 'https://api.anthropic.com/v1/messages';
    private readonly API_VERSION = '2023-06-01';


    constructor(private readonly context: vscode.ExtensionContext) {
        this._loadApiKey();
        // Reload key if settings change
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('dartAI.anthropicApiKey')) this._loadApiKey();
        }, undefined, context.subscriptions);
    }

    private _loadApiKey() {
        const config = vscode.workspace.getConfiguration('dartAI');
        this.apiKey = config.get('anthropicApiKey');
    }


    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Core AI call. Use this for all single-response tasks.
     */
    async call(
        content: string,
        options: AIRequestOptions
    ): Promise<string> {
        const { taskType, maxTokens = 1500, signal } = options;
        const cacheKey = `${taskType}:${this._hash(content)}`;

        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.metrics.cacheHits++;
            return cached;
        }

        return this.queue.enqueue(async () => {
            this.metrics.totalRequests++;
            const t0 = Date.now();

            try {
                if (!this.apiKey || !await this._isOnline()) {
                    this.metrics.offlineFallbacks++;
                    return offlineFallback(taskType, content);
                }

                const prompt = (options.systemOverride)
                    ? content
                    : PROMPTS[taskType](content);

                const result = await this._callWithRetry(
                    prompt,
                    options.systemOverride ?? SYSTEM_PROMPT,
                    maxTokens,
                    signal
                );

                this._recordTime(Date.now() - t0);
                this.metrics.successfulRequests++;
                this.cache.set(cacheKey, result);
                return result;

            } catch (err: any) {
                this.metrics.failedRequests++;
                if (err?.name === 'AbortError') throw err; // propagate cancellation
                console.error('[AIService] Error:', err?.message ?? err);
                return offlineFallback(taskType, content);
            } finally {
                this.metrics.queueHighWaterMark = this.queue.hwm;
            }
        }, signal);
    }

    /**
     * Streaming call — invokes onChunk for each token as it arrives.
     * Returns the full accumulated text when the stream ends.
     */
    async stream(
        content: string,
        options: AIRequestOptions,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        if (!this.apiKey || !await this._isOnline()) {
            const fallback = offlineFallback(options.taskType, content);
            onChunk(fallback);
            return fallback;
        }

        const controller = new AbortController();
        this.activeControllers.add(controller);

        if (options.signal) {
            options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const prompt = PROMPTS[options.taskType](content);
            return await this._streamRequest(
                prompt,
                options.systemOverride ?? SYSTEM_PROMPT,
                options.maxTokens ?? 2000,
                controller,
                onChunk
            );
        } finally {
            this.activeControllers.delete(controller);
        }
    }

    // ── High-level helpers (used by other engines) ─────────────────────────────


    async generateFixes(
        document: vscode.TextDocument,
        errors: Array<{
            line: number; message: string; severity: string; code?: string
            signal?: AbortSignal
        }>
    ): Promise<CodeFix[]> {
        const fixes: CodeFix[] = [];

        for (const error of errors) {
            const signal = error.signal;
            if (signal?.aborted) break;
            const lineText = document.lineAt(error.line).text;
            const context = this._contextLines(document, error.line, 5);

            const payload = `Error: ${error.message}\nCode: ${error.code ?? ''}\nLine: ${lineText}\n\nContext:\n${context}`;
            const fix = await this.call(payload, { taskType: 'fix', maxTokens: 200, signal });

            if (fix && fix !== lineText) {
                fixes.push({
                    range: new vscode.Range(
                        error.line, 0,
                        error.line, lineText.length
                    ),
                    newText: fix.trimEnd(),
                    description: `Dart AI Fix: ${error.message}`,
                    confidence: 0.8,
                });
            }
        }

        return fixes;
    }


    async optimizeCode(code: string, signal?: AbortSignal): Promise<string> {
        return this.call(code, { taskType: 'optimize', maxTokens: 1500, signal });
    }

    async explainCode(code: string, signal?: AbortSignal): Promise<string> {
        return this.call(code, { taskType: 'explain', maxTokens: 600, signal });
    }

    async generateTests(code: string, signal?: AbortSignal): Promise<string> {
        return this.call(code, { taskType: 'test', maxTokens: 2000, signal });
    }

    async suggestRefactorings(code: string, signal?: AbortSignal): Promise<Refactoring[]> {
        const raw = await this.call(code, { taskType: 'refactor', maxTokens: 2000, signal });
        return this._parseJSON<Refactoring[]>(raw, [{
            description: 'Extract method',
            code,
            confidence: 50,
            rationale: 'Could not parse AI response.',
        }]);
    }

    async completeCode(document: vscode.TextDocument, position: vscode.Position, signal?: AbortSignal): Promise<string> {
        const textBeforeCursor = document.getText(
            new vscode.Range(new vscode.Position(0, 0), position)
        );

        return this.call(textBeforeCursor, { taskType: 'completion', maxTokens: 300, signal });
    }

    async documentCode(code: string, signal?: AbortSignal): Promise<string> {
        return this.call(code, { taskType: 'document', maxTokens: 2000, signal });
    }

    async generateWidget(description: string, signal?: AbortSignal): Promise<string> {
        return this.call(description, { taskType: 'widget', maxTokens: 1500, signal });
    }

    async reviewCode(code: string, signal?: AbortSignal): Promise<Array<{
        severity: string; category: string; message: string; line: number | null;
    }>> {
        const raw = await this.call(code, { taskType: 'review', maxTokens: 1500, signal });
        return this._parseJSON(raw, []);
    }


    async generateCompletions(
        prefix: string,
        suffix: string,
        signal?: AbortSignal
    ): Promise<string[]> {
        const payload = `[PREFIX]\n${prefix}\n[SUFFIX]\n${suffix}`;
        const result = await this.call(payload, { taskType: 'completion', maxTokens: 300, signal });
        return result.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
    }

    // ── Metrics ────────────────────────────────────────────────────────────────

    getMetrics(): RequestMetrics {
        return { ...this.metrics, queueHighWaterMark: this.queue.hwm };
    }

    getCacheStats() { return this.cache.stats(); }

    getPerformanceReport(): string {
        const m = this.getMetrics();
        const c = this.getCacheStats();
        const successRate = m.totalRequests > 0 ? ((m.successfulRequests / m.totalRequests) * 100).toFixed(1) : '0.0';
        const cacheHitRate = m.totalRequests > 0 ? ((m.cacheHits / m.totalRequests) * 100).toFixed(1) : '0.0';
        const offlineRate = m.totalRequests > 0 ? ((m.offlineFallbacks / m.totalRequests) * 100).toFixed(1) : '0.0';

        return [
            '=== dart-ai-assistant Performance ===',
            '',
            `Requests      : ${m.totalRequests} total | ${m.successfulRequests} ok | ${m.failedRequests} failed`,
            `Success rate  : ${successRate}%`,
            `Cache hit rate: ${cacheHitRate}% (${c.size}/${c.maxSize} entries, ${c.utilizationPct}% used)`,
            `Offline fallback rate: ${offlineRate}%`,
            `Avg response  : ${m.averageResponseTimeMs.toFixed(0)}ms`,
            `Queue peak    : ${m.queueHighWaterMark} tasks`,
            `API key       : ${this.apiKey ? 'Configured ✓' : 'Not set — using offline fallback'}`,
        ].join('\n');
    }

    clearCache(): void { this.cache.clear(); }

    /** Cancel all in-flight requests and clean up. */
    dispose(): void {
        for (const ctrl of this.activeControllers) ctrl.abort();
        this.activeControllers.clear();
        this.cache.clear();
    }

    // ── Private: HTTP ──────────────────────────────────────────────────────────

    private _callWithRetry(
        prompt: string,
        systemPrompt: string,
        maxTokens: number,
        signal?: AbortSignal,
        attempt = 0
    ): Promise<string> {
        const MAX_ATTEMPTS = 3;
        const INITIAL_DELAY = 1000;

        return new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));

            const body = JSON.stringify({
                model: this.MODEL,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }],
            });

            const req = https.request(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey!,
                    'anthropic-version': this.API_VERSION,
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let raw = '';
                res.on('data', (chunk: Buffer) => raw += chunk.toString());
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 500 && attempt < MAX_ATTEMPTS - 1) {
                        const delay = INITIAL_DELAY * Math.pow(2, attempt);
                        setTimeout(() =>
                            this._callWithRetry(prompt, systemPrompt, maxTokens, signal, attempt + 1)
                                .then(resolve).catch(reject),
                            delay
                        );
                        return;
                    }
                    if (res.statusCode && res.statusCode >= 400) {
                        return reject(new Error(`API error ${res.statusCode}: ${raw}`));
                    }
                    try {
                        const json = JSON.parse(raw);
                        resolve(json.content?.[0]?.text ?? '');
                    } catch {
                        reject(new Error(`Failed to parse API response: ${raw.slice(0, 200)}`));
                    }
                });
            });

            req.on('error', (err) => {
                if (attempt < MAX_ATTEMPTS - 1) {
                    const delay = INITIAL_DELAY * Math.pow(2, attempt);
                    setTimeout(() =>
                        this._callWithRetry(prompt, systemPrompt, maxTokens, signal, attempt + 1)
                            .then(resolve).catch(reject),
                        delay
                    );
                } else {
                    reject(err);
                }
            });

            // Honour AbortSignal
            signal?.addEventListener('abort', () => {
                req.destroy();
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });

            req.write(body);
            req.end();
        });
    }

    private _streamRequest(
        prompt: string,
        systemPrompt: string,
        maxTokens: number,
        controller: AbortController,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify({
                model: this.MODEL,
                max_tokens: maxTokens,
                stream: true,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }],
            });

            const req = https.request(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey!,
                    'anthropic-version': this.API_VERSION,
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let accumulated = '';
                let buffer = '';

                res.on('data', (chunk: Buffer) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;
                        try {
                            const event = JSON.parse(data);
                            const text = event.delta?.text ?? '';
                            if (text) { accumulated += text; onChunk(text); }
                        } catch { /* skip malformed SSE lines */ }
                    }
                });

                res.on('end', () => resolve(accumulated));
                res.on('error', reject);
            });

            req.on('error', reject);

            controller.signal.addEventListener('abort', () => {
                req.destroy();
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });

            req.write(body);
            req.end();
        });
    }


    private _hash(str: string): string {
        let h = 0;
        for (let i = 0; i < Math.min(str.length, 500); i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return (h >>> 0).toString(16);
    }

    private async _isOnline(): Promise<boolean> {
        return new Promise((resolve) => {
            const req = https.request(
                { hostname: 'api.anthropic.com', path: '/', method: 'HEAD', timeout: 3000 },
                () => resolve(true)
            );
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.end();
        });
    }

    private _contextLines(
        document: vscode.TextDocument,
        line: number,
        radius: number
    ): string {
        const start = Math.max(0, line - radius);
        const end = Math.min(document.lineCount - 1, line + radius);
        const out: string[] = [];
        for (let i = start; i <= end; i++) {
            out.push(`${i === line ? '>>>' : '   '} ${i + 1}: ${document.lineAt(i).text}`);
        }
        return out.join('\n');
    }

    private _recordTime(ms: number): void {
        this.responseTimes.push(ms);
        if (this.responseTimes.length > 100) this.responseTimes.shift();
        this.metrics.averageResponseTimeMs =
            this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }






    private _parseJSON<T>(raw: string, fallback: T): T {
        try {
            const cleaned = raw.replace(/```(?:json)?/g, '').trim();
            return JSON.parse(cleaned) as T;
        } catch {
            return fallback;
        }
    }


}
