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
        return candidates.map(c => this.toItem(c));
    }

    private toItem(c: CompletionCandidate): vscode.CompletionItem {
        const item = new vscode.CompletionItem(c.label, c.kind);
        item.detail = c.detail;
        item.documentation = new vscode.MarkdownString(c.documentation);
        item.sortText = c.sortText;
        item.insertText = c.isSnippet && c.insertText
            ? new vscode.SnippetString(c.insertText)
            : c.text;
        return item;
    }
}