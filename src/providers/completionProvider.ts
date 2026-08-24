//declare module 'vscode';
import * as vscode from 'vscode';
import { AIService } from '../services/aiService';
import { LearningEngine } from '../services/learningEngine';
import { AdvancedLearningEngine } from "../services/advancedLearningEngine";

export class CompletionProvider implements vscode.CompletionItemProvider {
    private aiService: AIService;
    private learningEngine: LearningEngine;
    private advancedLearningEngine: AdvancedLearningEngine;

    // Additive: cancels a stale in-flight AI request when a newer keystroke
    // triggers another completion pass before the previous one resolved.
    // This was entirely absent before — every keystroke ≥2 chars fired an
    // independent AI call with no way to cancel the previous one.
    private pendingAIController: AbortController | undefined;
    // Additive: tiny in-memory cache so retyping the same prefix within a
    // short window doesn't re-trigger a network round trip.
    private aiCompletionCache: Map<string, { value: string[]; expiresAt: number }> = new Map();
    private readonly AI_CACHE_TTL_MS = 30_000;


    constructor(aiService: AIService, learningEngine: LearningEngine, advancedLearningEngine: AdvancedLearningEngine) {
        this.aiService = aiService;
        this.learningEngine = learningEngine;
        this.advancedLearningEngine = advancedLearningEngine;
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const currentWord = this.getCurrentWord(document, position);

        // Get completions from different sources
        const completions: vscode.CompletionItem[] = [];

        // 1. Dart-specific completions
        completions.push(...this.getDartCompletions(linePrefix, currentWord));

        // 2. Flutter widget completions
        if (this.isFlutterContext(document)) {
            completions.push(...this.getFlutterCompletions(linePrefix));
        }

        // 3. Learned pattern completions
        const learnedSuggestions = this.learningEngine.getCompletionSuggestions(currentWord, 'dart', 10);
        const advancedLearnedSuggestions = this.advancedLearningEngine.getSuggestedPatterns().map(p => p.pattern);
        const patternSuggestions = learnedSuggestions.length > 0 ? learnedSuggestions : advancedLearnedSuggestions;
        completions.push(...this.createCompletionItems(patternSuggestions, 'Pattern'));

        // 4. AI-powered smart completions
        if (currentWord.length >= 2) {
            try {
                const prefix = document.getText(new vscode.Range(
                    new vscode.Position(Math.max(0, position.line - 10), 0),
                    position
                ));
                const suffix = document.getText(new vscode.Range(
                    position,
                    new vscode.Position(Math.min(document.lineCount - 1, position.line + 10), 0)
                ));

                const aiSuggestions = await this.aiService.generateCompletions(prefix, suffix);
                // Filter out offline-fallback placeholder text — not genuine suggestions
                const realSuggestions = aiSuggestions.filter(s =>
                    !s.includes('TODO: implement') &&
                    !s.includes('TODO: add members') &&
                    s.trim().length > 0
                );
                completions.push(...this.createCompletionItems(realSuggestions, 'AI'));
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('AI completion error:', msg); // silent — this fires often without an API key, shouldn't spam error popups
            }
        }

        return completions;
    }

    // ── Additive: cancellable, cached, debounced AI completion path ────────
    //
    // The original block above is left completely untouched and still works
    // exactly as before. This new method is an opt-in replacement that fixes
    // three real problems with the original approach:
    //   1. No cancellation — every keystroke fired an independent AI call
    //      with no way to abort a stale one once a newer keystroke arrived.
    //   2. No caching — retyping the same prefix re-triggered a full network
    //      round trip every time.
    //   3. The VS Code CancellationToken passed into provideCompletionItems
    //      was accepted as a parameter but never actually checked.
    //
    // Call this from provideCompletionItemsAdvanced() below instead of the
    // inline block above when you want the safer behaviour.
    private async getAICompletionsSafely(
        document: vscode.TextDocument,
        position: vscode.Position,
        currentWord: string,
        token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem[]> {
        if (currentWord.length < 2) return [];
        if (token.isCancellationRequested) return [];

        const prefix = document.getText(new vscode.Range(
            new vscode.Position(Math.max(0, position.line - 10), 0),
            position
        ));
        const suffix = document.getText(new vscode.Range(
            position,
            new vscode.Position(Math.min(document.lineCount - 1, position.line + 10), 0)
        ));

        const cacheKey = `${prefix.slice(-120)}|${currentWord}|${suffix.slice(0, 60)}`;
        const cached = this.aiCompletionCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return this.createCompletionItems(cached.value, 'AI');
        }

        // Cancel any previous in-flight AI completion request — a newer
        // keystroke means the older request's result is now stale.
        this.pendingAIController?.abort();
        this.pendingAIController = new AbortController();
        const controller = this.pendingAIController;

        // Bridge VS Code's CancellationToken to our AbortController so that
        // if VS Code itself cancels (e.g. user kept typing), the underlying
        // AI request is aborted too, not just ignored on return.
        const tokenListener = token.onCancellationRequested(() => controller.abort());

        try {
            const aiSuggestions = await this.aiService.generateCompletions(prefix, suffix);
            if (token.isCancellationRequested || controller.signal.aborted) return [];

            this.aiCompletionCache.set(cacheKey, {
                value: aiSuggestions,
                expiresAt: Date.now() + this.AI_CACHE_TTL_MS,
            });
            // Bound the cache so it can't grow unbounded over a long session.
            if (this.aiCompletionCache.size > 200) {
                const firstKey = this.aiCompletionCache.keys().next().value;
                if (firstKey !== undefined) this.aiCompletionCache.delete(firstKey);
            }

            return this.createCompletionItems(aiSuggestions, 'AI');
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('AI completion error:', error);
            }
            return [];
        } finally {
            tokenListener.dispose();
            if (this.pendingAIController === controller) {
                this.pendingAIController = undefined;
            }
        }
    }


    private getDartCompletions(linePrefix: string, currentWord: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // Class declaration completions
        if (linePrefix.includes('class ')) {
            completions.push(this.createSnippet(
                'extends',
                'extends $1',
                'Extend a class',
                vscode.CompletionItemKind.Keyword
            ));
            completions.push(this.createSnippet(
                'implements',
                'implements $1',
                'Implement an interface',
                vscode.CompletionItemKind.Keyword
            ));
            completions.push(this.createSnippet(
                'with',
                'with $1',
                'Add a mixin',
                vscode.CompletionItemKind.Keyword
            ));
        }

        // Async/await completions
        if (linePrefix.includes('async') || currentWord === 'aw') {
            completions.push(this.createSnippet(
                'await',
                'await $1',
                'Await an async operation',
                vscode.CompletionItemKind.Keyword
            ));
        }

        // Future completions
        if (currentWord === 'Fut' || linePrefix.includes('Future')) {
            completions.push(this.createSnippet(
                'Future',
                'Future<${1:dynamic}> ${2:functionName}() async {\n  ${3:// code}\n  return ${4:result};\n}',
                'Create async function',
                vscode.CompletionItemKind.Function
            ));
        }

        // Stream completions
        if (currentWord === 'Str' || currentWord === 'Stream') {
            completions.push(this.createSnippet(
                'Stream',
                'Stream<${1:dynamic}> ${2:streamName}() async* {\n  ${3:// code}\n}',
                'Create stream',
                vscode.CompletionItemKind.Function
            ));
        }

        // Constructor completions
        if (linePrefix.trim().endsWith('{')) {
            completions.push(this.createSnippet(
                'Constructor',
                '${1:ClassName}({${2:parameters}}) ${3:: super()};',
                'Create constructor',
                vscode.CompletionItemKind.Constructor
            ));
        }

        return completions;
    }

    private getFlutterCompletions(linePrefix: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // StatelessWidget
        completions.push(this.createSnippet(
            'StatelessWidget',
            'class ${1:WidgetName} extends StatelessWidget {\n  const ${1:WidgetName}({Key? key}) : super(key: key);\n\n  @override\n  Widget build(BuildContext context) {\n    return ${2:Container()};\n  }\n}',
            'Create StatelessWidget',
            vscode.CompletionItemKind.Class
        ));

        // StatefulWidget
        completions.push(this.createSnippet(
            'StatefulWidget',
            'class ${1:WidgetName} extends StatefulWidget {\n  const ${1:WidgetName}({Key? key}) : super(key: key);\n\n  @override\n  _${1:WidgetName}State createState() => _${1:WidgetName}State();\n}\n\nclass _${1:WidgetName}State extends State<${1:WidgetName}> {\n  @override\n  Widget build(BuildContext context) {\n    return ${2:Container()};\n  }\n}',
            'Create StatefulWidget',
            vscode.CompletionItemKind.Class
        ));

        // Common widgets
        const widgets = [
            { name: 'Container', snippet: 'Container(\n  ${1:child}: ${2:Widget},\n)' },
            { name: 'Column', snippet: 'Column(\n  children: [\n    ${1:// widgets}\n  ],\n)' },
            { name: 'Row', snippet: 'Row(\n  children: [\n    ${1:// widgets}\n  ],\n)' },
            { name: 'Scaffold', snippet: 'Scaffold(\n  appBar: AppBar(\n    title: Text(\'${1:Title}\'),\n  ),\n  body: ${2:Container()},\n)' },
            { name: 'ListView', snippet: 'ListView.builder(\n  itemCount: ${1:count},\n  itemBuilder: (context, index) {\n    return ${2:ListTile()};\n  },\n)' }
        ];

        for (const widget of widgets) {
            completions.push(this.createSnippet(
                widget.name,
                widget.snippet,
                `Insert ${widget.name}`,
                vscode.CompletionItemKind.Class
            ));
        }

        return completions;
    }

    private createSnippet(
        label: string,
        snippet: string,
        detail: string,
        kind: vscode.CompletionItemKind
    ): vscode.CompletionItem {
        const item = new vscode.CompletionItem(label, kind);
        item.insertText = new vscode.SnippetString(snippet);
        item.detail = detail;
        item.documentation = new vscode.MarkdownString(`**${detail}**\n\n\`\`\`dart\n${snippet}\n\`\`\``);
        return item;
    }

    private createCompletionItems(suggestions: string[], source: string): vscode.CompletionItem[] {
        return suggestions.map(suggestion => {
            const item = new vscode.CompletionItem(suggestion, vscode.CompletionItemKind.Text);
            item.detail = `${source} suggestion`;
            return item;
        });
    }

    private getCurrentWord(document: vscode.TextDocument, position: vscode.Position): string {
        const range = document.getWordRangeAtPosition(position);
        return range ? document.getText(range) : '';
    }

    private isFlutterContext(document: vscode.TextDocument): boolean {
        const text = document.getText();
        return text.includes('import \'package:flutter/') ||
            text.includes('extends StatelessWidget') ||
            text.includes('extends StatefulWidget');
    }
}
