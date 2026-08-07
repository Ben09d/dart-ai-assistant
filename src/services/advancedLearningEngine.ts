import * as vscode from 'vscode';

declare const console: {
    warn(message?: any, ...optionalParams: any[]): void;
};

interface Pattern {
    pattern: string;
    frequency: number;
    context: string;
    lastUsed: Date;
    firstSeen: Date;
    contexts: string[];
    relatedPatterns: string[];
    confidence: number;
}

interface PatternRelationship {
    pattern1: string;
    pattern2: string;
    frequency: number;
    coOccurrences: number;
}

interface NamingPattern {
    prefix: string;
    suffix: string;
    type: string; // variable, method, class, property
    frequency: number;
    examples: string[];
}

interface CodeSmellDetected {
    type: string;
    location: string;
    suggestion: string;
    confidence: number;
}

interface LearningStats {
    totalPatterns: number;
    mostUsedPatterns: Pattern[];
    preferredNaming: string;
    preferredStructure: string[];
    totalFixes: number;
    learningAccuracy: number; // 0-100
    commonRelationships: PatternRelationship[];
    codeSmells: CodeSmellDetected[];
    learningTrend: 'improving' | 'stable' | 'new_patterns';
    suggestedPatterns: Pattern[];
    recentPatterns: Pattern[];
}

export class AdvancedLearningEngine {
    private context: vscode.ExtensionContext;
    private patterns: Map<string, Pattern>;
    private patternRelationships: Map<string, PatternRelationship>;
    private namingPatterns: Map<string, NamingPattern>;
    private fixHistory: Array<{ error: string; fix: string; timestamp: Date }>;
    private editHistory: Array<{ timestamp: Date; type: string; pattern: string }>;
    private contextHistory: string[];
    private preferences: {
        naming: string[];
        structure: string[];
        imports: string[];
        functionStyle: string[];
        classStyle: string[];
    };

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.patterns = new Map();
        this.patternRelationships = new Map();
        this.namingPatterns = new Map();
        this.fixHistory = [];
        this.editHistory = [];
        this.contextHistory = [];
        this.preferences = {
            naming: [],
            structure: [],
            imports: [],
            functionStyle: [],
            classStyle: []
        };
        this.loadLearningData();
    }

    private loadLearningData() {
        try {
            const saved = this.context.globalState.get<any>('advancedLearning');
            if (saved && typeof saved === 'object') {
                // Load patterns with full data
                if (saved.patterns) {
                    Object.entries(saved.patterns).forEach(([key, value]: [string, any]) => {
                        try {
                            const pattern: Pattern = {
                                pattern: value.pattern || key,
                                frequency: value.frequency || 1,
                                context: value.context || '',
                                lastUsed: value.lastUsed ? new Date(value.lastUsed) : new Date(),
                                firstSeen: value.firstSeen ? new Date(value.firstSeen) : new Date(),
                                contexts: value.contexts || [],
                                relatedPatterns: value.relatedPatterns || [],
                                confidence: value.confidence || 50
                            };
                            this.patterns.set(key, pattern);
                        } catch (error) {
                            console.warn('Error loading pattern:', error);
                        }
                    });
                }

                if (saved.preferences) {
                    this.preferences = saved.preferences;
                }

                if (saved.fixHistory) {
                    this.fixHistory = saved.fixHistory.map((h: any) => ({
                        error: h.error,
                        fix: h.fix,
                        timestamp: new Date(h.timestamp)
                    }));
                }
            }
        } catch (error) {
            console.warn('Error loading advanced learning data:', error);
        }
    }

    private async saveLearningData() {
        try {
            const patternsObj: { [key: string]: any } = {};
            this.patterns.forEach((pattern, key) => {
                patternsObj[key] = {
                    pattern: pattern.pattern,
                    frequency: pattern.frequency,
                    context: pattern.context,
                    lastUsed: pattern.lastUsed.toISOString(),
                    firstSeen: pattern.firstSeen.toISOString(),
                    contexts: pattern.contexts,
                    relatedPatterns: pattern.relatedPatterns,
                    confidence: pattern.confidence
                };
            });

            await this.context.globalState.update('advancedLearning', {
                patterns: patternsObj,
                preferences: this.preferences,
                fixHistory: this.fixHistory
            });
        } catch (error) {
            console.warn('Error saving learning data:', error);
        }
    }

    recordEdit(event: vscode.TextDocumentChangeEvent) {
        try {
            for (const change of event.contentChanges) {
                try {
                    const text = change.text;

                    // Learn naming patterns
                    this.learnNamingPatterns(text);

                    // Learn structure patterns
                    this.learnStructurePatterns(text);

                    // Learn import patterns
                    this.learnImportPatterns(text);

                    // Learn function/class styles
                    this.learnCodeStyles(text);

                    // Record edit history
                    this.editHistory.push({
                        timestamp: new Date(),
                        type: 'edit',
                        pattern: text
                    });

                    // Keep only last 1000 edits
                    if (this.editHistory.length > 1000) {
                        this.editHistory = this.editHistory.slice(-1000);
                    }
                } catch (error) {
                    (globalThis as any).console && (globalThis as any).console.warn('Error recording edit:', error);
                }
            }
        } catch (error) {
            (globalThis as any).console && (globalThis as any).console.warn('Error in recordEdit:', error);
        }
    }

    async analyzePatterns(document: vscode.TextDocument) {
        try {
            const text = document.getText();
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                try {
                    const line = lines[i];
                    const context = this.getContext(lines, i);

                    // Analyze class patterns
                    if (line.includes('class ')) {
                        this.recordPattern('class_definition', line, context);
                        this.detectClassStyle(line);
                    }

                    // Analyze function patterns
                    if (line.includes('Function') || line.includes('void') || line.includes('Future<')) {
                        this.recordPattern('function_definition', line, context);
                        this.detectFunctionStyle(line);
                    }

                    // Analyze async patterns
                    if (line.includes('async') || line.includes('await')) {
                        this.recordPattern('async_pattern', line, context);
                    }

                    // Analyze state management
                    if (line.includes('setState') || line.includes('Provider') || line.includes('Riverpod')) {
                        this.recordPattern('state_management', line, context);
                    }

                    // Analyze error handling
                    if (line.includes('try') || line.includes('catch') || line.includes('throw')) {
                        this.recordPattern('error_handling', line, context);
                    }

                    // Analyze collection operations
                    if (line.includes('.map(') || line.includes('.where(') || line.includes('.reduce(')) {
                        this.recordPattern('collection_operation', line, context);
                    }
                } catch (error) {
                    console.warn('Error analyzing line:', error);
                }
            }

            // Analyze relationships between patterns
            this.analyzePatternRelationships();

            // Detect code smells
            this.detectCodeSmells(document);

            // Update confidence levels
            this.updateConfidenceLevels();

            await this.saveLearningData();
        } catch (error) {
            console.warn('Error in analyzePatterns:', error);
        }
    }

    private learnNamingPatterns(text: string) {
        try {
            // Variable names
            const varPattern = /\b(var|final|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
            const matches = text.matchAll(varPattern);

            for (const match of matches) {
                try {
                    const varName = match[2];
                    const key = `var_${varName}`;

                    let pattern = this.namingPatterns.get(key);
                    if (!pattern) {
                        pattern = {
                            prefix: this.extractPrefix(varName),
                            suffix: this.extractSuffix(varName),
                            type: 'variable',
                            frequency: 0,
                            examples: []
                        };
                    }

                    pattern.frequency++;
                    if (!pattern.examples.includes(varName) && pattern.examples.length < 5) {
                        pattern.examples.push(varName);
                    }

                    this.namingPatterns.set(key, pattern);
                } catch (error) {
                    console.warn('Error learning variable naming:', error);
                }
            }

            // Method names
            const methodPattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
            const methodMatches = text.matchAll(methodPattern);

            for (const match of methodMatches) {
                try {
                    const methodName = match[1];
                    if (methodName.length > 2) {
                        const key = `method_${methodName}`;

                        let pattern = this.namingPatterns.get(key);
                        if (!pattern) {
                            pattern = {
                                prefix: this.extractPrefix(methodName),
                                suffix: this.extractSuffix(methodName),
                                type: 'method',
                                frequency: 0,
                                examples: []
                            };
                        }

                        pattern.frequency++;
                        if (!pattern.examples.includes(methodName) && pattern.examples.length < 5) {
                            pattern.examples.push(methodName);
                        }

                        this.namingPatterns.set(key, pattern);
                    }
                } catch (error) {
                    console.warn('Error learning method naming:', error);
                }
            }
        } catch (error) {
            console.warn('Error in learnNamingPatterns:', error);
        }
    }

    private learnStructurePatterns(text: string) {
        try {
            if (text.includes('extends')) {
                this.preferences.structure.push('inheritance');
            }
            if (text.includes('mixin ')) {
                this.preferences.structure.push('mixins');
            }
            if (text.includes('factory ')) {
                this.preferences.structure.push('factory_pattern');
            }
            if (text.includes('abstract')) {
                this.preferences.structure.push('abstract_classes');
            }
            if (text.includes('interface ')) {
                this.preferences.structure.push('interfaces');
            }
            if (text.includes('enum ')) {
                this.preferences.structure.push('enums');
            }

            // Keep recent preferences
            if (this.preferences.structure.length > 100) {
                this.preferences.structure = this.preferences.structure.slice(-100);
            }
        } catch (error) {
            console.warn('Error in learnStructurePatterns:', error);
        }
    }

    private learnImportPatterns(text: string) {
        try {
            const importPattern = /import\s+['"]([^'"]+)['"]/g;
            const matches = text.matchAll(importPattern);

            for (const match of matches) {
                try {
                    const importPath = match[1];
                    this.preferences.imports.push(importPath);
                } catch (error) {
                    console.warn('Error learning import:', error);
                }
            }

            // Keep top imports
            if (this.preferences.imports.length > 100) {
                this.preferences.imports = this.preferences.imports.slice(-100);
            }
        } catch (error) {
            console.warn('Error in learnImportPatterns:', error);
        }
    }

    private learnCodeStyles(text: string) {
        try {
            // Function style detection
            if (text.includes('=>')) {
                this.preferences.functionStyle.push('arrow_functions');
            }
            if (text.includes('async {')) {
                this.preferences.functionStyle.push('async_blocks');
            }
            if (text.includes('async*')) {
                this.preferences.functionStyle.push('async_generators');
            }

            // Class style detection
            if (text.includes('const ')) {
                this.preferences.classStyle.push('const_constructors');
            }
            if (text.includes('final')) {
                this.preferences.classStyle.push('final_fields');
            }
            if (text.includes('late ')) {
                this.preferences.classStyle.push('late_fields');
            }

            // Keep recent styles
            this.preferences.functionStyle = this.preferences.functionStyle.slice(-50);
            this.preferences.classStyle = this.preferences.classStyle.slice(-50);
        } catch (error) {
            console.warn('Error in learnCodeStyles:', error);
        }
    }

    private detectClassStyle(line: string): string {
        if (line.includes('abstract class')) return 'abstract';
        if (line.includes('class') && line.includes('extends')) return 'inheritance';
        if (line.includes('class') && line.includes('with')) return 'mixin_composition';
        if (line.includes('class') && line.includes('implements')) return 'interface_impl';
        return 'standard';
    }

    private detectFunctionStyle(line: string): string {
        if (line.includes('=>')) return 'arrow';
        if (line.includes('async {')) return 'async_block';
        if (line.includes('async*')) return 'async_generator';
        if (line.includes('Future<')) return 'future_returning';
        return 'standard';
    }

    private recordPattern(type: string, pattern: string, context: string) {
        try {
            const key = `${type}:${pattern}`;

            if (this.patterns.has(key)) {
                const existing = this.patterns.get(key)!;
                existing.frequency++;
                existing.lastUsed = new Date();
                if (!existing.contexts.includes(context)) {
                    existing.contexts.push(context);
                }
            } else {
                this.patterns.set(key, {
                    pattern,
                    frequency: 1,
                    context,
                    lastUsed: new Date(),
                    firstSeen: new Date(),
                    contexts: [context],
                    relatedPatterns: [],
                    confidence: 40
                });
            }
        } catch (error) {
            console.warn('Error recording pattern:', error);
        }
    }

    private analyzePatternRelationships() {
        try {
            // Find patterns that appear together
            const recentPatterns = Array.from(this.patterns.values())
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 20);

            for (let i = 0; i < recentPatterns.length; i++) {
                for (let j = i + 1; j < recentPatterns.length; j++) {
                    try {
                        const p1 = recentPatterns[i];
                        const p2 = recentPatterns[j];

                        // Count co-occurrences
                        const coOccurrences = this.countCoOccurrences(p1, p2);

                        if (coOccurrences > 0) {
                            const key = `${p1.pattern}|${p2.pattern}`;
                            const relationship: PatternRelationship = {
                                pattern1: p1.pattern,
                                pattern2: p2.pattern,
                                frequency: p1.frequency + p2.frequency,
                                coOccurrences
                            };
                            this.patternRelationships.set(key, relationship);
                        }
                    } catch (error) {
                        console.warn('Error analyzing relationship:', error);
                    }
                }
            }
        } catch (error) {
            console.warn('Error in analyzePatternRelationships:', error);
        }
    }

    private countCoOccurrences(p1: Pattern, p2: Pattern): number {
        try {
            let count = 0;
            for (const ctx of p1.contexts) {
                if (p2.contexts.includes(ctx)) {
                    count++;
                }
            }
            return count;
        } catch (error) {
            return 0;
        }
    }

    private detectCodeSmells(document: vscode.TextDocument): CodeSmellDetected[] {
        const smells: CodeSmellDetected[] = [];

        try {
            const text = document.getText();
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Detect long lines
                if (line.length > 120) {
                    smells.push({
                        type: 'long_line',
                        location: `Line ${i + 1}`,
                        suggestion: 'Consider breaking this line into multiple lines',
                        confidence: 70
                    });
                }

                // Detect deeply nested code
                const indentMatch = line.match(/^\s*/);
                const indentLevel = ((indentMatch && indentMatch[0]) || '').length / 2;
                if (indentLevel > 5) {
                    smells.push({
                        type: 'deep_nesting',
                        location: `Line ${i + 1}`,
                        suggestion: 'Consider extracting this into a separate method',
                        confidence: 65
                    });
                }

                // Detect potential null dereference
                if (line.includes('.') && !line.includes('?.') && !line.includes('null')) {
                    smells.push({
                        type: 'potential_null_deref',
                        location: `Line ${i + 1}`,
                        suggestion: 'Consider using ?. (null-aware operator)',
                        confidence: 50
                    });
                }
            }
        } catch (error) {
            console.warn('Error detecting code smells:', error);
        }

        return smells;
    }

    private updateConfidenceLevels() {
        try {
            this.patterns.forEach((pattern) => {
                // Confidence increases with frequency
                pattern.confidence = Math.min(100, 40 + (pattern.frequency * 5));

                // Boost confidence if recently used
                const daysOld = (new Date().getTime() - pattern.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld < 1) {
                    pattern.confidence = Math.min(100, pattern.confidence + 15);
                }

                // Consider context diversity
                pattern.confidence += Math.min(20, pattern.contexts.length * 2);
                pattern.confidence = Math.min(100, pattern.confidence);
            });
        } catch (error) {
            console.warn('Error updating confidence levels:', error);
        }
    }

    private extractPrefix(name: string): string {
        const match = name.match(/^[a-z]+/);
        return match ? match[0] : '';
    }

    private extractSuffix(name: string): string {
        const match = name.match(/[a-z]+$/);
        return match ? match[0] : '';
    }

    private getContext(lines: string[], index: number): string {
        const start = Math.max(0, index - 2);
        const end = Math.min(lines.length, index + 3);
        return lines.slice(start, end).join('\n');
    }

    recordFix(errors: any[], fixes: any[]) {
        try {
            for (let i = 0; i < errors.length && i < fixes.length; i++) {
                try {
                    this.fixHistory.push({
                        error: errors[i].message || 'unknown',
                        fix: fixes[i].newText || 'unknown',
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.warn('Error recording single fix:', error);
                }
            }

            // Keep only last 200 fixes
            if (this.fixHistory.length > 200) {
                this.fixHistory = this.fixHistory.slice(-200);
            }

            this.saveLearningData().catch(error => {
                console.warn('Error saving fix history:', error);
            });
        } catch (error) {
            console.warn('Error in recordFix:', error);
        }
    }

    getStatistics(): LearningStats {
        try {
            const allPatterns = Array.from(this.patterns.values());
            const mostUsed = allPatterns.sort((a, b) => b.frequency - a.frequency);
            const recent = allPatterns.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());

            // Calculate learning trend
            let trend: 'improving' | 'stable' | 'new_patterns' = 'stable';
            const recentEdits = this.editHistory.slice(-100);
            if (recentEdits.length > 50) {
                const newPatternsCount = recentEdits.filter(e => !this.patterns.has(e.pattern)).length;
                trend = newPatternsCount > 20 ? 'new_patterns' : 'improving';
            }

            // Calculate accuracy
            let accuracy = Math.min(100, 30 + (this.patterns.size * 2) + (this.fixHistory.length * 0.5));
            accuracy = Math.round(accuracy);

            // Get naming style
            const namingCount = new Map<string, number>();
            this.namingPatterns.forEach(pattern => {
                if (pattern.type === 'variable') {
                    const style = this.detectNamingStyle(pattern);
                    namingCount.set(style, (namingCount.get(style) || 0) + pattern.frequency);
                }
            });

            let preferredNaming = 'Not detected yet';
            let maxCount = 0;
            namingCount.forEach((count, style) => {
                if (count > maxCount) {
                    maxCount = count;
                    preferredNaming = style;
                }
            });

            // Get structure preferences
            const structureMap = new Map<string, number>();
            this.preferences.structure.forEach(s => {
                structureMap.set(s, (structureMap.get(s) || 0) + 1);
            });

            const preferredStructure = Array.from(structureMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([s]) => s);

            return {
                totalPatterns: this.patterns.size,
                mostUsedPatterns: mostUsed.slice(0, 10),
                preferredNaming,
                preferredStructure,
                totalFixes: this.fixHistory.length,
                learningAccuracy: accuracy,
                commonRelationships: Array.from(this.patternRelationships.values())
                    .sort((a, b) => b.coOccurrences - a.coOccurrences)
                    .slice(0, 5),
                codeSmells: this.detectCodeSmells(vscode.window.activeTextEditor?.document!).slice(0, 5),
                learningTrend: trend,
                suggestedPatterns: this.getSuggestedPatterns(),
                recentPatterns: recent.slice(0, 5)
            };
        } catch (error) {
            console.warn('Error getting statistics:', error);
            return {
                totalPatterns: 0,
                mostUsedPatterns: [],
                preferredNaming: 'Not detected yet',
                preferredStructure: [],
                totalFixes: 0,
                learningAccuracy: 0,
                commonRelationships: [],
                codeSmells: [],
                learningTrend: 'stable',
                suggestedPatterns: [],
                recentPatterns: []
            };
        }
    }

    private detectNamingStyle(pattern: NamingPattern): string {
        const examples = pattern.examples.join('');
        if (/[A-Z]/.test(examples)) {
            return 'camelCase';
        } else if (/_/.test(examples)) {
            return 'snake_case';
        }
        return 'unknown';
    }

    getSuggestedPatterns(): Pattern[] {
        try {
            const allPatterns = Array.from(this.patterns.values());

            // Suggest patterns that are similar to frequently used ones
            const topPatterns = allPatterns
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 5);

            const suggestions: Pattern[] = [];
            for (const pattern of topPatterns) {
                const similar = allPatterns.filter(p =>
                    this.patternSimilarity(p.pattern, pattern.pattern) > 0.6 &&
                    p !== pattern &&
                    p.frequency < pattern.frequency
                );
                suggestions.push(...similar.slice(0, 2));
            }

            return suggestions.slice(0, 10);
        } catch (error) {
            return [];
        }
    }

    private patternSimilarity(p1: string, p2: string): number {
        try {
            const longer = p1.length > p2.length ? p1 : p2;
            const shorter = p1.length > p2.length ? p2 : p1;

            if (longer.length === 0) return 1.0;

            const editDistance = this.levenshteinDistance(longer, shorter);
            return (longer.length - editDistance) / longer.length;
        } catch (error) {
            return 0;
        }
    }

    private levenshteinDistance(s1: string, s2: string): number {
        try {
            const matrix: number[][] = [];

            for (let i = 0; i <= s2.length; i++) {
                matrix[i] = [i];
            }

            for (let j = 0; j <= s1.length; j++) {
                matrix[0][j] = j;
            }

            for (let i = 1; i <= s2.length; i++) {
                for (let j = 1; j <= s1.length; j++) {
                    if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
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

            return matrix[s2.length][s1.length];
        } catch (error) {
            return 0;
        }
    }

    getSimilarFix(errorMessage: string): string | null {
        try {
            for (const history of this.fixHistory.slice().reverse().slice(0, 50)) {
                if (this.patternSimilarity(errorMessage, history.error) > 0.65) {
                    return history.fix;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    getPatternsByType(type: string): Pattern[] {
        try {
            return Array.from(this.patterns.entries())
                .filter(([key]) => key.startsWith(type))
                .map(([, value]) => value)
                .sort((a, b) => b.frequency - a.frequency);
        } catch (error) {
            return [];
        }
    }

    getTopNamingPatterns(): NamingPattern[] {
        try {
            return Array.from(this.namingPatterns.values())
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 10);
        } catch (error) {
            return [];
        }
    }
}
