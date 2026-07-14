import type * as vscode from 'vscode';

declare const console: {
    warn(message?: any, ...optionalParams: any[]): void;
};

interface CodeSequence {
    current: string;
    next: string;
    frequency: number;
    context: string;
    confidence: number;
}

interface PredictionContext {
    previousLine: string;
    currentLine: string;
    nextLineHint: string;
    indentLevel: number;
}

export class CodePredictionEngine {
    private context: vscode.ExtensionContext;
    private codeSequences: Map<string, CodeSequence[]>;
    private linePatterns: Map<string, string[]>;
    private functionPatterns: Map<string, string[]>;
    private blockPatterns: Map<string, string[]>;
    private maxSequences: number = 300;
    private minConfidence: number = 0.6;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.codeSequences = new Map();
        this.linePatterns = new Map();
        this.functionPatterns = new Map();
        this.blockPatterns = new Map();
        this.loadPredictionData();
    }

    /**
     * Learn code sequences from document
     * Tracks what code comes after what
     */
    analyzeDocument(document: vscode.TextDocument) {
        try {
            const text = document.getText();
            const lines = text.split('\n');

            // Analyze line sequences
            for (let i = 0; i < lines.length - 1; i++) {
                const currentLine = lines[i].trim();
                const nextLine = lines[i + 1].trim();

                if (currentLine && nextLine) {
                    this.recordSequence(currentLine, nextLine, 'line', lines[i]);
                }

                // Analyze function patterns
                if (currentLine.includes('Function') || currentLine.includes('void ')) {
                    this.recordFunctionPattern(currentLine, nextLine);
                }

                // Analyze block patterns (if, for, while, etc)
                if (this.isBlockStart(currentLine)) {
                    this.recordBlockPattern(currentLine, nextLine);
                }
            }

            this.savePredictionData();
        } catch (error) {
            console.warn('Error analyzing document for predictions:', error);
        }
    }

    /**
     * Record a code sequence for future prediction
     */
    private recordSequence(current: string, next: string, context: string, fullLine: string) {
        try {
            const key = `${context}:${current}`;

            if (!this.codeSequences.has(key)) {
                this.codeSequences.set(key, []);
            }

            const sequences = this.codeSequences.get(key)!;
            const existing = sequences.find(s => s.next === next);

            if (existing) {
                existing.frequency++;
                existing.confidence = Math.min(100, existing.confidence + 2);
            } else {
                sequences.push({
                    current,
                    next,
                    frequency: 1,
                    context: fullLine,
                    confidence: 40
                });
            }

            // Keep only top sequences
            if (sequences.length > 10) {
                sequences.sort((a, b) => b.frequency - a.frequency);
                this.codeSequences.set(key, sequences.slice(0, 10));
            }

            // Maintain size limit
            if (this.codeSequences.size > this.maxSequences) {
                const oldestKey = Array.from(this.codeSequences.keys())[0];
                this.codeSequences.delete(oldestKey);
            }
        } catch (error) {
            console.warn('Error recording sequence:', error);
        }
    }

    /**
     * Record function patterns for prediction
     */
    private recordFunctionPattern(currentLine: string, nextLine: string) {
        try {
            const funcKey = this.extractFunctionSignature(currentLine);
            
            if (funcKey && nextLine) {
                if (!this.functionPatterns.has(funcKey)) {
                    this.functionPatterns.set(funcKey, []);
                }

                const patterns = this.functionPatterns.get(funcKey)!;
                if (!patterns.includes(nextLine)) {
                    patterns.push(nextLine);
                }

                // Keep recent patterns
                if (patterns.length > 5) {
                    this.functionPatterns.set(funcKey, patterns.slice(-5));
                }
            }
        } catch (error) {
            
            console.warn('Error recording function pattern:', error);
        }
    }

    /**
     * Record block patterns (if, for, while, etc)
     */
    private recordBlockPattern(currentLine: string, nextLine: string) {
        try {
            const blockType = this.detectBlockType(currentLine);
            
            if (blockType && nextLine) {
                const key = `${blockType}:pattern`;
                
                if (!this.blockPatterns.has(key)) {
                    this.blockPatterns.set(key, []);
                }

                const patterns = this.blockPatterns.get(key)!;
                if (!patterns.includes(nextLine)) {
                    patterns.push(nextLine);
                }

                if (patterns.length > 10) {
                    this.blockPatterns.set(key, patterns.slice(-10));
                }
            }
        } catch (error) {
            console.warn('Error recording block pattern:', error);
        }
    }

    /**
     * Predict what comes next based on current code
     */
    predictNextLine(currentLine: string): string[] {
        try {
            const predictions: string[] = [];
            const trimmed = currentLine.trim();

            // Get sequence predictions
            const sequenceKey = `line:${trimmed}`;
            if (this.codeSequences.has(sequenceKey)) {
                const sequences = this.codeSequences.get(sequenceKey)!;
                sequences
                    .filter(s => s.confidence >= this.minConfidence)
                    .sort((a, b) => b.frequency - a.frequency)
                    .slice(0, 3)
                    .forEach(s => {
                        if (!predictions.includes(s.next)) {
                            predictions.push(s.next);
                        }
                    });
            }

            // Get function body predictions
            if (trimmed.includes('Function') || trimmed.includes(') {')) {
                const funcKey = this.extractFunctionSignature(trimmed);
                if (funcKey && this.functionPatterns.has(funcKey)) {
                    const patterns = this.functionPatterns.get(funcKey)!;
                    patterns.slice(0, 2).forEach(p => {
                        if (!predictions.includes(p)) {
                            predictions.push(p);
                        }
                    });
                }
            }

            // Get block predictions
            if (this.isBlockStart(trimmed)) {
                const blockType = this.detectBlockType(trimmed);
                const blockKey = `${blockType}:pattern`;
                if (this.blockPatterns.has(blockKey)) {
                    const patterns = this.blockPatterns.get(blockKey)!;
                    patterns.slice(0, 2).forEach(p => {
                        if (!predictions.includes(p)) {
                            predictions.push(p);
                        }
                    });
                }
            }

            return predictions.slice(0, 5); // Return top 5 predictions
        } catch (error) {
            console.warn('Error predicting next line:', error);
            return [];
        }
    }

    /**
     * Predict multiple next lines
     */
    predictNextLines(currentLine: string, count: number = 3): string[][] {
        try {
            const predictions: string[][] = [];
            let line = currentLine;

            for (let i = 0; i < count; i++) {
                const nextLines = this.predictNextLine(line);
                if (nextLines.length === 0) break;

                predictions.push(nextLines);
                line = nextLines[0]; // Use best prediction for next iteration
            }

            return predictions;
        } catch (error) {
            console.warn('Error predicting multiple lines:', error);
            return [];
        }
    }

    /**
     * Get context-aware predictions
     */
    getPredictionsWithContext(editor: vscode.TextEditor): string[] {
        try {
            const document = editor.document;
            const position = editor.selection.active;
            const currentLine = document.lineAt(position.line);
            
            // Get previous line for context
            const prevLine = position.line > 0 
                ? document.lineAt(position.line - 1).text.trim()
                : '';

            // Analyze indent level
            const indentLevel = currentLine.text.length - currentLine.text.trimLeft().length;

            const context: PredictionContext = {
                previousLine: prevLine,
                currentLine: currentLine.text.trim(),
                nextLineHint: this.getNextLineHint(document, position.line),
                indentLevel: Math.floor(indentLevel / 4) // Assuming 4-space indent
            };

            return this.predictWithContext(context);
        } catch (error) {
            console.warn('Error getting context predictions:', error);
            return [];
        }
    }

    /**
     * Predict based on context
     */
    private predictWithContext(context: PredictionContext): string[] {
        try {
            const predictions: string[] = [];

            // Predict based on current line
            const basePredictions = this.predictNextLine(context.currentLine);
            predictions.push(...basePredictions);

            // Adjust indent for predictions
            const indent = '  '.repeat(context.indentLevel);
            const adjustedPredictions = basePredictions.map(p => indent + p);

            // Handle closing braces/brackets
            if (context.currentLine.includes('{') && !context.currentLine.includes('}')) {
                const closingBrace = '}'.repeat((context.currentLine.match(/{/g) || []).length);
                predictions.push(indent + closingBrace);
            }

            return adjustedPredictions.slice(0, 5);
        } catch (error) {
            console.warn('Error predicting with context:', error);
            return [];
        }
    }

    /**
     * Predict next complete statement
     */
    predictStatement(currentCode: string): string | null {
        try {
            const lines = currentCode.split('\n');
            const lastLine = lines[lines.length - 1].trim();

            // Complete common patterns
            if (lastLine.includes('if (')) {
                return '{\n  \n}';
            }
            if (lastLine.includes('for (')) {
                return '{\n  \n}';
            }
            if (lastLine.includes('while (')) {
                return '{\n  \n}';
            }
            if (lastLine.includes('class ')) {
                return '{\n  \n}';
            }
            if (lastLine.endsWith(',')) {
                const predictions = this.predictNextLine(lastLine);
                return predictions.length > 0 ? predictions[0] : null;
            }

            return null;
        } catch (error) {
            console.warn('Error predicting statement:', error);
            return null;
        }
    }

    /**
     * Get prediction confidence score
     */
    getPredictionConfidence(currentLine: string, nextLine: string): number {
        try {
            const trimmed = currentLine.trim();
            const sequenceKey = `line:${trimmed}`;

            if (this.codeSequences.has(sequenceKey)) {
                const sequences = this.codeSequences.get(sequenceKey)!;
                const match = sequences.find(s => s.next === nextLine);
                if (match) {
                    return match.confidence;
                }
            }

            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get top predictions ranked by confidence
     */
    getRankedPredictions(currentLine: string): Array<{ prediction: string; confidence: number; frequency: number }> {
        try {
            const trimmed = currentLine.trim();
            const sequenceKey = `line:${trimmed}`;

            if (this.codeSequences.has(sequenceKey)) {
                const sequences = this.codeSequences.get(sequenceKey)!;
                return sequences
                    .map(s => ({
                        prediction: s.next,
                        confidence: s.confidence,
                        frequency: s.frequency
                    }))
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 10);
            }

            return [];
        } catch (error) {
            console.warn('Error getting ranked predictions:', error);
            return [];
        }
    }

    /**
     * Helper: Extract function signature
     */
    private extractFunctionSignature(line: string): string | null {
        try {
            const match = line.match(/(\w+\s+)?(\w+)\s*\(/);
            return match ? match[0].trim() : null;
        } catch {
            return null;
        }
    }

    /**
     * Helper: Check if line starts a block
     */
    private isBlockStart(line: string): boolean {
        return /^(if|else|for|while|switch|try|catch|class|void|Future)/.test(line.trim());
    }

    /**
     * Helper: Detect block type
     */
    private detectBlockType(line: string): string {
        if (line.includes('if ')) return 'if';
        if (line.includes('for ')) return 'for';
        if (line.includes('while ')) return 'while';
        if (line.includes('switch ')) return 'switch';
        if (line.includes('try ')) return 'try';
        if (line.includes('catch ')) return 'catch';
        if (line.includes('class ')) return 'class';
        if (line.includes('void ')) return 'void';
        return 'block';
    }

    /**
     * Get hint for next line
     */
    private getNextLineHint(document: vscode.TextDocument, lineIndex: number): string {
        try {
            if (lineIndex + 1 < document.lineCount) {
                return document.lineAt(lineIndex + 1).text.trim();
            }
            return '';
        } catch {
            return '';
        }
    }

    /**
     * Save prediction data locally
     */
    private savePredictionData() {
        try {
            const sequencesObj: { [key: string]: any } = {};
            this.codeSequences.forEach((sequences, key) => {
                sequencesObj[key] = sequences.map(s => ({
                    current: s.current,
                    next: s.next,
                    frequency: s.frequency,
                    confidence: s.confidence
                }));
            });

            this.context.globalState.update('codePredictions', {
                sequences: sequencesObj,
                functionPatterns: Array.from(this.functionPatterns.entries()),
                blockPatterns: Array.from(this.blockPatterns.entries())
            });
        } catch (error) {
            console.warn('Error saving prediction data:', error);
        }
    }

    /**
     * Load prediction data
     */
    private loadPredictionData() {
        try {
            const saved = this.context.globalState.get<any>('codePredictions');
            if (saved) {
                if (saved.sequences) {
                    Object.entries(saved.sequences).forEach(([key, sequences]: [string, any]) => {
                        this.codeSequences.set(key, sequences);
                    });
                }
                if (saved.functionPatterns) {
                    this.functionPatterns = new Map(saved.functionPatterns);
                }
                if (saved.blockPatterns) {
                    this.blockPatterns = new Map(saved.blockPatterns);
                }
            }
        } catch (error) {
            console.warn('Error loading prediction data:', error);
        }
    }

    /**
     * Get prediction statistics
     */
    getStatistics() {
        return {
            totalSequences: this.codeSequences.size,
            totalFunctionPatterns: this.functionPatterns.size,
            totalBlockPatterns: this.blockPatterns.size,
            memoryEstimate: `${(this.codeSequences.size * 500) / 1024 / 1024} MB`
        };
    }

    /**
     * Clear old predictions
     */
    clearOldPredictions() {
        try {
            // Remove low-frequency sequences
            this.codeSequences.forEach((sequences, key) => {
                const filtered = sequences.filter(s => s.frequency > 1);
                if (filtered.length === 0) {
                    this.codeSequences.delete(key);
                } else {
                    this.codeSequences.set(key, filtered);
                }
            });

            this.savePredictionData();
        } catch (error) {
            console.warn('Error clearing old predictions:', error);
        }
    }
}
