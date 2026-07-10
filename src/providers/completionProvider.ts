//declare module 'vscode';
import * as vscode from 'vscode';
import { AIService } from '../services/aiService';
import { LearningEngine } from '../services/learningEngine';

export class CompletionProvider implements vscode.CompletionItemProvider {
    private aiService: AIService;
    private learningEngine: LearningEngine;

    constructor(aiService: AIService, learningEngine: LearningEngine) {
        this.aiService = aiService;
        this.learningEngine = learningEngine;
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
        const learnedSuggestions = this.learningEngine.getCompletionSuggestions(currentWord);
        completions.push(...this.createCompletionItems(learnedSuggestions, 'Pattern'));

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

                const aiSuggestions = await this.aiService.generateCompletion(prefix, suffix, currentWord);
                completions.push(...this.createCompletionItems(aiSuggestions, 'AI'));
            } catch (error) {
                // Use VS Code API to report errors instead of console to avoid lib issues
                const msg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`AI completion error: ${msg}`);
            }
        }

        return completions;
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
