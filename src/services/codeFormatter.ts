import * as vscode from 'vscode';

export class CodeFormatter {
    async format(code: string): Promise<string> {
        //if (!code.trim()) return code;
        let formatted = code;

        // Apply Dart formatting rules
        formatted = this.formatImports(formatted); // saves well
        // //formatted = this.formatIndentation(formatted);
        formatted = this.formatSpacing(formatted);// saves then unsaves
        formatted = this.formatBraces(formatted); //saves well
        formatted = this.formatCommas(formatted);//deletes ma files when saving
        formatted = this.removeTrailingWhitespace(formatted); //saves well

        // Collapse 3+ blank lines to max 1
        formatted = formatted.replace(/\n{3,}/g, '\n\n');

        // Ensure final newline
        if (!formatted.endsWith('\n')) formatted += '\n';

        return formatted;
    }

    private formatImports(code: string): string {
        const lines = code.split('\n');
        const imports: string[] = [];
        const dartImports: string[] = [];
        const packageImports: string[] = [];
        const relativeImports: string[] = [];
        const nonImports: string[] = [];
        let pastImports = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (!pastImports && trimmed.startsWith('import ')) {
                if (trimmed.includes('dart:') || trimmed.includes('"dart:')) {
                    dartImports.push(line);
                } else if (trimmed.includes('package:') || trimmed.includes('"package:')) {
                    packageImports.push(line);
                } else {
                    relativeImports.push(line);
                }
            } else {
                // A non-import non-blank non-comment line ends the import section
                if (!pastImports && trimmed && !trimmed.startsWith('//')) {
                    pastImports = true;
                }
                nonImports.push(line);
            }
        }

        // Nothing to sort — return as-is
        if (!dartImports.length && !packageImports.length && !relativeImports.length) {
            return code;
        }

        // Sort imports
        dartImports.sort();
        packageImports.sort();
        relativeImports.sort();

        // Combine with proper spacing
        const sortedImports = [
            ...dartImports,
            ...(dartImports.length && packageImports.length ? [''] : []),
            ...packageImports,
            ...(packageImports.length && relativeImports.length ? [''] : []),
            ...relativeImports
        ];

        if (sortedImports.length && nonImports.some(l => l.trim())) {
            sortedImports.push('');
        }

        while (nonImports.length && !nonImports[0].trim()) nonImports.shift();


        return [...sortedImports, ...nonImports].join('\n');
    }


    // ── formatIndentation removed ─────────────────────────────────────────────
    // Re-indenting via brace counting is too error-prone for real Dart code:
    // it breaks arrow functions, multi-line expressions, string templates,
    // and anything that spans multiple lines without braces.
    // VS Code's built-in indentation + dart format handles this correctly.
    // If you need indentation fixing, call `dart format` via child_process instead.


    // private formatIndentation(code: string): string {
    //     const lines = code.split('\n');
    //     let indentLevel = 0;
    //     const formatted: string[] = [];

    //     for (let line of lines) {
    //         const trimmed = line.trim();

    //         if (!trimmed) {
    //             formatted.push('');
    //             continue;
    //         }

    //         // Decrease indent before closing braces
    //         if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
    //             indentLevel = Math.max(0, indentLevel - 1);
    //         }

    //         // Add proper indentation
    //         const indent = '  '.repeat(indentLevel);
    //         formatted.push(indent + trimmed);

    //         // Increase indent after opening braces
    //         if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
    //             indentLevel++;
    //         }

    //         // Handle cases where brace is on same line
    //         if (trimmed.includes('{') && trimmed.includes('}')) {
    //             // Don't change indent for inline braces
    //         } else if (trimmed.endsWith('}') || trimmed.endsWith(']') || trimmed.endsWith(')')) {
    //             // Already handled above
    //         }
    //     }

    //     return formatted.join('\n');
    // }

    private withStringProtection(line: string, fn: (safe: string) => string): string {
        // Skip comment lines entirely
        if (line.trimStart().startsWith('//') ||
            line.trimStart().startsWith('*')) return line;

        const strings: string[] = [];

        // Isolate string literals
        let safe = line.replace(
            /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g,
            (match) => { strings.push(match); return `__S${strings.length - 1}__`; }
        );

        // Run the formatting
        safe = fn(safe);

        // Restore string literals
        return safe.replace(/__S(\d+)__/g, (_, i) => strings[parseInt(i)]);
    }

    private formatSpacing(code: string): string {
        let formatted = code;
        return formatted.split('\n').map(line =>
            this.withStringProtection(line, (safe) => {
                // Keywords
                safe = safe.replace(/\b(if|for|while|switch|catch)\(/g, '$1 (');

                // = but not ==, =>, !=, <=, >=
                safe = safe.replace(/([^=!<>])=(?![=>])/g, '$1 = ');

                // Comparison operators
                safe = safe.replace(/([^ ])(==|!=|<=|>=)([^ ])/g, '$1 $2 $3');

                // Comma spacing
                safe = safe.replace(/,([^ \n])/g, ', $1');

                return safe;
            })
        ).join('\n');

    }

    private formatBraces(code: string): string {
        const lines = code.split('\n');
        const formatted: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Ensure opening brace is on same line
            if (trimmed === '{' && formatted.length > 0) {
                const prevLine = formatted[formatted.length - 1];
                if (prevLine && !prevLine.trim().endsWith('{')) {
                    formatted[formatted.length - 1] = prevLine + ' {';
                    continue;
                }
            }

            formatted.push(line);
        }

        return formatted.join('\n').replace(/\{\s*\n\s*\}/g, '{}');
    }

    private formatCommas(code: string): string {
        // Only add trailing commas to widget/collection parameters —
        // lines that are clearly a single argument inside a multiline call.
        // Strategy: if a line is indented, ends with an identifier or closing
        // bracket (not already comma'd), and the NEXT line starts with ) or ],
        // it's the last arg and needs a trailing comma.
        const lines = code.split('\n');
        const formatted: string[] = [];

        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            const next = lines[i + 1].trim();
            const trimmed = line.trim();

            // Skip blank, comment, or already-terminated lines
            if (!trimmed ||
                trimmed.startsWith('//') ||
                trimmed.endsWith(',') ||
                trimmed.endsWith('{') ||
                trimmed.endsWith('(') ||
                trimmed.endsWith('[')) {
                formatted.push(line);  // ← ADD THIS: push original line
                continue;
            }

            // Add trailing comma when next line closes a bracket
            if (next.startsWith(')') || next.startsWith(']')) {
                formatted[i] = line.trimEnd() + ',';
            } else {
                formatted.push(line);  // ← ADD THIS: push original
            }
        }

        return formatted.join('\n');
    }

    private removeTrailingWhitespace(code: string): string {
        return code.split('\n')
            .map(line => line.trimEnd())
            .join('\n');
    }

    formatSelection(text: string, indentLevel: number = 0): string {
        const indent = '  '.repeat(indentLevel);
        const lines = text.split('\n');

        return text.split('\n')
            .map(line => line.trim() ? indent + line.trim() : '')
            .join('\n');
    }

    async formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const original = document.getText();
        const formatted = await this.format(original);

        // No changes — return nothing to avoid a dirty buffer
        if (formatted === original) return [];

        const lastLine = document.lineCount - 1;
        const lastChar = document.lineAt(lastLine).text.length;

        return [
            vscode.TextEdit.replace(
                new vscode.Range(0, 0, lastLine, lastChar),
                formatted
            )
        ];
    }


    // ── Additive: corrected, idempotent spacing pass ────────────────────────
    //
    // CRITICAL BUG FOUND in formatSpacing() above: its `=` spacing regex
    // (/([^=!<>])=(?![=>])/g) does not check whether the character before
    // `=` is already a space. This means every save widens the gap around
    // every assignment operator — "final x = 5;" becomes "final x  =  5;"
    // after one save, "final x   =   5;" after two, and so on indefinitely,
    // since this runs in setupAutoFormatting() on every onDidSaveTextDocument.
    // Confirmed via direct testing: 4 successive format() calls on
    // "final x = 5;\n" produced "final x  =  5;\n", "final x   =   5;\n",
    // "final x    =    5;\n", "final x     =     5;\n" — strictly growing.
    //
    // Per the no-deletion rule, formatSpacing() above is left completely
    // untouched. This method is a corrected drop-in replacement: it
    // processes compound operators (==, !=, <=, >=, =>) first via
    // placeholders, THEN spaces bare `=`, so a single bare-equals pass can
    // never partially match inside a compound operator, and re-running this
    // method on already-formatted code is a true no-op.

    private formatSpacingCorrected(code: string): string {
        return code.split('\n').map(line =>
            this.withStringProtection(line, (safe) => {
                // Keywords
                safe = safe.replace(/\b(if|for|while|switch|catch)\(/g, '$1 (');

                // Step 1: normalise spacing around compound operators FIRST,
                // replacing each match with a null-byte placeholder so the
                // later bare-`=` pass cannot see or touch them.
                const placeholders: string[] = [];
                safe = safe.replace(/\s*(==|!=|<=|>=|=>)\s*/g, (_match, op) => {
                    placeholders.push(` ${op} `);
                    return `\u0000P${placeholders.length - 1}\u0000`;
                });

                // Step 2: space bare assignment `=`. Safe now — every
                // compound operator has already been swapped for a
                // placeholder, so this can only match real assignment.
                safe = safe.replace(/\s*=\s*/g, ' = ');

                // Step 3: restore the compound operators.
                safe = safe.replace(/\u0000P(\d+)\u0000/g, (_match, i) => placeholders[parseInt(i, 10)]);

                // Comma spacing — same as the original, this part had no bug.
                safe = safe.replace(/,(?!\s)(?!$)/g, ', ');

                return safe;
            })
        ).join('\n');
    }

    /**
     * Safer drop-in replacement for format(). Identical pipeline to the
     * original format() above, except it calls formatSpacingCorrected()
     * instead of the buggy formatSpacing(). The original format() is left
     * completely untouched and still available for any existing caller.
     * Prefer this method for any new call site (e.g. wire setupAutoFormatting
     * in extension.ts to call formatSafely() instead of format()).
     */
    async formatSafely(code: string): Promise<string> {
        if (!code.trim()) return code;

        let formatted = code;

        formatted = this.formatImports(formatted);
        formatted = this.formatSpacingCorrected(formatted);
        formatted = this.formatBraces(formatted);
        formatted = this.formatCommas(formatted);
        formatted = this.removeTrailingWhitespace(formatted);

        formatted = formatted.replace(/\n{3,}/g, '\n\n');

        if (!formatted.endsWith('\n')) formatted += '\n';

        return formatted;
    }

    /**
     * Same as formatDocument() above but uses formatSafely() internally.
     * Original formatDocument() is untouched; this is the version to wire
     * into a CodeActionProvider or save-hook once you're ready to switch
     * away from the buggy spacing pass.
     */
    async formatDocumentSafely(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const original = document.getText();
        const formatted = await this.formatSafely(original);

        if (formatted === original) return [];

        const lastLine = document.lineCount - 1;
        const lastChar = document.lineAt(lastLine).text.length;

        return [
            vscode.TextEdit.replace(
                new vscode.Range(0, 0, lastLine, lastChar),
                formatted
            )
        ];
    }

    /**
     * Self-test that verifies formatSafely() is idempotent on its own output
     * — i.e. formatting already-formatted code is always a true no-op. Useful
     * as a guard a command can run once on activation to catch a regression
     * if these regexes are ever touched again in the future.
     * Returns true if every fixture is stable after a second formatting pass.
     */
    async verifyIdempotency(): Promise<boolean> {
        const fixtures = [
            'final x = (a, b) => a+b;\n',
            'List<int> items = [];\nif(x==5){\n  print(x);\n}\n',
            'final y =-5;\nfinal z = -10;\n',
            'final s = "a=>b == c";\nprint(s);\n',
            'final list = []..add(1)..add(2);\n',
            'final a = b?.c ?? d;\n',
            'Map<String,int> counts = {};\n',
        ];

        for (const fixture of fixtures) {
            const run1 = await this.formatSafely(fixture);
            const run2 = await this.formatSafely(run1);
            if (run1 !== run2) return false;
        }

        return true;
    }
}
