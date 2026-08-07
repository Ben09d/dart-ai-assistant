import * as vscode from 'vscode';
import { CodePredictionEngine } from '../services/codePredictionEngine';

export class PredictiveCompletionProvider implements vscode.CompletionItemProvider {
    private predictionEngine: CodePredictionEngine;

    constructor(predictionEngine: CodePredictionEngine) {
        this.predictionEngine = predictionEngine;
    }

    /**
     * Provide completion items based on predictions
     */
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        try {
            // Don't predict in comments
            const lineText = document.lineAt(position.line).text;
            if (lineText.trim().startsWith('//')) {
                return [];
            }

            const currentLine = lineText.substring(0, position.character).trim();

            // Get predictions
            const predictions = this.predictionEngine.predictNextLine(currentLine);

            if (predictions.length === 0) {
                return [];
            }

            // Create completion items
            const completions: vscode.CompletionItem[] = [];

            predictions.forEach((prediction, index) => {
                const item = new vscode.CompletionItem(
                    prediction,
                    vscode.CompletionItemKind.Snippet
                );

                // Get confidence for this prediction
                const confidence = this.predictionEngine.getPredictionConfidence(currentLine, prediction);
                const confidencePercent = Math.round(confidence);

                item.label = `${prediction}`;
                item.detail = `🏹 Predicted (${confidencePercent}% confidence)`;
                item.documentation = this.getDocumentation(prediction, index);
                item.sortText = `00${index}`; // Show at top
                item.preselect = index === 0; // Pre-select best prediction

                // Insert full line with proper indentation
                const indent = lineText.match(/^\s*/)?.[0] || '';
                item.insertText = new vscode.SnippetString(prediction);

                completions.push(item);
            });

            return completions;
        } catch (error) {
            // Use VS Code notification API instead of console to avoid lib DOM dependency
            try {
                vscode.window.showWarningMessage('Error providing predictions: ' + String(error));
            } catch { }
            return [];
        }
    }

    /**
     * Get documentation for prediction
     */
    private getDocumentation(prediction: string, index: number): vscode.MarkdownString {
        const doc = new vscode.MarkdownString();

        if (index === 0) {
            doc.appendMarkdown('🎯 **Top Prediction** - Most likely next line based on your patterns\n\n');
        } else {
            doc.appendMarkdown(`**Alternative #${index}** - Another likely option\n\n`);
        }

        doc.appendMarkdown(`\`\`\`dart\n${prediction}\n\`\`\``);
        doc.isTrusted = true;

        return doc;
    }
}

/**
 * Predictive Inline Completion Provider
 * Shows next line suggestions inline
 */
export class PredictiveInlineProvider {
    private predictionEngine: CodePredictionEngine;
    private lastPredictions: Map<number, string> = new Map();

    constructor(predictionEngine: CodePredictionEngine) {
        this.predictionEngine = predictionEngine;
    }

    /**
     * Get inline completion suggestions
     */
    getInlineCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.InlineCompletionItem[] {
        try {
            const lineText = document.lineAt(position.line).text;

            // Don't predict if line is incomplete
            if (!this.isLineLikelyComplete(lineText)) {
                return [];
            }

            const currentLine = lineText.trim();
            const predictions = this.predictionEngine.predictNextLine(currentLine);

            if (predictions.length === 0) {
                return [];
            }

            const completions: vscode.InlineCompletionItem[] = [];
            const nextLineNum = position.line + 1;

            // If next line exists and matches prediction, don't suggest
            if (nextLineNum < document.lineCount) {
                const nextLine = document.lineAt(nextLineNum).text.trim();
                if (nextLine && predictions[0].trim() === nextLine) {
                    return [];
                }
            }

            // Add indent to predictions
            const indent = lineText.match(/^\s*/)?.[0] || '';

            predictions.forEach((prediction, index) => {
                const item = new vscode.InlineCompletionItem(
                    `\n${indent}${prediction}`,
                    new vscode.Range(position, position)
                );

                item.range = new vscode.Range(
                    new vscode.Position(position.line, lineText.length),
                    new vscode.Position(position.line, lineText.length)
                );

                completions.push(item);
            });

            // Store for analytics
            this.lastPredictions.set(position.line, predictions[0]);

            return completions;
        } catch (error) {
            try {
                vscode.window.showWarningMessage('Error getting inline completions: ' + String(error));
            } catch { }
            return [];
        }
    }

    /**
     * Check if line is likely complete
     */
    private isLineLikelyComplete(line: string): boolean {
        const trimmed = line.trim();

        // Not complete if ends with these characters
        if (trimmed.endsWith(',') || trimmed.endsWith(';') === false) {
            return false;
        }

        // Complete if ends with semicolon, closing brace, or bracket
        return trimmed.endsWith(';') || trimmed.endsWith('}') || trimmed.endsWith(')');
    }
}

/**
 * Prediction Status Bar Item
 * Shows current prediction stats
 */
export class PredictionStatusBar {
    private statusBar: vscode.StatusBarItem;
    private predictionEngine: CodePredictionEngine;

    constructor(predictionEngine: CodePredictionEngine) {
        this.predictionEngine = predictionEngine;
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.command = 'dartAI.showPredictionStats';
        this.updateStatus();
    }

    /**
     * Update status bar
     */
    updateStatus() {
        try {
            const stats = this.predictionEngine.getStatistics();
            this.statusBar.text = `🏹 Predictions: ${stats.totalSequences}`;
            this.statusBar.tooltip = `Code Predictions\nSequences: ${stats.totalSequences}\nFunction Patterns: ${stats.totalFunctionPatterns}\nBlock Patterns: ${stats.totalBlockPatterns}`;
            this.statusBar.show();
        } catch (error) {
            try {
                vscode.window.showWarningMessage('Error updating status bar: ' + String(error));
            } catch { }
        }
    }

    /**
     * Show status
     */
    show() {
        this.statusBar.show();
    }

    /**
     * Hide status
     */
    hide() {
        this.statusBar.hide();
    }

    /**
     * Dispose
     */
    dispose() {
        this.statusBar.dispose();
    }
}
