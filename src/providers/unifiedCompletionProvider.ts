import * as vscode from 'vscode';
import { CompletionProvider } from './completionProvider';
import { SnippetProvider } from './snippetProvider';
import { AdvancedCompletionAdapter } from './advancedCompletionAdapter';
import { PredictiveCompletionProvider } from './predictiveCompletionProvider';

/**
 * Single entry point for all Dart completion sources. Internally queries
 * CompletionProvider, SnippetProvider, AdvancedCompletionAdapter, and
 * PredictiveCompletionProvider, then merges and deduplicates their results
 * into one ranked list — instead of registering 4 separate providers that
 * VS Code would otherwise mash together with no cross-provider ranking.
 *
 * Priority order (first occurrence wins on duplicate labels):
 * 1. Predictions (highest confidence, most contextually relevant right now)
 * 2. Advanced completions (widgets, snippets, learned patterns, member methods)
 * 3. Basic completions (AI-service-backed)
 * 4. Snippets (lowest priority — broadest, most generic matches)
 */
export class UnifiedCompletionProvider implements vscode.CompletionItemProvider {
    private readonly sourceNames = ['predictive', 'advanced', 'basic', 'snippet'];

    constructor(
        private readonly predictiveProvider: PredictiveCompletionProvider,
        private readonly advancedAdapter: AdvancedCompletionAdapter,
        private readonly completionProvider: CompletionProvider,
        private readonly snippetProvider: SnippetProvider
    ) { }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const results = await Promise.allSettled([
            this._safeCall(() => this.predictiveProvider.provideCompletionItems(document, position, token, context)),
            this._safeCall(() => this.advancedAdapter.provideCompletionItems(document, position, token, context)),
            this._safeCall(() => this.completionProvider.provideCompletionItems(document, position, token, context)),
            this._safeCallSync(() => this.snippetProvider.provideCompletionItems(document, position)),
        ]);

        const merged: vscode.CompletionItem[] = [];
        results.forEach((result, sourceIndex) => {
            if (result.status !== 'fulfilled') return;
            result.value.forEach((item, itemIndex) => {
                item.sortText = `${sourceIndex}${item.sortText ?? String(itemIndex).padStart(3, '0')}`;
                merged.push(item);
            });
        });

        const deduped = this._deduplicateByLabel(merged);

        if (deduped.length > 0) {
            deduped.sort((a, b) => (a.sortText ?? '').localeCompare(b.sortText ?? ''));
            deduped[0].preselect = true;
        }

        return deduped;
    }

    /** Runs an async provider call without letting one failure kill the whole merged list. */
    private async _safeCall(
        fn: () => Promise<vscode.CompletionItem[]>
    ): Promise<vscode.CompletionItem[]> {
        try {
            const result = await fn();
            return result ?? [];
        } catch (error) {
            console.warn('[UnifiedCompletionProvider] A source failed:', error);
            return [];
        }
    }

    /** Runs a synchronous provider call (e.g. SnippetProvider), wrapped as a resolved Promise. */
    private async _safeCallSync(
        fn: () => vscode.CompletionItem[]
    ): Promise<vscode.CompletionItem[]> {
        try {
            return fn() ?? [];
        } catch (error) {
            console.warn('[UnifiedCompletionProvider] A source failed:', error);
            return [];
        }
    }

    /** Keeps the first (highest-priority) occurrence when multiple sources suggest the same label. */
    private _deduplicateByLabel(items: vscode.CompletionItem[]): vscode.CompletionItem[] {
        const seen = new Map<string, vscode.CompletionItem>();
        for (const item of items) {
            const label = typeof item.label === 'string' ? item.label : item.label.label;
            if (!seen.has(label)) {
                seen.set(label, item);
            }
        }
        return Array.from(seen.values());
    }
}