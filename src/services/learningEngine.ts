import * as vscode from 'vscode';

declare const console: {
    warn(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;

};

interface CodingPattern {
    id: string;
    pattern: string;
    frequency: number;
    context: string;
    lastUsed: Date;
    /** Exponentially-weighted score that decays over time */
    score: number;
    /** Which file types this pattern was seen in */
    fileTypes: Set<string>;
    /** Tags derived from analysis (e.g. "async", "widget", "state") */
    tags: Set<string>;
}


interface PatternCluster {
    centroid: string;
    members: string[];
    label: string;
}

interface SessionStats {
    editsThisSession: number;
    errorsFixed: number;
    patternsLearned: number;
    sessionStart: number;
}

interface UserPreference {
    naming: string[];
    structure: string[];
    imports: string[];
}

interface AnomalyScore {
    pattern: string;
    score: number;
    isAnomaly: boolean;
    reason: string;
}

interface PatternMetrics {
    totalPatterns: number;
    avgFrequency: number;
    medianFrequency: number;
    patterns: Map<string, CodingPattern>;
    anomalies: AnomalyScore[];
}

interface FixRecord {
    error: string;
    fix: string;
    timestamp: number;
    errorType: string;
    /** Normalised embedding vector (bag-of-tokens) for fast similarity lookup */
    vector: number[];
}

/** Tracks adoption of a specific best-practice over time. */
interface BestPracticeAdoption {
    practice: string;
    timesFollowed: number;
    timesViolated: number;
    lastSeen: Date;
    adoptionRate: number;
}

/** A single snapshot of session stats, kept for trend analysis across sessions. */
interface SessionSnapshot {
    sessionStart: number;
    sessionEnd: number;
    editsThisSession: number;
    errorsFixed: number;
    patternsLearned: number;
}

/** Uganda/Flutter-specific signal extracted from the user's code. */
interface LocalMarketSignal {
    signal: string;
    category: 'mobile_money' | 'currency' | 'phone_validation' | 'offline_pattern' | 'localization';
    frequency: number;
    lastUsed: Date;
}


/** Aggregated productivity trend across the last N sessions. */
interface ProductivityTrend {
    averageEditsPerSession: number;
    averageErrorsFixedPerSession: number;
    averagePatternsLearnedPerSession: number;
    sessionsAnalyzed: number;
    trendDirection: 'improving' | 'stable' | 'declining';
}


// ─── Constants ────────────────────────────────────────────────────────────────

const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const MAX_FIX_HISTORY = 200;
const MAX_PATTERNS = 2000;
const MAX_PREF_ITEMS = 100;
const SIMILARITY_THRESHOLD = 0.65;
const MAX_SESSION_HISTORY = 50;


// Best-practice rules tracked for adoption-rate analytics
const BEST_PRACTICE_CHECKS: Record<string, { followed: RegExp; violated: RegExp }> = {
    const_constructors: {
        followed: /\bconst\s+(?:Text|Icon|SizedBox|Padding|EdgeInsets)\s*\(/,
        violated: /(?<!const\s)\b(?:Text|Icon|SizedBox|Padding)\s*\(\s*['"\d]/,
    },
    mounted_guard: {
        followed: /if\s*\(\s*mounted\s*\)\s*\{[^}]*setState/,
        violated: /await[^;]+;[^}]*setState\s*\((?!\s*\(\s*\)\s*=>\s*\{\s*\}\s*\))[^}]*\)(?![^]*mounted)/,
    },
    null_aware_access: {
        followed: /\w+\?\.\w+/,
        violated: /\w+!\.\w+/,
    },
    secure_storage: {
        followed: /flutter_secure_storage/,
        violated: /SharedPreferences[^;]*(?:token|password|secret)/i,
    },
    debug_print: {
        followed: /\bdebugPrint\s*\(/,
        violated: /(?<!debug)\bprint\s*\(/,
    },
};

// Uganda / local-market detection patterns
const LOCAL_MARKET_PATTERNS: Record<LocalMarketSignal['category'], RegExp> = {
    mobile_money: /MTN|Airtel|MobileMoney|partyIdType|MSISDN/i,
    currency: /UGX|NumberFormat\.currency|formatUGX/,
    phone_validation: /\+256|0(?:7[0-8]|3[09])\d{7}/,
    offline_pattern: /\bHive\b|connectivity_plus|ConnectivityResult/,
    localization: /Intl\.|flutter_localizations|AppLocalizations/,
};

// Common Dart / Flutter error categories for smarter bucketing
const ERROR_CATEGORIES: Record<string, RegExp> = {
    type_mismatch: /type '([^']+)' is not a subtype of type '([^']+)'/,
    undefined_method: /The method '([^']+)' isn't defined/,
    undefined_getter: /The getter '([^']+)' isn't defined/,
    missing_import: /Undefined name '([^']+)'/,
    null_safety: /Null check operator used on a null value/,
    widget_build: /The return type '([^']+)' isn't a '([^']+)'/,
};


function decayedScore(frequency: number, lastUsed: Date): number {
    const ageMs = Date.now() - lastUsed.getTime();
    const lambda = Math.LN2 / DECAY_HALF_LIFE_MS;
    return frequency * Math.exp(-lambda * ageMs);
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}


function buildVector(tokens: string[], vocab: string[]): number[] {
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    const vec = vocab.map(v => counts.get(v) ?? 0);
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map(x => x / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot; // vectors are pre-normalised
}


function categoriseError(message: string): string {
    for (const [cat, re] of Object.entries(ERROR_CATEGORIES)) {
        if (re.test(message)) return cat;
    }
    return 'general';
}

// ─── Main class ───────────────────────────────────────────────────────────────



export class LearningEngine {
    private context: vscode.ExtensionContext;
    private patterns: Map<string, CodingPattern>;
    private preferences: UserPreference;
    private fixHistory: FixRecord[];
    private clusters: PatternCluster[];
    private vocab: string[];          // shared vocabulary for vector embeddings
    private session: SessionStats;
    private bestPractices: Map<string, BestPracticeAdoption>;
    private localMarketSignals: Map<string, LocalMarketSignal>;
    private sessionHistory: SessionSnapshot[];

    // Throttle heavy work
    private dirtyPatterns = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.patterns = new Map();
        this.preferences = {
            naming: [],
            structure: [],
            imports: []
        };
        this.fixHistory = [];


        this.clusters = [];
        this.vocab = [];
        this.bestPractices = new Map();
        this.localMarketSignals = new Map();
        this.sessionHistory = [];
        this.session = {
            editsThisSession: 0,
            errorsFixed: 0,
            patternsLearned: 0,
            sessionStart: Date.now(),
        };
        this.loadLearningData();
    }

    // ── Persistence ────────────────────────────────────────────────────────────

    private loadLearningData() {
        try {
            const rawPatterns = this.context.globalState.get<Record<string, any>>('codingPatterns');
            const rawPrefs = this.context.globalState.get<UserPreference>('userPreferences');
            const rawHistory = this.context.globalState.get<FixRecord[]>('fixHistory');
            const rawVocab = this.context.globalState.get<string[]>('vocab');
            const rawClusters = this.context.globalState.get<PatternCluster[]>('clusters');
            const rawBestPractices = this.context.globalState.get<Record<string, any>>('bestPractices');
            const rawLocalSignals = this.context.globalState.get<Record<string, any>>('localMarketSignals');
            const rawSessionHistory = this.context.globalState.get<SessionSnapshot[]>('sessionHistory');

            if (rawPatterns) {
                let repairedCount = 0;
                this.patterns = new Map(
                    Object.entries(rawPatterns).map(([k, v]) => {
                        let tags = new Set<string>(v.tags ?? []);
                        let fileTypes = new Set<string>(v.fileTypes ?? []);

                        // Self-heal: if tags/fileTypes are empty (corrupted by the old
                        // broken save path), re-derive tags from the pattern's own key
                        // prefix (e.g. "try_block:..." -> infer ["error-handling"]).
                        if (tags.size === 0) {
                            tags = this._inferTagsFromKey(k);
                            repairedCount++;
                        }
                        if (fileTypes.size === 0) {
                            fileTypes = new Set<string>(['dart']);
                        }

                        return [
                            k,
                            {
                                ...v,
                                lastUsed: new Date(v.lastUsed),
                                fileTypes,
                                tags,
                            } as CodingPattern,
                        ];
                    })
                );

                if (repairedCount > 0) {
                    console.warn(`[LearningEngine] Repaired ${repairedCount} pattern(s) with corrupted tags from a previous version.`);
                    this.scheduleSave(); // persist the repair so it doesn't need to re-run every load
                }
            }

            if (rawPrefs) this.preferences = rawPrefs;
            if (rawHistory) this.fixHistory = rawHistory;
            if (rawVocab) this.vocab = rawVocab;
            if (rawClusters) this.clusters = rawClusters;
            if (rawBestPractices) {
                this.bestPractices = new Map(
                    Object.entries(rawBestPractices).map(([k, v]) => [
                        k,
                        { ...v, lastSeen: new Date(v.lastSeen) } as BestPracticeAdoption,
                    ])
                );
            }
            if (rawLocalSignals) {
                this.localMarketSignals = new Map(
                    Object.entries(rawLocalSignals).map(([k, v]) => [
                        k,
                        { ...v, lastUsed: new Date(v.lastUsed) } as LocalMarketSignal,
                    ])
                );
            }
            if (rawSessionHistory) this.sessionHistory = rawSessionHistory;
        } catch (e) {
            // Corrupted state — start fresh
            console.error('[LearningEngine || AdvancedLearningEngine] Failed to load state, resetting.', e);
        }
    }


    /** Debounced save: batches rapid writes into a single disk operation. */
    private scheduleSave(): void {
        this.dirtyPatterns = true;
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            if (this.dirtyPatterns) void this.persistLearningData();
        }, 2000);
    }

    private async persistLearningData(): Promise<void> {
        this.dirtyPatterns = false;

        // Serialize Sets to arrays for JSON storage
        const serialisedPatterns: Record<string, any> = {};
        for (const [k, v] of this.patterns) {
            serialisedPatterns[k] = {
                ...v,
                lastUsed: v.lastUsed.toISOString(),
                fileTypes: Array.from(v.fileTypes),
                tags: Array.from(v.tags),
            };
        }

        await Promise.all([
            this.context.globalState.update('codingPatterns', serialisedPatterns),
            this.context.globalState.update('userPreferences', this.preferences),
            this.context.globalState.update('fixHistory', this.fixHistory),
            this.context.globalState.update('vocab', this.vocab),
            this.context.globalState.update('clusters', this.clusters),
            this.context.globalState.update('bestPractices', this._serialiseBestPractices()),
            this.context.globalState.update('localMarketSignals', this._serialiseLocalSignals()),
            this.context.globalState.update('sessionHistory', this.sessionHistory),
        ]);
    }

    /** Serialises bestPractices Map (with Date) into a plain object for globalState storage. */
    private _serialiseBestPractices(): Record<string, any> {
        const out: Record<string, any> = {};
        for (const [k, v] of this.bestPractices) {
            out[k] = { ...v, lastSeen: v.lastSeen.toISOString() };
        }
        return out;
    }

    /** Serialises localMarketSignals Map (with Date) into a plain object for globalState storage. */
    private _serialiseLocalSignals(): Record<string, any> {
        const out: Record<string, any> = {};
        for (const [k, v] of this.localMarketSignals) {
            out[k] = { ...v, lastUsed: v.lastUsed.toISOString() };
        }
        return out;
    }

    // ── Real-time edit learning ────────────────────────────────────────────────

    recordEdit(event: vscode.TextDocumentChangeEvent): void {
        const ext = event.document.fileName.split('.').pop() ?? 'unknown';

        for (const change of event.contentChanges) {
            const text = change.text;
            if (!text.trim()) continue; // ignore whitespace-only changes

            this.learnNamingConvention(text);
            this.learnStructurePattern(text);
            this.learnImportPattern(text);
            this.learnWidgetPattern(text, ext);
            this.session.editsThisSession++;
        }

        this.scheduleSave();
    }

    // ── Deep document analysis ────────────────────────────────────────────────

    async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        const text = document.getText();
        const lines = text.split('\n');
        const ext = document.fileName.split('.').pop() ?? 'unknown';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const ctx = this.getContext(lines, i);

            // Structural patterns
            if (/\bclass\s+\w+/.test(line)) this.upsertPattern('class_structure', line, ctx, ext, ['oop']);
            if (/\bFuture[<(]/.test(line)) this.upsertPattern('async_future', line, ctx, ext, ['async']);
            if (/\bStream[<(]/.test(line)) this.upsertPattern('stream_pattern', line, ctx, ext, ['async', 'reactive']);
            if (/\bsetState\s*\(/.test(line)) this.upsertPattern('stateful_widget', line, ctx, ext, ['state', 'widget']);
            if (/\bProvider\.of\b/.test(line)) this.upsertPattern('provider_pattern', line, ctx, ext, ['state', 'di']);
            if (/\bBlocBuilder\b/.test(line)) this.upsertPattern('bloc_builder', line, ctx, ext, ['state', 'bloc']);
            if (/\briverpod\b/i.test(line)) this.upsertPattern('riverpod_pattern', line, ctx, ext, ['state', 'riverpod']);
            if (/\bextends\s+StatelessWidget/.test(line)) this.upsertPattern('stateless_widget', line, ctx, ext, ['widget']);
            if (/\bextends\s+StatefulWidget/.test(line)) this.upsertPattern('stateful_widget_def', line, ctx, ext, ['widget', 'state']);
            if (/\bfactory\s+\w+/.test(line)) this.upsertPattern('factory_constructor', line, ctx, ext, ['pattern']);
            if (/\bconst\s+\w+\s*=\s*\[/.test(line)) this.upsertPattern('const_list', line, ctx, ext, ['const']);

            // Error handling
            if (/\btry\s*\{/.test(line)) this.upsertPattern('try_block', line, ctx, ext, ['error-handling']);
            if (/\bcatch\s*\(/.test(line)) this.upsertPattern('catch_block', line, ctx, ext, ['error-handling']);
            if (/\bfinally\s*\{/.test(line)) this.upsertPattern('finally_block', line, ctx, ext, ['error-handling']);
            if (/\bthrow\s+\w/.test(line)) this.upsertPattern('throw_statement', line, ctx, ext, ['error-handling']);

            // Null safety
            if (/\?\./.test(line)) this.upsertPattern('null_aware_access', line, ctx, ext, ['null-safety']);
            if (/\?\?/.test(line)) this.upsertPattern('null_coalescing', line, ctx, ext, ['null-safety']);
            if (/!\./.test(line)) this.upsertPattern('non_null_assertion', line, ctx, ext, ['null-safety']);

            // Constructors
            if (/^\s*\w+\.\w+\s*\(/.test(line) && line.includes('this.')) this.upsertPattern('named_constructor', line, ctx, ext, ['oop', 'constructor']);

            // Extension methods
            if (/\bextension\s+\w+\s+on\s+\w+/.test(line)) this.upsertPattern('extension_method', line, ctx, ext, ['extension']);

            // Enums
            if (/\benum\s+\w+/.test(line)) this.upsertPattern('enum_definition', line, ctx, ext, ['enum']);

            // Mixins
            if (/\bmixin\s+\w+/.test(line)) this.upsertPattern('mixin_definition', line, ctx, ext, ['mixin']);
            if (/\bwith\s+\w+/.test(line)) this.upsertPattern('mixin_usage', line, ctx, ext, ['mixin']);
        }

        // Prune low-value patterns when we exceed the cap
        this.prunePatterns();

        // Rebuild clusters periodically (every ~50 document analyses)
        if (Math.random() < 0.02) await this.rebuildClusters();

        // Track best-practice adoption and Uganda/local-market signals across the whole file
        this.trackBestPractices(text);
        this.trackLocalMarketSignals(text);

        this.scheduleSave();
    }


    // ── Best-practice adoption tracking ───────────────────────────────────────

    /**
     * Scans the document text against known best-practice rules and updates
     * the adoption-rate ledger. Call this from analyzeDocument or on save.
     */
    trackBestPractices(text: string): void {
        for (const [practice, rule] of Object.entries(BEST_PRACTICE_CHECKS)) {
            const followedCount = (text.match(rule.followed) ?? []).length;
            const violatedCount = (text.match(rule.violated) ?? []).length;
            if (followedCount === 0 && violatedCount === 0) continue;

            const existing = this.bestPractices.get(practice);
            if (existing) {
                existing.timesFollowed += followedCount;
                existing.timesViolated += violatedCount;
                existing.lastSeen = new Date();
                const total = existing.timesFollowed + existing.timesViolated;
                existing.adoptionRate = total > 0 ? existing.timesFollowed / total : 0;
            } else {
                const total = followedCount + violatedCount;
                this.bestPractices.set(practice, {
                    practice,
                    timesFollowed: followedCount,
                    timesViolated: violatedCount,
                    lastSeen: new Date(),
                    adoptionRate: total > 0 ? followedCount / total : 0,
                });
            }
        }
    }

    /** Returns the adoption-rate ledger sorted by lowest adoption first (areas needing attention). */
    getBestPracticeReport(): BestPracticeAdoption[] {
        return Array.from(this.bestPractices.values())
            .sort((a, b) => a.adoptionRate - b.adoptionRate);
    }

    // ── Local market (Uganda) signal tracking ─────────────────────────────────

    /**
     * Detects Uganda/Flutter-specific market signals (Mobile Money, UGX, +256
     * phone numbers, offline-first patterns, localization) in the document text.
     */
    trackLocalMarketSignals(text: string): void {
        for (const [category, regex] of Object.entries(LOCAL_MARKET_PATTERNS) as [LocalMarketSignal['category'], RegExp][]) {
            const matches = text.match(regex);
            if (!matches) continue;

            const key = category;
            const existing = this.localMarketSignals.get(key);
            if (existing) {
                existing.frequency += matches.length;
                existing.lastUsed = new Date();
            } else {
                this.localMarketSignals.set(key, {
                    signal: matches[0],
                    category,
                    frequency: matches.length,
                    lastUsed: new Date(),
                });
            }
        }
    }





    // ── Clustering ────────────────────────────────────────────────────────────

    /**
     * Groups patterns into clusters via greedy token-overlap.
     * A lightweight substitute for k-means that runs in O(n²).
     */
    private async rebuildClusters(): Promise<void> {
        const entries = Array.from(this.patterns.values())
            .filter(p => p.frequency >= 2)
            .slice(0, 500); // cap for performance

        const clusters: PatternCluster[] = [];
        const assigned = new Set<string>();

        for (const entry of entries) {
            if (assigned.has(entry.pattern)) continue;

            const cluster: PatternCluster = {
                centroid: entry.pattern,
                members: [entry.pattern],
                label: Array.from(entry.tags)[0] ?? 'general',
            };
            assigned.add(entry.pattern);

            for (const other of entries) {
                if (assigned.has(other.pattern)) continue;
                if (this.tokenOverlap(entry.pattern, other.pattern) > 0.4) {
                    cluster.members.push(other.pattern);
                    assigned.add(other.pattern);
                }
            }

            clusters.push(cluster);
        }

        this.clusters = clusters;
    }


    private tokenOverlap(a: string, b: string): number {
        const sa = new Set(tokenize(a));
        const sb = new Set(tokenize(b));
        let common = 0;
        for (const t of sa) if (sb.has(t)) common++;
        return (2 * common) / (sa.size + sb.size || 1);
    }

    // ── Private learning helpers ──────────────────────────────────────────────

    private learnNamingConvention(text: string): void {
        const varPattern = /\b(?:var|final|const|late)\s+(?:\w+\s+)?([a-zA-Z_]\w*)\s*(?:=|;)/g;
        for (const match of text.matchAll(varPattern)) {
            const name = match[1];
            if (this.isCamelCase(name)) this.appendPref('naming', 'camelCase');
            else if (this.isSnakeCase(name)) this.appendPref('naming', 'snake_case');
            else if (this.isPascalCase(name)) this.appendPref('naming', 'PascalCase');
        }
    }


    private learnImportPattern(text: string): void {
        for (const match of text.matchAll(/import\s+['"]([^'"]+)['"]/g)) {
            this.appendPref('imports', match[1]);
        }
    }





    /**
     * Predict likely errors based on recent patterns and error history.
     * Returns list of (error_type, probability) pairs.
     */
    predictLikelyErrors(recentCode: string): Array<{ errorType: string; probability: number }> {
        const errorCounts: Record<string, number> = {};
        const totalErrors = this.fixHistory.length || 1;

        for (const fix of this.fixHistory) {
            errorCounts[fix.errorType] = (errorCounts[fix.errorType] ?? 0) + 1;
        }

        // Check which error types are related to patterns in recent code
        const relatedErrors: Record<string, number> = {};
        const codeTokens = tokenize(recentCode);

        for (const fix of this.fixHistory) {
            const fixTokens = tokenize(fix.error + ' ' + fix.fix);
            const overlap = codeTokens.filter(t => fixTokens.includes(t)).length;

            if (overlap > 0) {
                relatedErrors[fix.errorType] = (relatedErrors[fix.errorType] ?? 0) + overlap;
            }
        }

        // Combine base probabilities with code-specific signals
        const predictions: Array<{ errorType: string; probability: number }> = [];
        for (const [errorType, relatedCount] of Object.entries(relatedErrors)) {
            const baseProb = (errorCounts[errorType] ?? 0) / totalErrors;
            const relatedProb = relatedCount / totalErrors;
            const combined = (baseProb * 0.6 + relatedProb * 0.4);
            predictions.push({ errorType, probability: combined });
        }

        return predictions.sort((a, b) => b.probability - a.probability).slice(0, 5);
    }


    /**
     * Compute quality metrics for all patterns.
     * Helps identify which patterns are most valuable for learning.
     */
    getPatternMetrics(): PatternMetrics {
        const patterns = Array.from(this.patterns.values());
        const frequencies = patterns.map(p => p.frequency);

        const sorted = [...frequencies].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return {
            totalPatterns: patterns.length,
            avgFrequency: frequencies.length > 0 ? frequencies.reduce((a, b) => a + b, 0) / frequencies.length : 0,
            medianFrequency: median,
            patterns: this.patterns,
            anomalies: this.detectAnomalies()
        };
    }



    /**
     * Predict the most likely next pattern given the current line context.
     * Uses a simple bigram model built from co-occurring pattern types.
     */
    predictNextPattern(currentLine: string): string[] {
        const matchingTags = new Set<string>();

        for (const [, p] of this.patterns) {
            if (currentLine.includes(p.pattern.split(':')[1] ?? '')) {
                for (const t of p.tags) matchingTags.add(t);
            }
        }

        const candidates = Array.from(this.patterns.values())
            .filter(p => Array.from(p.tags).some(t => matchingTags.has(t)))
            .map(p => ({ pattern: p.pattern, score: decayedScore(p.frequency, p.lastUsed) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(x => x.pattern);

        return candidates;
    }


    async analyzePatterns(document: vscode.TextDocument) {
        try {
            const text = document.getText();
            const lines = text.split('\n');

            // Analyze class structures
            for (let i = 0; i < lines.length; i++) {
                try {
                    const line = lines[i];

                    const ext = document.fileName.split('.').pop() ?? 'unknown';

                    if (line.includes('class ')) {
                        this.recordPattern('class_structure', line, ext, this.getContext(lines, i));
                    }

                    if (line.includes('Future<')) {
                        this.recordPattern('async_pattern', line, ext, this.getContext(lines, i));
                    }

                    if (line.includes('setState(')) {
                        this.recordPattern('state_management', line, ext, this.getContext(lines, i));
                    }
                } catch (error) {
                    console.warn('Error analyzing line:', error);
                }
            }

            this.scheduleSave();
        } catch (error) {
            console.warn('Error in analyzePatterns:', error);
        }
    }

    recordFix(errors: any[], fixes: any[]) {
        try {
            for (let i = 0; i < errors.length && i < fixes.length; i++) {
                try {
                    this.fixHistory.push({
                        error: errors[i].message || 'unknown',
                        fix: fixes[i].newText || 'unknown',
                        timestamp: Date.now(),
                        errorType: errors[i].code || 'unknown',
                        vector: tokenize(errors[i].message || 'unknown').map((_, i) => i)
                    });
                } catch (error) {
                    console.warn('Error recording single fix:', error);
                }
            }

            // Keep only last 100 fixes
            if (this.fixHistory.length > 100) {
                this.fixHistory = this.fixHistory.slice(-100);
            }

            this.scheduleSave();
        } catch (error) {
            console.warn('Error in recordFix:', error);
        }
    }

    getSimilarFix(errorMessage: string): string | null {
        // Find similar errors in history, most recent first (without mutating the array)
        for (let i = this.fixHistory.length - 1; i >= 0; i--) {
            const history = this.fixHistory[i];
            if (this.calculateSimilarity(errorMessage, history.error) > 0.7) {
                return history.fix;
            }
        }
        return null;
    }

    getPreferredPattern(type: string, tag?: string, limit = 5): CodingPattern[] {
        return Array.from(this.patterns.values())
            .filter(p =>
                p.pattern.toLowerCase().includes(type.toLowerCase()) &&
                (!tag || p.tags.has(tag))
            )
            .map(p => ({ ...p, score: decayedScore(p.frequency, p.lastUsed) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    getCompletionSuggestions(prefix: string, fileType?: string, limit = 10): string[] {
        const suggestions: string[] = [];

        // Get patterns that match the prefix (and file type, if specified)
        for (const [key, pattern] of this.patterns) {
            if (!pattern.pattern.startsWith(prefix)) continue;
            if (fileType && !pattern.fileTypes.has(fileType)) continue;
            suggestions.push(pattern.pattern);
        }

        // Sort by frequency
        suggestions.sort((a, b) => {
            const freqA = this.patterns.get(a)?.frequency || 0;
            const freqB = this.patterns.get(b)?.frequency || 0;
            return freqB - freqA;
        });

        return suggestions.slice(0, limit);
    }

    private learnStructurePattern(text: string) {
        if (/\bextends\b/.test(text)) this.appendPref('structure', 'inheritance');
        if (/\bmixin\b/.test(text)) this.appendPref('structure', 'mixins');
        if (/\bfactory\b/.test(text)) this.appendPref('structure', 'factory_pattern');
        if (/\bimplements\b/.test(text)) this.appendPref('structure', 'interface');
        if (/\bwith\s+\w/.test(text)) this.appendPref('structure', 'mixin_application');
        if (/=>\s/.test(text)) this.appendPref('structure', 'arrow_function');
        if (/\basync\s*\*/.test(text)) this.appendPref('structure', 'async_generator');
    }

    private learnWidgetPattern(text: string, ext: string): void {
        if (ext !== 'dart') return;
        if (/\bColumn\s*\(/.test(text)) this.upsertPattern('widget_column', text, '', ext, ['widget', 'layout']);
        if (/\bRow\s*\(/.test(text)) this.upsertPattern('widget_row', text, '', ext, ['widget', 'layout']);
        if (/\bStack\s*\(/.test(text)) this.upsertPattern('widget_stack', text, '', ext, ['widget', 'layout']);
        if (/\bScaffold\s*\(/.test(text)) this.upsertPattern('widget_scaffold', text, '', ext, ['widget']);
    }

    private upsertPattern(type: string, pattern: string, context: string, fileType: string, tags: string[]): void {
        const key = `${type}:${pattern}`;

        if (this.patterns.has(key)) {
            const p = this.patterns.get(key)!;
            p.frequency++;
            p.lastUsed = new Date();
            p.score = decayedScore(p.frequency, p.lastUsed);
            p.fileTypes.add(fileType);
            for (const t of tags) p.tags.add(t);
        } else {
            this.patterns.set(key, {
                id: key,
                pattern,
                frequency: 1,
                context,
                lastUsed: new Date(),
                score: 1,
                fileTypes: new Set([fileType]),
                tags: new Set(tags),
            });
            this.session.patternsLearned++;
        }
    }


    /** Evict the lowest-scoring patterns when the map grows too large. */
    private prunePatterns(): void {
        if (this.patterns.size <= MAX_PATTERNS) return;

        const sorted = Array.from(this.patterns.entries())
            .map(([k, v]) => ({ k, score: decayedScore(v.frequency, v.lastUsed) }))
            .sort((a, b) => a.score - b.score);

        const toRemove = sorted.slice(0, this.patterns.size - MAX_PATTERNS);
        for (const { k } of toRemove) this.patterns.delete(k);
    }

    private appendPref<K extends keyof UserPreference>(key: K, value: string): void {
        (this.preferences[key] as string[]).push(value);
        if ((this.preferences[key] as string[]).length > MAX_PREF_ITEMS) {
            (this.preferences[key] as string[]).splice(0, 1);
        }
    }


    private recordPattern(type: string, pattern: string, fileType: string, context: string) {
        const key = `${type}:${pattern}`;

        if (this.patterns.has(key)) {
            const existing = this.patterns.get(key)!;
            existing.frequency++;
            existing.lastUsed = new Date();
            existing.fileTypes.add(fileType);
        } else {
            this.patterns.set(key, {
                id: key,
                pattern,
                frequency: 1,
                context,
                lastUsed: new Date(),
                score: 1,
                fileTypes: new Set([fileType]),
                tags: new Set,
            });
        }
    }

    /** Best-effort tag recovery for patterns whose tags were lost to a prior storage bug. */
    private _inferTagsFromKey(key: string): Set<string> {
        const type = key.split(':')[0] ?? '';
        const map: Record<string, string[]> = {
            class_structure: ['oop'],
            async_future: ['async'],
            stream_pattern: ['async', 'reactive'],
            stateful_widget: ['state', 'widget'],
            provider_pattern: ['state', 'di'],
            bloc_builder: ['state', 'bloc'],
            riverpod_pattern: ['state', 'riverpod'],
            stateless_widget: ['widget'],
            stateful_widget_def: ['widget', 'state'],
            factory_constructor: ['pattern'],
            const_list: ['const'],
            try_block: ['error-handling'],
            catch_block: ['error-handling'],
            finally_block: ['error-handling'],
            throw_statement: ['error-handling'],
            null_aware_access: ['null-safety'],
            null_coalescing: ['null-safety'],
            non_null_assertion: ['null-safety'],
            named_constructor: ['oop', 'constructor'],
            extension_method: ['extension'],
            enum_definition: ['enum'],
            mixin_definition: ['mixin'],
            mixin_usage: ['mixin'],
        };
        return new Set(map[type] ?? ['general']);
    }



    private getContext(lines: string[], index: number): string {
        return lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join('\n');
    }

    private isCamelCase(str: string): boolean {
        return /^[a-z][a-zA-Z0-9]*$/.test(str) && /[A-Z]/.test(str);
    }

    private isSnakeCase(str: string): boolean {
        return /^[a-z][a-z0-9_]*_[a-z0-9_]*$/.test(str);
    }
    private isPascalCase(str: string) { return /^[A-Z][a-zA-Z0-9]*$/.test(str); }

    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    getStatistics() {
        const totalPatterns = this.patterns.size;
        const mostUsedPatterns = Array.from(this.patterns.values())
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

        const namingStyle = this.getMostCommon(this.preferences.naming);
        const structureStyle = this.getMostCommon(this.preferences.structure);

        return {
            totalPatterns,
            mostUsedPatterns,
            preferredNaming: namingStyle,
            preferredStructure: structureStyle,
            totalFixes: this.fixHistory.length
        };
    }

    private getMostCommon(arr: string[]): string {
        const counts = new Map<string, number>();

        for (const item of arr) {
            counts.set(item, (counts.get(item) || 0) + 1);
        }

        let max = 0;
        let most = '';

        for (const [item, count] of counts) {
            if (count > max) {
                max = count;
                most = item;
            }
        }

        return most;
    }

    /**
   * Detect anomalous patterns that deviate from user's coding norms.
   * Uses statistical methods (z-score, isolation) to flag suspicious patterns.
   */
    detectAnomalies(): AnomalyScore[] {
        const allPatterns = Array.from(this.patterns.values());
        if (allPatterns.length < 5) return [];

        const frequencies = allPatterns.map(p => p.frequency);
        const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
        const variance = frequencies.reduce((a, b) => a + (b - mean) ** 2, 0) / frequencies.length;
        const stdDev = Math.sqrt(variance);

        const anomalies: AnomalyScore[] = [];

        for (const pattern of allPatterns) {
            // Z-score detection
            const zScore = (pattern.frequency - mean) / (stdDev + 1);

            // Recency anomaly: pattern used recently but low frequency
            const daysOld = (Date.now() - pattern.lastUsed.getTime()) / 86_400_000;
            const isRecent = daysOld < 1;
            const isRare = pattern.frequency < mean * 0.3;

            if (Math.abs(zScore) > 2) {
                anomalies.push({
                    pattern: pattern.pattern,
                    score: Math.abs(zScore),
                    isAnomaly: true,
                    reason: zScore > 2 ? 'unusually_frequent' : 'unusually_rare'
                });
            } else if (isRecent && isRare) {
                anomalies.push({
                    pattern: pattern.pattern,
                    score: 1.5,
                    isAnomaly: true,
                    reason: 'recent_but_rare'
                });
            }
        }

        return anomalies.sort((a, b) => b.score - a.score).slice(0, 10);
    }
}
