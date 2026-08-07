import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Knowledge Base Manager
 * Imports and manages external knowledge sources (docs, tutorials, examples)
 */

interface KnowledgeItem {
    id: string;
    title: string;
    category: string; // 'firebase', 'flutter', 'dart', 'uganda-patterns', etc.
    content: string;
    tags: string[];
    source: string; // where it came from
    addedDate: string;
}

export class KnowledgeBaseManager {
    private knowledgeItems: Map<string, KnowledgeItem> = new Map();
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
        this.ensureDbExists();
    }

    /**
     * Add knowledge from external sources
     * Sources: tutorials, docs, GitHub repos, Medium articles, YouTube transcripts, etc.
     */
    async addFromUrl(url: string, category: string): Promise<void> {
        try {
            const content = await this.fetchContent(url);
            const item: KnowledgeItem = {
                id: this.generateId(),
                title: this.extractTitle(url),
                category,
                content,
                tags: this.extractTags(content),
                source: url,
                addedDate: new Date().toISOString()
            };

            this.knowledgeItems.set(item.id, item);
            await this.saveToDb();

            console.log(`[KnowledgeBase] Added: ${item.title} from ${url}`);
        } catch (error) {
            console.error(`[KnowledgeBase] Failed to add from ${url}:`, error);
        }
    }

    /**
     * Add knowledge from local files
     * Examples: your own tutorials, code snippets, documentation
     */
    async addFromLocalFile(filePath: string, category: string): Promise<void> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const item: KnowledgeItem = {
                id: this.generateId(),
                title: path.basename(filePath),
                category,
                content,
                tags: this.extractTags(content),
                source: filePath,
                addedDate: new Date().toISOString()
            };

            this.knowledgeItems.set(item.id, item);
            await this.saveToDb();

            console.log(`[KnowledgeBase] Added: ${item.title} from local file`);
        } catch (error) {
            console.error(`[KnowledgeBase] Failed to add local file:`, error);
        }
    }

    /**
     * Add knowledge from clipboard
     * User can copy any code/tutorial and paste it in
     */
    async addFromClipboard(category: string, title: string): Promise<void> {
        try {
            const clipboard = await vscode.env.clipboard.readText();

            const item: KnowledgeItem = {
                id: this.generateId(),
                title,
                category,
                content: clipboard,
                tags: this.extractTags(clipboard),
                source: 'clipboard',
                addedDate: new Date().toISOString()
            };

            this.knowledgeItems.set(item.id, item);
            await this.saveToDb();

            vscode.window.showInformationMessage(`Added to knowledge base: ${title}`);
        } catch (error) {
            console.error(`[KnowledgeBase] Clipboard error:`, error);
        }
    }

    /**
     * Search knowledge base
     * Find relevant docs for code completion context
     */
    search(query: string, category?: string): KnowledgeItem[] {
        const results = Array.from(this.knowledgeItems.values())
            .filter(item => {
                const matchesQuery =
                    item.title.toLowerCase().includes(query.toLowerCase()) ||
                    item.content.toLowerCase().includes(query.toLowerCase()) ||
                    item.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));

                const matchesCategory = !category || item.category === category;

                return matchesQuery && matchesCategory;
            })
            .sort((a, b) => this.calculateRelevance(b, query) - this.calculateRelevance(a, query));

        return results.slice(0, 10); // Top 10 results
    }

    /**
     * Retrieves relevant knowledge when generating suggestions
     */
    getContextForCompletion(prefix: string, currentCode: string): string {
        // Search for relevant knowledge items
        const category = this.detectCategory(currentCode);
        const relevantItems = this.search(prefix, category);

        if (relevantItems.length === 0) {
            return '';
        }

        let context = '\n\n## Relevant Documentation:\n';
        for (const item of relevantItems.slice(0, 3)) {
            const contentPreview = item.content ? item.content.substring(0, 500) : '';
            context += `\n### ${item.title}\n${contentPreview}...\n`;
        }

        return context;
    }

    /**
     * Export knowledge base as JSON
     * Can be shared with team or backed up
     */
    export(): string {
        const data = Array.from(this.knowledgeItems.values());
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import knowledge base from JSON
     * Restore or share knowledge across machines
     */
    async import(jsonData: string): Promise<void> {
        try {
            const items = JSON.parse(jsonData) as KnowledgeItem[];
            for (const item of items) {
                this.knowledgeItems.set(item.id, item);
            }
            await this.saveToDb();
            vscode.window.showInformationMessage(`Imported ${items.length} knowledge items`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import knowledge base: ${error}`);
        }
    }

    /**
     * List all knowledge by category
     */
    listByCategory(category: string): KnowledgeItem[] {
        return Array.from(this.knowledgeItems.values())
            .filter(item => item.category === category)
            .sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());
    }

    /**
     * Delete knowledge item
     */
    async delete(id: string): Promise<void> {
        this.knowledgeItems.delete(id);
        await this.saveToDb();
    }

    /**
     * Get statistics about knowledge base
     */
    getStats(): {
        totalItems: number;
        byCategory: Record<string, number>;
        totalSize: number;
    } {
        const stats = {
            totalItems: this.knowledgeItems.size,
            byCategory: {} as Record<string, number>,
            totalSize: 0
        };

        for (const item of this.knowledgeItems.values()) {
            stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
            stats.totalSize += item.content.length;
        }

        return stats;
    }

    // ─────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────

    private async fetchContent(url: string): Promise<string> {
        // Fetch from URL (would need node-fetch or similar)
        // For now, return placeholder
        console.log(`Fetching from: ${url}`);
        return `[Content from ${url}]`;
    }

    private extractTitle(url: string): string {
        // Extract title from URL or page
        return url.split('/').pop()?.replace(/[_-]/g, ' ') || 'Untitled';
    }

    private extractTags(content: string): string[] {
        // Extract keywords (simple approach: split by common delimiters)
        const keywords = content
            .toLowerCase()
            .match(/\b[a-z]+\b/g) || [];

        return [...new Set(keywords)]
            .filter(kw => kw.length > 4)
            .slice(0, 10);
    }

    private calculateRelevance(item: KnowledgeItem, query: string): number {
        let score = 0;
        const lowerQuery = query.toLowerCase();

        // Check if title contains query
        if (item.title && item.title.toLowerCase().includes(lowerQuery)) {
            score += 10;
        }

        // Check if any tags contain query
        if (item.tags && Array.isArray(item.tags)) {
            if (item.tags.some(tag => tag && tag.toLowerCase().includes(lowerQuery))) {
                score += 5;
            }
        }

        // Check if content contains query
        if (item.content && item.content.toLowerCase().includes(lowerQuery)) {
            score += 1;
        }

        return score;
    }

    private detectCategory(code: string): string {
        // Detect what category of knowledge is relevant
        if (code.includes('FirebaseAuth') || code.includes('Firestore')) return 'firebase';
        if (code.includes('StreamBuilder') || code.includes('Widget')) return 'flutter';
        if (code.includes('MTN') || code.includes('Airtel')) return 'uganda-patterns';
        if (code.includes('Hive') || code.includes('SharedPreferences')) return 'storage';
        return 'general';
    }

    private generateId(): string {
        return `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private ensureDbExists(): void {
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify([]));
        }
    }

    private async saveToDb(): Promise<void> {
        try {
            const data = Array.from(this.knowledgeItems.values());
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[KnowledgeBase] Failed to save:', error);
        }
    }
}