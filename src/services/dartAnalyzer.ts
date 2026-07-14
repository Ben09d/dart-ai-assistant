import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface DartError {
    id: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    message: string;
    severity: DiagnosticSeverity;
    code?: string;
    source: string;
    quickFix?: QuickFixSuggestion;
    documentationUrl?: string
}


export interface QuickFixSuggestion {
    title: string;
    kind: 'replace' | 'insert' | 'remove' | 'rename' | 'command';
    detail?: string;
}

export interface AnalysisResult {
    uri: string;
    errors: DartError[];
    analyzedAt: number;             // Date.now()
    durationMs: number;
    fromCache: boolean;
}

export interface AnalyzerOptions {
    /** Milliseconds to debounce repeated requests for the same file. Default: 600 */
    debounceMs?: number;
    /** Max age of a cached result before it is considered stale. Default: 8000 */
    cacheMaxAgeMs?: number;
    /** Whether to analyse dirty (unsaved) buffers using a temp file. Default: false */
    analyseDirtyBuffers?: boolean;
    /** Extra flags forwarded to `dart analyze`. */
    extraFlags?: string[];
}

class Debouncer {
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

    schedule(key: string, fn: () => void, delayMs: number): void {
        const existing = this.timers.get(key);
        if (existing) clearTimeout(existing);
        this.timers.set(key, setTimeout(() => { this.timers.delete(key); fn(); }, delayMs));
    }

    cancel(key: string): void {
        const t = this.timers.get(key);
        if (t) { clearTimeout(t); this.timers.delete(key); }
    }

    cancelAll(): void {
        for (const t of this.timers.values()) clearTimeout(t);
        this.timers.clear();
    }
}

// ─── Result cache ─────────────────────────────────────────────────────────────

interface CacheEntry {
    result: AnalysisResult;
    expiresAt: number;
}

class ResultCache {
    private readonly map = new Map<string, CacheEntry>();

    get(uri: string, maxAgeMs: number): AnalysisResult | undefined {
        const entry = this.map.get(uri);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) { this.map.delete(uri); return undefined; }
        return entry.result;
    }

    set(uri: string, result: AnalysisResult, maxAgeMs: number): void {
        this.map.set(uri, { result, expiresAt: Date.now() + maxAgeMs });
    }

    invalidate(uri: string): void { this.map.delete(uri); }
    clear(): void { this.map.clear(); }
}

// ─── Quick-fix database ───────────────────────────────────────────────────────

interface FixEntry {
    fix: QuickFixSuggestion;
    documentationUrl?: string;
}

const QUICK_FIX_DB: Record<string, FixEntry> = {
    // Dart core
    missing_return: {
        fix: { title: 'Add a return statement', kind: 'insert', detail: 'Insert return <value>; before the closing brace.' },
        documentationUrl: 'https://dart.dev/tools/diagnostic-messages#missing_return',
    },
    undefined_identifier: {
        fix: { title: 'Check import or variable name', kind: 'command', detail: 'Run "Dart: Add Import" or verify spelling.' },
        documentationUrl: 'https://dart.dev/tools/diagnostic-messages#undefined_identifier',
    },
    unused_import: {
        fix: { title: 'Remove unused import', kind: 'remove' },
        documentationUrl: 'https://dart.dev/tools/diagnostic-messages#unused_import',
    },
    unused_local_variable: {
        fix: { title: 'Prefix with _ to mark as intentionally unused', kind: 'rename', detail: 'Rename to _variableName.' },
        documentationUrl: 'https://dart.dev/tools/diagnostic-messages#unused_local_variable',
    },
    dead_code: {
        fix: { title: 'Remove unreachable code', kind: 'remove' },
        documentationUrl: 'https://dart.dev/tools/diagnostic-messages#dead_code',
    },
    invalid_assignment: {
        fix: { title: 'Fix type mismatch — cast or change declared type', kind: 'replace' },
        documentationUrl: 'https://dart.dev/tools/diagnostic-messages#invalid_assignment',
    },
    argument_type_not_assignable: {
        fix: { title: 'Cast argument to expected type', kind: 'replace' },
    },
    unnecessary_cast: {
        fix: { title: 'Remove redundant cast', kind: 'remove' },
    },
    unnecessary_null_check_in_equality_expression: {
        fix: { title: 'Simplify null check', kind: 'replace' },
    },
    unchecked_use_of_nullable_value: {
        fix: { title: 'Add null check (!) or use null-aware operator (?.)', kind: 'replace' },
        documentationUrl: 'https://dart.dev/null-safety',
    },
    nullable_type_in_catch_clause: {
        fix: { title: 'Remove ? from catch clause type — caught objects are never null', kind: 'replace' },
    },
    // Async
    missing_await: {
        fix: { title: 'Add await before the expression', kind: 'insert' },
        documentationUrl: 'https://dart.dev/guides/libraries/async-await',
    },
    unawaited_futures: {
        fix: { title: 'Add await, or wrap with unawaited() if intentional', kind: 'replace' },
    },
    // Flutter-specific
    use_build_context_synchronously: {
        fix: { title: 'Add mounted check before using BuildContext after await', kind: 'insert', detail: 'if (mounted) { ... }' },
        documentationUrl: 'https://docs.flutter.dev/development/ui/interactive',
    },
    prefer_const_constructors: {
        fix: { title: 'Add const keyword to constructor call', kind: 'insert' },
    },
    prefer_const_literals_to_create_immutables: {
        fix: { title: 'Add const to list/set/map literal', kind: 'insert' },
    },
    sized_box_for_whitespace: {
        fix: { title: 'Replace Container with SizedBox for whitespace', kind: 'replace' },
        documentationUrl: 'https://dart-lang.github.io/linter/lints/sized_box_for_whitespace.html',
    },
    avoid_print: {
        fix: { title: 'Replace print() with debugPrint()', kind: 'replace' },
        documentationUrl: 'https://dart-lang.github.io/linter/lints/avoid_print.html',
    },
    use_key_in_widget_constructors: {
        fix: { title: 'Add {super.key} to widget constructor', kind: 'insert' },
    },
    // Style
    prefer_single_quotes: {
        fix: { title: 'Convert double quotes to single quotes', kind: 'replace' },
    },
    unnecessary_string_interpolations: {
        fix: { title: 'Remove unnecessary string interpolation — use value directly', kind: 'replace' },
    },
    prefer_final_locals: {
        fix: { title: 'Change var to final', kind: 'replace' },
    },
    always_declare_return_types: {
        fix: { title: 'Add explicit return type to function', kind: 'insert' },
    },
    annotate_overrides: {
        fix: { title: "Add @override annotation", kind: 'insert' },
    },
    // Performance
    avoid_function_literals_in_foreach_calls: {
        fix: { title: 'Replace forEach with a for-in loop', kind: 'replace' },
    },
    // Security
    avoid_dynamic_calls: {
        fix: { title: 'Replace dynamic call with typed access or cast', kind: 'replace' },
    },
};

export class DartAnalyzer {

    private readonly cache = new ResultCache();
    private readonly debouncer = new Debouncer();
    private readonly inFlight = new Map<string, Promise<AnalysisResult>>();
    private readonly options: Required<AnalyzerOptions>;

    constructor(options: AnalyzerOptions = {}) {
        this.options = {
            debounceMs: options.debounceMs ?? 600,
            cacheMaxAgeMs: options.cacheMaxAgeMs ?? 8_000,
            analyseDirtyBuffers: options.analyseDirtyBuffers ?? false,
            extraFlags: options.extraFlags ?? [],
        };
    }

    async analyzeDocument(document: vscode.TextDocument): Promise<DartError[]> {
        const errors: DartError[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Common Dart error patterns
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            //Missing semicolons
            if (this.isMissingSemicolon(line, i, lines)) {
                errors.push({
                    id: `missing_semicolon:${i}`,
                    line: i,
                    column: line.length,
                    message: 'Missing semicolon',
                    severity: 'error',
                    source: 'dart_analyze'
                });
            }

            // Undefined variables
            const undefinedVars = this.findUndefinedVariables(line, i, lines);
            errors.push(...undefinedVars);

            // Type mismatches
            const typeMismatches = this.findTypeMismatches(line, i);
            errors.push(...typeMismatches);

            // Unused imports
            if (line.trim().startsWith('import ') && this.isUnusedImport(line, text)) {
                errors.push({
                    id: `unused_import:${i}`,
                    line: i,
                    column: 0,
                    message: 'Unused import',
                    severity: 'warning',
                    source: 'dart_analyze'
                });
            }

            // Missing return statements
            if (this.isMissingReturn(line, i, lines)) {
                errors.push({
                    id: `missing_return:${i}`,
                    line: i,
                    column: 0,
                    message: 'Missing return statement',
                    severity: 'error',
                    source: 'dart_analyze'
                });
            }

            // Deprecated API usage
            const deprecations = this.findDeprecatedUsage(line, i);
            errors.push(...deprecations);

            // Null safety issues
            const nullSafetyIssues = this.findNullSafetyIssues(line, i);
            errors.push(...nullSafetyIssues);
        }

        return errors;
    }
    private isMissingSemicolon(line: string, index: number, lines: string[]): boolean {
        const trimmed = line.trim();

        // Skip comments, empty lines, and control structures
        if (!trimmed ||
            trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            trimmed.endsWith('{') ||
            trimmed.endsWith('}') ||
            trimmed.endsWith(',') ||
            trimmed.endsWith('(') ||    // ← ADD: Skip opening parens
            trimmed.endsWith(')') ||    // ← ADD: Skip closing parens
            trimmed.startsWith('if ') ||   // ← ADD: Skip if/for/while
            trimmed.startsWith('for ') ||
            trimmed.startsWith('while ') ||
            trimmed.startsWith('class ') ||  // ← ADD: Skip class/function
            trimmed.startsWith('void ') ||
            trimmed.startsWith('Future') ||
            trimmed.includes(' => ')) {   // ← ADD: Skip lambda/arrow functions
            return false;
        }

        // Check for statements that should end with semicolon
        const requiresSemicolon = /^(var|final|const|return|throw|assert|continue|break|print|[a-zA-Z_]\w*\s*=)/.test(trimmed);

        if (requiresSemicolon && !trimmed.endsWith(';')) {
            // Check if it's a multi-line statement
            const nextLine = lines[index + 1]?.trim();
            if (!nextLine || nextLine.startsWith('.') || nextLine.startsWith('(') || nextLine.startsWith('[')) {
                return false;
            }
            return true;
        }

        return false;
    }

    private findUndefinedVariables(line: string, index: number, allLines: string[]): DartError[] {
        const errors: DartError[] = [];

        // Skip if line contains these (too complex to analyze)
        if (line.includes('.') ||              // ← Skip dot notation (properties)
            line.includes('(') ||              // ← Skip function calls
            line.includes('[') ||              // ← Skip indexing
            line.startsWith('//')) {           // ← Skip comments
            return errors;
        }

        // Only check simple assignments: var x = y;
        const variablePattern = /\b([a-z_][a-zA-Z0-9_]*)\b/g;
        const matches = line.matchAll(variablePattern);

        for (const match of matches) {
            const varName = match[1];

            // Skip common Dart built-ins
            const builtIns = ['print', 'assert', 'throw', 'return', 'var', 'final', 'const', 'int', 'String', 'bool', 'List', 'Map', 'dynamic'];
            if (builtIns.includes(varName) || this.isDartKeyword(varName)) {
                continue;
            }

            // Skip if defined in this file
            if (this.isVariableDefined(varName, index, allLines)) {
                continue;
            }

            // Only report if looks like simple variable (conservative)
            const beforeMatch = line.substring(0, match.index || 0);
            if (!beforeMatch.includes('.') && !beforeMatch.includes('(')) {
                errors.push({
                    id: `undefined_variable:${index}:${match.index || 0}`,
                    line: index,
                    column: match.index || 0,
                    message: `Undefined name '${varName}'`,
                    severity: 'warning',  // ← Changed to WARNING (less aggressive)
                    source: 'dart_analyze'
                });
            }
        }

        return errors;
    }
    private findTypeMismatches(line: string, index: number): DartError[] {
        const errors: DartError[] = [];

        const trimmed = line.trim();

        // Skip comments, strings, and complex lines
        if (trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            trimmed.includes('as ') ||           // ← Skip type casts
            trimmed.includes('is ') ||           // ← Skip type checks
            line.includes('toString()') ||       // ← Skip conversions
            line.includes('toInt()') ||
            line.includes('int.parse') ||
            line.includes('String.from')) {
            return errors;
        }

        // Only check VERY obvious cases (conservative)
        const stringToInt = /int\s+\w+\s*=\s*"[^"]*"\s*;/.test(trimmed);
        const intToString = /String\s+\w+\s*=\s*\d+\s*;/.test(trimmed);

        if (stringToInt) {
            errors.push({
                id: `type_mismatch:${index}:0`,
                line: index,
                column: 0,
                message: 'Type mismatch: Cannot assign String to int',
                severity: 'warning',  // ← Changed to WARNING
                source: 'dart_analyze'
            });
        }

        if (intToString) {
            errors.push({
                id: `type_mismatch:${index}:0`,
                line: index,
                column: 0,
                message: 'Type mismatch: Cannot assign int to String',
                severity: 'warning',  // ← Changed to WARNING
                source: 'dart_analyze'
            });
        }

        return errors;
    }
    private isUnusedImport(importLine: string, fullText: string): boolean {
        const match = importLine.match(/import\s+['"](.+)['"];?/);
        if (!match) return false;

        const importPath = match[1];
        const packageName = importPath.split('/').pop()?.replace('.dart', '');

        if (!packageName) return false;

        // Simple check: if package name doesn't appear elsewhere in text
        const occurrences = (fullText.match(new RegExp(packageName, 'g')) || []).length;
        return occurrences <= 1; // Only in the import statement itself
    }

    private isMissingReturn(line: string, index: number, lines: string[]): boolean {
        const trimmed = line.trim();

        // Check if this is a function declaration with return type
        const functionMatch = trimmed.match(/(\w+)\s+(\w+)\s*\([^)]*\)\s*{/);
        if (!functionMatch) return false;

        const returnType = functionMatch[1];
        if (returnType === 'void' || returnType === 'Future') return false;

        // Check if function has a return statement
        let braceCount = 1;
        for (let i = index + 1; i < lines.length && braceCount > 0; i++) {
            const funcLine = lines[i];
            braceCount += (funcLine.match(/{/g) || []).length;
            braceCount -= (funcLine.match(/}/g) || []).length;

            if (funcLine.includes('return ')) {
                return false;
            }
        }

        return true;
    }

    private findDeprecatedUsage(line: string, index: number): DartError[] {
        const errors: DartError[] = [];

        // Common deprecated Dart APIs
        const deprecated = [
            { old: 'WhereType', new: 'whereType', message: 'Use lowercase whereType instead' },
            { old: 'IterableMixin', new: 'Iterable', message: 'IterableMixin is deprecated' }
        ];

        for (const item of deprecated) {
            if (line.includes(item.old)) {
                errors.push({
                    id: `deprecated_api:${index}:${line.indexOf(item.old)}`,
                    line: index,
                    column: line.indexOf(item.old),
                    message: `Deprecated: ${item.message}`,
                    severity: 'warning',
                    source: 'dart_analyze'
                });
            }
        }

        return errors;
    }

    private findNullSafetyIssues(line: string, index: number): DartError[] {
        const errors: DartError[] = [];

        const trimmed = line.trim();

        // Skip comments and safe lines
        if (trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            line.includes('?.') ||        // ← Already using null-aware
            line.includes('!') ||          // ← Already using non-null assertion
            line.includes('final ') ||     // ← final fields are safe
            line.includes('const ')) {     // ← const fields are safe
            return errors;
        }

        // ONLY check obvious null dereference in function parameters
        // Skip normal property access (user.name, list.length, etc are usually safe)
        if (line.includes('?.') || !line.includes('.')) {
            return errors;
        }

        // Only flag if it LOOKS like an unsafe operation (very conservative)
        // Most dot notation is safe, so we skip this entirely
        // This was creating too many false positives

        // Check ONLY for explicit non-nullable type without initializer
        // Example: "int count;" (no = value)
        if (/^\s*(int|String|bool|double)\s+\w+\s*;/.test(trimmed) && !line.includes('=') && !line.includes('?')) {
            errors.push({
                id: `non_nullable_field:${index}:0`,
                line: index,
                column: 0,
                message: 'Non-nullable field should be initialized',
                severity: 'warning',  // ← Changed to WARNING
                source: 'dart_analyze'
            });
        }

        return errors;
    }
    private isDartKeyword(word: string): boolean {
        const keywords = [
            'abstract', 'as', 'assert', 'async', 'await', 'break', 'case', 'catch',
            'class', 'const', 'continue', 'default', 'do', 'else', 'enum', 'export',
            'extends', 'final', 'finally', 'for', 'if', 'import', 'in', 'is', 'library',
            'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'false',
            'try', 'var', 'void', 'while', 'with', 'yield'
        ];
        return keywords.includes(word);
    }

    private isVariableDefined(varName: string, currentLine: number, lines: string[]): boolean {
        // Check previous lines for variable declaration
        for (let i = 0; i < currentLine; i++) {
            const line = lines[i];

            // Check for various declaration patterns
            if (new RegExp(`\\b(var|final|const|int|String|double|bool|List|Map)\\s+${varName}\\b`).test(line) ||
                new RegExp(`\\b${varName}\\s*=`).test(line) ||
                new RegExp(`\\bfor\\s*\\(.*\\b${varName}\\b`).test(line) ||
                new RegExp(`\\bcatch\\s*\\(.*\\b${varName}\\b`).test(line) ||
                new RegExp(`\\(.*\\b${varName}\\b.*\\)\\s*{`).test(line)) {
                return true;
            }
        }

        return false;
    }



    /** Produce a generic fix hint from the error message when no DB entry exists. */
    private _inferGenericFix(error: DartError): QuickFixSuggestion | null {
        const msg = error.message.toLowerCase();
        if (msg.includes('import')) return { title: 'Review or remove import', kind: 'command' };
        if (msg.includes('undefined')) return { title: 'Check identifier or add import', kind: 'command' };
        if (msg.includes('null')) return { title: 'Add null check or ?. operator', kind: 'replace' };
        if (msg.includes('await')) return { title: 'Add await keyword', kind: 'insert' };
        if (msg.includes('return')) return { title: 'Add return statement', kind: 'insert' };
        if (msg.includes('type')) return { title: 'Review type annotation or cast', kind: 'replace' };
        return null;
    }


    // ── Public API ─────────────────────────────────────────────────────────────



    /**
     * Schedule a debounced analysis — useful in onDidChangeTextDocument handlers.
     * Calls back with results once the quiet period elapses.
     */
    scheduleAnalysis(
        document: vscode.TextDocument,
        callback: (errors: DartError[]) => void
    ): void {
        if (document.languageId !== 'dart') return;
        const uri = document.uri.toString();
        this.debouncer.schedule(uri, async () => {
            const errors = await this.analyzeDocument(document);
            callback(errors);
        }, this.options.debounceMs);
    }

    /**
     * Analyse every Dart file currently open in the workspace.
     * Returns a map of file URI → errors.
     */
    async analyzeWorkspace(): Promise<Map<string, DartError[]>> {
        const dartFiles = await vscode.workspace.findFiles('**/*.dart', '**/build/**');
        const results = new Map<string, DartError[]>();

        await Promise.allSettled(
            dartFiles.map(async (uri) => {
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const errors = await this.analyzeDocument(doc);
                    results.set(uri.toString(), errors);
                } catch {
                    // individual file failures don't abort the batch
                }
            })
        );

        return results;
    }

    /**
     * Run `dart fix --apply` on a file, then invalidate its cache entry.
     */
    async applyDartFix(document: vscode.TextDocument): Promise<void> {
        if (document.languageId !== 'dart') return;
        const dartBin = this._dartBin();
        const workspaceRoot = this._workspaceRoot();

        return new Promise((resolve, reject) => {
            cp.exec(
                `"${dartBin}" fix --apply "${document.fileName}"`,
                { cwd: workspaceRoot },
                (err) => {
                    this.cache.invalidate(document.uri.toString());
                    err ? reject(err) : resolve();
                }
            );
        });
    }

    /** Force-invalidate the cache for a specific file. */
    invalidateCache(uri: string): void {
        this.cache.invalidate(uri);
    }

    /** Clear the entire result cache. */
    clearCache(): void {
        this.cache.clear();
    }

    /** Get a quick-fix suggestion for a given error code. */
    getQuickFix(error: DartError): QuickFixSuggestion | null {
        const entry = error.code ? QUICK_FIX_DB[error.code] : undefined;
        return entry?.fix ?? this._inferGenericFix(error) ?? null;
    }

    /** Get the documentation URL for a given error code. */
    getDocumentationUrl(code: string): string | undefined {
        return QUICK_FIX_DB[code]?.documentationUrl;
    }

    /**
     * Convert DartErrors to VS Code Diagnostics for use with
     * vscode.languages.createDiagnosticCollection().
     */
    toDiagnostics(errors: DartError[]): vscode.Diagnostic[] {
        return errors.map(e => {
            const start = new vscode.Position(e.line, e.column);
            const end = new vscode.Position(e.endLine ?? e.line, e.endColumn ?? e.column + 1);
            const diag = new vscode.Diagnostic(
                new vscode.Range(start, end),
                e.message,
                this._vscodeSeverity(e.severity)
            );
            diag.source = e.source;
            diag.code = e.documentationUrl
                ? { value: e.code ?? e.documentationUrl, target: vscode.Uri.parse(e.documentationUrl) }
                : e.code;
            return diag;
        });
    }

    dispose(): void {
        this.debouncer.cancelAll();
        this.cache.clear();
        this.inFlight.clear();
    }

    // ── Private ────────────────────────────────────────────────────────────────

    /** Run analysis or join an already-in-flight request for the same file. */
    private _runOrJoin(uri: string, filePath: string): Promise<AnalysisResult> {
        const existing = this.inFlight.get(uri);
        if (existing) return existing;

        const promise = this._runAnalysis(uri, filePath).finally(() => {
            this.inFlight.delete(uri);
        });

        this.inFlight.set(uri, promise);
        return promise;
    }

    private _runAnalysis(uri: string, filePath: string): Promise<AnalysisResult> {
        return new Promise((resolve) => {
            const dartBin = this._dartBin();
            const workspaceRoot = this._workspaceRoot();
            const extraFlags = this.options.extraFlags.join(' ');
            const startMs = Date.now();

            cp.exec(
                `"${dartBin}" analyze "${filePath}" --format=json ${extraFlags}`.trim(),
                { cwd: workspaceRoot, maxBuffer: 4 * 1024 * 1024 },
                (_err, stdout) => {
                    const durationMs = Date.now() - startMs;

                    if (!stdout?.trim()) {
                        const empty = this._makeResult(uri, [], durationMs, false);
                        this.cache.set(uri, empty, this.options.cacheMaxAgeMs);
                        return resolve(empty);
                    }

                    try {
                        const json = JSON.parse(stdout);
                        const errors = (json.diagnostics ?? []).map((d: any) =>
                            this._mapDiagnostic(d)
                        );
                        const deduped = this._deduplicate(errors);
                        const result = this._makeResult(uri, deduped, durationMs, false);
                        this.cache.set(uri, result, this.options.cacheMaxAgeMs);
                        resolve(result);
                    } catch {
                        // Never surface false positives on malformed output
                        const empty = this._makeResult(uri, [], durationMs, false);
                        resolve(empty);
                    }
                }
            );
        });
    }

    private _mapDiagnostic(d: any): DartError {
        const startLine = Math.max(0, (d.location?.range?.start?.line ?? 1) - 1);
        const startCol = Math.max(0, (d.location?.range?.start?.column ?? 1) - 1);
        const endLine = Math.max(0, (d.location?.range?.end?.line ?? 1) - 1);
        const endCol = Math.max(0, (d.location?.range?.end?.column ?? 1) - 1);
        const code = (d.code ?? '').toString();
        const severity = this._mapSeverity(d.severity);
        const message = d.message ?? 'Unknown diagnostic';
        const id = this._errorId(code, startLine, startCol);
        const fixEntry = QUICK_FIX_DB[code];

        return {
            id,
            line: startLine,
            column: startCol,
            endLine: endLine !== startLine ? endLine : undefined,
            endColumn: endCol !== startCol ? endCol : undefined,
            message,
            severity,
            code,
            source: 'dart_analyze',
            quickFix: fixEntry?.fix,
            documentationUrl: fixEntry?.documentationUrl
                ?? (code ? `https://dart.dev/tools/diagnostic-messages#${code}` : undefined),
        };
    }

    private _mapSeverity(raw: string): DiagnosticSeverity {
        switch ((raw ?? '').toUpperCase()) {
            case 'ERROR': return 'error';
            case 'WARNING': return 'warning';
            case 'HINT': return 'hint';
            default: return 'info';
        }
    }

    private _vscodeSeverity(s: DiagnosticSeverity): vscode.DiagnosticSeverity {
        switch (s) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'hint': return vscode.DiagnosticSeverity.Hint;
            default: return vscode.DiagnosticSeverity.Information;
        }
    }

    private _deduplicate(errors: DartError[]): DartError[] {
        const seen = new Map<string, DartError>();
        for (const e of errors) {
            if (!seen.has(e.id)) seen.set(e.id, e);
        }
        return Array.from(seen.values());
    }

    private _errorId(code: string, line: number, col: number): string {
        return `${code}:${line}:${col}`;
    }

    private _makeResult(
        uri: string,
        errors: DartError[],
        durationMs: number,
        fromCache: boolean
    ): AnalysisResult {
        return { uri, errors, analyzedAt: Date.now(), durationMs, fromCache };
    }

    /** Resolve the Dart SDK binary path, respecting dart.sdkPath setting. */
    private _dartBin(): string {
        const sdkPath = vscode.workspace
            .getConfiguration('dart')
            .get<string>('sdkPath');
        return sdkPath ? path.join(sdkPath, 'bin', 'dart') : 'dart';
    }

    private _workspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }



}
