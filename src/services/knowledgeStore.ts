import * as vscode from 'vscode';

/**
 * Unified Knowledge Store — single source of truth for everything the
 * extension has learned or been taught: patterns from LearningEngine,
 * AdvancedLearningEngine, static snippets, and imported Knowledge Base
 * documents. CodePredictionEngine's sequence-based data remains separate
 * (different data shape — A→B transitions, not standalone entries) but
 * contributes to final ranking at suggestion time.
 */

export type KnowledgeEntryType = 'pattern' | 'snippet' | 'document';

export interface KnowledgeEntry {
    /** Normalized, unique key — the primary dedup boundary across all sources. */
    key: string;
    /** The actual text/content (code pattern, snippet body, or doc excerpt). */
    text: string;
    /** Human-readable label, if different from text (e.g. a doc title). */
    label?: string;
    type: KnowledgeEntryType;
    frequency: number;
    confidence: number; // 0-100
    tags: Set<string>;
    fileTypes: Set<string>;
    firstSeen: Date;
    lastUsed: Date;
    userConfirmed: boolean;
    /** Which original system(s) contributed to this entry — for migration/debugging visibility. */
    sources: Set<string>;
}

const MAX_ENTRIES = 1000;

export class KnowledgeStore {
    private entries: Map<string, KnowledgeEntry> = new Map();
    private dirty = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.load();
    }

    /** Records or updates an entry. Called by every input source (edits, saves, imports). */
    record(
        key: string,
        text: string,
        type: KnowledgeEntryType,
        source: string,
        options?: { label?: string; tags?: string[]; fileType?: string; confidenceBoost?: number }
    ): void {
        const existing = this.entries.get(key);

        if (existing) {
            existing.frequency++;
            existing.lastUsed = new Date();
            existing.confidence = Math.min(100, existing.confidence + (options?.confidenceBoost ?? 2));
            existing.sources.add(source);
            if (options?.tags) options.tags.forEach(t => existing.tags.add(t));
            if (options?.fileType) existing.fileTypes.add(options.fileType);
        } else {
            this.entries.set(key, {
                key,
                text,
                label: options?.label,
                type,
                frequency: 1,
                confidence: 40 + (options?.confidenceBoost ?? 0),
                tags: new Set(options?.tags ?? []),
                fileTypes: new Set(options?.fileType ? [options.fileType] : []),
                firstSeen: new Date(),
                lastUsed: new Date(),
                userConfirmed: false,
                sources: new Set([source]),
            });
            this._pruneIfNeeded();
        }

        this._scheduleSave();
    }

    /** Explicitly teach an entry — boosts confidence immediately, marks as user-confirmed. */
    recordExplicit(key: string, text: string, type: KnowledgeEntryType, fileType: string): void {
        const existing = this.entries.get(key);
        if (existing) {
            existing.userConfirmed = true;
            existing.confidence = 100;
            existing.frequency += 5;
        } else {
            this.entries.set(key, {
                key,
                text,
                type,
                frequency: 5,
                confidence: 100,
                tags: new Set(['user-taught']),
                fileTypes: new Set([fileType]),
                firstSeen: new Date(),
                lastUsed: new Date(),
                userConfirmed: true,
                sources: new Set(['explicit']),
            });
        }
        this._scheduleSave();
    }

    forget(key: string): boolean {
        const existed = this.entries.delete(key);
        if (existed) this._scheduleSave();
        return existed;
    }

    /** Returns entries whose text starts with the given prefix, ranked by confidence/frequency. */
    query(prefix: string, fileType?: string, limit = 10): KnowledgeEntry[] {
        const lp = prefix.toLowerCase();
        return Array.from(this.entries.values())
            .filter(e => e.text.toLowerCase().startsWith(lp))
            .filter(e => !fileType || e.fileTypes.size === 0 || e.fileTypes.has(fileType))
            .sort((a, b) => {
                if (a.userConfirmed !== b.userConfirmed) return a.userConfirmed ? -1 : 1;
                return b.confidence - a.confidence || b.frequency - a.frequency;
            })
            .slice(0, limit);
    }

    getAllEntries(): KnowledgeEntry[] {
        return Array.from(this.entries.values());
    }

    getStats() {
        return {
            totalEntries: this.entries.size,
            byType: this._countByType(),
        };
    }

    private _countByType(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const e of this.entries.values()) {
            counts[e.type] = (counts[e.type] ?? 0) + 1;
        }
        return counts;
    }

    private _pruneIfNeeded(): void {
        if (this.entries.size <= MAX_ENTRIES) return;
        const sorted = Array.from(this.entries.entries())
            .filter(([, e]) => !e.userConfirmed) // never prune user-taught entries
            .sort((a, b) => (a[1].confidence + a[1].frequency) - (b[1].confidence + b[1].frequency));
        const toRemove = sorted.slice(0, this.entries.size - MAX_ENTRIES);
        for (const [key] of toRemove) this.entries.delete(key);
    }

    private _scheduleSave(): void {
        this.dirty = true;
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            if (this.dirty) void this._persist();
        }, 2000);
    }

    private async _persist(): Promise<void> {
        this.dirty = false;
        const serialized: Record<string, any> = {};
        for (const [key, entry] of this.entries) {
            serialized[key] = {
                ...entry,
                tags: Array.from(entry.tags),
                fileTypes: Array.from(entry.fileTypes),
                sources: Array.from(entry.sources),
                firstSeen: entry.firstSeen.toISOString(),
                lastUsed: entry.lastUsed.toISOString(),
            };
        }
        await this.context.globalState.update('knowledgeStore', serialized);
    }

    private load(): void {
        try {
            const raw = this.context.globalState.get<Record<string, any>>('knowledgeStore');
            if (!raw) return;
            this.entries = new Map(
                Object.entries(raw).map(([key, v]) => [
                    key,
                    {
                        ...v,
                        tags: new Set<string>(v.tags ?? []),
                        fileTypes: new Set<string>(v.fileTypes ?? []),
                        sources: new Set<string>(v.sources ?? []),
                        firstSeen: new Date(v.firstSeen),
                        lastUsed: new Date(v.lastUsed),
                    } as KnowledgeEntry,
                ])
            );
        } catch (error) {
            console.warn('[KnowledgeStore] Failed to load, starting fresh:', error);
        }
    }
}