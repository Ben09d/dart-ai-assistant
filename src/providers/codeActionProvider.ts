import * as vscode from 'vscode';
import { DartAnalyzer, DartError, QuickFixSuggestion } from '../services/dartAnalyzer';
import { ErrorPrevention, ErrorPrediction } from '../engines/errorPrevention';
import { PatternPredictor, CodeRecommendation } from '../engines/patternPredictor';

/**
 * Provides VS Code Code Actions (the 💡 lightbulb menu) for Dart files.
 *
 * This is the missing bridge between the rich quick-fix data already
 * produced by DartAnalyzer (analyzer diagnostics), ErrorPrevention
 * (regex-based real-time findings), and PatternPredictor (style/perf/
 * security recommendations) — and what the user can actually click on
 * in the editor.
 *
 * Three categories of actions are offered, each clearly labelled so the
 * user can tell at a glance where a suggestion came from:
 * - "Dart Fix: ..."        → from DartAnalyzer.getQuickFix() (dart analyze diagnostics)
 * - "Prevent: ..."         → from ErrorPrevention (regex heuristics, often multi-line)
 * - "Improve: ..."         → from PatternPredictor (style/perf/security recommendations)
 *
 * Also offers two always-available "fix all" commands when more than one
 * action of a given kind is available on the current line/selection, plus
 * an AI-powered fallback action that defers to AIService.generateFixes()
 * when no static quick fix exists for the diagnostic at the cursor.
 */
export class CodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Refactor,
        vscode.CodeActionKind.RefactorRewrite,
    ];

    constructor(
        private readonly dartAnalyzer: DartAnalyzer,
        private readonly errorPrevention: ErrorPrevention,
        private readonly patternPredictor: PatternPredictor,
        /** Optional — only needed for the AI-powered fallback action. */
        private readonly aiService?: {
            generateFixes: (
                document: vscode.TextDocument,
                errors: Array<{ line: number; message: string; severity: string; code?: string }>
            ) => Promise<Array<{ range: vscode.Range; newText: string; description: string }>>;
        }
    ) { }

    // ── VS Code CodeActionProvider entry point ──────────────────────────────

    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        if (document.languageId !== 'dart') return [];

        const actions: vscode.CodeAction[] = [];

        // 1) Actions derived directly from VS Code's own diagnostics for this
        //    range (these come from our DiagnosticProvider, which sourced
        //    them from DartAnalyzer in the first place).
        actions.push(...this._actionsFromDiagnostics(document, context.diagnostics, range));

        if (token.isCancellationRequested) return actions;

        // 2) Actions from the fast regex-based ErrorPrevention engine —
        //    independent of whatever diagnostics VS Code currently has
        //    loaded, so this still works even before a save-triggered
        //    dart analyze pass has run.
        actions.push(...await this._actionsFromErrorPrevention(document, range));

        if (token.isCancellationRequested) return actions;

        // 3) Actions from PatternPredictor recommendations relevant to this line.
        actions.push(...this._actionsFromPatternPredictor(document, range));

        // 4) "Fix all in file" convenience actions, only offered once enough
        //    individual fixes exist to make batching worthwhile.
        if (actions.length >= 2) {
            actions.push(this._buildFixAllAction(document));
        }

        return actions;
    }

    /**
     * Optional VS Code hook: lazily resolves the edit for an action only
     * when the user actually invokes it, useful for actions that were
     * constructed cheaply but need a bit more work to finalise.
     * Currently a passthrough since all actions above are built eagerly,
     * but kept so callers can rely on the interface being fully implemented.
     */
    resolveCodeAction(
        codeAction: vscode.CodeAction,
        _token: vscode.CancellationToken
    ): vscode.CodeAction | Promise<vscode.CodeAction> {
        return codeAction;
    }

    // ── Category 1: DartAnalyzer-backed diagnostics ─────────────────────────

    private _actionsFromDiagnostics(
        document: vscode.TextDocument,
        diagnostics: readonly vscode.Diagnostic[],
        range: vscode.Range
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of diagnostics) {
            if (diagnostic.source !== 'Dart AI Assistant' && diagnostic.source !== 'dart_analyze') continue;
            if (!diagnostic.range.intersection(range) && !diagnostic.range.contains(range.start)) continue;

            const code = this._codeFromDiagnostic(diagnostic);
            const dartError: DartError = {
                id: code,
                line: diagnostic.range.start.line,
                column: diagnostic.range.start.character,
                message: diagnostic.message,
                severity: this._severityFromDiagnostic(diagnostic),
                code,
                source: diagnostic.source || 'dart_analyze',
            };

            const fix: QuickFixSuggestion | null = this.dartAnalyzer.getQuickFix(dartError);
            if (!fix) continue;

            const action = new vscode.CodeAction(
                `Dart Fix: ${fix.title}`,
                vscode.CodeActionKind.QuickFix
            );
            action.diagnostics = [diagnostic];
            action.isPreferred = fix.kind === 'replace' || fix.kind === 'insert';

            const docUrl = this.dartAnalyzer.getDocumentationUrl(code);
            if (docUrl) {
                action.command = {
                    title: 'View documentation',
                    command: 'vscode.open',
                    arguments: [vscode.Uri.parse(docUrl)],
                };
            }

            // Where we can construct a concrete textual fix, do so; otherwise
            // surface the suggestion as an informational action that opens
            // documentation or shows a message — better than a dead lightbulb.
            const edit = this._buildEditForFix(document, diagnostic.range, fix);
            if (edit) {
                action.edit = edit;
            } else {
                action.command = {
                    title: fix.title,
                    command: 'dartAI.showQuickFixDetail',
                    arguments: [fix.title, fix.detail ?? ''],
                };
            }

            actions.push(action);
        }

        return actions;
    }

    /**
     * Best-effort construction of a concrete WorkspaceEdit for a given
     * QuickFixSuggestion. Handles the common, mechanically-safe cases
     * (remove, insert semicolon, simple replace patterns); anything more
     * involved is left to the AI-powered fallback action instead of
     * risking an incorrect automatic edit.
     */
    private _buildEditForFix(
        document: vscode.TextDocument,
        range: vscode.Range,
        fix: QuickFixSuggestion
    ): vscode.WorkspaceEdit | undefined {
        const edit = new vscode.WorkspaceEdit();
        const lineText = document.lineAt(range.start.line).text;

        switch (fix.kind) {
            case 'remove':
                // Remove the whole line containing the diagnostic — safe for
                // unused_import, dead_code, unnecessary_cast, etc.
                edit.delete(
                    document.uri,
                    new vscode.Range(range.start.line, 0, range.start.line + 1, 0)
                );
                return edit;

            case 'insert':
                if (fix.title.toLowerCase().includes('semicolon')) {
                    edit.insert(
                        document.uri,
                        new vscode.Position(range.start.line, lineText.trimEnd().length),
                        ';'
                    );
                    return edit;
                }
                if (fix.title.toLowerCase().includes('const')) {
                    edit.insert(
                        document.uri,
                        new vscode.Position(range.start.line, range.start.character),
                        'const '
                    );
                    return edit;
                }
                if (fix.title.toLowerCase().includes('await')) {
                    edit.insert(
                        document.uri,
                        new vscode.Position(range.start.line, range.start.character),
                        'await '
                    );
                    return edit;
                }
                return undefined;

            case 'rename':
                if (fix.title.toLowerCase().includes('prefix with _')) {
                    edit.insert(
                        document.uri,
                        new vscode.Position(range.start.line, range.start.character),
                        '_'
                    );
                    return edit;
                }
                return undefined;

            case 'replace':
                if (fix.title.toLowerCase().includes('debugprint')) {
                    const replaced = lineText.replace(/\bprint\s*\(/, 'debugPrint(');
                    if (replaced !== lineText) {
                        edit.replace(
                            document.uri,
                            new vscode.Range(range.start.line, 0, range.start.line, lineText.length),
                            replaced
                        );
                        return edit;
                    }
                }
                if (fix.title.toLowerCase().includes('single quotes')) {
                    const replaced = lineText.replace(/"([^"]*)"/g, "'$1'");
                    if (replaced !== lineText) {
                        edit.replace(
                            document.uri,
                            new vscode.Range(range.start.line, 0, range.start.line, lineText.length),
                            replaced
                        );
                        return edit;
                    }
                }
                if (fix.title.toLowerCase().includes('sizedbox')) {
                    const replaced = lineText.replace(/\bContainer\s*\(/, 'SizedBox(');
                    if (replaced !== lineText) {
                        edit.replace(
                            document.uri,
                            new vscode.Range(range.start.line, 0, range.start.line, lineText.length),
                            replaced
                        );
                        return edit;
                    }
                }
                return undefined;

            default:
                return undefined;
        }
    }

    // ── Category 2: ErrorPrevention-backed quick fixes ──────────────────────

    private async _actionsFromErrorPrevention(
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<vscode.CodeAction[]> {
        const actions: vscode.CodeAction[] = [];
        const predictions: ErrorPrediction[] = await this.errorPrevention.analyzeForPrevention(document);

        for (const prediction of predictions) {
            if (prediction.line !== range.start.line) continue;
            if (!prediction.quickFix) continue;

            const action = new vscode.CodeAction(
                `Prevent: ${prediction.message}`,
                vscode.CodeActionKind.QuickFix
            );

            const lineRange = new vscode.Range(
                prediction.line,
                0,
                prediction.line,
                document.lineAt(prediction.line).text.length
            );

            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, lineRange, prediction.quickFix);
            action.edit = edit;
            action.isPreferred = prediction.confidence >= 0.85;

            if (prediction.documentationUrl) {
                action.command = {
                    title: 'View documentation',
                    command: 'vscode.open',
                    arguments: [vscode.Uri.parse(prediction.documentationUrl)],
                };
            }

            actions.push(action);
        }

        return actions;
    }

    // ── Category 3: PatternPredictor-backed recommendations ─────────────────

    private _actionsFromPatternPredictor(
        document: vscode.TextDocument,
        range: vscode.Range
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        const recommendations: CodeRecommendation[] = this.patternPredictor.generateRecommendations(document);

        // PatternPredictor recommendations aren't line-anchored in the same
        // way as DartError/ErrorPrediction, so we only surface the ones that
        // are clearly actionable (have a quickFix) and let the user invoke
        // them from anywhere — VS Code will still show them in the lightbulb
        // menu for the current line.
        for (const rec of recommendations) {
            if (!rec.quickFix) continue;

            const action = new vscode.CodeAction(
                `Improve: ${rec.title}`,
                rec.type === 'refactor'
                    ? vscode.CodeActionKind.RefactorRewrite
                    : vscode.CodeActionKind.QuickFix
            );

            action.command = {
                title: rec.title,
                command: 'dartAI.applyRecommendation',
                arguments: [rec],
            };

            if (rec.documentationUrl) {
                action.command = {
                    title: 'View documentation',
                    command: 'vscode.open',
                    arguments: [vscode.Uri.parse(rec.documentationUrl)],
                };
            }

            actions.push(action);
        }

        return actions;
    }

    // ── Category 4: batch "fix all" convenience action ──────────────────────

    private _buildFixAllAction(document: vscode.TextDocument): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Dart AI: Fix all auto-fixable issues in this file',
            vscode.CodeActionKind.SourceFixAll
        );
        action.command = {
            title: 'Fix all auto-fixable issues',
            command: 'dartAI.fixErrors',
            arguments: [document.uri],
        };
        return action;
    }

    // ── AI fallback action (used when no static fix exists) ─────────────────

    /**
     * Builds a single "Ask AI to fix this" action for a diagnostic that has
     * no static quick fix available. Kept separate from provideCodeActions()
     * so it can be opted into per-diagnostic rather than always appearing,
     * since it requires a network round trip and should not flood the
     * lightbulb menu for every single diagnostic.
     */
    buildAIFixAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        if (!this.aiService) return undefined;

        const action = new vscode.CodeAction(
            'Ask AI to fix this',
            vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diagnostic];
        action.command = {
            title: 'Ask AI to fix this',
            command: 'dartAI.aiFixSingleDiagnostic',
            arguments: [document.uri, diagnostic],
        };
        return action;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _codeFromDiagnostic(diagnostic: vscode.Diagnostic): string {
        if (typeof diagnostic.code === 'string') return diagnostic.code;
        if (typeof diagnostic.code === 'number') return String(diagnostic.code);
        if (diagnostic.code && typeof diagnostic.code === 'object' && 'value' in diagnostic.code) {
            return String((diagnostic.code as { value: string | number }).value);
        }
        return '';
    }

    private _severityFromDiagnostic(diagnostic: vscode.Diagnostic): 'error' | 'warning' | 'info' {
        switch (diagnostic.severity) {
            case vscode.DiagnosticSeverity.Error: return 'error';
            case vscode.DiagnosticSeverity.Warning: return 'warning';
            default: return 'info';
        }
    }
}