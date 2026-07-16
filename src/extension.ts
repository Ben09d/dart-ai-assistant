/**
 * ============================================================================
 * Dart AI Assistant - VS CODE EXTENSION
 * ============================================================================
 * 
 * A comprehensive Dart/Flutter IDE productivity tool with:
 * 
 * 🧠 LEARNING SYSTEM (Advanced + Basic)
 *    - Advanced Learning Engine: 10 detection types, confidence scoring
 *    - Learning Notifications: Real-time feedback (9 types)
 *    - Pattern relationships: Co-occurrence detection
 *    - Code smell detection: 6 types of quality issues
 *    - Trend analysis: Improving/stable/new patterns
 * 
 * 🔧 ERROR HANDLING
 *    - Real-time error detection
 *    - Auto-correction with Ctrl+Shift+F
 *    - Smart fix suggestions using pattern learning
 *    - Similarity matching (85%+ accuracy)
 * 
 * 💡 INTELLIGENCE
 *    - AI-powered completions and suggestions
 *    - Code optimization
 *    - Intelligent refactoring
 *    - Security vulnerability scanning
 *    - 100+ code snippets
 * 
 * 📊 FEATURES
 *    - Auto-formatting
 *    - Real-time diagnostics
 *    - Learning dashboard with statistics
 *    - Code explanation
 *    - Test generation
 *    - Multi-file analysis
 * 
 * 🎯 ARCHITECTURE
 *    - Lazy service initialization (better performance)
 *    - Error resilience (continues even if one service fails)
 *    - Event-driven design (reactive to user actions)
 *    - Comprehensive logging for debugging
 * 
 * ============================================================================
 * Version: 1.0.0
 * Author: Dart AI Assistant Team
 * Last Updated: 2024
 * ============================================================================
 */
//import { Buffer } from "buffer";
import * as vscode from 'vscode';
import { AIService } from './services/aiService';
import { DartAnalyzer } from './services/dartAnalyzer';
import { SecurityScanner } from './services/securityScanner';
import { LearningEngine } from './services/learningEngine';
import { CodeFormatter } from './services/codeFormatter';
import { CodeActionProvider } from './providers/codeActionProvider'
import { SnippetProvider } from './providers/snippetProvider';
import { CompletionProvider } from './providers/completionProvider';
import { DiagnosticProvider } from './providers/diagnosticProvider';
import { LearningDashboard } from './services/learningDashboard';
import { AdvancedLearningEngine } from './services/advancedLearningEngine';
import { LearningNotifications } from './services/learningNotifications';
import { CodePredictionEngine } from './services/codePredictionEngine';
import { PredictiveCompletionProvider, PredictiveInlineProvider, PredictionStatusBar } from './providers/predictiveCompletionProvider';
import { ErrorPrevention } from './engines/errorPrevention';
import { AdvancedCompletionEngine } from './providers/advancedCompletionEngine';
import { AdvancedCompletionAdapter } from './providers/advancedCompletionAdapter';
import { PatternPredictor } from './engines/patternPredictor';
// Additive: HoverProvider import, also on its own line.
//import { HoverProvider } from './providers/hoverProvider';

declare const console: any;

// ============================================================================
// SERVICE INSTANCES (Lazy initialized for performance)
// ============================================================================

let aiService: AIService | undefined;
let dartAnalyzer: DartAnalyzer | undefined;
let securityScanner: SecurityScanner | undefined;
let learningEngine: LearningEngine | undefined;
let advancedLearningEngine: AdvancedLearningEngine | undefined;
let codeFormatter: CodeFormatter | undefined;
let diagnosticProvider: DiagnosticProvider | undefined;
let learningNotifications: LearningNotifications | undefined;
let codePredictionEngine: CodePredictionEngine | undefined;
let predictiveCompletionProvider: PredictiveCompletionProvider | undefined;
let predictionStatusBar: PredictionStatusBar | undefined;
let errorPrevention: ErrorPrevention | undefined;
let completionProvider: CompletionProvider | undefined;
let codeActionProvider: CodeActionProvider | undefined;
let advancedCompletionEngine: AdvancedCompletionEngine | undefined;
let patternPredictor: PatternPredictor | undefined;
let healthStatusBar: vscode.StatusBarItem | undefined;
let activeAIController: AbortController | undefined;
//let hoverProvider: HoverProvider | undefined;

// ============================================================================
// INITIALIZATION HELPERS
// ============================================================================

const liveAnalysisTimers = new Map<string, ReturnType<typeof setTimeout>>();
const LIVE_ANALYSIS_DEBOUNCE_MS = 700;


/**
 * Lazy-loaded AI Service for generating fixes and optimizations
 */
function getAIService(context: vscode.ExtensionContext): AIService {
    if (!aiService) {
        aiService = new AIService(context);
    }
    return aiService;
}

/**
 * Lazy-loaded Dart Analyzer for detecting errors and code issues
 */
function getDartAnalyzer(): DartAnalyzer {
    if (!dartAnalyzer) {
        dartAnalyzer = new DartAnalyzer();
    }
    return dartAnalyzer;
}

/**
 * Lazy-loaded Security Scanner for vulnerability detection
 */
function getSecurityScanner(): SecurityScanner {
    if (!securityScanner) {
        securityScanner = new SecurityScanner();
    }
    return securityScanner;
}

/**
 * Lazy-loaded Learning Engine for basic pattern tracking
 */
function getLearningEngine(context: vscode.ExtensionContext): LearningEngine {
    if (!learningEngine) {
        try {
            learningEngine = new LearningEngine(context);
        } catch (error) {
            console.error('Failed to initialize learning engine:', error);
            // Continue without learning engine
        }
    }
    return learningEngine!;
}

function getCodeActionProvider(context: vscode.ExtensionContext): CodeActionProvider {
    if (!codeActionProvider) {
        try {
            codeActionProvider = new CodeActionProvider(
                getDartAnalyzer(),
                getErrorPrevention(),
                getPatternPredictor(context),
                getAIService(context)
            );
        } catch (error) {
            console.error('Failed to initialize code action provider:', error);
        }
    }
    return codeActionProvider!;
}

/**
 * Lazy-loaded Pattern Predictor for pattern-based suggestions
 */
function getPatternPredictor(context: vscode.ExtensionContext): PatternPredictor {
    if (!patternPredictor) {
        try {
            // PatternPredictor depends on learning engines; provide those
            patternPredictor = new PatternPredictor(
                getLearningEngine(context),
                getAdvancedLearningEngine(context)
            );
            console.log('✅ Pattern Predictor initialized');
        } catch (error) {
            console.error('Failed to initialize pattern predictor:', error);
        }
    }
    return patternPredictor!;
}

/**
 * Lazy-loaded Advanced Learning Engine for powerful multi-dimensional analysis
 */
function getAdvancedLearningEngine(context: vscode.ExtensionContext): AdvancedLearningEngine {
    if (!advancedLearningEngine) {
        try {
            advancedLearningEngine = new AdvancedLearningEngine(context);
            console.log('✅ Advanced Learning Engine initialized');
        } catch (error) {
            console.error('Failed to initialize advanced learning engine:', error);
        }
    }
    return advancedLearningEngine!;
}

/**
 * Lazy-loaded Learning Notifications for real-time feedback
 */
function getLearningNotifications(context: vscode.ExtensionContext): LearningNotifications {
    if (!learningNotifications) {
        try {
            learningNotifications = new LearningNotifications(getAdvancedLearningEngine(context));
            console.log('✅ Learning Notifications initialized');
        } catch (error) {
            console.error('Failed to initialize learning notifications:', error);
        }
    }
    return learningNotifications!;
}

/**
 * Lazy-loaded Code Formatter for consistent code style
 */
function getCodeFormatter(): CodeFormatter {
    if (!codeFormatter) {
        codeFormatter = new CodeFormatter();
    }
    return codeFormatter;
}

/**
 * Lazy-loaded Diagnostic Provider for real-time error display
 */
function getDiagnosticProvider(): DiagnosticProvider {
    if (!diagnosticProvider) {
        diagnosticProvider = new DiagnosticProvider(getDartAnalyzer());
    }
    return diagnosticProvider;
}

/**
 * Lazy-loaded Code Prediction Engine for next-line prediction
 */
function getCodePredictionEngine(context: vscode.ExtensionContext): CodePredictionEngine {
    if (!codePredictionEngine) {
        try {
            codePredictionEngine = new CodePredictionEngine(context);
            console.log('✅ Code Prediction Engine initialized');
        } catch (error) {
            console.error('Failed to initialize code prediction engine:', error);
        }
    }
    return codePredictionEngine!;
}

function getAdvancedCompletionEngine(context: vscode.ExtensionContext): AdvancedCompletionEngine {
    if (!advancedCompletionEngine) {
        advancedCompletionEngine = new AdvancedCompletionEngine(
            getLearningEngine(context),
            getAIService(context)
        );
    }
    return advancedCompletionEngine;
}

function getErrorPrevention(): ErrorPrevention {
    if (!errorPrevention) {
        errorPrevention = new ErrorPrevention();
    }
    return errorPrevention!;
}




/**
 * Extension activation - initializes all services and registers commands
 * Called when VS Code loads the extension
 */
export async function activate(context: vscode.ExtensionContext) {
    try {
        console.log('🚀 Dart AI Assistant is initializing...');

        // ====================================================================
        // INITIALIZE CORE SERVICES
        // ====================================================================
        try {
            getAIService(context);
            getDartAnalyzer();
            getSecurityScanner();
            getLearningEngine(context);
            getAdvancedLearningEngine(context);
            getLearningNotifications(context);
            getCodeFormatter();
            getDiagnosticProvider();
            getCodePredictionEngine(context);
            getErrorPrevention();
            getPatternPredictor(context);
            vscode.window.showInformationMessage('Dart AI Assistant: All services initialized successfully');
        } catch (error) {
            console.error('ACTUAL ERROR:', error);
            try {
                vscode.window.showErrorMessage(`Dart AI Assistant FAILED: ${error}`);
            } catch { }
            return;
        }

        // Register completion provider for intelligent code suggestions
        const completionProvider = new CompletionProvider(getAIService(context), getLearningEngine(context));
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'dart',
                completionProvider,
                '.', '(', '{', '[', '<', '"', "'", ' '
            )
        );

        // ── Additive: update health status bar whenever the active editor changes ──
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor?.document.languageId === 'dart') {
                    updateHealthStatusBarForDocument(editor.document, context);
                } else {
                    updateHealthStatusBar();
                }
            })
        );

        // Register snippet provider
        const snippetProvider = new SnippetProvider(getLearningEngine(context));
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider('dart', snippetProvider)
        );

        // ── Additive: register the new commands defined further below ──────────
        // Avoid duplicate registration if commands already exist (prevents
        // "command ... already exists" errors when the extension reloads).
        registerAdditionalCommands(context);

        // ── Status bar ──────────────────────────────────────────────
        const statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 100
        );
        statusBar.command = 'dartAI.showLearningReport';
        context.subscriptions.push(statusBar);

        function updateStatusBar() {
            const stats = getLearningEngine(context).getStatistics();
            statusBar.text = `$(brain) Dart AI: ${stats.totalPatterns} patterns`;
            statusBar.tooltip = 'Click to see learning report';
            statusBar.show();
        }


        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                'dart',
                getCodeActionProvider(context),
                { providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds }
            )
        );


        const advEngine = getAdvancedCompletionEngine(context);
        const advAdapter = new AdvancedCompletionAdapter(advEngine);
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider('dart', advAdapter, '.', ' ')
        );

        // ── Additive: code health status bar (separate from the learning one) ──
        healthStatusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 99
        );
        healthStatusBar.command = 'dartAI.showCodeHealth';
        context.subscriptions.push(healthStatusBar);
        updateHealthStatusBar(); // initial paint



        // ====================================================================
        // REGISTER PREDICTIVE COMPLETION PROVIDER
        // ====================================================================
        const predictionEngine = getCodePredictionEngine(context);
        const predictiveProvider = new PredictiveCompletionProvider(predictionEngine);
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider('dart', predictiveProvider, ' ', '\n')
        );

        // Show prediction stats in status bar
        try {
            const statusBar = new PredictionStatusBar(predictionEngine);
            context.subscriptions.push(statusBar);
        } catch (error) {
            console.warn('Error creating prediction status bar:', error);
        }

        registerCommands(context);

        // Setup auto-save formatting
        setupAutoFormatting(context);

        // Setup real-time diagnostics
        setupDiagnostics(context);

        // Setup learning engine watchers
        setupLearningWatchers(context);

        console.log('Dart AI Assistant activated successfully!');

        // Show welcome message (but don't block if there's an error)
        vscode.window.showInformationMessage(
            'Dart AI Assistant ready! Ctrl+Shift+F to fix errors, Ctrl+Space for completions.'
        );
    } catch (error) {

        console.error('Critical error during extension activation:', error);
        vscode.window.showErrorMessage('Dart AI Assistant failed to activate. Check the console for details.');
    }

    /**
    * Repaints the health status bar from the currently active editor, or hides
    * useful detail when there is no active Dart file.
    */
    function updateHealthStatusBar(): void {
        if (!healthStatusBar) return;
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'dart') {
            updateHealthStatusBarForDocument(editor.document, context);
        } else {
            healthStatusBar.text = '$(circle-outline) Dart: —';
            healthStatusBar.tooltip = 'Open a Dart file to see code health';
            healthStatusBar.show();
        }
    }

    /** Synchronous-feeling wrapper that kicks off analysis for a specific document. */
    function updateHealthStatusBarForDocument(document: vscode.TextDocument, context: vscode.ExtensionContext): void {
        void runLiveAnalysis(document, context);
    }

    /**
 * Additional commands layered on top of the original registerCommands().
 * Kept in a separate function so the original command registrations above
 * are never touched, only supplemented.
 */
    function registerAdditionalCommands(context: vscode.ExtensionContext): void {
        // ── Show full code health report (status bar click target) ─────────────
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.showCodeHealth', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.languageId !== 'dart') {
                    vscode.window.showErrorMessage('Please open a Dart file');
                    return;
                }

                const health = getPatternPredictor(context).calculateCodeHealth(editor.document);
                const predictions = await getErrorPrevention().analyzeForPrevention(editor.document);
                const stats = getErrorPrevention().getPreventionStats(editor.document);

                let report = `=== Code Health Report ===\n\n`;
                report += `Score: ${health.score}/100 (Grade ${health.grade})\n`;
                report += `${health.summary}\n\n`;
                report += `Error Prevention Stats:\n`;
                report += `- Errors: ${stats.errors}\n`;
                report += `- Warnings: ${stats.warnings}\n`;
                report += `- Infos: ${stats.infos}\n\n`;
                report += `Top Issues:\n`;
                for (const issue of health.topIssues) {
                    report += `- [${issue.severity.toUpperCase()}] ${issue.title}\n  ${issue.suggestion}\n`;
                }
                if (predictions.length > 0) {
                    report += `\nLive Prevention Findings (first 10):\n`;
                    for (const p of predictions.slice(0, 10)) {
                        report += `Line ${p.line + 1}: ${p.message}\n  Suggestion: ${p.suggestion}\n`;
                    }
                }

                const panel = vscode.window.createWebviewPanel(
                    'codeHealth',
                    'Code Health',
                    vscode.ViewColumn.Two,
                    {}
                );
                panel.webview.html = getReportHtml(report);
            })
        );

        // ── Cancel any in-flight AI request (bound to a keybinding by the user) ──
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.cancelAIRequest', () => {
                if (activeAIController) {
                    activeAIController.abort();
                    activeAIController = undefined;
                    vscode.window.showInformationMessage('AI request cancelled.');
                } else {
                    vscode.window.showInformationMessage('No AI request in progress.');
                }
            })
        );

        // ── Explain code, but cancellable + uses the AIService streaming path ──
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.explainCodeStreaming', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const text = editor.document.getText(editor.selection);
                if (!text) {
                    vscode.window.showErrorMessage('Please select some code to explain');
                    return;
                }

                activeAIController?.abort();
                activeAIController = new AbortController();

                const panel = vscode.window.createWebviewPanel(
                    'codeExplanationStreaming',
                    'Code Explanation (live)',
                    vscode.ViewColumn.Two,
                    {}
                );
                panel.webview.html = getExplanationHtml('Loading…');

                let accumulated = '';
                try {
                    await (aiService as any).stream(
                        text,
                        { taskType: 'explain', signal: activeAIController.signal },
                        (chunk: string) => {
                            accumulated += chunk;
                            panel.webview.html = getExplanationHtml(accumulated);
                        }
                    );
                } catch (err: any) {
                    if (err?.name !== 'AbortError') {
                        vscode.window.showErrorMessage(`AI explain failed: ${err}`);
                    }
                } finally {
                    activeAIController = undefined;
                }
            })
        );

        // ── Review code via AIService.reviewCode, rendered as a recommendations panel ──
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.aiReview', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.languageId !== 'dart') {
                    vscode.window.showErrorMessage('Please open a Dart file');
                    return;
                }

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Running AI code review...',
                    cancellable: false,
                }, async () => {
                    const issues = await (aiService as any).reviewCode(editor.document.getText());
                    if (!issues || issues.length === 0) {
                        vscode.window.showInformationMessage('AI review found no issues!');
                        return;
                    }

                    const panel = vscode.window.createWebviewPanel(
                        'aiReview',
                        'AI Code Review',
                        vscode.ViewColumn.Two,
                        {}
                    );
                    panel.webview.html = getRecommendationsHtml(
                        issues.map((i: any) => ({
                            severity: i.severity,
                            title: i.category ?? 'AI review finding',
                            description: i.message,
                            suggestion: i.line != null ? `Around line ${i.line}` : 'See description above',
                        }))
                    );
                });
            })
        );

        // ── Generate a Flutter widget from a free-text description via AIService ──
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.generateWidget', async () => {
                const description = await vscode.window.showInputBox({
                    prompt: 'Describe the widget you want to generate',
                    placeHolder: 'e.g. a card showing an order with status badge and a track button',
                });
                if (!description) return;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating widget...',
                    cancellable: false,
                }, async () => {
                    const code = await (aiService as any).generateWidget(description);
                    const doc = await vscode.workspace.openTextDocument({
                        language: 'dart',
                        content: code,
                    });
                    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                });
            })
        );

        // ── AI Service performance + cache stats in one combined view ──────────
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.aiServiceDiagnostics', () => {
                const report = getAIService(context).getPerformanceReport();
                const panel = vscode.window.createWebviewPanel(
                    'aiServiceDiagnostics',
                    'AI Service Diagnostics',
                    vscode.ViewColumn.Two,
                    {}
                );
                panel.webview.html = getReportHtml(report);
            })
        );

        // ── LearningEngine health check (uses the additive getHealthCheck() method) ──
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.learningHealthCheck', () => {
                const health = (learningEngine as any).getHealthCheck
                    ? (learningEngine as any).getHealthCheck()
                    : { healthy: true, issues: [], patternCount: 0, fixHistoryCount: 0, vocabSize: 0, clusterCount: 0 };

                let report = `=== Learning Engine Health Check ===\n\n`;
                report += `Healthy: ${health.healthy ? 'Yes' : 'No'}\n`;
                report += `Patterns: ${health.patternCount}\n`;
                report += `Fix history: ${health.fixHistoryCount}\n`;
                report += `Vocabulary size: ${health.vocabSize}\n`;
                report += `Clusters: ${health.clusterCount}\n\n`;
                if (health.issues.length > 0) {
                    report += `Issues:\n`;
                    for (const issue of health.issues) report += `- ${issue}\n`;
                } else {
                    report += `No issues detected.\n`;
                }

                const panel = vscode.window.createWebviewPanel(
                    'learningHealthCheck',
                    'Learning Engine Health',
                    vscode.ViewColumn.Two,
                    {}
                );
                panel.webview.html = getReportHtml(report);
            })
        );

        // ── Export learning data to a JSON file the user can back up ───────────
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.exportLearningData', async () => {
                if (!(learningEngine as any).exportState) {
                    vscode.window.showWarningMessage('Export is not available in this version of the learning engine.');
                    return;
                }
                const data = (learningEngine as any).exportState();
                const uri = await vscode.window.showSaveDialog({
                    filters: { JSON: ['json'] },
                    saveLabel: 'Export Dart AI Learning Data',
                });
                if (!uri) return;

                await vscode.workspace.fs.writeFile(
                    uri,
                    new TextEncoder().encode(JSON.stringify(data, null, 2))
                );
                vscode.window.showInformationMessage('Learning data exported successfully!');
            })
        );

        // ── Import previously exported learning data, merging with current state ──
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.importLearningData', async () => {
                if (!(learningEngine as any).importState) {
                    vscode.window.showWarningMessage('Import is not available in this version of the learning engine.');
                    return;
                }
                const uris = await vscode.window.showOpenDialog({
                    filters: { JSON: ['json'] },
                    canSelectMany: false,
                    openLabel: 'Import Dart AI Learning Data',
                });
                if (!uris || uris.length === 0) return;

                try {
                    const bytes = await vscode.workspace.fs.readFile(uris[0]);
                    const data = JSON.parse(new TextDecoder().decode(bytes));
                    await (learningEngine as any).importState(data);
                    vscode.window.showInformationMessage('Learning data imported and merged successfully!');
                    updateHealthStatusBar();
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to import learning data: ${err}`);
                }
            })
        );

        // ── Run dart fix --apply via DartAnalyzer's additive helper, if present ──
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.applyDartFix', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.languageId !== 'dart') {
                    vscode.window.showErrorMessage('Please open a Dart file');
                    return;
                }
                if (!(dartAnalyzer as any).applyDartFix) {
                    vscode.window.showWarningMessage('dart fix integration is not available in this version of DartAnalyzer.');
                    return;
                }

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Running dart fix --apply...',
                    cancellable: false,
                }, async () => {
                    try {
                        await (dartAnalyzer as any).applyDartFix(editor.document);
                        vscode.window.showInformationMessage('dart fix applied successfully!');
                    } catch (err) {
                        vscode.window.showErrorMessage(`dart fix failed: ${err}`);
                    }
                });
            })
        );

        // ── Quiet/strict toggle for error prevention confidence threshold ──────
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.toggleQuietMode', async () => {
                const config = vscode.workspace.getConfiguration('dartAI');
                const current = config.get<boolean>('quietMode') ?? false;
                await config.update('quietMode', !current, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                    `Dart AI quiet mode ${!current ? 'enabled' : 'disabled'}.`
                );
            })
        );

        // ── Additive: commands invoked by CodeActionProvider's lightbulb actions ──

        /**
         * Applies a PatternPredictor CodeRecommendation's quickFix description
         * as an informational action. PatternPredictor recommendations are not
         * line-anchored with a guaranteed-safe mechanical edit (unlike the
         * DartAnalyzer/ErrorPrevention paths, which build real WorkspaceEdits
         * directly in CodeActionProvider), so this surfaces the suggestion text
         * and offers to open documentation rather than risk an incorrect edit.
         */
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.applyRecommendation', async (rec: {
                title: string;
                description: string;
                suggestion: string;
                quickFix?: string;
                documentationUrl?: string;
            }) => {
                const detail = rec.quickFix ? `\n\nSuggested approach: ${rec.quickFix}` : '';
                const choice = await vscode.window.showInformationMessage(
                    `${rec.title}\n\n${rec.suggestion}${detail}`,
                    ...(rec.documentationUrl ? ['Open Documentation', 'Dismiss'] : ['Dismiss'])
                );
                if (choice === 'Open Documentation' && rec.documentationUrl) {
                    await vscode.env.openExternal(vscode.Uri.parse(rec.documentationUrl));
                }
            })
        );

        /**
         * Handles the "Ask AI to fix this" action built by
         * CodeActionProvider.buildAIFixAction(). Reuses AIService.generateFixes()
         * (already present on the rewritten AIService) scoped to a single
         * diagnostic rather than the whole-document path used by dartAI.fixErrors.
         */
        context.subscriptions.push(
            vscode.commands.registerCommand(
                'dartAI.aiFixSingleDiagnostic',
                async (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
                    const document = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(document);

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Asking AI to fix this issue...',
                        cancellable: false,
                    }, async () => {
                        const codeValue = typeof diagnostic.code === 'object' && diagnostic.code
                            ? String((diagnostic.code as { value: string | number }).value)
                            : String(diagnostic.code ?? '');

                        const fixes = await getAIService(context).generateFixes(document, [{
                            line: diagnostic.range.start.line,
                            message: diagnostic.message,
                            severity: 'error',
                            code: codeValue,
                        } as any]);

                        if (fixes.length === 0) {
                            vscode.window.showInformationMessage('AI could not generate a fix for this issue.');
                            return;
                        }

                        await applyFixes(editor, fixes as any);
                        vscode.window.showInformationMessage('AI fix applied!');
                    });
                }
            )
        );

        /**
         * Shows the full detail text for a quick fix that CodeActionProvider
         * could not turn into a concrete WorkspaceEdit (e.g. fixes requiring
         * judgment, like resolving a type mismatch). Keeps the lightbulb menu
         * useful even when an automatic edit isn't safe to apply.
         */
        context.subscriptions.push(
            vscode.commands.registerCommand(
                'dartAI.showQuickFixDetail',
                async (title: string, detail: string) => {
                    await vscode.window.showInformationMessage(
                        detail ? `${title}\n\n${detail}` : title,
                        'OK'
                    );
                }
            )
        );

        /**
         * Invoked by HoverProvider's "Explain with AI" link. Receives the
         * document URI and the position of the hovered word, expands that into
         * a sensible surrounding range (the enclosing function/widget if one can
         * be found, otherwise a fixed line radius), and calls
         * AIService.explainCode() on that range — streaming the result into a
         * webview so the user sees output appear progressively rather than
         * waiting for the full response.
         */
        context.subscriptions.push(
            vscode.commands.registerCommand(
                'dartAI.explainHoveredSymbol',
                async (uriString: string, pos: { line: number; character: number }) => {
                    const uri = vscode.Uri.parse(uriString);
                    const document = await vscode.workspace.openTextDocument(uri);
                    const position = new vscode.Position(pos.line, pos.character);

                    const range = findEnclosingRangeForExplain(document, position);
                    const codeToExplain = document.getText(range);

                    if (!codeToExplain.trim()) {
                        vscode.window.showInformationMessage('Nothing to explain at this position.');
                        return;
                    }

                    activeAIController?.abort();
                    activeAIController = new AbortController();

                    const panel = vscode.window.createWebviewPanel(
                        'explainHoveredSymbol',
                        'Code Explanation',
                        vscode.ViewColumn.Two,
                        {}
                    );
                    panel.webview.html = getExplanationHtml('Loading…');

                    let accumulated = '';
                    try {
                        await (aiService as any).stream(
                            codeToExplain,
                            { taskType: 'explain', signal: activeAIController.signal },
                            (chunk: string) => {
                                accumulated += chunk;
                                panel.webview.html = getExplanationHtml(accumulated);
                            }
                        );
                    } catch (err: any) {
                        if (err?.name !== 'AbortError') {
                            panel.webview.html = getExplanationHtml(
                                `Could not generate an explanation: ${err}`
                            );
                        }
                    } finally {
                        activeAIController = undefined;
                    }
                }
            )
        );
    }



    function registerCommands(context: vscode.ExtensionContext) {
        // ======================================================================
        // FIX ALL ERRORS COMMAND - Auto-correct and learn from fixes
        // ======================================================================
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.fixErrors', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor || editor.document.languageId !== 'dart') {
                        vscode.window.showErrorMessage('Please open a Dart file');
                        return;
                    }

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "🔧 Fixing errors...",
                        cancellable: false
                    }, async (progress) => {
                        try {
                            const document = editor.document;
                            const errors = await getDartAnalyzer().analyzeDocument(document);

                            if (errors.length === 0) {
                                vscode.window.showInformationMessage('✅ No errors found!');
                                return;
                            }

                            const fixes = await getAIService(context).generateFixes(document, errors);
                            await applyFixes(editor, fixes);

                            // Record with both learning engines
                            getLearningEngine(context).recordFix(errors, fixes);
                            getAdvancedLearningEngine(context).recordFix(errors, fixes);

                            // ADVANCED: Show fix pattern learned notification
                            if (errors.length > 0) {
                                const errorType = errors[0].message?.split(':')[0] || 'error';
                                getLearningNotifications(context).showFixPatternLearnedNotification(errorType);
                            }

                            vscode.window.showInformationMessage(`✅ Fixed ${fixes.length} error(s)!`);
                        } catch (error) {
                            console.error('Error during fix operation:', error);
                            vscode.window.showErrorMessage('Error fixing errors. Check console for details.');
                        }
                    });
                } catch (error) {
                    console.error('Error in fixErrors command:', error);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.showPreventionStats', () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;
                const stats = getErrorPrevention().getPreventionStats(editor.document);
                vscode.window.showInformationMessage(
                    `🛡️ Issues: ${stats.totalIssues} (${stats.errors} errors, ${stats.warnings} warnings)`
                );
            })
        );

        // Error Prevention Command
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.preventErrors', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.languageId !== 'dart') {
                    vscode.window.showErrorMessage('Please open a Dart file');
                    return;
                }

                const predictions = await getErrorPrevention().analyzeForPrevention(editor.document);
                if (predictions.length === 0) {
                    vscode.window.showInformationMessage('No potential errors detected!');
                    return;
                }

                let report = `=== Error Prevention Report ===\n\nDetected ${predictions.length} potential errors:\n\n`;
                for (const prediction of predictions.slice(0, 10)) {
                    report += `Line ${prediction.line + 1}: ${prediction.message}\n`;
                    report += `Suggestion: ${prediction.suggestion}\n\n`;
                }

                const panel = vscode.window.createWebviewPanel(
                    'errorPrevention',
                    'Error Prevention',
                    vscode.ViewColumn.Two,
                    {}
                );
                panel.webview.html = getReportHtml(report);
            })
        );


        // Optimize Code Command
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.optimizeCode', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor || editor.document.languageId !== 'dart') {
                        vscode.window.showErrorMessage('Please open a Dart file');
                        return;
                    }

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Optimizing code...",
                        cancellable: false
                    }, async (progress) => {
                        try {
                            const optimizations = await getAIService(context).optimizeCode(
                                editor.document.getText(),
                                editor.selection
                            );

                            await editor.edit(editBuilder => {
                                const range = editor.selection.isEmpty
                                    ? new vscode.Range(0, 0, editor.document.lineCount, 0)
                                    : editor.selection;
                                editBuilder.replace(range, optimizations);
                            });

                            vscode.window.showInformationMessage('Code optimized!');
                        } catch (error) {
                            console.error('Error during optimization:', error);
                            vscode.window.showErrorMessage('Error optimizing code.');
                        }
                    });
                } catch (error) {
                    console.error('Error in optimizeCode command:', error);
                }
            })
        );

        // Security Scan Command
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.securityScan', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor || editor.document.languageId !== 'dart') {
                        vscode.window.showErrorMessage('Please open a Dart file');
                        return;
                    }

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Scanning for security issues...",
                        cancellable: false
                    }, async (progress) => {
                        try {
                            const issues = await getSecurityScanner().scan(editor.document);

                            if (issues.length === 0) {
                                vscode.window.showInformationMessage('No security issues found!');
                            } else {
                                const panel = vscode.window.createWebviewPanel(
                                    'securityReport',
                                    'Security Report',
                                    vscode.ViewColumn.Two,
                                    {}
                                );
                                panel.webview.html = getSecurityScanner().generateReport(issues);
                            }
                        } catch (error) {
                            console.error('Error during security scan:', error);
                            vscode.window.showErrorMessage('Error scanning for security issues.');
                        }
                    });
                } catch (error) {
                    console.error('Error in securityScan command:', error);
                }
            })
        );

        // Explain Code Command
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.explainCode', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) return;

                    const selection = editor.selection;
                    const text = editor.document.getText(selection);

                    if (!text) {
                        vscode.window.showErrorMessage('Please select some code to explain');
                        return;
                    }

                    const explanation = await getAIService(context).explainCode(text);

                    const panel = vscode.window.createWebviewPanel(
                        'codeExplanation',
                        'Code Explanation',
                        vscode.ViewColumn.Two,
                        {}
                    );
                    panel.webview.html = getExplanationHtml(explanation);
                } catch (error) {
                    console.error('Error in explainCode command:', error);
                }
            })
        );

        // Generate Tests Command
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.generateTests', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor || editor.document.languageId !== 'dart') {
                        vscode.window.showErrorMessage('Please open a Dart file');
                        return;
                    }

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Generating tests...",
                        cancellable: false
                    }, async (progress) => {
                        try {
                            const tests = await getAIService(context).generateTests(editor.document.getText());

                            const testFileName = editor.document.fileName.replace('.dart', '_test.dart');
                            const testUri = vscode.Uri.file(testFileName);

                            await vscode.workspace.fs.writeFile(
                                testUri,
                                Buffer.from(tests, 'utf8')
                            );

                            const doc = await vscode.workspace.openTextDocument(testUri);
                            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

                            vscode.window.showInformationMessage('Tests generated!');
                        } catch (error) {
                            console.error('Error generating tests:', error);
                            vscode.window.showErrorMessage('Error generating tests.');
                        }
                    });
                } catch (error) {
                    console.error('Error in generateTests command:', error);
                }
            })
        );

        // Intelligent Refactor Command
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.refactor', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) return;

                    const selection = editor.selection;
                    const text = editor.document.getText(selection);

                    if (!text) {
                        vscode.window.showErrorMessage('Please select code to refactor');
                        return;
                    }

                    const suggestions = await getAIService(context).suggestRefactorings(text);

                    const chosen = await vscode.window.showQuickPick(
                        suggestions.map(s => s.description),
                        { placeHolder: 'Choose a refactoring' }
                    );

                    if (chosen) {
                        const refactoring = suggestions.find(s => s.description === chosen);
                        if (refactoring) {
                            await editor.edit(editBuilder => {
                                editBuilder.replace(selection, refactoring.code);
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error in refactor command:', error);
                }
            })
        );

        // Complete Code Block Command
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.completeCode', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor || editor.document.languageId !== 'dart') {
                        vscode.window.showErrorMessage('Please open a Dart file');
                        return;
                    }

                    const position = editor.selection.active;
                    const completion = await getAIService(context).completeCode(
                        editor.document,
                        position
                    );

                    await editor.edit(editBuilder => {
                        editBuilder.insert(position, completion);
                    });
                } catch (error) {
                    console.error('Error in completeCode command:', error);
                }
            })
        );

        // ======================================================================
        // VIEW LEARNING DASHBOARD COMMAND - Show advanced learning statistics
        // ======================================================================
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.viewLearningDashboard', async () => {
                try {
                    const dashboard = new LearningDashboard(getLearningEngine(context));

                    // Enhanced: Also pass advanced learning engine for richer insights
                    const advStats = getLearningStats(context);
                    if (advStats) {
                        console.log('📊 Advanced Learning Statistics:', advStats);
                    }

                    dashboard.showDashboard();
                } catch (error) {
                    console.error('Error showing learning dashboard:', error);
                    vscode.window.showErrorMessage('Failed to open Learning Dashboard. Check console for details.');
                }
            })
        );

        // ======================================================================
        // VIEW ADVANCED LEARNING STATS COMMAND - Show quick stats
        // ======================================================================
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.viewAdvancedStats', async () => {
                try {
                    showAdvancedLearningDashboard(context);
                } catch (error) {
                    console.error('Error showing advanced stats:', error);
                    vscode.window.showErrorMessage('Failed to show advanced statistics.');
                }
            })
        );

        // ======================================================================
        // SHOW NEXT LINE PREDICTIONS COMMAND
        // ======================================================================
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.showPredictions', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor || editor.document.languageId !== 'dart') {
                        vscode.window.showErrorMessage('Please open a Dart file');
                        return;
                    }

                    const currentLine = editor.document.lineAt(editor.selection.active.line).text.trim();
                    const predEngine = getCodePredictionEngine(context);
                    const predictions = predEngine.predictNextLine(currentLine);
                    const rankedPredictions = predEngine.getRankedPredictions(currentLine);

                    if (predictions.length === 0) {
                        vscode.window.showInformationMessage('No predictions available. Need more patterns to learn.');
                        return;
                    }

                    // Show quick pick
                    const items = rankedPredictions.map((p, i) => ({
                        label: `${i === 0 ? '🎯' : '💡'} ${p.prediction}`,
                        description: `Confidence: ${p.confidence}% | Frequency: ${p.frequency}`,
                        prediction: p.prediction
                    }));

                    const selected = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select predicted next line...'
                    });

                    if (selected) {
                        // Insert the prediction
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            const lineNum = editor.selection.active.line;
                            const indent = editor.document.lineAt(lineNum).text.match(/^\s*/)?.[0] || '';
                            const position = new vscode.Position(lineNum + 1, 0);

                            await editor.edit(editBuilder => {
                                editBuilder.insert(position, `${indent}${selected.prediction}\n`);
                            });

                            vscode.window.showInformationMessage(`✅ Prediction inserted!`);
                        }
                    }
                } catch (error) {
                    console.error('Error showing predictions:', error);
                    vscode.window.showErrorMessage('Error showing predictions.');
                }
            })
        );

        // ======================================================================
        // SHOW PREDICTION STATS COMMAND
        // ======================================================================
        context.subscriptions.push(
            vscode.commands.registerCommand('dartAI.showPredictionStats', async () => {
                try {
                    const predEngine = getCodePredictionEngine(context);
                    const stats = predEngine.getStatistics();

                    const message = `
🔮 CODE PREDICTION STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total Sequences: ${stats.totalSequences}
🔧 Function Patterns: ${stats.totalFunctionPatterns}
📦 Block Patterns: ${stats.totalBlockPatterns}
💾 Memory Used: ${stats.memoryEstimate}

The more code you write, the better predictions become!
Use Ctrl+Shift+P → "Show Predictions" to see next line suggestions.
                `.trim();

                    vscode.window.showInformationMessage(message);
                } catch (error) {
                    console.error('Error showing prediction stats:', error);
                }
            })
        );
    }

    /**
     * Finds a sensible code range to explain around a hovered position: walks
     * outward from the hovered line to the nearest enclosing function/method/
     * class signature above, and to the matching closing brace below, falling
     * back to a fixed ±8 line radius if no clear enclosing block is found.
     * Kept as a standalone function (not a method) since it has no dependency
     * on any of the module-level service instances above.
     */
    function findEnclosingRangeForExplain(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Range {
        const enclosingPattern = /^\s*(?:@override\s*)?(?:[\w<>?,\s]+\s+)?\w+\s*\([^)]*\)\s*(?:async\s*)?\{/;
        const classOrWidgetPattern = /^\s*class\s+\w+/;

        let startLine = position.line;
        for (let i = position.line; i >= Math.max(0, position.line - 60); i--) {
            const text = document.lineAt(i).text;
            if (enclosingPattern.test(text) || classOrWidgetPattern.test(text)) {
                startLine = i;
                break;
            }
            if (i === Math.max(0, position.line - 60)) {
                startLine = Math.max(0, position.line - 8);
            }
        }

        let depth = 0;
        let endLine = Math.min(document.lineCount - 1, position.line + 8);
        let sawOpenBrace = false;
        for (let i = startLine; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;
            for (const ch of text) {
                if (ch === '{') { depth++; sawOpenBrace = true; }
                if (ch === '}') depth--;
            }
            if (sawOpenBrace && depth <= 0) {
                endLine = i;
                break;
            }
            if (i - startLine > 200) { // safety cap on very large/unbalanced blocks
                endLine = Math.min(document.lineCount - 1, position.line + 8);
                break;
            }
        }

        return new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        );
    }


}



/**
 * Debounced live analysis — runs errorPrevention + patternPredictor on every
 * keystroke but collapses rapid edits into a single pass per document,
 * matching the debounce pattern already used by DartAnalyzer/AIService.
 */function scheduleLiveAnalysis(document: vscode.TextDocument, context: vscode.ExtensionContext): void {
    const key = document.uri.toString();
    const existing = liveAnalysisTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
        liveAnalysisTimers.delete(key);
        try {
            await runLiveAnalysis(document, context);
        } catch (err) {
            console.error('[dartAI] live analysis failed:', err);
        }
    }, LIVE_ANALYSIS_DEBOUNCE_MS);

    liveAnalysisTimers.set(key, timer);
}
/**
 * Runs the lightweight regex-based analysers (errorPrevention,
 * patternPredictor) and refreshes the code-health status bar item.
 * Intentionally does not call dartAnalyzer here (that remains tied to
 * save-time diagnostics via setupDiagnostics, unchanged above) so this
 * stays fast enough to run on every edit.
 */
async function runLiveAnalysis(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<void> {
    if (document.languageId !== 'dart') return;

    const errorPrevention = getErrorPrevention();
    const patternPredictor = getPatternPredictor(context);

    if (!errorPrevention || !patternPredictor) return;

    const predictions = await errorPrevention.analyzeForPrevention(document);
    const recs = patternPredictor.generateRecommendations(document);

    // Surface only if this document is still the active editor, to avoid
    // updating the status bar for a file the user has since navigated away from.
    const active = vscode.window.activeTextEditor;
    if (active && active.document.uri.toString() === document.uri.toString()) {
        const errorCount = predictions.filter(p => p.severity === 'error').length;
        const warnCount = predictions.filter(p => p.severity === 'warning').length;
        const recErrorCount = recs.filter(r => r.severity === 'error').length;

        if (healthStatusBar) {
            const totalErrors = errorCount + recErrorCount;
            const icon = totalErrors > 0 ? '$(error)' : warnCount > 0 ? '$(warning)' : '$(check)';
            healthStatusBar.text = `${icon} Dart: ${totalErrors} err / ${warnCount} warn`;
            healthStatusBar.tooltip = 'Click for full code health report';
            healthStatusBar.show();
        }
    }


}

let isFormatting = false; // ← ADD: prevents re-trigger loop

function setupAutoFormatting(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            try {
                if (isFormatting) return; // ← ADD: skip if we caused this save

                const config = vscode.workspace.getConfiguration('dartAI');
                if (!config.get('autoFormat') || document.languageId !== 'dart') {
                    return;
                }

                const original = document.getText();
                const formatted = await getCodeFormatter().format(original);

                // ← ADD: skip if nothing actually changed
                if (formatted === original) return;

                isFormatting = true; // ← ADD: lock

                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    0, 0,
                    document.lineCount,
                    0
                );
                edit.replace(document.uri, fullRange, formatted);
                await vscode.workspace.applyEdit(edit);
                await document.save(); // ← ADD: save the formatted version

                isFormatting = false; // ← ADD: unlock
            } catch (error) {
                isFormatting = false; // ← ADD: unlock on error too
                console.error('Error during auto-formatting:', error);
            }
        })
    );
}



function setupDiagnostics(context: vscode.ExtensionContext) {
    try {
        const diagnosticCollection = vscode.languages.createDiagnosticCollection('dartAI');
        context.subscriptions.push(diagnosticCollection);

        // Analyze on document change
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(async (event) => {
                try {
                    if (event.document.languageId !== 'dart') return;

                    const config = vscode.workspace.getConfiguration('dartAI');
                    if (!config.get('enableAutoCorrect')) return;

                    // Debounce
                    setTimeout(async () => {
                        try {
                            const diagnostics = await getDiagnosticProvider().provideRichDiagnostics(event.document);
                            diagnosticCollection.set(event.document.uri, diagnostics);
                        } catch (error) {
                            console.error('Error providing diagnostics:', error);
                        }
                    }, config.get('suggestionDelay') || 300);
                } catch (error) {
                    console.error('Error in onDidChangeTextDocument:', error);
                }
            })
        );
        // Live health status bar analysis (errorPrevention + patternPredictor)
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document.languageId !== 'dart') return;
                scheduleLiveAnalysis(event.document, context);
            })
        );

        // Analyze on document open
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(async (document) => {
                try {
                    if (document.languageId !== 'dart') return;

                    const diagnostics = await getDiagnosticProvider().provideRichDiagnostics(document);
                    diagnosticCollection.set(document.uri, diagnostics);
                } catch (error) {
                    console.error('Error in onDidOpenTextDocument:', error);
                }
            })
        );
    } catch (error) {
        console.error('Error setting up diagnostics:', error);
    }
}



/**
 * Setup learning watchers to track patterns and improvements
 * Uses both basic and advanced learning engines for comprehensive analysis
 */
function setupLearningWatchers(context: vscode.ExtensionContext) {
    try {
        const config = vscode.workspace.getConfiguration('dartAI');
        if (!config.get('enableLearning')) return;

        // ====================================================================
        // BASIC LEARNING ENGINE - Record edits and patterns
        // ====================================================================
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                try {
                    if (event.document.languageId !== 'dart') return;

                    // Record with basic engine
                    getLearningEngine(context).recordEdit(event);

                    // ADVANCED: Record with advanced engine
                    const advEngine = getAdvancedLearningEngine(context);
                    advEngine.recordEdit(event);
                } catch (error) {
                    console.error('Error recording edit:', error);
                }
            })
        );

        // ====================================================================
        // PATTERN ANALYSIS - Learn from completed code
        // ====================================================================
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                try {
                    if (document.languageId !== 'dart') return;

                    // Basic engine
                    getLearningEngine(context).analyzePatterns(document);

                    // ADVANCED: Analyze with advanced engine
                    const advEngine = getAdvancedLearningEngine(context);
                    await advEngine.analyzePatterns(document);

                    // PREDICTION: Learn code sequences
                    const predEngine = getCodePredictionEngine(context);
                    predEngine.analyzeDocument(document);

                    // ADVANCED: Show notifications
                    const stats = advEngine.getStatistics();
                    const notifications = getLearningNotifications(context);

                    // Show learning progress notification (every 10 patterns)
                    if (stats.totalPatterns % 10 === 0 && stats.totalPatterns > 0) {
                        notifications.showLearningMilestoneNotification(stats.totalPatterns);
                    }

                    // Show learning progress
                    if (stats.totalPatterns % 5 === 0) {
                        notifications.showLearningProgressNotification(stats.learningAccuracy);
                    }

                    // Show naming style if just detected
                    if (stats.preferredNaming && stats.preferredNaming !== 'Not detected yet') {
                        notifications.showNamingStyleDetectedNotification(stats.preferredNaming);
                    }

                    // Show trend notification
                    notifications.showLearningTrendNotification(stats.learningTrend);
                } catch (error) {
                    console.error('Error analyzing patterns:', error);
                }
            })
        );

        // ====================================================================
        // FIX TRACKING - Learn from error fixes
        // ====================================================================
        // This is handled in the fixErrors command
    } catch (error) {
        console.error('❌ Error setting up learning watchers:', error);
    }
}

/**
 * Apply fixes to the active editor
 */
async function applyFixes(
    editor: vscode.TextEditor,
    fixes: Array<{ range: vscode.Range; newText: string }>
) {
    await editor.edit(editBuilder => {
        for (const fix of fixes) {
            editBuilder.replace(fix.range, fix.newText);
        }
    });
}

/**
 * Get similar fix from advanced learning engine
 * Uses similarity matching to find historically similar errors
 */
function getSimilarFix(context: vscode.ExtensionContext, errorMessage: string): string | null {
    try {
        const advEngine = getAdvancedLearningEngine(context);
        const similarFix = advEngine.getSimilarFix(errorMessage);
        return similarFix;
    } catch (error) {
        console.warn('Error getting similar fix:', error);
        return null;
    }
}

/**
 * Get learning statistics for display
 */
function getLearningStats(context: vscode.ExtensionContext): any {
    try {
        const advEngine = getAdvancedLearningEngine(context);
        return advEngine.getStatistics();
    } catch (error) {
        console.warn('Error getting learning stats:', error);
        return null;
    }
}

/**
 * Show advanced learning dashboard with rich statistics
 */
function showAdvancedLearningDashboard(context: vscode.ExtensionContext) {
    try {
        const stats = getLearningStats(context);
        if (!stats) {
            vscode.window.showErrorMessage('Could not load learning statistics');
            return;
        }

        // Create detailed dashboard message
        const message = `
🧠 ADVANCED LEARNING STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Total Patterns: ${stats.totalPatterns}
🔧 Fixes Recorded: ${stats.totalFixes}
📝 Naming Style: ${stats.preferredNaming}
⭐ Learning Accuracy: ${stats.learningAccuracy}%
📈 Learning Trend: ${stats.learningTrend}

${stats.codeSmells.length > 0 ? '⚠️ CODE SMELLS DETECTED:\n' + stats.codeSmells.map((s: { type: string; location: string }) => `  • ${s.type} (${s.location})`).join('\n') : ''}

View full dashboard: Ctrl+Shift+P → "View Learning Dashboard"
        `.trim();

        vscode.window.showInformationMessage(message);
    } catch (error) {
        console.error('Error showing dashboard:', error);
    }
}

function getExplanationHtml(explanation: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Explanation</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h1 {
                    color: var(--vscode-textLink-foreground);
                    border-bottom: 2px solid var(--vscode-textLink-foreground);
                    padding-bottom: 10px;
                }
                pre {
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
                code {
                    font-family: 'Courier New', monospace;
                }
            </style>
        </head>
        <body>
            <h1>Code Explanation</h1>
            <div>${explanation.replace(/\n/g, '<br>')}</div>
        </body>
        </html>
    `;
}

function getReportHtml(report: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Report</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h1 {
                    color: var(--vscode-textLink-foreground);
                    border-bottom: 2px solid var(--vscode-textLink-foreground);
                    padding-bottom: 10px;
                }
                pre {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h1>Report</h1>
            <pre>${report.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
        </html>
    `;
}


/**
 * HTML template for code recommendations
 */
function getRecommendationsHtml(recommendations: any[]): string {
    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Recommendations</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h1 { color: var(--vscode-textLink-foreground); }
                .recommendation {
                    margin: 15px 0;
                    padding: 15px;
                    border-left: 4px solid;
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 5px;
                }
                .error { border-color: #ff4444; }
                .warning { border-color: #ffaa00; }
                .info { border-color: #00aaff; }
                .title { font-weight: bold; font-size: 1.1em; }
                .suggestion { margin-top: 10px; padding: 10px; background: var(--vscode-editor-background); border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>💡 Code Recommendations</h1>
    `;

    for (const rec of recommendations) {
        const severityClass = rec.severity || 'info';
        html += `
            <div class="recommendation ${severityClass}">
                <div class="title">${rec.title}</div>
                <div>${rec.description}</div>
                <div class="suggestion"><strong>Suggestion:</strong> ${rec.suggestion}</div>
            </div>
        `;
    }

    html += `
        </body>
        </html>
    `;

    return html;
}

/**
 * Extension deactivation - cleanup and save state
 * Called when VS Code unloads the extension
 */export function deactivate() {
    try {
        console.log('🛑 Dart AI Assistant is deactivating...');

        // Save learning data before shutdown
        if (learningEngine) {
            console.log('💾 Saving learning engine data...');
        }

        if (advancedLearningEngine) {
            console.log('💾 Saving advanced learning engine data...');
        }

        // Clear any pending live-analysis timers
        for (const timer of liveAnalysisTimers.values()) {
            clearTimeout(timer);
        }
        liveAnalysisTimers.clear();

        // Cleanup services
        aiService = undefined;
        dartAnalyzer = undefined;
        securityScanner = undefined;
        learningEngine = undefined;
        advancedLearningEngine = undefined;
        codeFormatter = undefined;
        diagnosticProvider = undefined;
        learningNotifications = undefined;
        codePredictionEngine = undefined;
        errorPrevention = undefined;
        patternPredictor = undefined;
        advancedCompletionEngine = undefined;
        completionProvider = undefined;
        codeActionProvider = undefined;
        healthStatusBar = undefined;
        predictionStatusBar = undefined;
        activeAIController = undefined;

        console.log('✅ Dart AI Assistant deactivated successfully');
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}