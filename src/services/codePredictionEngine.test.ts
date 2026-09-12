import { CodePredictionEngine } from './codePredictionEngine';

// Mock vscode + a minimal fake ExtensionContext (globalState in-memory)
jest.mock('vscode', () => ({}), { virtual: true });

function makeFakeContext(): any {
    const store = new Map<string, any>();
    return {
        globalState: {
            get: (key: string) => store.get(key),
            update: (key: string, value: any) => {
                store.set(key, value);
                return Promise.resolve();
            },
        },
    };
}

describe('CodePredictionEngine', () => {
    let engine: CodePredictionEngine;

    beforeEach(() => {
        engine = new CodePredictionEngine(makeFakeContext());
    });

    test('maxSequences is a sane, finite cap (not the historical runaway value)', () => {
        const cap = (engine as any).maxSequences;
        expect(cap).toBeLessThanOrEqual(1000); // sanity bound
        expect(cap).toBeGreaterThan(0);
    });

    test('minConfidence is on the 0-100 scale, not 0-1', () => {
        const min = (engine as any).minConfidence;
        expect(min).toBeGreaterThan(1); // catches the old "0.6" bug
        expect(min).toBeLessThanOrEqual(100);
    });

    test('recordSequence stores and retrieves a HIGH-confidence prediction correctly', () => {
        // Record it multiple times to push confidence above minConfidence (60)
        for (let i = 0; i < 15; i++) {
            (engine as any).recordSequence('var x = 5;', 'print(x);', 'line', 'var x = 5;');
        }
        const predictions = engine.predictNextLine('var x = 5;');
        expect(predictions).toContain('print(x);');
    });

    test('a freshly recorded (low-confidence) sequence is correctly excluded until confidence builds up', () => {
        (engine as any).recordSequence('var y = 10;', 'print(y);', 'line', 'var y = 10;');
        const predictions = engine.predictNextLine('var y = 10;');
        // Single occurrence starts at confidence 40, below the 60 threshold
        expect(predictions).not.toContain('print(y);');
    });

    test('confidence filter actually excludes low-confidence sequences', () => {
        // Manually inject a low-confidence sequence directly into the map
        const sequences = (engine as any).codeSequences;
        sequences.set('line:foo', [
            { current: 'foo', next: 'low-confidence-result', frequency: 1, context: 'foo', confidence: 10 },
        ]);
        const predictions = engine.predictNextLine('foo');
        expect(predictions).not.toContain('low-confidence-result');
    });
});