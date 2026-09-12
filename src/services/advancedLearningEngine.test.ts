import { AdvancedLearningEngine } from './advancedLearningEngine';

jest.mock('vscode', () => ({
    window: {
        activeTextEditor: undefined, // simulate "no active editor" scenario
    },
}), { virtual: true });

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

describe('AdvancedLearningEngine', () => {
    let engine: AdvancedLearningEngine;

    beforeEach(() => {
        engine = new AdvancedLearningEngine(makeFakeContext());
    });

    test('getStatistics() does not crash when there is no active editor', () => {
        expect(() => engine.getStatistics()).not.toThrow();
    });

    test('getStatistics() returns an empty codeSmells array when there is no active editor', () => {
        const stats = engine.getStatistics();
        expect(stats.codeSmells).toEqual([]);
    });

    test('pattern storage respects a finite cap (does not grow unbounded)', () => {
        const recordPattern = (engine as any).recordPattern.bind(engine);
        // Record far more patterns than any reasonable cap
        for (let i = 0; i < 1000; i++) {
            recordPattern('test_type', `pattern_${i}`, `context_${i}`);
        }
        const patternCount = (engine as any).patterns.size;
        expect(patternCount).toBeLessThan(1000); // must have pruned, not grown unbounded
    });

    test('recordPattern correctly increments frequency on repeated patterns', () => {
        const recordPattern = (engine as any).recordPattern.bind(engine);
        recordPattern('test_type', 'repeated_pattern', 'ctx');
        recordPattern('test_type', 'repeated_pattern', 'ctx');
        recordPattern('test_type', 'repeated_pattern', 'ctx');

        const stored = (engine as any).patterns.get('test_type:repeated_pattern');
        expect(stored.frequency).toBe(3);
    });
});