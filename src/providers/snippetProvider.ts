import * as vscode from 'vscode';
import { LearningEngine } from '../services/learningEngine';

export class SnippetProvider implements vscode.CompletionItemProvider {
    private learningEngine: LearningEngine;

    constructor(learningEngine: LearningEngine) {
        this.learningEngine = learningEngine;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const snippets: vscode.CompletionItem[] = [];

        // Add standard Dart snippets
        snippets.push(...this.getStandardSnippets());

        // Add Flutter snippets if in Flutter context
        if (this.isFlutterFile(document)) {
            snippets.push(...this.getFlutterSnippets());
        }

        // Add learned snippets
        const learnedPatterns = this.learningEngine.getPreferredPattern('snippet');
        snippets.push(...this.createLearnedSnippets(learnedPatterns));

        return snippets;
    }

    private getStandardSnippets(): vscode.CompletionItem[] {
        return [
            this.createSnippet(
                'main',
                'void main() {\n  ${1:// code}\n}',
                'Main function'
            ),
            this.createSnippet(
                'class',
                'class ${1:ClassName} {\n  ${2:// code}\n}',
                'Class declaration'
            ),
            this.createSnippet(
                'const',
                'const ${1:variableName} = ${2:value};',
                'Const variable'
            ),
            this.createSnippet(
                'final',
                'final ${1:variableName} = ${2:value};',
                'Final variable'
            ),
            this.createSnippet(
                'for',
                'for (var ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n  ${3:// code}\n}',
                'For loop'
            ),
            this.createSnippet(
                'foreach',
                'for (var ${1:item} in ${2:collection}) {\n  ${3:// code}\n}',
                'For-each loop'
            ),
            this.createSnippet(
                'if',
                'if (${1:condition}) {\n  ${2:// code}\n}',
                'If statement'
            ),
            this.createSnippet(
                'ifelse',
                'if (${1:condition}) {\n  ${2:// code}\n} else {\n  ${3:// code}\n}',
                'If-else statement'
            ),
            this.createSnippet(
                'switch',
                'switch (${1:expression}) {\n  case ${2:value}:\n    ${3:// code}\n    break;\n  default:\n    ${4:// code}\n}',
                'Switch statement'
            ),
            this.createSnippet(
                'try',
                'try {\n  ${1:// code}\n} catch (${2:e}) {\n  ${3:// error handling}\n}',
                'Try-catch block'
            ),
            this.createSnippet(
                'async',
                'Future<${1:dynamic}> ${2:functionName}() async {\n  ${3:// code}\n  return ${4:result};\n}',
                'Async function'
            ),
            this.createSnippet(
                'test',
                'test(\'${1:description}\', () {\n  ${2:// test code}\n});',
                'Test case'
            ),
            this.createSnippet(
                'group',
                'group(\'${1:description}\', () {\n  ${2:// tests}\n});',
                'Test group'
            )
        ];
    }

    private getFlutterSnippets(): vscode.CompletionItem[] {
        return [
            this.createSnippet(
                'stless',
                'class ${1:WidgetName} extends StatelessWidget {\n  const ${1:WidgetName}({Key? key}) : super(key: key);\n\n  @override\n  Widget build(BuildContext context) {\n    return ${2:Container()};\n  }\n}',
                'StatelessWidget'
            ),
            this.createSnippet(
                'stful',
                'class ${1:WidgetName} extends StatefulWidget {\n  const ${1:WidgetName}({Key? key}) : super(key: key);\n\n  @override\n  _${1:WidgetName}State createState() => _${1:WidgetName}State();\n}\n\nclass _${1:WidgetName}State extends State<${1:WidgetName}> {\n  @override\n  Widget build(BuildContext context) {\n    return ${2:Container()};\n  }\n}',
                'StatefulWidget'
            ),
            this.createSnippet(
                'initState',
                '@override\nvoid initState() {\n  super.initState();\n  ${1:// code}\n}',
                'initState method'
            ),
            this.createSnippet(
                'dispose',
                '@override\nvoid dispose() {\n  ${1:// cleanup}\n  super.dispose();\n}',
                'dispose method'
            ),
            this.createSnippet(
                'setState',
                'setState(() {\n  ${1:// update state}\n});',
                'setState call'
            ),
            this.createSnippet(
                'build',
                '@override\nWidget build(BuildContext context) {\n  return ${1:Container()};\n}',
                'build method'
            ),
            this.createSnippet(
                'scaffold',
                'Scaffold(\n  appBar: AppBar(\n    title: Text(\'${1:Title}\'),\n  ),\n  body: ${2:Container()},\n)',
                'Scaffold widget'
            ),
            this.createSnippet(
                'container',
                'Container(\n  ${1:child: ${2:Widget},}\n)',
                'Container widget'
            ),
            this.createSnippet(
                'center',
                'Center(\n  child: ${1:Widget},\n)',
                'Center widget'
            ),
            this.createSnippet(
                'padding',
                'Padding(\n  padding: const EdgeInsets.${1:all}(${2:8.0}),\n  child: ${3:Widget},\n)',
                'Padding widget'
            ),
            this.createSnippet(
                'column',
                'Column(\n  children: [\n    ${1:// widgets}\n  ],\n)',
                'Column widget'
            ),
            this.createSnippet(
                'row',
                'Row(\n  children: [\n    ${1:// widgets}\n  ],\n)',
                'Row widget'
            ),
            this.createSnippet(
                'listview',
                'ListView.builder(\n  itemCount: ${1:items.length},\n  itemBuilder: (context, index) {\n    return ${2:ListTile()};\n  },\n)',
                'ListView.builder'
            ),
            this.createSnippet(
                'gridview',
                'GridView.builder(\n  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(\n    crossAxisCount: ${1:2},\n  ),\n  itemCount: ${2:items.length},\n  itemBuilder: (context, index) {\n    return ${3:Container()};\n  },\n)',
                'GridView.builder'
            ),
            this.createSnippet(
                'futurebuilder',
                'FutureBuilder<${1:dynamic}>(\n  future: ${2:futureFunction()},\n  builder: (context, snapshot) {\n    if (snapshot.hasData) {\n      return ${3:Widget};\n    } else if (snapshot.hasError) {\n      return Text(\'Error: \\${snapshot.error}\');\n    }\n    return CircularProgressIndicator();\n  },\n)',
                'FutureBuilder'
            ),
            this.createSnippet(
                'streambuilder',
                'StreamBuilder<${1:dynamic}>(\n  stream: ${2:stream},\n  builder: (context, snapshot) {\n    if (snapshot.hasData) {\n      return ${3:Widget};\n    }\n    return CircularProgressIndicator();\n  },\n)',
                'StreamBuilder'
            )
        ];
    }

    private createLearnedSnippets(patterns: string[]): vscode.CompletionItem[] {
        return patterns.map((pattern, index) => {
            const item = new vscode.CompletionItem(
                `learned${index}`,
                vscode.CompletionItemKind.Snippet
            );
            item.insertText = new vscode.SnippetString(pattern);
            item.detail = 'Learned pattern';
            item.documentation = new vscode.MarkdownString(
                `Pattern learned from your coding style:\n\n\`\`\`dart\n${pattern}\n\`\`\``
            );
            return item;
        });
    }

    private createSnippet(
        label: string,
        snippet: string,
        description: string
    ): vscode.CompletionItem {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(snippet);
        item.detail = description;
        item.documentation = new vscode.MarkdownString(
            `${description}\n\n\`\`\`dart\n${snippet}\n\`\`\``
        );
        return item;
    }

    private isFlutterFile(document: vscode.TextDocument): boolean {
        const text = document.getText();
        return text.includes('import \'package:flutter/') || 
               text.includes('extends StatelessWidget') ||
               text.includes('extends StatefulWidget');
    }
}
