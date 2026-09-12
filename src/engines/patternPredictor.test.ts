import { PatternPredictor } from './patternPredictor';

jest.mock('vscode', () => ({
    Range: class { constructor(public a: any, public b: any) { } },
    Position: class { constructor(public line: number, public character: number) { } },
}), { virtual: true });

function makeFakeLearningEngine(): any {
    return { predictNextPattern: () => [], predictLikelyErrors: () => [] };
}

function makeFakeAdvancedEngine(): any {
    return { getSuggestedPatterns: () => [] };
}

function makeFakeDocument(text: string): any {
    const lines = text.split('\n');
    return {
        getText: () => text,
        lineCount: lines.length,
        lineAt: (i: number) => ({ text: lines[i] }),
    };
}

describe('PatternPredictor — brace-aware false-positive fixes', () => {
    let predictor: PatternPredictor;

    beforeEach(() => {
        predictor = new PatternPredictor(makeFakeLearningEngine(), makeFakeAdvancedEngine());
    });

    test('does NOT flag nested loops when two unrelated for-loops exist in separate functions', () => {
        const code = `
void functionA() {
  for (var i = 0; i < 10; i++) {
    print(i);
  }
}

void functionB() {
  for (var j = 0; j < 5; j++) {
    print(j);
  }
}
`;
        const doc = makeFakeDocument(code);
        const recs = predictor.generateRecommendations(doc);
        const nestedLoopRec = recs.find(r => r.id === 'perf-nested-loops');
        expect(nestedLoopRec).toBeUndefined();
    });

    test('DOES flag genuinely nested loops (for inside for)', () => {
        const code = `
void functionA() {
  for (var i = 0; i < 10; i++) {
    for (var j = 0; j < 10; j++) {
      print(i + j);
    }
  }
}
`;
        const doc = makeFakeDocument(code);
        const recs = predictor.generateRecommendations(doc);
        const nestedLoopRec = recs.find(r => r.id === 'perf-nested-loops');
        expect(nestedLoopRec).toBeDefined();
    });

    test('does NOT flag setState-in-loop when setState is in an unrelated function', () => {
        const code = `
void loopFunction() {
  for (var i = 0; i < 10; i++) {
    print(i);
  }
}

void updateUI() {
  setState(() {});
}
`;
        const doc = makeFakeDocument(code);
        const recs = predictor.generateRecommendations(doc);
        const setStateRec = recs.find(r => r.id === 'state-setstate-in-loop');
        expect(setStateRec).toBeUndefined();
    });

    test('DOES flag genuine setState-in-loop', () => {
        const code = `
void badFunction() {
  for (var i = 0; i < 10; i++) {
    setState(() {});
  }
}
`;
        const doc = makeFakeDocument(code);
        const recs = predictor.generateRecommendations(doc);
        const setStateRec = recs.find(r => r.id === 'state-setstate-in-loop');
        expect(setStateRec).toBeDefined();
    });
});