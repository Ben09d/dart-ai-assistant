import * as vscode from 'vscode';
import { LearningEngine } from '../services/learningEngine';
import { AdvancedLearningEngine } from '../services/advancedLearningEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationType =
    | 'pattern'
    | 'refactor'
    | 'performance'
    | 'style'
    | 'security'
    | 'nullSafety'
    | 'stateManagement'
    | 'widgetBestPractice'
    | 'asyncPattern';

export type Severity = 'info' | 'warning' | 'error';

export interface PatternPrediction {
    pattern: string;
    confidence: number;       // 0.0–1.0
    context: string;
    alternatives: string[];
    reasoning?: string;        // why this pattern was predicted
}

export interface CodeRecommendation {
    id: string;                // unique stable key
    type: RecommendationType;
    title: string;
    description: string;
    severity: Severity;
    suggestion: string;
    quickFix?: string;
    documentationUrl?: string;
    affectedLines?: number[];
    tags: string[];
}

export interface CodeHealthReport {
    score: number;             // 0–100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    breakdown: {
        errors: number;
        warnings: number;
        infos: number;
    };
    topIssues: CodeRecommendation[];
    summary: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DART_DOCS_BASE = 'https://dart.dev/guides';
const FLUTTER_DOCS_BASE = 'https://docs.flutter.dev';

const SEVERITY_WEIGHT: Record<Severity, number> = {
    error: 15,
    warning: 5,
    info: 1,
};

const GRADE_THRESHOLDS: [number, CodeHealthReport['grade']][] = [
    [90, 'A'],
    [75, 'B'],
    [60, 'C'],
    [45, 'D'],
    [0, 'F'],
];

// ─── Analyser Interface ───────────────────────────────────────────────────────

interface CodeAnalyser {
    readonly id: string;
    analyse(lines: string[], joined: string): CodeRecommendation[];
}

// ─── Analyser Implementations ─────────────────────────────────────────────────

class AsyncPatternAnalyser implements CodeAnalyser {
    readonly id = 'asyncPattern';

    analyse(_lines: string[], joined: string): CodeRecommendation[] {
        const recs: CodeRecommendation[] = [];

        if (joined.includes('Future') && joined.includes('.then(') && !joined.includes('async')) {
            recs.push({
                id: 'async-prefer-await',
                type: 'asyncPattern',
                title: 'Prefer async/await over .then()',
                description:
                    'Chaining .then() deeply hurts readability. async/await produces equivalent code that is easier to follow and debug.',
                severity: 'warning',
                suggestion: 'Mark the function async and replace .then()/.catchError() with await / try-catch.',
                quickFix: 'Convert Future.then() chain to async/await',
                documentationUrl: `${DART_DOCS_BASE}/libraries/async/async-await`,
                tags: ['async', 'readability'],
            });
        }

        if (/Future\.wait\(\s*\[/.test(joined) && !/await\s+Future\.wait/.test(joined)) {
            recs.push({
                id: 'async-await-future-wait',
                type: 'asyncPattern',
                title: 'Await Future.wait()',
                description: 'Future.wait() returns a Future — ensure you await it so results are captured.',
                severity: 'error',
                suggestion: 'Add await before Future.wait([...]).',
                tags: ['async', 'correctness'],
            });
        }

        if (/catchError\s*\(/.test(joined)) {
            recs.push({
                id: 'async-use-try-catch',
                type: 'asyncPattern',
                title: 'Replace catchError with try-catch',
                description:
                    '.catchError() is error-prone — it requires the callback to match the exact return type. try-catch is safer and clearer.',
                severity: 'warning',
                suggestion: 'Wrap await calls in try-catch instead of chaining .catchError().',
                documentationUrl: `${DART_DOCS_BASE}/libraries/async/async-await#handling-errors`,
                tags: ['async', 'error-handling'],
            });
        }

        return recs;
    }
}

class NullSafetyAnalyser implements CodeAnalyser {
    readonly id = 'nullSafety';

    analyse(lines: string[], joined: string): CodeRecommendation[] {
        const recs: CodeRecommendation[] = [];

        // Overuse of bang operator
        const bangCount = (joined.match(/[a-zA-Z0-9_)\]]\!/g) || []).length;
        if (bangCount > 3) {
            recs.push({
                id: 'null-excessive-bang',
                type: 'nullSafety',
                title: 'Excessive use of the ! (bang) operator',
                description: `Found ${bangCount} non-null assertions. Each one is a potential null-pointer crash at runtime.`,
                severity: 'warning',
                suggestion: 'Use ?. (null-aware access), ?? (null coalescing), or proper null checks instead of !.',
                documentationUrl: `${DART_DOCS_BASE}/null-safety/understanding-null-safety`,
                tags: ['null-safety', 'crash-risk'],
            });
        }

        // late without initializer in a non-trivial context
        if (/\blate\b/.test(joined) && !/\blate final\b/.test(joined)) {
            recs.push({
                id: 'null-late-not-final',
                type: 'nullSafety',
                title: 'Prefer late final over late var',
                description:
                    'late var can be reassigned, defeating the purpose. late final makes intent explicit and prevents accidental mutation.',
                severity: 'info',
                suggestion: 'Change late declarations to late final where the value is set once.',
                tags: ['null-safety', 'immutability'],
            });
        }

        // Dynamic type usage
        const dynamicCount = (joined.match(/\bdynamic\b/g) || []).length;
        if (dynamicCount > 2) {
            recs.push({
                id: 'null-dynamic-overuse',
                type: 'nullSafety',
                title: `Overuse of dynamic (${dynamicCount} occurrences)`,
                description:
                    'dynamic opts out of type checking entirely. Prefer specific types or generics to keep compiler guarantees.',
                severity: 'warning',
                suggestion: 'Replace dynamic with the most specific type available, or use Object? when truly needed.',
                tags: ['null-safety', 'type-safety'],
            });
        }

        return recs;
    }
}

class PerformanceAnalyser implements CodeAnalyser {
    readonly id = 'performance';

    analyse(lines: string[], joined: string): CodeRecommendation[] {
        const recs: CodeRecommendation[] = [];

        // Nested loops
        if (/for\s*[\w(<(]*[^)]*\)\s*\{[^}]*for\s*[\w(<(]/.test(joined)) {
            recs.push({
                id: 'perf-nested-loops',
                type: 'performance',
                title: 'Nested loops — potential O(n²) complexity',
                description: 'Nested iteration can degrade quickly on larger datasets common in mobile apps.',
                severity: 'warning',
                suggestion: 'Consider using a Map or Set for O(1) lookup, or restructure the algorithm.',
                tags: ['performance', 'complexity'],
            });
        }

        // String concatenation in loop
        if (/for\s*\([^)]*\)\s*\{[^}]*\+=\s*['"`]/m.test(joined)) {
            recs.push({
                id: 'perf-string-concat-loop',
                type: 'performance',
                title: 'String concatenation inside a loop',
                description: 'String += inside a loop creates a new object each iteration.',
                severity: 'warning',
                suggestion: 'Use StringBuffer and call .toString() once after the loop.',
                quickFix: 'Wrap with StringBuffer',
                tags: ['performance', 'strings'],
            });
        }

        // Repeated .length accesses
        const lengthMatches = joined.match(/\.length/g) || [];
        if (lengthMatches.length > 6) {
            recs.push({
                id: 'perf-cached-length',
                type: 'performance',
                title: `${lengthMatches.length} .length calls — consider caching`,
                description:
                    'While Dart list .length is O(1), repeatedly accessing it in hot paths adds minor overhead and reduces readability.',
                severity: 'info',
                suggestion: 'Cache the length in a final variable when used multiple times in the same scope.',
                tags: ['performance', 'micro-optimisation'],
            });
        }

        // setState called with heavy computation
        const setStateLines = lines.filter(l => /setState\s*\(/.test(l));
        for (const line of setStateLines) {
            if (/setState\s*\(\s*\(\)\s*\{[^}]{60,}/.test(line)) {
                recs.push({
                    id: 'perf-heavy-setstate',
                    type: 'performance',
                    title: 'Heavy computation inside setState()',
                    description: 'setState() should only assign new values. Heavy work inside it blocks the UI thread.',
                    severity: 'warning',
                    suggestion: 'Move expensive computation outside setState() and only assign the result inside.',
                    documentationUrl: `${FLUTTER_DOCS_BASE}/development/ui/interactive#managing-state`,
                    tags: ['performance', 'flutter', 'ui'],
                });
                break; // report once
            }
        }

        // Avoid rebuilding const widgets
        if (/new\s+(Text|Icon|Padding|SizedBox|Container)\s*\(/.test(joined)) {
            recs.push({
                id: 'perf-new-keyword',
                type: 'performance',
                title: 'Unnecessary new keyword on widgets',
                description:
                    'Using new prevents the compiler from applying const optimisations. Prefer const constructors where possible.',
                severity: 'info',
                suggestion: 'Remove new and add const where the constructor supports it.',
                tags: ['performance', 'flutter', 'const'],
            });
        }

        return recs;
    }
}

class WidgetBestPracticeAnalyser implements CodeAnalyser {
    readonly id = 'widgetBestPractice';

    analyse(lines: string[], joined: string): CodeRecommendation[] {
        const recs: CodeRecommendation[] = [];

        // build() method with side effects
        if (
            /Widget\s+build\s*\(/.test(joined) &&
            (/print\s*\(/.test(joined) || /debugPrint\s*\(/.test(joined))
        ) {
            recs.push({
                id: 'widget-build-side-effects',
                type: 'widgetBestPractice',
                title: 'Side effects inside build()',
                description:
                    'build() can be called many times per second. Logging or heavy work inside it degrades performance.',
                severity: 'warning',
                suggestion: 'Move side effects to initState(), didUpdateWidget(), or lifecycle-aware callbacks.',
                documentationUrl: `${FLUTTER_DOCS_BASE}/development/ui/widgets-intro`,
                tags: ['flutter', 'widget', 'lifecycle'],
            });
        }

        // Missing const on leaf widgets
        const nonConstWidgets = lines.filter(l =>
            /^\s*(Text|Icon|SizedBox|Padding)\s*\(/.test(l) && !/\bconst\b/.test(l)
        );
        if (nonConstWidgets.length > 2) {
            recs.push({
                id: 'widget-missing-const',
                type: 'widgetBestPractice',
                title: `${nonConstWidgets.length} widgets could be const`,
                description:
                    'const widgets are cached and never rebuilt unless their parameters change, which reduces jank.',
                severity: 'info',
                suggestion: 'Add const before Text(), Icon(), SizedBox(), Padding() where arguments are compile-time constants.',
                tags: ['flutter', 'widget', 'const', 'performance'],
            });
        }

        // Prefer SizedBox over Container for whitespace
        const containerWhitespace = lines.filter(l =>
            /Container\s*\(\s*\n?\s*(height|width)\s*:/.test(l)
        );
        if (containerWhitespace.length > 0) {
            recs.push({
                id: 'widget-sizedbox-over-container',
                type: 'widgetBestPractice',
                title: 'Use SizedBox instead of Container for spacing',
                description:
                    'Container with only height/width is heavier than SizedBox. The Flutter linter flags this by default.',
                severity: 'info',
                suggestion: 'Replace Container(height: x) / Container(width: x) with SizedBox(height: x) / SizedBox(width: x).',
                tags: ['flutter', 'widget', 'lint'],
            });
        }

        // Deeply nested widget tree heuristic
        const maxNesting = this._maxIndentDepth(lines);
        if (maxNesting > 10) {
            recs.push({
                id: 'widget-deep-nesting',
                type: 'widgetBestPractice',
                title: `Widget tree depth ~${maxNesting} — consider extracting sub-widgets`,
                description:
                    'Deeply nested widget trees are hard to read and may impact hot-reload accuracy.',
                severity: 'warning',
                suggestion: 'Extract inner sections into private Widget methods or separate StatelessWidget classes.',
                tags: ['flutter', 'widget', 'readability'],
            });
        }

        return recs;
    }

    private _maxIndentDepth(lines: string[]): number {
        let max = 0;
        for (const line of lines) {
            const spaces = line.match(/^(\s*)/)?.[1].length ?? 0;
            max = Math.max(max, Math.floor(spaces / 2));
        }
        return max;
    }
}

class StyleAnalyser implements CodeAnalyser {
    readonly id = 'style';

    analyse(lines: string[], joined: string): CodeRecommendation[] {
        const recs: CodeRecommendation[] = [];

        // Mixing camelCase and snake_case variable names
        let camelCount = 0, snakeCount = 0;
        for (const line of lines) {
            if (/\bvar\b|\bfinal\b|\bconst\b/.test(line)) {
                if (/[a-z][A-Z]/.test(line)) camelCount++;
                if (/[a-z]_[a-z]/.test(line)) snakeCount++;
            }
        }
        if (camelCount > 0 && snakeCount > 0) {
            recs.push({
                id: 'style-mixed-naming',
                type: 'style',
                title: 'Mixed naming conventions',
                description: `Found both camelCase (${camelCount}) and snake_case (${snakeCount}) variable names. Dart style mandates camelCase for identifiers.`,
                severity: 'warning',
                suggestion: 'Follow Dart style guide: lowerCamelCase for variables/functions, UpperCamelCase for types.',
                documentationUrl: `${DART_DOCS_BASE}/effective-dart/style`,
                tags: ['style', 'naming'],
            });
        }

        // try without catch
        if (/\btry\s*\{/.test(joined) && !/\bcatch\s*\(/.test(joined)) {
            recs.push({
                id: 'style-try-no-catch',
                type: 'style',
                title: 'try block without catch or finally',
                description: 'A try block with no catch or finally silently swallows exceptions.',
                severity: 'error',
                suggestion: 'Add a catch block. At minimum, log the error and rethrow if you cannot handle it.',
                tags: ['error-handling', 'correctness'],
            });
        }

        // TODO/FIXME density
        const todoCount = (joined.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi) || []).length;
        if (todoCount > 4) {
            recs.push({
                id: 'style-todo-debt',
                type: 'style',
                title: `${todoCount} TODO/FIXME comments — technical debt accumulating`,
                description: 'High number of unresolved TODOs indicates deferred work that may never be addressed.',
                severity: 'info',
                suggestion: 'Track TODOs in your issue tracker and remove resolved ones from the code.',
                tags: ['maintainability', 'tech-debt'],
            });
        }

        // print() in production code
        const printCount = (joined.match(/\bprint\s*\(/g) || []).length;
        if (printCount > 0) {
            recs.push({
                id: 'style-print-in-code',
                type: 'style',
                title: `${printCount} print() call(s) — use debugPrint() or a logger`,
                description:
                    'print() is synchronous and can cause jank on the UI thread. debugPrint() throttles output and is stripped in release mode by many setups.',
                severity: 'warning',
                suggestion: 'Replace print() with debugPrint(), or a structured logger package like logger or talker.',
                tags: ['style', 'logging', 'flutter'],
            });
        }

        return recs;
    }
}

class SecurityAnalyser implements CodeAnalyser {
    readonly id = 'security';

    analyse(_lines: string[], joined: string): CodeRecommendation[] {
        const recs: CodeRecommendation[] = [];

        // Hardcoded secrets heuristic
        if (/(?:apiKey|api_key|secret|password|token)\s*=\s*['"`][A-Za-z0-9+/=_\-]{8,}/i.test(joined)) {
            recs.push({
                id: 'sec-hardcoded-secret',
                type: 'security',
                title: 'Possible hardcoded secret/API key',
                description:
                    'Storing credentials in source code exposes them in version control and app binaries.',
                severity: 'error',
                suggestion: 'Move secrets to environment variables, a secure .env file (not committed), or Flutter --dart-define.',
                tags: ['security', 'credentials'],
            });
        }

        // Unvalidated URL usage
        if (/Uri\.parse\s*\([^)]+\$/.test(joined)) {
            recs.push({
                id: 'sec-dynamic-url',
                type: 'security',
                title: 'Dynamic URL construction via string interpolation',
                description: 'Constructing URLs from user-supplied input can enable SSRF or open-redirect attacks.',
                severity: 'warning',
                suggestion: 'Validate and sanitise all user input before constructing URLs. Use a whitelist of allowed hosts.',
                tags: ['security', 'network'],
            });
        }

        // SharedPreferences for sensitive data
        if (/SharedPreferences/.test(joined) && /(?:token|password|secret)/i.test(joined)) {
            recs.push({
                id: 'sec-sharedprefs-sensitive',
                type: 'security',
                title: 'Sensitive data stored in SharedPreferences',
                description: 'SharedPreferences stores data in plaintext. On rooted/jailbroken devices this is trivially readable.',
                severity: 'error',
                suggestion: 'Use flutter_secure_storage (backed by Android Keystore / iOS Keychain) for sensitive values.',
                documentationUrl: 'https://pub.dev/packages/flutter_secure_storage',
                tags: ['security', 'storage'],
            });
        }

        return recs;
    }
}

class StateManagementAnalyser implements CodeAnalyser {
    readonly id = 'stateManagement';

    analyse(_lines: string[], joined: string): CodeRecommendation[] {
        const recs: CodeRecommendation[] = [];

        // setState in a loop
        if (/for\s*\([^)]*\)\s*\{[^}]*setState\s*\(/m.test(joined)) {
            recs.push({
                id: 'state-setstate-in-loop',
                type: 'stateManagement',
                title: 'setState() called inside a loop',
                description: 'Each setState() schedules a rebuild. Calling it in a loop causes N consecutive rebuilds per iteration.',
                severity: 'error',
                suggestion: 'Batch all mutations, then call setState() once after the loop.',
                tags: ['flutter', 'state', 'performance'],
            });
        }

        // setState after async gap without mounted check
        if (/await\s+/.test(joined) && /setState\s*\(/.test(joined) && !/if\s*\(\s*mounted\s*\)/.test(joined)) {
            recs.push({
                id: 'state-setstate-after-await',
                type: 'stateManagement',
                title: 'setState() after async gap without mounted check',
                description:
                    'If the widget is disposed between the await and the setState(), this throws a runtime error.',
                severity: 'error',
                suggestion: 'Guard with `if (mounted) { setState(() { ... }); }` after every await.',
                documentationUrl: `${FLUTTER_DOCS_BASE}/development/ui/interactive`,
                tags: ['flutter', 'state', 'async', 'crash-risk'],
            });
        }

        return recs;
    }
}

// ─── PatternPredictor ─────────────────────────────────────────────────────────

/**
 * Advanced pattern prediction and intelligent recommendation engine.
 *
 * Improvements over v1:
 * - Pluggable analyser architecture: add new analysers without touching core logic.
 * - Stable recommendation IDs: enables deduplication and caching.
 * - Richer Dart/Flutter-specific rules: null-safety, widget lifecycle, state management, security.
 * - Code health grades (A–F) with structured breakdown.
 * - Prediction reasoning: tells the user *why* a pattern was predicted.
 * - Line-level attribution on recommendations where applicable.
 */
export class PatternPredictor {
    private readonly analysers: CodeAnalyser[];

    constructor(private readonly learningEngine: LearningEngine, private readonly advancedLearningEngine: AdvancedLearningEngine) {
        this.analysers = [
            new AsyncPatternAnalyser(),
            new NullSafetyAnalyser(),
            new PerformanceAnalyser(),
            new WidgetBestPracticeAnalyser(),
            new StyleAnalyser(),
            new SecurityAnalyser(),
            new StateManagementAnalyser(),
        ];
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Register a custom analyser at runtime.
     * Useful for extension points from other parts of the plugin.
     */
    registerAnalyser(analyser: CodeAnalyser): void {
        const exists = this.analysers.some(a => a.id === analyser.id);
        if (!exists) {
            this.analysers.push(analyser);
        }
    }

    /**
     * Predict the next patterns the user is likely to type,
     * with confidence scores and reasoning.
     */
    predictNextPattern(
        document: vscode.TextDocument,
        position: vscode.Position
    ): PatternPrediction[] {
        const contextRange = new vscode.Range(
            new vscode.Position(Math.max(0, position.line - 5), 0),
            new vscode.Position(Math.min(document.lineCount - 1, position.line + 1), 0)
        );
        const context = document.getText(contextRange).trim();
        const rawPredictions = this.learningEngine.predictNextPattern(context);
        const advancedRawPredicitons = this.advancedLearningEngine.getSuggestedPatterns();
        const totalRawPredictions = rawPredictions || advancedRawPredicitons;

        return totalRawPredictions.slice(0, 5).map((pattern, index) => ({
            pattern,
            confidence: Math.max(0, 0.95 - index * 0.12),
            context,
            alternatives: rawPredictions.slice(index + 1, index + 3),
            reasoning: this._explainPrediction(pattern, context),
        }));
    }

    /**
     * Run all analysers and return deduplicated, severity-sorted recommendations.
     */
    generateRecommendations(document: vscode.TextDocument): CodeRecommendation[] {
        const lines = document.getText().split('\n');
        const joined = lines.join('\n');

        const all: CodeRecommendation[] = this.analysers.flatMap(a => {
            try {
                return a.analyse(lines, joined);
            } catch (err) {
                // Prevent one broken analyser from silencing the others
                console.error(`[PatternPredictor] Analyser "${a.id}" threw:`, err);
                return [];
            }
        });

        return this._deduplicateAndSort(all);
    }

    /**
     * Build a full code health report.
     */
    calculateCodeHealth(document: vscode.TextDocument): CodeHealthReport {
        const recs = this.generateRecommendations(document);
        const errors = recs.filter(r => r.severity === 'error').length;
        const warnings = recs.filter(r => r.severity === 'warning').length;
        const infos = recs.filter(r => r.severity === 'info').length;

        const deductions =
            errors * SEVERITY_WEIGHT.error +
            warnings * SEVERITY_WEIGHT.warning +
            Math.min(infos * SEVERITY_WEIGHT.info, 10);

        const score = Math.max(0, 100 - deductions);
        const grade = this._grade(score);
        const topIssues = recs.filter(r => r.severity === 'error' || r.severity === 'warning').slice(0, 5);

        return {
            score,
            grade,
            breakdown: { errors, warnings, infos },
            topIssues,
            summary: this._buildSummary(score, grade, errors, warnings, infos),
        };
    }

    /**
     * @deprecated Use calculateCodeHealth() for the full report.
     * Kept for backward compatibility.
     */
    calculateCodeHealthScore(recommendations: CodeRecommendation[]): number {
        const deductions =
            recommendations.filter(r => r.severity === 'error').length * SEVERITY_WEIGHT.error +
            recommendations.filter(r => r.severity === 'warning').length * SEVERITY_WEIGHT.warning +
            Math.min(recommendations.filter(r => r.severity === 'info').length * SEVERITY_WEIGHT.info, 10);
        return Math.max(0, 100 - deductions);
    }

    /**
     * Return high-probability predictive warnings from the learning engine.
     */
    getPredictiveWarnings(document: vscode.TextDocument): CodeRecommendation[] {
        const predictions = this.learningEngine.predictLikelyErrors(document.getText());

        return predictions
            .filter(({ probability }) => probability > 0.55)
            .slice(0, 3)
            .map(({ errorType, probability }) => ({
                id: `predictive-${errorType}`,
                type: 'pattern' as RecommendationType,
                title: `Likely ${errorType} error (${Math.round(probability * 100)}% confidence)`,
                description: `Your coding patterns suggest a ${errorType} error is probable in this file.`,
                severity: 'warning' as Severity,
                suggestion: `Review your code for known ${errorType} pitfalls.`,
                tags: ['predictive', errorType],
            }));
    }

    /**
     * Filter recommendations by one or more types.
     */
    filterRecommendations(
        recs: CodeRecommendation[],
        types: RecommendationType[]
    ): CodeRecommendation[] {
        return recs.filter(r => types.includes(r.type));
    }

    /**
     * Filter recommendations by one or more tags.
     */
    filterByTags(recs: CodeRecommendation[], tags: string[]): CodeRecommendation[] {
        return recs.filter(r => tags.some(t => r.tags.includes(t)));
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private _deduplicateAndSort(recs: CodeRecommendation[]): CodeRecommendation[] {
        const seen = new Map<string, CodeRecommendation>();
        for (const rec of recs) {
            if (!seen.has(rec.id)) {
                seen.set(rec.id, rec);
            }
        }

        const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
        return Array.from(seen.values()).sort(
            (a, b) => order[a.severity] - order[b.severity]
        );
    }

    private _grade(score: number): CodeHealthReport['grade'] {
        for (const [threshold, grade] of GRADE_THRESHOLDS) {
            if (score >= threshold) return grade;
        }
        return 'F';
    }

    private _buildSummary(
        score: number,
        grade: string,
        errors: number,
        warnings: number,
        infos: number
    ): string {
        const parts: string[] = [`Health: ${score}/100 | Grade: ${grade}.`];
        if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''} need immediate attention.`);
        if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''} should be reviewed.`);
        if (infos > 0) parts.push(`${infos} suggestion${infos > 1 ? 's' : ''} for improvement.`);
        if (errors === 0 && warnings === 0) parts.push('No critical issues found.');
        return parts.join(' ');
    }

    private _explainPrediction(pattern: string, context: string): string {
        if (context.includes('async') && pattern.includes('await')) {
            return 'Completing async function body pattern.';
        }
        if (context.includes('class') && pattern.includes('@override')) {
            return 'Class body commonly follows with lifecycle overrides.';
        }
        if (context.includes('setState') && pattern.includes('mounted')) {
            return 'Mounted guard commonly paired with setState after async gaps.';
        }
        return 'Predicted from historical usage patterns in similar contexts.';
    }
}