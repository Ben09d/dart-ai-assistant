import * as vscode from 'vscode';
import { DartAnalyzer, DartError } from '../services/dartAnalyzer';
// import type { QuickFixSuggestion } from '../services/dartAnalyzer';

export class DiagnosticProvider {
    private analyzer: DartAnalyzer;

    constructor(analyzer: DartAnalyzer) {
        this.analyzer = analyzer;
    }

    async provideDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const errors = await this.analyzer.analyzeDocument(document);
        return errors.map(error => this.createDiagnostic(error, document));
    }

    private createDiagnostic(error: DartError, document: vscode.TextDocument): vscode.Diagnostic {
        const line = document.lineAt(error.line);
        const range = new vscode.Range(
            error.line,
            error.column,
            error.line,
            line.text.length
        );

        const severity = this.getSeverity(error.severity);
        const diagnostic = new vscode.Diagnostic(range, error.message, severity);

        diagnostic.source = 'Dart AI Assistant';
        diagnostic.code = error.code;

        // Add quick fix if available
        const quickFix = this.analyzer.getQuickFix(error);
        if (quickFix) {
            diagnostic.relatedInformation = [
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Quick fix: ${quickFix}`
                )
            ];
        }

        return diagnostic;
    }

    private getSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Hint;
        }
    }

    
    // ── Additive: richer diagnostic construction matching the new DartAnalyzer ──

    /**
     * Builds diagnostics using the full DartError shape from the rewritten
     * DartAnalyzer: precise end ranges, documentation links as clickable
     * codes, stable ids for CodeActionProvider matching, and Unnecessary/
     * Deprecated tags. Call this instead of provideDiagnostics() to get the
     * richer output; provideDiagnostics() above is left untouched for any
     * existing caller that depends on its current behaviour.
     */
    async provideRichDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const errors = await this.analyzer.analyzeDocument(document);
        return errors.map(error => this.createRichDiagnostic(error, document));
    }

    /**
     * Same as provideRichDiagnostics but returns a Map keyed by the stable
     * DartError.id, so a caller can diff against a previous result and only
     * update the diagnostics that actually changed instead of replacing the
     * whole DiagnosticCollection entry every time.
     */
    async provideDiagnosticsMap(document: vscode.TextDocument): Promise<Map<string, vscode.Diagnostic>> {
        const errors = await this.analyzer.analyzeDocument(document);
        const map = new Map<string, vscode.Diagnostic>();
        for (const error of errors) {
            map.set(error.id, this.createRichDiagnostic(error, document));
        }
        return map;
    }

    private createRichDiagnostic(error: DartError, document: vscode.TextDocument): vscode.Diagnostic {
        const line = document.lineAt(error.line);
        const endLine = error.endLine ?? error.line;
        const endColumn = error.endColumn ?? line.text.length;

        // Guard against an end position that's before the start position —
        // can happen if endLine/endColumn weren't populated by the analyzer
        // for a particular diagnostic, falling back to end-of-line safely.
        const safeEndLine = endLine >= error.line ? endLine : error.line;
        const safeEndColumn =
            safeEndLine === error.line && endColumn <= error.column
                ? line.text.length
                : endColumn;

        const range = new vscode.Range(
            error.line,
            error.column,
            safeEndLine,
            safeEndColumn
        );

        const severity = this.getRichSeverity(error.severity);
        const diagnostic = new vscode.Diagnostic(range, error.message, severity);

        diagnostic.source = error.source ?? 'Dart AI Assistant';

        // Documentation URL becomes a clickable code in the Problems panel
        // when present; otherwise fall back to a plain string code so the
        // original behaviour (diagnostic.code = error.code) is preserved.
        diagnostic.code = error.documentationUrl
            ? { value: error.code || 'dart_ai', target: vscode.Uri.parse(error.documentationUrl) }
            : error.code;

        // Structured quick fix as relatedInformation, now using the typed
        // QuickFixSuggestion shape (title/kind/detail) instead of a bare string.
        const quickFix: QuickFixSuggestion | null = this.analyzer.getQuickFix(error);
        if (quickFix) {
            const detailSuffix = quickFix.detail ? ` — ${quickFix.detail}` : '';
            diagnostic.relatedInformation = [
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Quick fix (${quickFix.kind}): ${quickFix.title}${detailSuffix}`
                ),
            ];
        }

        // Fade out / strike-through styling for known unnecessary or
        // deprecated code patterns, matching VS Code's native lint UX.
        const tags: vscode.DiagnosticTag[] = [];
        if (this.isUnnecessaryCode(error.code)) tags.push(vscode.DiagnosticTag.Unnecessary);
        if (this.isDeprecatedCode(error.code)) tags.push(vscode.DiagnosticTag.Deprecated);
        if (tags.length > 0) diagnostic.tags = tags;

        return diagnostic;
    }

    /** Extended severity mapping that includes the 'hint' level from DartAnalyzer. */
    private getRichSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            case 'hint':
                return vscode.DiagnosticSeverity.Hint;
            default:
                return vscode.DiagnosticSeverity.Hint;
        }
    }

    /** Lint codes that represent dead/unnecessary code, eligible for fade-out styling. */
    private isUnnecessaryCode(code: string): boolean {
        const unnecessaryCodes = new Set([
            'unused_import',
            'unused_local_variable',
            'dead_code',
            'unnecessary_cast',
            'unnecessary_null_check_in_equality_expression',
            'unnecessary_string_interpolations',
        ]);
        return unnecessaryCodes.has(code);
    }

    /** Lint codes that represent deprecated API usage, eligible for strike-through styling. */
    private isDeprecatedCode(code: string): boolean {
        const deprecatedCodes = new Set([
            'deprecated_member_use',
            'deprecated_member_use_from_same_package',
        ]);
        return deprecatedCodes.has(code);
    }

    // ── Additive: aggregate stats useful for the status bar / health panel ────

    /**
     * Summarises a diagnostics array into counts by severity, handy for
     * status-bar style summaries without re-walking the analyzer output.
     */
    summarise(diagnostics: vscode.Diagnostic[]): {
        errors: number;
        warnings: number;
        infos: number;
        hints: number;
        total: number;
    } {
        let errors = 0, warnings = 0, infos = 0, hints = 0;
        for (const d of diagnostics) {
            switch (d.severity) {
                case vscode.DiagnosticSeverity.Error: errors++; break;
                case vscode.DiagnosticSeverity.Warning: warnings++; break;
                case vscode.DiagnosticSeverity.Information: infos++; break;
                case vscode.DiagnosticSeverity.Hint: hints++; break;
            }
        }
        return { errors, warnings, infos, hints, total: diagnostics.length };
    }

    /**
     * Filters out diagnostics below a given severity threshold — useful for
     * an eventual "quiet mode" toggle that hides hints/info while keeping
     * errors and warnings visible.
     */
    filterBySeverity(
        diagnostics: vscode.Diagnostic[],
        minSeverity: vscode.DiagnosticSeverity
    ): vscode.Diagnostic[] {
        // Lower numeric value = higher severity in VS Code's enum ordering
        // (Error = 0, Warning = 1, Information = 2, Hint = 3).
        return diagnostics.filter(d => d.severity <= minSeverity);
    }
}
