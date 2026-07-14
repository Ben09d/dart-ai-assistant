import * as vscode from 'vscode';

declare const console: {
    warn(message?: any, ...optionalParams: any[]): void;
};
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
interface CodingPattern {
    pattern: string;
    frequency: number;
    context: string;
    lastUsed: Date;
    /** Tags derived from analysis (e.g. "async", "widget", "state") */
    tags: Set<string>;
}

interface UserPreference {
    naming: string[];
    structure: string[];
    imports: string[];
}

interface AnomalyScore {
    pattern: string;
    score: number;
    isAnomaly: boolean;
    reason: string;
}

interface PatternMetrics {
    totalPatterns: number;
    avgFrequency: number;
    medianFrequency: number;
    patterns: Map<string, CodingPattern>;
    anomalies: AnomalyScore[];
}

interface FixRecord {
    error: string;
    fix: string;
    timestamp: number;
    errorType: string;
    /** Normalised embedding vector (bag-of-tokens) for fast similarity lookup */
    vector: number[];
}

function decayedScore(frequency: number, lastUsed: Date): number {
    const ageMs = Date.now() - lastUsed.getTime();
    const lambda = Math.LN2 / DECAY_HALF_LIFE_MS;
    return frequency * Math.exp(-lambda * ageMs);
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}


export class LearningEngine {
    private context: vscode.ExtensionContext;
    private patterns: Map<string, CodingPattern>;
    private preferences: UserPreference;
    private fixHistory: FixRecord[];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.patterns = new Map();
        this.preferences = {
            naming: [],
            structure: [],
            imports: []
        };
        this.fixHistory = [];
        this.loadLearningData();
    }

    private loadLearningData() {
        try {
            const savedPatterns = this.context.globalState.get<any>('codingPatterns');
            const savedPreferences = this.context.globalState.get<UserPreference>('userPreferences');
            const savedHistory = this.context.globalState.get<FixRecord[]>('fixHistory');

            if (savedPatterns && typeof savedPatterns === 'object') {
                try {
                    this.patterns = new Map(Object.entries(savedPatterns));
                } catch (error) {
                    console.warn('Failed to load patterns:', error);
                    this.patterns = new Map();
                }
            }

            if (savedPreferences && typeof savedPreferences === 'object') {
                this.preferences = savedPreferences;
            }

            if (Array.isArray(savedHistory)) {
                this.fixHistory = savedHistory;
            }
        } catch (error) {
            console.warn('Error loading learning data:', error);
            // Continue with defaults
        }
    }

    private async saveLearningData() {
        try {
            await this.context.globalState.update('codingPatterns', Object.fromEntries(this.patterns));
            await this.context.globalState.update('userPreferences', this.preferences);
            await this.context.globalState.update('fixHistory', this.fixHistory);
        } catch (error) {
            console.warn('Error saving learning data:', error);
            // Don't throw - just log and continue
        }
    }


    /**
     * Predict likely errors based on recent patterns and error history.
     * Returns list of (error_type, probability) pairs.
     */
    predictLikelyErrors(recentCode: string): Array<{ errorType: string; probability: number }> {
        const errorCounts: Record<string, number> = {};
        const totalErrors = this.fixHistory.length || 1;

        for (const fix of this.fixHistory) {
            errorCounts[fix.errorType] = (errorCounts[fix.errorType] ?? 0) + 1;
        }

        // Check which error types are related to patterns in recent code
        const relatedErrors: Record<string, number> = {};
        const codeTokens = tokenize(recentCode);

        for (const fix of this.fixHistory) {
            const fixTokens = tokenize(fix.error + ' ' + fix.fix);
            const overlap = codeTokens.filter(t => fixTokens.includes(t)).length;

            if (overlap > 0) {
                relatedErrors[fix.errorType] = (relatedErrors[fix.errorType] ?? 0) + overlap;
            }
        }

        // Combine base probabilities with code-specific signals
        const predictions: Array<{ errorType: string; probability: number }> = [];
        for (const [errorType, relatedCount] of Object.entries(relatedErrors)) {
            const baseProb = (errorCounts[errorType] ?? 0) / totalErrors;
            const relatedProb = relatedCount / totalErrors;
            const combined = (baseProb * 0.6 + relatedProb * 0.4);
            predictions.push({ errorType, probability: combined });
        }

        return predictions.sort((a, b) => b.probability - a.probability).slice(0, 5);
    }


    /**
     * Compute quality metrics for all patterns.
     * Helps identify which patterns are most valuable for learning.
     */
    getPatternMetrics(): PatternMetrics {
        const patterns = Array.from(this.patterns.values());
        const frequencies = patterns.map(p => p.frequency);

        const sorted = [...frequencies].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return {
            totalPatterns: patterns.length,
            avgFrequency: frequencies.length > 0 ? frequencies.reduce((a, b) => a + b, 0) / frequencies.length : 0,
            medianFrequency: median,
            patterns: this.patterns,
            anomalies: this.detectAnomalies()
        };
    }



    /**
     * Predict the most likely next pattern given the current line context.
     * Uses a simple bigram model built from co-occurring pattern types.
     */
    predictNextPattern(currentLine: string): string[] {
        const matchingTags = new Set<string>();

        for (const [, p] of this.patterns) {
            if (currentLine.includes(p.pattern.split(':')[1] ?? '')) {
                for (const t of p.tags) matchingTags.add(t);
            }
        }

        const candidates = Array.from(this.patterns.values())
            .filter(p => Array.from(p.tags).some(t => matchingTags.has(t)))
            .map(p => ({ pattern: p.pattern, score: decayedScore(p.frequency, p.lastUsed) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(x => x.pattern);

        return candidates;
    }


    recordEdit(event: vscode.TextDocumentChangeEvent) {
        try {
            for (const change of event.contentChanges) {
                try {
                    const text = change.text;

                    // Learn from variable naming
                    this.learnNamingConvention(text);

                    // Learn from code structure
                    this.learnStructurePattern(text);

                    // Learn from imports
                    this.learnImportPattern(text);
                } catch (error) {
                    console.warn('Error recording single edit:', error);
                }
            }
        } catch (error) {
            console.warn('Error in recordEdit:', error);
        }
    }

    async analyzePatterns(document: vscode.TextDocument) {
        try {
            const text = document.getText();
            const lines = text.split('\n');

            // Analyze class structures
            for (let i = 0; i < lines.length; i++) {
                try {
                    const line = lines[i];

                    if (line.includes('class ')) {
                        this.recordPattern('class_structure', line, this.getContext(lines, i));
                    }

                    if (line.includes('Future<')) {
                        this.recordPattern('async_pattern', line, this.getContext(lines, i));
                    }

                    if (line.includes('setState(')) {
                        this.recordPattern('state_management', line, this.getContext(lines, i));
                    }
                } catch (error) {
                    console.warn('Error analyzing line:', error);
                }
            }

            await this.saveLearningData();
        } catch (error) {
            console.warn('Error in analyzePatterns:', error);
        }
    }

    recordFix(errors: any[], fixes: any[]) {
        try {
            for (let i = 0; i < errors.length && i < fixes.length; i++) {
                try {
                    this.fixHistory.push({
                        error: errors[i].message || 'unknown',
                        fix: fixes[i].newText || 'unknown',
                        timestamp: Date.now(),
                        errorType: errors[i].code || 'unknown',
                        vector: tokenize(errors[i].message || 'unknown').map((_, i) => i)
                    });
                } catch (error) {
                    console.warn('Error recording single fix:', error);
                }
            }

            // Keep only last 100 fixes
            if (this.fixHistory.length > 100) {
                this.fixHistory = this.fixHistory.slice(-100);
            }

            this.saveLearningData().catch(error => {
                console.warn('Error saving fix history:', error);
            });
        } catch (error) {
            console.warn('Error in recordFix:', error);
        }
    }

    getSimilarFix(errorMessage: string): string | null {
        // Find similar errors in history
        for (const history of this.fixHistory.reverse()) {
            if (this.calculateSimilarity(errorMessage, history.error) > 0.7) {
                return history.fix;
            }
        }
        return null;
    }

    getPreferredPattern(type: string): string[] {
        const patterns = Array.from(this.patterns.values())
            .filter(p => p.pattern.includes(type))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5)
            .map(p => p.pattern);

        return patterns;
    }

    getCompletionSuggestions(prefix: string): string[] {
        const suggestions: string[] = [];

        // Get patterns that match the prefix
        for (const [key, pattern] of this.patterns) {
            if (pattern.pattern.startsWith(prefix)) {
                suggestions.push(pattern.pattern);
            }
        }

        // Sort by frequency
        suggestions.sort((a, b) => {
            const freqA = this.patterns.get(a)?.frequency || 0;
            const freqB = this.patterns.get(b)?.frequency || 0;
            return freqB - freqA;
        });

        return suggestions.slice(0, 10);
    }

    private learnNamingConvention(text: string) {
        try {
            // Extract variable names
            const variablePattern = /\b(var|final|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
            const matches = text.matchAll(variablePattern);

            for (const match of matches) {
                try {
                    const varName = match[2];

                    // Analyze naming style
                    if (this.isCamelCase(varName)) {
                        this.preferences.naming.push('camelCase');
                    } else if (this.isSnakeCase(varName)) {
                        this.preferences.naming.push('snake_case');
                    }
                } catch (error) {
                    console.warn('Error learning naming convention:', error);
                }
            }

            // Keep only recent preferences
            if (this.preferences.naming.length > 50) {
                this.preferences.naming = this.preferences.naming.slice(-50);
            }
        } catch (error) {
            console.warn('Error in learnNamingConvention:', error);
        }
    }

    private learnStructurePattern(text: string) {
        if (text.includes('class ') && text.includes('extends')) {
            this.preferences.structure.push('inheritance');
        }

        if (text.includes('mixin ')) {
            this.preferences.structure.push('mixins');
        }

        if (text.includes('factory ')) {
            this.preferences.structure.push('factory_pattern');
        }

        if (this.preferences.structure.length > 50) {
            this.preferences.structure = this.preferences.structure.slice(-50);
        }
    }

    private learnImportPattern(text: string) {
        const importPattern = /import\s+['"]([^'"]+)['"]/g;
        const matches = text.matchAll(importPattern);

        for (const match of matches) {
            this.preferences.imports.push(match[1]);
        }

        if (this.preferences.imports.length > 50) {
            this.preferences.imports = this.preferences.imports.slice(-50);
        }
    }

    private recordPattern(type: string, pattern: string, context: string) {
        const key = `${type}:${pattern}`;

        if (this.patterns.has(key)) {
            const existing = this.patterns.get(key)!;
            existing.frequency++;
            existing.lastUsed = new Date();
        } else {
            this.patterns.set(key, {
                pattern,
                frequency: 1,
                context,
                lastUsed: new Date(),
                tags: new Set,
            });
        }
    }

    private getContext(lines: string[], index: number): string {
        const start = Math.max(0, index - 2);
        const end = Math.min(lines.length, index + 3);
        return lines.slice(start, end).join('\n');
    }

    private isCamelCase(str: string): boolean {
        return /^[a-z][a-zA-Z0-9]*$/.test(str);
    }

    private isSnakeCase(str: string): boolean {
        return /^[a-z][a-z0-9_]*$/.test(str);
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    getStatistics() {
        const totalPatterns = this.patterns.size;
        const mostUsedPatterns = Array.from(this.patterns.values())
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

        const namingStyle = this.getMostCommon(this.preferences.naming);
        const structureStyle = this.getMostCommon(this.preferences.structure);

        return {
            totalPatterns,
            mostUsedPatterns,
            preferredNaming: namingStyle,
            preferredStructure: structureStyle,
            totalFixes: this.fixHistory.length
        };
    }

    private getMostCommon(arr: string[]): string {
        const counts = new Map<string, number>();

        for (const item of arr) {
            counts.set(item, (counts.get(item) || 0) + 1);
        }

        let max = 0;
        let most = '';

        for (const [item, count] of counts) {
            if (count > max) {
                max = count;
                most = item;
            }
        }

        return most;
    }

      /**
     * Detect anomalous patterns that deviate from user's coding norms.
     * Uses statistical methods (z-score, isolation) to flag suspicious patterns.
     */
    detectAnomalies(): AnomalyScore[] {
        const allPatterns = Array.from(this.patterns.values());
        if (allPatterns.length < 5) return [];

        const frequencies = allPatterns.map(p => p.frequency);
        const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
        const variance = frequencies.reduce((a, b) => a + (b - mean) ** 2, 0) / frequencies.length;
        const stdDev = Math.sqrt(variance);

        const anomalies: AnomalyScore[] = [];

        for (const pattern of allPatterns) {
            // Z-score detection
            const zScore = (pattern.frequency - mean) / (stdDev + 1);

            // Recency anomaly: pattern used recently but low frequency
            const daysOld = (Date.now() - pattern.lastUsed.getTime()) / 86_400_000;
            const isRecent = daysOld < 1;
            const isRare = pattern.frequency < mean * 0.3;

            if (Math.abs(zScore) > 2) {
                anomalies.push({
                    pattern: pattern.pattern,
                    score: Math.abs(zScore),
                    isAnomaly: true,
                    reason: zScore > 2 ? 'unusually_frequent' : 'unusually_rare'
                });
            } else if (isRecent && isRare) {
                anomalies.push({
                    pattern: pattern.pattern,
                    score: 1.5,
                    isAnomaly: true,
                    reason: 'recent_but_rare'
                });
            }
        }

        return anomalies.sort((a, b) => b.score - a.score).slice(0, 10);
    }
}
