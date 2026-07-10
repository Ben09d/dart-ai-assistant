import * as vscode from 'vscode';
import { DartAnalyzer } from '../services/dartAnalyzer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorCategory =
    | 'missing_semicolon'
    | 'unmatched_brace'
    | 'null_safety'
    | 'async_issue'
    | 'return_type'
    | 'import_issue'
    | 'type_mismatch'
    | 'widget_lifecycle'
    | 'state_management'
    | 'security'
    | 'performance'
    | 'typo'
    | 'style'
    | 'index_access'
    | 'general';

export type Severity = 'error' | 'warning' | 'info';

export interface ErrorPrediction {
    id: string;                        // stable unique key
    category: ErrorCategory;
    line: number;
    column: number;
    endColumn?: number;
    severity: Severity;
    message: string;
    suggestion: string;
    quickFix?: string;
    documentationUrl?: string;
    confidence: number;                // 0.0–1.0
}

export interface ProblemArea {
    id: string;
    description: string;
    location: vscode.Range;
    severity: Severity;
    isPreventable: boolean;
    suggestion: string;
}

export interface PreventionStats {
    totalIssues: number;
    errors: number;
    warnings: number;
    infos: number;
    byCategory: Partial<Record<ErrorCategory, number>>;
    mostCommon?: ErrorCategory;
}

// ─── Rule Engine ──────────────────────────────────────────────────────────────

interface LineRule {
    id: string;
    category: ErrorCategory;
    pattern: RegExp;
    message: string;
    suggestion: string;
    severity: Severity;
    confidence: number;
    documentationUrl?: string;
    buildQuickFix?: (line: string, match: RegExpMatchArray) => string | undefined;
}

interface MultiLineRule {
    id: string;
    category: ErrorCategory;
    message: string;
    suggestion: string;
    severity: Severity;
    confidence: number;
    documentationUrl?: string;
    detect: (lines: string[], joined: string) => Array<{ line: number; column: number; endColumn?: number }>;
}

// ─── Line-level rules ─────────────────────────────────────────────────────────

const LINE_RULES: LineRule[] = [
    {
        id: 'missing-semicolon',
        category: 'missing_semicolon',
        pattern: /^\s*(?:var|final|const|int|String|double|bool|dynamic|List|Map|Set)\s+\w[\w<>, ]*\s*=\s*[^;{}\n]+[^;{}]$/,
        message: 'Missing semicolon at end of statement',
        suggestion: 'Add ; at the end of the line.',
        severity: 'error',
        confidence: 0.85,
        buildQuickFix: (line) => line.trimEnd() + ';',
    },

    {
        id: 'null-assigned-without-type',
        category: 'null_safety',
        pattern: /^\s*(?:var|dynamic)\s+\w+\s*=\s*null\s*;/,
        message: 'Variable assigned null without a nullable type annotation',
        suggestion: 'Use an explicit nullable type: e.g. String? name = null;',
        severity: 'warning',
        confidence: 0.9,
        documentationUrl: 'https://dart.dev/null-safety/understanding-null-safety',
    },

    {
        id: 'future-without-await',
        category: 'async_issue',
        pattern: /^\s*(?:final|var)\s+\w+\s*=\s*(?!await\s)\w+\(.*\)\s*;/,
        message: 'Result assigned without await — could be an unresolved Future',
        suggestion: 'Add await if the right-hand side returns a Future.',
        severity: 'warning',
        confidence: 0.65,
        documentationUrl: 'https://dart.dev/guides/libraries/async-await',
    },

    {
        id: 'bang-not-null-aware',
        category: 'null_safety',
        pattern: /[a-zA-Z0-9_)\]]\!\./,
        message: 'Non-null assertion (!) before property access — potential null crash',
        suggestion: 'Replace !. with ?. if the value may be null, or assert non-null with a guard.',
        severity: 'warning',
        confidence: 0.8,
        buildQuickFix: (line) => line.replace(/(\w)\!\./g, '$1?.'),
    },

    {
        id: 'bool-comparison-redundant',
        category: 'style',
        pattern: /\bif\s*\(\s*\w+\s*(?:==|!=)\s*(?:true|false)\s*\)/,
        message: 'Redundant boolean comparison',
        suggestion: 'Simplify: if (x == true) → if (x), if (x == false) → if (!x).',
        severity: 'info',
        confidence: 0.95,
        buildQuickFix: (line) =>
            line
                .replace(/if\s*\(\s*(\w+)\s*==\s*true\s*\)/g, 'if ($1)')
                .replace(/if\s*\(\s*(\w+)\s*==\s*false\s*\)/g, 'if (!$1)')
                .replace(/if\s*\(\s*(\w+)\s*!=\s*false\s*\)/g, 'if ($1)')
                .replace(/if\s*\(\s*(\w+)\s*!=\s*true\s*\)/g, 'if (!$1)'),
    },

    {
        id: 'typo-build',
        category: 'typo',
        pattern: /\bbild\s*\(/,
        message: 'Typo: "bild" should be "build"',
        suggestion: 'Rename bild to build.',
        severity: 'error',
        confidence: 0.99,
        buildQuickFix: (line) => line.replace(/\bbild\s*\(/, 'build('),
    },

    {
        id: 'typo-widget',
        category: 'typo',
        pattern: /\bWiget\b|\bWidgte\b|\bWidge\b/,
        message: 'Typo in "Widget"',
        suggestion: 'Correct to Widget.',
        severity: 'error',
        confidence: 0.99,
        buildQuickFix: (line) => line.replace(/\bWiget\b|\bWidgte\b|\bWidge\b/g, 'Widget'),
    },

    {
        id: 'print-in-code',
        category: 'style',
        pattern: /^\s*print\s*\(/,
        message: 'print() found — synchronous and visible in release builds',
        suggestion: 'Replace with debugPrint() or a structured logger (logger, talker).',
        severity: 'warning',
        confidence: 0.9,
        buildQuickFix: (line) => line.replace(/\bprint\s*\(/, 'debugPrint('),
    },

    {
        id: 'hardcoded-secret',
        category: 'security',
        pattern: /(?:apiKey|api_key|secret|password|token|auth_token)\s*=\s*['"`][A-Za-z0-9+/=_\-]{8,}/i,
        message: 'Possible hardcoded secret or API key',
        suggestion: 'Move secrets to --dart-define, a secure .env, or flutter_secure_storage.',
        severity: 'error',
        confidence: 0.75,
    },

    {
        id: 'missing-const-leaf-widget',
        category: 'performance',
        pattern: /^\s*(?:return\s+|child:\s+|children:\s+\[?\s*)(?!const\b)(Text|Icon|SizedBox|Padding|Divider)\s*\(/,
        message: 'Leaf widget could be const — unnecessary rebuilds may occur',
        suggestion: 'Add const before Text(), Icon(), SizedBox(), Padding(), Divider().',
        severity: 'info',
        confidence: 0.8,
        documentationUrl: 'https://docs.flutter.dev/perf/best-practices#control-build-cost',
        buildQuickFix: (line, _m) => line.replace(/(Text|Icon|SizedBox|Padding|Divider)\s*\(/, 'const $1('),
    },

    {
        id: 'sizedbox-over-container',
        category: 'performance',
        pattern: /Container\s*\(\s*(?:height|width)\s*:/,
        message: 'Container used only for sizing — SizedBox is lighter',
        suggestion: 'Replace Container(height/width: x) with SizedBox(height/width: x).',
        severity: 'info',
        confidence: 0.85,
        documentationUrl: 'https://dart-lang.github.io/linter/lints/sized_box_for_whitespace.html',
    },

    {
        id: 'new-keyword',
        category: 'style',
        pattern: /\bnew\s+[A-Z]/,
        message: 'new keyword is unnecessary in Dart 2+',
        suggestion: 'Remove new — use const or just the constructor call.',
        severity: 'info',
        confidence: 0.95,
        buildQuickFix: (line) => line.replace(/\bnew\s+/g, ''),
    },

    {
        id: 'as-cast-risk',
        category: 'null_safety',
        pattern: /\bas\s+[A-Z]\w+(?!\?)/,
        message: 'Unchecked as cast — throws if runtime type does not match',
        suggestion: 'Use "is" type check before casting, or cast to a nullable type first.',
        severity: 'warning',
        confidence: 0.7,
    },

    {
        id: 'string-interp-tostring',
        category: 'style',
        pattern: /\$\{?\w+\.toString\(\)\}?/,
        message: 'Unnecessary .toString() inside string interpolation',
        suggestion: 'String interpolation calls toString() automatically — remove the explicit call.',
        severity: 'info',
        confidence: 0.95,
        buildQuickFix: (line) => line.replace(/\$\{?(\w+)\.toString\(\)\}?/g, '$$$1'),
    },

    {
        id: 'try-no-catch',
        category: 'general',
        pattern: /\btry\s*\{/,
        message: 'try block without catch or finally — exceptions are silently lost',
        suggestion: 'Add a catch block. At minimum log and rethrow.',
        severity: 'error',
        confidence: 0.5,  // low because this is single-line; multi-line rule is more precise
    },

    {
        id: 'shared-prefs-sensitive',
        category: 'security',
        pattern: /SharedPreferences.*(?:token|password|secret|key)/i,
        message: 'Sensitive data written to SharedPreferences (plaintext storage)',
        suggestion: 'Use flutter_secure_storage backed by Android Keystore / iOS Keychain.',
        severity: 'error',
        confidence: 0.8,
        documentationUrl: 'https://pub.dev/packages/flutter_secure_storage',
    },
];

// ─── Multi-line rules ─────────────────────────────────────────────────────────

const MULTI_LINE_RULES: MultiLineRule[] = [
    {
        id: 'try-no-catch-multiline',
        category: 'general',
        message: 'try block with no catch or finally — exceptions silently swallowed',
        suggestion: 'Add a catch block. Log the error and rethrow if you cannot handle it.',
        severity: 'error',
        confidence: 0.9,
        detect(lines, joined) {
            const hits: Array<{ line: number; column: number }> = [];
            if (/\btry\s*\{/.test(joined) && !/\bcatch\s*\(/.test(joined) && !/\bfinally\s*\{/.test(joined)) {
                lines.forEach((l, i) => {
                    if (/\btry\s*\{/.test(l)) hits.push({ line: i, column: l.indexOf('try') });
                });
            }
            return hits;
        },
    },

    {
        id: 'setstate-after-await-no-mounted',
        category: 'state_management',
        message: 'setState() called after await without a mounted guard',
        suggestion: 'Wrap setState() in `if (mounted) { setState(() {...}); }` after any await.',
        severity: 'error',
        confidence: 0.85,
        documentationUrl: 'https://docs.flutter.dev/development/ui/interactive',
        detect(lines, joined) {
            const hits: Array<{ line: number; column: number }> = [];
            if (/\bawait\b/.test(joined) && /\bsetState\s*\(/.test(joined) && !/if\s*\(\s*mounted\s*\)/.test(joined)) {
                lines.forEach((l, i) => {
                    if (/\bsetState\s*\(/.test(l)) hits.push({ line: i, column: l.indexOf('setState') });
                });
            }
            return hits;
        },
    },

    {
        id: 'setstate-in-loop',
        category: 'state_management',
        message: 'setState() called inside a loop — causes N consecutive rebuilds',
        suggestion: 'Batch all mutations, then call setState() once after the loop.',
        severity: 'error',
        confidence: 0.88,
        detect(lines, joined) {
            const hits: Array<{ line: number; column: number }> = [];
            if (/\bfor\b[^{]*\{[^}]*\bsetState\s*\(/.test(joined)) {
                lines.forEach((l, i) => {
                    if (/\bsetState\s*\(/.test(l)) hits.push({ line: i, column: l.indexOf('setState') });
                });
            }
            return hits;
        },
    },

    {
        id: 'future-not-awaited-in-async',
        category: 'async_issue',
        message: 'Future returned from function call may not be awaited',
        suggestion: 'Use await, or explicitly discard with unawaited() from dart:async if intentional.',
        severity: 'warning',
        confidence: 0.7,
        documentationUrl: 'https://dart.dev/guides/libraries/async-await',
        detect(lines, joined) {
            const hits: Array<{ line: number; column: number }> = [];
            if (!/\basync\b/.test(joined)) return hits;
            lines.forEach((l, i) => {
                // A call statement (not assigned) that returns a Future — heuristic
                if (/^\s*[a-z]\w+\s*\([^)]*\)\s*;/.test(l) && !/\bawait\b/.test(l) && !/\/\//.test(l)) {
                    hits.push({ line: i, column: l.search(/\S/) });
                }
            });
            return hits.slice(0, 3); // cap noise
        },
    },

    {
        id: 'unbalanced-braces',
        category: 'unmatched_brace',
        message: 'Unbalanced braces in file',
        suggestion: 'Check that every { has a matching }.',
        severity: 'error',
        confidence: 0.95,
        detect(lines, joined) {
            const open = (joined.match(/\{/g) || []).length;
            const close = (joined.match(/\}/g) || []).length;
            if (open === close) return [];
            // Point to first unclosed brace
            let depth = 0, targetLine = 0, targetCol = 0;
            for (let i = 0; i < lines.length; i++) {
                for (let c = 0; c < lines[i].length; c++) {
                    if (lines[i][c] === '{') { depth++; targetLine = i; targetCol = c; }
                    if (lines[i][c] === '}') depth--;
                }
            }
            return depth !== 0 ? [{ line: targetLine, column: targetCol }] : [];
        },
    },

    {
        id: 'build-method-side-effects',
        category: 'widget_lifecycle',
        message: 'Side effects (print/debugPrint) inside build() — runs every frame',
        suggestion: 'Move logging or heavy work to initState(), didUpdateWidget(), or callbacks.',
        severity: 'warning',
        confidence: 0.8,
        documentationUrl: 'https://docs.flutter.dev/development/ui/widgets-intro',
        detect(lines, joined) {
            const hits: Array<{ line: number; column: number }> = [];
            if (!/Widget\s+build\s*\(/.test(joined)) return hits;
            let inBuild = false, depth = 0;
            for (let i = 0; i < lines.length; i++) {
                if (/Widget\s+build\s*\(/.test(lines[i])) { inBuild = true; depth = 0; }
                if (inBuild) {
                    depth += (lines[i].match(/\{/g) || []).length;
                    depth -= (lines[i].match(/\}/g) || []).length;
                    if (/\b(?:print|debugPrint)\s*\(/.test(lines[i])) {
                        hits.push({ line: i, column: lines[i].search(/\S/) });
                    }
                    if (depth <= 0 && i > 0) inBuild = false;
                }
            }
            return hits;
        },
    },

    {
        id: 'dispose-not-called',
        category: 'widget_lifecycle',
        message: 'StatefulWidget uses a controller but dispose() may not call .dispose()',
        suggestion: 'Override dispose() and call controller.dispose() to prevent memory leaks.',
        severity: 'warning',
        confidence: 0.75,
        documentationUrl: 'https://docs.flutter.dev/development/ui/interactive#managing-state',
        detect(lines, joined) {
            const hasController = /(?:AnimationController|TextEditingController|ScrollController|FocusNode)\s+\w+\s*=/.test(joined);
            const hasDispose = /void\s+dispose\s*\(\s*\)/.test(joined);
            if (hasController && !hasDispose) {
                const hit = lines.findIndex(l => /(?:AnimationController|TextEditingController|ScrollController|FocusNode)/.test(l));
                return hit >= 0 ? [{ line: hit, column: lines[hit].search(/\S/) }] : [];
            }
            return [];
        },
    },

    {
        id: 'dynamic-url-injection',
        category: 'security',
        message: 'Dynamic URL constructed via string interpolation — potential injection risk',
        suggestion: 'Validate user input before building URLs; whitelist allowed hosts.',
        severity: 'warning',
        confidence: 0.7,
        detect(lines, _joined) {
            return lines.reduce<Array<{ line: number; column: number }>>((acc, l, i) => {
                if (/Uri\.parse\s*\(.*\$/.test(l)) acc.push({ line: i, column: l.indexOf('Uri') });
                return acc;
            }, []);
        },
    },
];

// ─── ErrorPrevention ──────────────────────────────────────────────────────────

/**
 * Advanced real-time error prevention system for Dart/Flutter files.
 *
 * Improvements over v1:
 * - Declarative rule tables (LINE_RULES + MULTI_LINE_RULES) — add rules without touching logic.
 * - Multi-line / whole-file analysis: catches unbalanced braces, missing dispose(), etc.
 * - Stable IDs on every prediction — safe for deduplication and VS Code diagnostic caching.
 * - Confidence scores on every hit — lets the UI suppress noisy low-confidence rules.
 * - Brace balance checker, controller lifecycle, URL injection, and more Flutter-specific rules.
 * - registerLineRule() / registerMultiLineRule() for extension points at runtime.
 * - getPreventionStats() now includes per-category breakdown and most-common category.
 */
export class ErrorPrevention {
    private readonly lineRules: LineRule[] = [...LINE_RULES];
    private readonly multiLineRules: MultiLineRule[] = [...MULTI_LINE_RULES];

    constructor(private readonly dartAnalyzer: DartAnalyzer) { }

    // ── Public API ─────────────────────────────────────────────────────────────

    /** Add a custom single-line rule at runtime. */
    registerLineRule(rule: LineRule): void {
        if (!this.lineRules.some(r => r.id === rule.id)) {
            this.lineRules.push(rule);
        }
    }

    /** Add a custom multi-line rule at runtime. */
    registerMultiLineRule(rule: MultiLineRule): void {
        if (!this.multiLineRules.some(r => r.id === rule.id)) {
            this.multiLineRules.push(rule);
        }
    }

    /**
     * Full document analysis — runs line rules and multi-line rules,
     * returns deduplicated predictions sorted by severity then line number.
     */
    async analyzeForPrevention(document: vscode.TextDocument): Promise<ErrorPrediction[]> {
        const text = document.getText();
        const lines = text.split('\n');
        const joined = text;

        const predictions: ErrorPrediction[] = [
            ...this._runLineRules(lines),
            ...this._runMultiLineRules(lines, joined),
        ];

        return this._deduplicateAndSort(predictions);
    }

    /**
     * Returns only warnings and errors as ProblemArea objects,
     * with precise VS Code Range locations.
     */
    async getPreventableProblems(document: vscode.TextDocument): Promise<ProblemArea[]> {
        const predictions = await this.analyzeForPrevention(document);

        return predictions
            .filter(p => p.severity === 'error' || p.severity === 'warning')
            .map(p => ({
                id: p.id,
                description: p.message,
                location: new vscode.Range(
                    p.line,
                    p.column,
                    p.line,
                    p.endColumn ?? Math.min(p.column + 20, document.lineAt(p.line).text.length)
                ),
                severity: p.severity,
                isPreventable: true,
                suggestion: p.suggestion,
            }));
    }

    /**
     * Lightweight stat snapshot — does not allocate full prediction objects.
     */
    getPreventionStats(document: vscode.TextDocument): PreventionStats {
        const text = document.getText();
        const lines = text.split('\n');
        const joined = text;

        let errors = 0, warnings = 0, infos = 0;
        const byCategory: Partial<Record<ErrorCategory, number>> = {};

        const bump = (severity: Severity, category: ErrorCategory) => {
            if (severity === 'error') errors++;
            else if (severity === 'warning') warnings++;
            else infos++;
            byCategory[category] = (byCategory[category] ?? 0) + 1;
        };

        for (const line of lines) {
            for (const rule of this.lineRules) {
                if (rule.pattern.test(line)) bump(rule.severity, rule.category);
            }
        }

        for (const rule of this.multiLineRules) {
            const hits = rule.detect(lines, joined);
            for (const _hit of hits) bump(rule.severity, rule.category);
        }

        const mostCommon = (Object.entries(byCategory) as [ErrorCategory, number][])
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        return { totalIssues: errors + warnings + infos, errors, warnings, infos, byCategory, mostCommon };
    }

    /**
     * Filter predictions below a confidence threshold (default 0.6).
     * Useful for quieter UI modes.
     */
    filterByConfidence(predictions: ErrorPrediction[], threshold = 0.6): ErrorPrediction[] {
        return predictions.filter(p => p.confidence >= threshold);
    }

    // ── Private: runners ───────────────────────────────────────────────────────

    private _runLineRules(lines: string[]): ErrorPrediction[] {
        const results: ErrorPrediction[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('//')) continue; // skip comment lines

            for (const rule of this.lineRules) {
                const match = line.match(rule.pattern);
                if (!match) continue;

                const column = line.search(/\S/);
                results.push({
                    id: `${rule.id}:${i}`,
                    category: rule.category,
                    line: i,
                    column: column < 0 ? 0 : column,
                    endColumn: column + (match[0]?.length ?? 10),
                    severity: rule.severity,
                    message: rule.message,
                    suggestion: rule.suggestion,
                    quickFix: rule.buildQuickFix?.(line, match),
                    documentationUrl: rule.documentationUrl,
                    confidence: rule.confidence,
                });
            }
        }

        return results;
    }

    private _runMultiLineRules(lines: string[], joined: string): ErrorPrediction[] {
        const results: ErrorPrediction[] = [];

        for (const rule of this.multiLineRules) {
            let hits: Array<{ line: number; column: number; endColumn?: number }> = [];

            try {
                hits = rule.detect(lines, joined);
            } catch (err) {
                console.error(`[ErrorPrevention] Multi-line rule "${rule.id}" threw:`, err);
                continue;
            }

            for (const hit of hits) {
                results.push({
                    id: `${rule.id}:${hit.line}`,
                    category: rule.category,
                    line: hit.line,
                    column: hit.column,
                    endColumn: hit.endColumn,
                    severity: rule.severity,
                    message: rule.message,
                    suggestion: rule.suggestion,
                    documentationUrl: rule.documentationUrl,
                    confidence: rule.confidence,
                });
            }
        }

        return results;
    }

    // ── Private: deduplication + sort ─────────────────────────────────────────

    private _deduplicateAndSort(predictions: ErrorPrediction[]): ErrorPrediction[] {
        const seen = new Map<string, ErrorPrediction>();
        for (const p of predictions) {
            if (!seen.has(p.id)) seen.set(p.id, p);
        }

        const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
        return Array.from(seen.values()).sort(
            (a, b) => order[a.severity] - order[b.severity] || a.line - b.line
        );
    }
}