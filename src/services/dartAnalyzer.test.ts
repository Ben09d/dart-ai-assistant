import * as vscode from 'vscode';
import { DartAnalyzer } from './dartAnalyzer';

// Jest can't load the real 'vscode' module outside the extension host,
// so we mock just enough of it for DartAnalyzer's constructor/methods
// that don't need a live editor to run.
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: () => ({ get: () => undefined }),
        workspaceFolders: undefined,
    },
}), { virtual: true });

describe('DartAnalyzer.isMissingReturn (private, tested via analyzeDocument)', () => {
    let analyzer: any;

    beforeEach(() => {
        analyzer = new DartAnalyzer();
    });

    // Access the private method directly for focused unit testing —
    // acceptable here since we're testing pure logic, not VS Code integration.
    function isMissingReturn(line: string, index: number, lines: string[]): boolean {
        return (analyzer as any).isMissingReturn(line, index, lines);
    }

    test('does NOT flag "} else if (...)" as missing return', () => {
        const lines = ["} else if (value == 'delete') {", "  doSomething();", "}"];
        expect(isMissingReturn(lines[0], 0, lines)).toBe(false);
    });

    test('does NOT flag plain "else if (...)" as missing return', () => {
        const lines = ["else if (selectedAnimalType == 'Sheep') {", "  doSomething();", "}"];
        expect(isMissingReturn(lines[0], 0, lines)).toBe(false);
    });

    test('does NOT flag "if (...)" as missing return', () => {
        const lines = ["if (x == true) {", "  doSomething();", "}"];
        expect(isMissingReturn(lines[0], 0, lines)).toBe(false);
    });

    test('does NOT flag control-flow keywords (for/while/try/catch)', () => {
        const cases = [
            "for (var i = 0; i < 10; i++) {",
            "while (running) {",
            "try {",
            "catch (e) {",
        ];
        for (const line of cases) {
            expect(isMissingReturn(line, 0, [line, '}'])).toBe(false);
        }
    });

    test('DOES flag a real function with a non-void return type and no return statement', () => {
        const lines = [
            'int calculateTotal() {',
            '  var x = 5;',
            '}',
        ];
        expect(isMissingReturn(lines[0], 0, lines)).toBe(true);
    });

    test('does NOT flag a void function even with no return statement', () => {
        const lines = [
            'void doSomething() {',
            '  var x = 5;',
            '}',
        ];
        expect(isMissingReturn(lines[0], 0, lines)).toBe(false);
    });
});