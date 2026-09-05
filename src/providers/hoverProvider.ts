import * as vscode from 'vscode';
import { DartAnalyzer, DartError } from '../services/dartAnalyzer';
import { ErrorPrevention, ErrorPrediction } from '../engines/errorPrevention';
import { PatternPredictor, CodeRecommendation } from '../engines/patternPredictor';
import { LearningEngine } from '../services/learningEngine';

/**
 * Surfaces everything the extension already knows about a piece of code
 * directly on hover, instead of requiring the user to run a command first.
 *
 * Combines four sources into one hover card, each clearly labelled:
 * - DartAnalyzer diagnostics at the hovered position (real `dart analyze` output)
 * - ErrorPrevention findings on the hovered line (fast regex heuristics)
 * - PatternPredictor recommendations relevant to the hovered symbol
 * - LearningEngine stats when hovering a widget/pattern the user has used before
 *   (e.g. "You've used Scaffold 42 times — most recently 2 days ago")
 *
 * An "Explain with AI" link is appended when an AIService-shaped object is
 * supplied, deferring the network round trip until the user actually clicks
 * it rather than firing on every hover.
 */
export class HoverProvider implements vscode.HoverProvider {
    // ── Hover-specific caching ───────────────────────────────────────────────
    //
    // DartAnalyzer already caches its own results (ResultCache with TTL) and
    // ErrorPrevention's regex passes are comparatively cheap, but
    // PatternPredictor.generateRecommendations() runs 7 full-document
    // analysers with no caching of its own. provideHover() fires on every
    // mouse-pause — far more frequently than the debounced 700ms save-time
    // analysis in extension.ts — so calling it uncached here would mean
    // re-running all 7 analysers dozens of times per minute from mouse
    // movement alone, especially costly on a large file. This cache is keyed
    // by (document URI + version), so it's invalidated automatically the
    // moment the document actually changes, and otherwise reused across
    // repeated hovers on the same unmodified document.
    private _recommendationCache: { uri: string; version: number; recs: CodeRecommendation[] } | undefined;
    private _preventionCache: { uri: string; version: number; predictions: ErrorPrediction[] } | undefined;

    constructor(
        private readonly dartAnalyzer: DartAnalyzer,
        private readonly errorPrevention: ErrorPrevention,
        private readonly patternPredictor: PatternPredictor,
        private readonly learningEngine: LearningEngine,
        /** Optional — only needed for the "Explain with AI" command link. */
        private readonly aiAvailable: boolean = false
    ) { }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        if (document.languageId !== 'dart') return undefined;

        const wordRange = document.getWordRangeAtPosition(position);
        const word = wordRange ? document.getText(wordRange) : '';
        const line = document.lineAt(position.line);

        const sections: vscode.MarkdownString[] = [];

        // 1) DartAnalyzer diagnostics at this exact position.
        const analyzerSection = await this._buildAnalyzerSection(document, position, token);
        if (analyzerSection) sections.push(analyzerSection);

        if (token.isCancellationRequested) return this._assemble(sections, wordRange);

        // 2) ErrorPrevention findings anchored to this line.
        const preventionSection = await this._buildPreventionSection(document, position.line, token);
        if (preventionSection) sections.push(preventionSection);

        if (token.isCancellationRequested) return this._assemble(sections, wordRange);

        // 3) PatternPredictor recommendations relevant to the hovered word/line.
        const recommendationSection = this._buildRecommendationSection(document, line.text, word);
        if (recommendationSection) sections.push(recommendationSection);

        // 4) LearningEngine usage stats for the hovered symbol, if recognisable.
        // Usage stats intentionally not shown in hover — kept as internal
        // data only (see _buildUsageSection, currently unused here).

        // 5) Widget/keyword documentation blurb for common Flutter/Dart symbols —
        //    a lightweight fallback so hovering still shows *something* useful
        //    even when no diagnostics/recommendations/usage data exist yet.
        if (sections.length === 0) {
            const fallback = this._buildFallbackDocs(word);
            if (fallback) sections.push(fallback);
        }

        if (sections.length === 0) return undefined;

        // 6) "Explain with AI" action link, appended last, always available
        //    when an AI service is configured — deferred until clicked.
        if (this.aiAvailable && wordRange) {
            sections.push(this._buildExplainLink(document, wordRange));
        }

        return this._assemble(sections, wordRange);
    }

    // ── Section builders ────────────────────────────────────────────────────

    private async _buildAnalyzerSection(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.MarkdownString | undefined> {
        if (document.isDirty) return undefined; // DartAnalyzer skips dirty buffers anyway

        const errors: DartError[] = await this.dartAnalyzer.analyzeDocument(document);
        if (token.isCancellationRequested) return undefined;

        const matching = errors.filter(e =>
            e.line === position.line &&
            position.character >= e.column &&
            position.character <= (e.endColumn ?? e.column + 40)
        );
        if (matching.length === 0) return undefined;

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.appendMarkdown(`**$(warning) Dart Analyzer**\n\n`);

        for (const error of matching.slice(0, 3)) {
            const icon = error.severity === 'error' ? '🔴' : error.severity === 'warning' ? '🟡' : '🔵';
            md.appendMarkdown(`${icon} ${error.message}\n\n`);

            // const fix = this.dartAnalyzer.getQuickFix(error);
            // if (fix) {
            //     md.appendMarkdown(`> ✅ ${fix.title}${fix.detail ? ` — ${fix.detail}` : ''}\n\n`);
            // }
            if (error.documentationUrl) {
                md.appendMarkdown(`[View documentation](${error.documentationUrl})\n\n`);
            }
        }

        return md;
    }

    private async _buildPreventionSection(
        document: vscode.TextDocument,
        line: number,
        token: vscode.CancellationToken
    ): Promise<vscode.MarkdownString | undefined> {
        const predictions: ErrorPrediction[] = await this._getCachedPreventionPredictions(document);
        if (token.isCancellationRequested) return undefined;

        const matching = predictions.filter(p => p.line === line);
        if (matching.length === 0) return undefined;

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.appendMarkdown(`**$(shield) Error Prevention**\n\n`);

        for (const p of matching.slice(0, 3)) {
            const icon = p.severity === 'error' ? '🔴' : p.severity === 'warning' ? '🟡' : '🔵';
            const confidencePct = Math.round(p.confidence * 100);
            md.appendMarkdown(`${icon} ${p.message} _(${confidencePct}% confidence)_\n\n`);
            md.appendMarkdown(`> ${p.suggestion}\n\n`);
            if (p.documentationUrl) {
                md.appendMarkdown(`[Learn more](${p.documentationUrl})\n\n`);
            }
        }

        return md;
    }

    /**
     * Returns analyzeForPrevention() output, reusing the cached result if the
     * document hasn't changed since the last hover. ErrorPrevention has no
     * caching of its own (unlike DartAnalyzer's internal ResultCache), and
     * its regex passes — while individually cheap — run across the whole
     * document on every call, so this avoids repeating that work on every
     * mouse-pause when the buffer hasn't actually changed.
     */
    private async _getCachedPreventionPredictions(document: vscode.TextDocument): Promise<ErrorPrediction[]> {
        const uri = document.uri.toString();
        const version = document.version;

        if (
            this._preventionCache &&
            this._preventionCache.uri === uri &&
            this._preventionCache.version === version
        ) {
            return this._preventionCache.predictions;
        }

        const predictions = await this.errorPrevention.analyzeForPrevention(document);
        this._preventionCache = { uri, version, predictions };
        return predictions;
    }

    private _buildRecommendationSection(
        document: vscode.TextDocument,
        lineText: string,
        word: string
    ): vscode.MarkdownString | undefined {
        const recommendations: CodeRecommendation[] = this._getCachedRecommendations(document);
        if (recommendations.length === 0) return undefined;

        // Recommendations from PatternPredictor aren't line-anchored, so we
        // only surface ones whose title/suggestion textually relates to the
        // hovered word or the current line — keeps the hover focused instead
        // of dumping every recommendation in the file on every hover.
        const relevant = recommendations.filter(r => {
            if (word && (r.title.includes(word) || r.suggestion.includes(word))) return true;
            const lineTokens = lineText.toLowerCase();
            return r.tags.some(tag => lineTokens.includes(tag.replace(/-/g, ' ')));
        });
        if (relevant.length === 0) return undefined;

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.appendMarkdown(`**$(lightbulb) Recommendation**\n\n`);

        for (const r of relevant.slice(0, 2)) {
            const icon = r.severity === 'error' ? '🔴' : r.severity === 'warning' ? '🟡' : '🔵';
            md.appendMarkdown(`${icon} **${r.title}**\n\n${r.description}\n\n`);
            md.appendMarkdown(`> ✅ ${r.suggestion}\n\n`);
        }

        return md;
    }

    /**
     * Returns generateRecommendations() output, reusing the cached result if
     * the document hasn't changed since the last hover. See the cache field
     * comment above for why this matters: hover fires far more often than
     * the debounced save-time analysis path, and PatternPredictor has no
     * caching of its own.
     */
    private _getCachedRecommendations(document: vscode.TextDocument): CodeRecommendation[] {
        const uri = document.uri.toString();
        const version = document.version;

        if (
            this._recommendationCache &&
            this._recommendationCache.uri === uri &&
            this._recommendationCache.version === version
        ) {
            return this._recommendationCache.recs;
        }

        const recs = this.patternPredictor.generateRecommendations(document);
        this._recommendationCache = { uri, version, recs };
        return recs;
    }

    private _buildUsageSection(word: string): vscode.MarkdownString | undefined {
        // Skip short/common words — substring matching against them produces
        // noisy, unrelated hits (e.g. "id" matching "VillageIdentifier").
        if (!word || word.length < 4) return undefined;

        try {
            const matches = this.learningEngine.getPreferredPattern(word, undefined, 1);
            if (matches.length === 0) return undefined;

            const pattern = matches[0];
            const daysAgo = Math.floor((Date.now() - pattern.lastUsed.getTime()) / 86_400_000);
            const recency = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;

            const md = new vscode.MarkdownString();
            md.appendMarkdown(
                `**$(history) Your usage**\n\nYou've used this pattern **${pattern.frequency}×**, most recently ${recency}.\n\n`
            );
            return md;
        } catch {
            return undefined; // never let a learning-engine quirk break hover
        }
    }

    /**
     * Lightweight built-in documentation for common Dart/Flutter symbols,
     * shown only when no diagnostics/recommendations/usage data exist for
     * the hovered position — keeps hover useful from the very first launch
     * before any learning data has accumulated.
     */
    private _buildFallbackDocs(word: string): vscode.MarkdownString | undefined {
        const docs: Record<string, string> = {
            StatelessWidget: 'A widget that does not require mutable state — describes part of the UI by building a constellation of other widgets.',
            StatefulWidget: 'A widget that has mutable state, persisted across rebuilds via an associated State object.',
            setState: 'Notifies the framework that the internal state of this object has changed, scheduling a rebuild. Always guard with `if (mounted)` after an `await`.',
            initState: 'Called once when this State object is inserted into the tree. Always call `super.initState()` first.',
            dispose: 'Called when this State object is removed permanently. Dispose controllers and cancel subscriptions here.',
            late: 'Marks a non-nullable variable that will be initialized after its declaration, but before it is used.',
            required: 'Marks a named parameter as mandatory — the caller must provide a value.',
            FutureBuilder: 'Builds itself based on the latest snapshot of interaction with a Future.',
            StreamBuilder: 'Builds itself based on the latest snapshot of interaction with a Stream.',
            Hive: 'A lightweight, fast key-value database written in pure Dart, commonly used for offline-first local storage.',
            FirebaseFirestore: 'Cloud Firestore client — a flexible, scalable NoSQL cloud database for mobile/web/server apps.',
        };

        const doc = docs[word];
        if (!doc) return undefined;

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${word}**\n\n${doc}\n\n`);
        return md;
    }

    /**
     * Builds a clickable "Explain with AI" command link. The command itself
     * (dartAI.explainCodeStreaming / dartAI.aiFixSingleDiagnostic-style
     * wiring) is expected to already exist in extension.ts; this only emits
     * the link, it does not invoke the AI service directly, so hovering
     * never triggers a network call on its own.
     */
    private _buildExplainLink(document: vscode.TextDocument, wordRange: vscode.Range): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        const args = encodeURIComponent(JSON.stringify([document.uri.toString(), {
            line: wordRange.start.line,
            character: wordRange.start.character,
        }]));

        //md.appendMarkdown(`---\n\n[$(sparkle) Explain with AI](command:dartAI.explainHoveredSymbol?${args})`);
        md.appendMarkdown(`---\n\n[Dart AI](command:dartAI.explainHoveredSymbol?${args})`);

        return md;
    }

    // ── Assembly ─────────────────────────────────────────────────────────────

    private _assemble(
        sections: vscode.MarkdownString[],
        wordRange: vscode.Range | undefined
    ): vscode.Hover | undefined {
        if (sections.length === 0) return undefined;
        return wordRange ? new vscode.Hover(sections, wordRange) : new vscode.Hover(sections);
    }
}