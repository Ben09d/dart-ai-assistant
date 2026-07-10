import * as vscode from 'vscode';

export interface SecurityIssue {
    line: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    message: string;
    recommendation: string;
}

export class SecurityScanner {
    async scan(document: vscode.TextDocument): Promise<SecurityIssue[]> {
        const issues: SecurityIssue[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        const config = vscode.workspace.getConfiguration('dartAI');
        const securityLevel = config.get('securityLevel') || 'standard';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for hardcoded secrets
            issues.push(...this.checkHardcodedSecrets(line, i));

            // Check for SQL injection vulnerabilities
            issues.push(...this.checkSQLInjection(line, i));

            // Check for insecure HTTP usage
            issues.push(...this.checkInsecureHTTP(line, i));

            // Check for weak cryptography
            issues.push(...this.checkWeakCrypto(line, i));

            // Check for path traversal
            issues.push(...this.checkPathTraversal(line, i));

            // Check for XSS vulnerabilities
            issues.push(...this.checkXSS(line, i));

            // Check for insecure random number generation
            issues.push(...this.checkInsecureRandom(line, i));

            if (securityLevel === 'strict') {
                // Additional strict checks
                issues.push(...this.checkStrictSecurity(line, i));
            }
        }

        return issues;
    }

    private checkHardcodedSecrets(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        // API keys and tokens
        const secretPatterns = [
            { pattern: /(api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]{20,})['"]/, type: 'API Key' },
            { pattern: /(secret|password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/, type: 'Secret/Password' },
            { pattern: /(token|auth[_-]?token)\s*[:=]\s*['"]([^'"]{20,})['"]/, type: 'Auth Token' },
            { pattern: /(['"][A-Za-z0-9+/]{40,}['"])/, type: 'Potential Secret' }
        ];

        for (const { pattern, type } of secretPatterns) {
            if (pattern.test(line) && !line.includes('TODO') && !line.includes('EXAMPLE')) {
                issues.push({
                    line: lineNumber,
                    severity: 'critical',
                    type: 'Hardcoded Secret',
                    message: `Potential hardcoded ${type} detected`,
                    recommendation: 'Use environment variables or secure secret management instead'
                });
            }
        }

        return issues;
    }

    private checkSQLInjection(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        // Check for string concatenation in SQL queries
        if ((line.includes('SELECT') || line.includes('INSERT') || line.includes('UPDATE') || line.includes('DELETE')) &&
            (line.includes('$') || line.includes('+'))) {
            issues.push({
                line: lineNumber,
                severity: 'high',
                type: 'SQL Injection',
                message: 'Potential SQL injection vulnerability',
                recommendation: 'Use parameterized queries or prepared statements'
            });
        }

        return issues;
    }

    private checkInsecureHTTP(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        if (/http:\/\/(?!localhost|127\.0\.0\.1)/.test(line)) {
            issues.push({
                line: lineNumber,
                severity: 'medium',
                type: 'Insecure Communication',
                message: 'Using insecure HTTP protocol',
                recommendation: 'Use HTTPS for secure communication'
            });
        }

        return issues;
    }

    private checkWeakCrypto(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        const weakAlgorithms = ['MD5', 'SHA1', 'DES', 'RC4'];
        
        for (const algo of weakAlgorithms) {
            if (line.includes(algo)) {
                issues.push({
                    line: lineNumber,
                    severity: 'high',
                    type: 'Weak Cryptography',
                    message: `Using weak cryptographic algorithm: ${algo}`,
                    recommendation: 'Use SHA-256, SHA-384, or SHA-512 instead'
                });
            }
        }

        return issues;
    }

    private checkPathTraversal(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        if ((line.includes('File(') || line.includes('Directory(')) && 
            (line.includes('$') || line.includes('+'))) {
            issues.push({
                line: lineNumber,
                severity: 'high',
                type: 'Path Traversal',
                message: 'Potential path traversal vulnerability',
                recommendation: 'Validate and sanitize file paths, use path.join() or path.normalize()'
            });
        }

        return issues;
    }

    private checkXSS(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        if ((line.includes('innerHTML') || line.includes('setInnerHtml')) &&
            (line.includes('$') || line.includes('+'))) {
            issues.push({
                line: lineNumber,
                severity: 'high',
                type: 'Cross-Site Scripting (XSS)',
                message: 'Potential XSS vulnerability through HTML injection',
                recommendation: 'Sanitize user input before inserting into HTML'
            });
        }

        return issues;
    }

    private checkInsecureRandom(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        if (line.includes('Random()') && !line.includes('Random.secure()')) {
            issues.push({
                line: lineNumber,
                severity: 'medium',
                type: 'Weak Random Number Generation',
                message: 'Using non-cryptographic random number generator',
                recommendation: 'Use Random.secure() for cryptographic operations'
            });
        }

        return issues;
    }

    private checkStrictSecurity(line: string, lineNumber: number): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        // Check for eval-like functions
        if (line.includes('eval(')) {
            issues.push({
                line: lineNumber,
                severity: 'critical',
                type: 'Code Injection',
                message: 'Dynamic code evaluation detected',
                recommendation: 'Avoid using eval or similar dynamic code execution'
            });
        }

        // Check for file permissions
        if (line.includes('chmod') && line.includes('777')) {
            issues.push({
                line: lineNumber,
                severity: 'high',
                type: 'Insecure Permissions',
                message: 'Overly permissive file permissions',
                recommendation: 'Use restrictive permissions (e.g., 644 or 755)'
            });
        }

        // Check for debug mode in production
        if (line.includes('debugMode') && line.includes('true')) {
            issues.push({
                line: lineNumber,
                severity: 'medium',
                type: 'Debug Mode',
                message: 'Debug mode may be enabled',
                recommendation: 'Ensure debug mode is disabled in production'
            });
        }

        return issues;
    }

    generateReport(issues: SecurityIssue[]): string {
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const highCount = issues.filter(i => i.severity === 'high').length;
        const mediumCount = issues.filter(i => i.severity === 'medium').length;
        const lowCount = issues.filter(i => i.severity === 'low').length;

        let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Scan Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 3px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
        }
        .summary {
            display: flex;
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            flex: 1;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .critical { background-color: #ff4444; color: white; }
        .high { background-color: #ff8800; color: white; }
        .medium { background-color: #ffaa00; color: white; }
        .low { background-color: #00aaff; color: white; }
        .issue {
            margin: 15px 0;
            padding: 15px;
            border-left: 4px solid;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
        }
        .issue.critical { border-color: #ff4444; }
        .issue.high { border-color: #ff8800; }
        .issue.medium { border-color: #ffaa00; }
        .issue.low { border-color: #00aaff; }
        .issue-header {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .recommendation {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border-radius: 4px;
            font-style: italic;
        }
        .line-number {
            display: inline-block;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 3px;
            font-family: monospace;
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <h1>🔒 Security Scan Report</h1>
    
    <div class="summary">
        <div class="summary-card critical">
            <h2>${criticalCount}</h2>
            <p>Critical</p>
        </div>
        <div class="summary-card high">
            <h2>${highCount}</h2>
            <p>High</p>
        </div>
        <div class="summary-card medium">
            <h2>${mediumCount}</h2>
            <p>Medium</p>
        </div>
        <div class="summary-card low">
            <h2>${lowCount}</h2>
            <p>Low</p>
        </div>
    </div>

    <h2>Issues Found</h2>
`;

        if (issues.length === 0) {
            html += '<p>✅ No security issues detected!</p>';
        } else {
            // Sort by severity
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

            for (const issue of issues) {
                html += `
    <div class="issue ${issue.severity}">
        <div class="issue-header">
            <span class="line-number">Line ${issue.line + 1}</span>
            ${issue.type}
        </div>
        <p>${issue.message}</p>
        <div class="recommendation">
            💡 <strong>Recommendation:</strong> ${issue.recommendation}
        </div>
    </div>
`;
            }
        }

        html += `
</body>
</html>
`;

        return html;
    }
}
