import * as vscode from 'vscode';
import { LearningEngine } from './learningEngine';

export class LearningDashboard {
    private learningEngine: LearningEngine;

    constructor(learningEngine: LearningEngine) {
        this.learningEngine = learningEngine;
    }

    showDashboard(): void {
        const panel = vscode.window.createWebviewPanel(
            'learningDashboard',
            'Dart AI - Learning Dashboard',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        const refresh = () => {
            const stats = this.learningEngine.getStatistics();
            panel.webview.html = this.generateDashboardHTML(stats);
        };

        refresh(); // Initial load

        // Auto-refresh every 5 seconds while panel is open
        const interval = setInterval(refresh, 5000);

        // Stop refreshing when panel closes (prevents memory leak)
        panel.onDidDispose(() => {
            clearInterval(interval);
        });
    }
    private generateDashboardHTML(stats: any): string {
        const {
            totalPatterns,
            mostUsedPatterns,
            preferredNaming,
            preferredStructure,
            totalFixes
        } = stats;

        const patternsHTML = mostUsedPatterns
            .slice(0, 10)
            .map((p: any, i: number) => `
                <div class="pattern-item">
                    <span class="pattern-rank">${i + 1}</span>
                    <span class="pattern-name">${this.escapeHtml(p.pattern)}</span>
                    <span class="pattern-freq">${p.frequency}x</span>
                </div>
            `)
            .join('');

        const namingStyle = preferredNaming || 'Not detected yet';
        const structureStyle = preferredStructure || 'Not detected yet';

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learning Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }

        .header {
            margin-bottom: 30px;
            border-bottom: 3px solid var(--vscode-textLink-foreground);
            padding-bottom: 15px;
        }

        .header h1 {
            color: var(--vscode-textLink-foreground);
            font-size: 28px;
            margin-bottom: 5px;
        }

        .header p {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-focusBorder);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }

        .stat-card h3 {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 10px;
            letter-spacing: 1px;
        }

        .stat-value {
            color: var(--vscode-textLink-foreground);
            font-size: 36px;
            font-weight: bold;
        }

        .stat-subtext {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-top: 5px;
        }

        .section {
            margin-bottom: 30px;
        }

        .section h2 {
            color: var(--vscode-textLink-foreground);
            font-size: 18px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--vscode-focusBorder);
        }

        .section-content {
            background: var(--vscode-textBlockQuote-background);
            border-radius: 6px;
            padding: 15px;
        }

        .pattern-item {
            display: flex;
            align-items: center;
            padding: 10px;
            margin-bottom: 8px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }

        .pattern-rank {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 50%;
            font-weight: bold;
            margin-right: 10px;
            flex-shrink: 0;
        }

        .pattern-name {
            flex: 1;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
            color: var(--vscode-foreground);
        }

        .pattern-freq {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            margin-left: 10px;
            white-space: nowrap;
        }

        .preference {
            background: var(--vscode-editor-background);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 12px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }

        .preference-label {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }

        .preference-value {
            color: var(--vscode-foreground);
            font-size: 16px;
            font-weight: 500;
            font-family: 'Courier New', monospace;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }

        .progress-fill {
            height: 100%;
            background: var(--vscode-textLink-foreground);
            transition: width 0.3s ease;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }

        .empty-state-text {
            font-size: 14px;
            line-height: 1.6;
        }

        .tips {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-debugConsole-warningForeground);
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
        }

        .tips h3 {
            color: var(--vscode-debugConsole-warningForeground);
            margin-bottom: 10px;
            font-size: 14px;
        }

        .tips ul {
            margin-left: 20px;
            color: var(--vscode-foreground);
            font-size: 13px;
        }

        .tips li {
            margin-bottom: 8px;
        }

        .chart-container {
            margin-top: 15px;
        }

        .bar-chart {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .bar-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .bar-label {
            width: 120px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }

        .bar-container {
            flex: 1;
            height: 24px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            align-items: center;
        }

        .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--vscode-textLink-foreground), var(--vscode-textLink-foreground));
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 8px;
            color: var(--vscode-editor-background);
            font-size: 11px;
            font-weight: bold;
        }

        .learning-status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 15px;
        }

        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--vscode-gitDecoration-addedResourceForeground);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }

        .status-text {
            color: var(--vscode-foreground);
            font-size: 13px;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-focusBorder);
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            text-align: center;
        }

        .feature-badge {
            display: inline-block;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            margin-right: 5px;
        }

        .action-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .btn {
            flex: 1;
            padding: 10px;
            border: 1px solid var(--vscode-focusBorder);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-textBlockQuote-background);
            color: var(--vscode-foreground);
        }

        .btn-secondary:hover {
            background: var(--vscode-focusBorder);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Learning Dashboard</h1>
        <p>What Dart AI Assistant has learned about your coding style</p>
        <div class="learning-status">
            <div class="status-indicator"></div>
            <div class="status-text">Learning actively as you code</div>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <h3>📚 Total Patterns</h3>
            <div class="stat-value">${totalPatterns}</div>
            <div class="stat-subtext">unique patterns learned</div>
        </div>
        <div class="stat-card">
            <h3>🛠 Fixes Recorded</h3>
            <div class="stat-value">${totalFixes}</div>
            <div class="stat-subtext">error fixes learned</div>
        </div>
        <div class="stat-card">
            <h3>📝 Naming Style</h3>
            <div class="stat-value">${namingStyle === 'camelCase' ? '🐫' : namingStyle === 'snake_case' ? '🐍' : '❓'}</div>
            <div class="stat-subtext">${namingStyle}</div>
        </div>
        <div class="stat-card">
            <h3>🏗️ Code Structure</h3>
            <div class="stat-value">${structureStyle !== 'Not detected yet' ? '✓' : '⏳'}</div>
            <div class="stat-subtext">${structureStyle}</div>
        </div>
    </div>

    ${totalPatterns > 0 ? `
    <div class="section">
        <h2>🔝 Most Used Patterns</h2>
        <div class="section-content">
            ${patternsHTML || '<p style="color: var(--vscode-descriptionForeground); text-align: center; padding: 20px;">No patterns learned yet. Keep coding!</p>'}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <h2>🎯 Your Preferences</h2>
        <div class="section-content">
            <div class="preference">
                <div class="preference-label">Naming Convention</div>
                <div class="preference-value">${namingStyle}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${totalPatterns > 0 ? Math.min((totalPatterns / 100) * 100, 100) : 0}%"></div>
                </div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 5px;">
                    ${totalPatterns} naming samples analyzed
                </div>
            </div>

            <div class="preference">
                <div class="preference-label">Code Structure Style</div>
                <div class="preference-value">${structureStyle}</div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 10px;">
                    The extension learns your preferred patterns: inheritance, mixins, factories, state management, etc.
                </div>
            </div>

            <div class="preference">
                <div class="preference-label">Frequently Used Packages</div>
                <div class="preference-value">Auto-learned</div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 10px;">
                    The extension remembers which packages you import most often
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>✅ How Learning Works</h2>
        <div class="section-content">
            <div style="color: var(--vscode-foreground); line-height: 1.8;">
                <p><strong>Knowledge</strong> (Built-in, for everyone):</p>
                <ul style="margin: 10px 0 15px 20px; color: var(--vscode-descriptionForeground); font-size: 13px;">
                    <li>Error detection (missing semicolons, undefined variables)</li>
                    <li>Security scanning (hardcoded secrets, SQL injection)</li>
                    <li>Code formatting (indentation, spacing)</li>
                    <li>Dart & Flutter patterns</li>
                </ul>

                <p style="margin-top: 15px;"><strong>Learning</strong> (Personalized to you):</p>
                <ul style="margin: 10px 0 0 20px; color: var(--vscode-descriptionForeground); font-size: 13px;">
                    <li>Your naming conventions</li>
                    <li>Your preferred code structures</li>
                    <li>Your import preferences</li>
                    <li>How you fix errors (for similar suggestions later)</li>
                </ul>
            </div>

            <div class="action-buttons">
                <button class="btn btn-secondary" onclick="alert('Data is stored locally in VS Code. Press Ctrl+Shift+P and search \\'Developer: Open User Data Folder\\' to manage.')">
                    📁 About Data Storage
                </button>
            </div>
        </div>
    </div>

    ${totalPatterns === 0 ? `
    <div class="empty-state">
        <div class="empty-state-icon">🚀</div>
        <div class="empty-state-text">
            <strong>Learning is getting started!</strong><br><br>
            The extension learns as you code:<br>
            • Open Dart files and start typing<br>
            • Let the extension detect your patterns<br>
            • Save files for pattern analysis<br>
            • Check back in a few hours to see what was learned!<br><br>
            <em>Come back to this dashboard after coding to see your personalized insights.</em>
        </div>
    </div>
    ` : `
    <div class="tips">
        <h3>💬 Tips to Improve Learning</h3>
        <ul>
            <li>Keep the extension enabled (dartAI.enableLearning = true)</li>
            <li>Write code consistently - patterns need examples</li>
            <li>Use Ctrl+Shift+F to fix errors - helps learning your fix patterns</li>
            <li>Save files regularly - triggers pattern analysis</li>
            <li>Check this dashboard periodically to see what was learned</li>
        </ul>
    </div>
    `}

    <div class="footer">
        <p>🧠 Learning Dashboard • Data stays on your machine • Updated in real-time</p>
        <p style="margin-top: 10px; font-size: 11px;">
            Learn more: Check out the extension documentation for details on Knowledge vs Learning
        </p>
    </div>
</body>
</html>
        `;
    }

    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (char) => map[char]);
    }
}
