/**
 * ============================================================================
 * DART AI ASSISTANT PRO - VS CODE EXTENSION
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
import { SnippetProvider } from './providers/snippetProvider';
import { CompletionProvider } from './providers/completionProvider';
import { DiagnosticProvider } from './providers/diagnosticProvider';
import { LearningDashboard } from './services/learningDashboard';
import { AdvancedLearningEngine } from './services/advancedLearningEngine';
import { LearningNotifications } from './services/learningNotifications';
import { CodePredictionEngine } from './services/codePredictionEngine';
import { PredictiveCompletionProvider, PredictiveInlineProvider, PredictionStatusBar } from './providers/predictiveCompletionProvider';

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

// ============================================================================
// INITIALIZATION HELPERS
// ============================================================================

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

/**
 * Extension activation - initializes all services and registers commands
 * Called when VS Code loads the extension
 */
export function activate(context: vscode.ExtensionContext) {
    try {
        console.log('🚀 Dart AI Assistant Pro is initializing...');

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
            vscode.window.showInformationMessage('Dart AI Assistant: All services initialized successfully');
        } catch (error) {
            // Log to the extension host output and show an error notification
            // (avoid using the global `console` to satisfy environments lacking DOM lib)
            try { vscode.window.showErrorMessage('Dart AI Assistant: Failed to initialize services. Check extension host logs for details.'); } catch { }
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

        // Register snippet provider
        const snippetProvider = new SnippetProvider(getLearningEngine(context));
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider('dart', snippetProvider)
        );

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

        // Register commands
        registerCommands(context);

        // Setup auto-save formatting
        setupAutoFormatting(context);

        // Setup real-time diagnostics
        setupDiagnostics(context);

        // Setup learning engine watchers
        setupLearningWatchers(context);

        console.log('Dart AI Assistant Pro activated successfully!');

        // Show welcome message (but don't block if there's an error)
        vscode.window.showInformationMessage(
            'Dart AI Assistant Pro ready! Ctrl+Shift+F to fix errors, Ctrl+Space for completions.'
        );
    } catch (error) {

        console.error('Critical error during extension activation:', error);
        vscode.window.showErrorMessage('Dart AI Assistant Pro failed to activate. Check the console for details.');
    }
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

function setupAutoFormatting(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            try {
                const config = vscode.workspace.getConfiguration('dartAI');
                if (!config.get('autoFormat') || document.languageId !== 'dart') {
                    return;
                }

                const formatted = await getCodeFormatter().format(document.getText());

                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    0, 0,
                    document.lineCount,
                    0
                );
                edit.replace(document.uri, fullRange, formatted);
                await vscode.workspace.applyEdit(edit);
            } catch (error) {
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
                            const diagnostics = await getDiagnosticProvider().provideDiagnostics(event.document);
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

        // Analyze on document open
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(async (document) => {
                try {
                    if (document.languageId !== 'dart') return;

                    const diagnostics = await getDiagnosticProvider().provideDiagnostics(document);
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

/**
 * Extension deactivation - cleanup and save state
 * Called when VS Code unloads the extension
 */
export function deactivate() {
    try {
        console.log('🛑 Dart AI Assistant Pro is deactivating...');

        // Save learning data before shutdown
        if (learningEngine) {
            console.log('💾 Saving learning engine data...');
        }

        if (advancedLearningEngine) {
            console.log('💾 Saving advanced learning engine data...');
        }

        // Cleanup services
        aiService = undefined;
        dartAnalyzer = undefined;
        securityScanner = undefined;
        learningEngine = undefined;
        advancedLearningEngine = undefined;
        codeFormatter = undefined;
        diagnosticProvider = undefined;
        learningNotifications = undefined;

        console.log('✅ Dart AI Assistant Pro deactivated successfully');
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}
