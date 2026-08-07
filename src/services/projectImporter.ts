import * as vscode from 'vscode';
import { LearningEngine } from './learningEngine';
import { AdvancedLearningEngine } from './advancedLearningEngine';
import { CodePredictionEngine } from './codePredictionEngine';
import { KnowledgeBaseManager } from '../engines/knowledgeBaseManager';

export interface ImportSummary {
    filesScanned: number;
    filesProcessed: number;
    filesSkipped: number;
    knowledgeItemsAdded: number;
    errors: string[];
}

const MAX_FILES_TO_PROCESS = 100;
const EXCLUDED_DIRS = ['build', '.dart_tool', 'node_modules', '.git', 'ios', 'android', '.pub-cache'];

export class ProjectImporter {
    constructor(
        private readonly learningEngine: LearningEngine,
        private readonly advancedLearningEngine: AdvancedLearningEngine,
        private readonly codePredictionEngine: CodePredictionEngine,
        private readonly knowledgeBase: KnowledgeBaseManager
    ) { }

    /**
     * Import an entire project folder: finds all .dart files, feeds each
     * through the learning engines and knowledge base. Caps at
     * MAX_FILES_TO_PROCESS, prioritizing most recently modified files so
     * large legacy projects don't blow past the engines' internal limits.
     */
    async importProject(
        folderUri: vscode.Uri,
        onProgress: (message: string, increment: number) => void
    ): Promise<ImportSummary> {
        const summary: ImportSummary = {
            filesScanned: 0,
            filesProcessed: 0,
            filesSkipped: 0,
            knowledgeItemsAdded: 0,
            errors: [],
        };

        const allFiles = await this._findDartFiles(folderUri);
        summary.filesScanned = allFiles.length;

        const prioritized = await this._prioritizeByRecency(allFiles);
        const toProcess = prioritized.slice(0, MAX_FILES_TO_PROCESS);
        summary.filesSkipped = allFiles.length - toProcess.length;

        const increment = 100 / Math.max(toProcess.length, 1);

        for (const fileUri of toProcess) {
            try {
                onProgress(`Learning from ${fileUri.path.split('/').pop()}...`, increment);
                await this._processFile(fileUri);
                summary.filesProcessed++;
                summary.knowledgeItemsAdded++;
            } catch (error) {
                summary.errors.push(`${fileUri.fsPath}: ${error}`);
            }
        }

        return summary;
    }

    private async _processFile(fileUri: vscode.Uri): Promise<void> {
        const document = await vscode.workspace.openTextDocument(fileUri);

        // Feed all three learning engines
        this.learningEngine.analyzePatterns(document);
        await this.advancedLearningEngine.analyzePatterns(document);
        this.codePredictionEngine.analyzeDocument(document);

        // Feed knowledge base (category inferred from folder structure)
        const category = this._inferCategory(fileUri.fsPath);
        await this.knowledgeBase.addFromLocalFile(fileUri.fsPath, category);
    }

    private async _findDartFiles(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
        const results: vscode.Uri[] = [];
        await this._walk(folderUri, results);
        return results;
    }

    private async _walk(dirUri: vscode.Uri, results: vscode.Uri[]): Promise<void> {
        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch {
            return; // unreadable directory, skip
        }

        for (const [name, type] of entries) {
            if (EXCLUDED_DIRS.includes(name)) continue;

            const childUri = vscode.Uri.joinPath(dirUri, name);
            if (type === vscode.FileType.Directory) {
                await this._walk(childUri, results);
            } else if (type === vscode.FileType.File && name.endsWith('.dart')) {
                results.push(childUri);
            }
        }
    }

    private async _prioritizeByRecency(files: vscode.Uri[]): Promise<vscode.Uri[]> {
        const withStats = await Promise.all(
            files.map(async (uri) => {
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    return { uri, mtime: stat.mtime };
                } catch {
                    return { uri, mtime: 0 };
                }
            })
        );
        return withStats.sort((a, b) => b.mtime - a.mtime).map(x => x.uri);
    }

    private _inferCategory(filePath: string): string {
        const lower = filePath.toLowerCase();
        if (lower.includes('firebase') || lower.includes('firestore')) return 'firebase';
        if (lower.includes('hive') || lower.includes('storage')) return 'storage';
        if (lower.includes('mtn') || lower.includes('airtel') || lower.includes('mobile_money')) return 'uganda-patterns';
        if (lower.includes('widget') || lower.includes('screen') || lower.includes('page')) return 'flutter';
        return 'general';
    }
}