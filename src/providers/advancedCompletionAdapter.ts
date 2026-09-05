import * as vscode from 'vscode';
import { AdvancedCompletionEngine, CompletionCandidate } from './advancedCompletionEngine';

export class AdvancedCompletionAdapter implements vscode.CompletionItemProvider {
    constructor(private engine: AdvancedCompletionEngine) { }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const candidates = await this.engine.generateCompletions(
            document, position, context.triggerCharacter
        );
        const range = this._getReplacementRange(document, position);
        return candidates.map(c => this.toItem(c, range));
    }

    /**
     * Determines the word range to replace, so completions overwrite what the
     * user already typed instead of being inserted alongside it (which would
     * produce duplicated text, e.g. typing "import" then accepting an "import"
     * keyword suggestion resulting in "importimport").
     */
    private _getReplacementRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
        const wordRange = document.getWordRangeAtPosition(position, /[\w]+/);
        return wordRange ?? new vscode.Range(position, position);
    }

    private toItem(c: CompletionCandidate, range: vscode.Range): vscode.CompletionItem {
        const item = new vscode.CompletionItem(c.label, c.kind);
        item.detail = c.detail;
        item.documentation = new vscode.MarkdownString(c.documentation);
        item.sortText = c.sortText;
        item.range = range;
        item.insertText = c.isSnippet && c.insertText
            ? new vscode.SnippetString(c.insertText)
            : c.text;
        return item;
    }
}