import * as vscode from 'vscode';

// Some TS configs may not include the DOM lib which defines `console`.
// Declare a minimal console.warn to avoid "Cannot find name 'console'" errors.
declare const console: { warn: (...args: any[]) => void };
import { AdvancedLearningEngine } from './advancedLearningEngine';

export class LearningNotifications {
    private learningEngine: AdvancedLearningEngine;
    private lastNotificationTime: number = 0;
    private notificationCooldown: number = 5000; // 5 seconds between notifications

    constructor(learningEngine: AdvancedLearningEngine) {
        this.learningEngine = learningEngine;
    }

    showPatternDetectedNotification(pattern: string, frequency: number): void {
        try {
            const now = Date.now();
            if (now - this.lastNotificationTime < this.notificationCooldown) {
                return; // Too soon, skip
            }

            if (frequency > 10) {
                vscode.window.showInformationMessage(
                    `🧠 Pattern Detected: You use "${pattern}" frequently (${frequency}x)`,
                    'View Dashboard'
                ).then(selection => {
                    if (selection === 'View Dashboard') {
                        vscode.commands.executeCommand('dartAI.viewLearningDashboard');
                    }
                });
            }

            this.lastNotificationTime = now;
        } catch (error) {
            console.warn('Error showing pattern notification:', error);
        }
    }

    showLearningMilestoneNotification(totalPatterns: number): void {
        try {
            const milestones = [10, 25, 50, 100, 150];

            if (milestones.includes(totalPatterns)) {
                const message = this.getMilestoneMessage(totalPatterns);
                vscode.window.showInformationMessage(message, 'View Dashboard').then(selection => {
                    if (selection === 'View Dashboard') {
                        vscode.commands.executeCommand('dartAI.viewLearningDashboard');
                    }
                });
            }
        } catch (error) {
            console.warn('Error showing milestone notification:', error);
        }
    }

    showNamingStyleDetectedNotification(style: string): void {
        try {
            if (style && style !== 'Not detected yet') {
                vscode.window.showInformationMessage(
                    `📝 Naming Style Detected: You prefer ${style}! Extension will now suggest matching patterns.`,
                    'Got it'
                );
            }
        } catch (error) {
            console.warn('Error showing naming style notification:', error);
        }
    }

    showCodeSmellWarning(smell: { type: string; location: string; suggestion: string }): void {
        try {
            const message = `⚠️ Code Smell (${smell.type}) at ${smell.location}: ${smell.suggestion}`;
            vscode.window.showWarningMessage(message);
        } catch (error) {
            console.warn('Error showing code smell warning:', error);
        }
    }

    showLearningProgressNotification(accuracy: number): void {
        try {
            let message = '';
            let icon = '';

            if (accuracy < 30) {
                icon = '🚀';
                message = 'Getting started with learning...';
            } else if (accuracy < 60) {
                icon = '📈';
                message = 'Learning is taking shape!';
            } else if (accuracy < 85) {
                icon = '⭐';
                message = 'Highly personalized suggestions ready!';
            } else {
                icon = '🎯';
                message = 'Perfectly tuned to your style!';
            }

            const percent = Math.round(accuracy);
            vscode.window.showInformationMessage(
                `${icon} Learning Progress: ${percent}%`,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    vscode.commands.executeCommand('dartAI.viewLearningDashboard');
                }
            });
        } catch (error) {
            console.warn('Error showing progress notification:', error);
        }
    }

    showNewStructurePatternNotification(structure: string): void {
        try {
            vscode.window.showInformationMessage(
                `🏗️ New Structure Pattern: You're using ${structure}!`
            );
        } catch (error) {
            console.warn('Error showing structure notification:', error);
        }
    }

    showFixPatternLearnedNotification(fixType: string): void {
        try {
            vscode.window.showInformationMessage(
                `✅ Fix Pattern Learned: Next time you see similar "${fixType}" errors, suggestions will be smarter!`
            );
        } catch (error) {
            console.warn('Error showing fix pattern notification:', error);
        }
    }

    private getMilestoneMessage(totalPatterns: number): string {
        switch (totalPatterns) {
            case 10:
                return '🎉 10 patterns learned! Your style is becoming clear.';
            case 25:
                return '⭐ 25 patterns learned! Very personalized now.';
            case 50:
                return '🚀 50 patterns learned! Expert-level personalization!';
            case 100:
                return '💎 100 patterns learned! You\'re a master!';
            case 150:
                return '👑 150 patterns learned! Supreme customization!';
            default:
                return `🧠 ${totalPatterns} patterns learned!`;
        }
    }

    showSuggestedPatternNotification(pattern: string): void {
        try {
            vscode.window.showInformationMessage(
                `💡 Suggestion: Based on your patterns, try this: ${pattern}`
            );
        } catch (error) {
            console.warn('Error showing suggestion notification:', error);
        }
    }

    showLearningTrendNotification(trend: 'improving' | 'stable' | 'new_patterns'): void {
        try {
            let message = '';
            switch (trend) {
                case 'improving':
                    message = '📊 Learning is improving! Suggestions getting smarter.';
                    break;
                case 'stable':
                    message = '✅ Learning stable. Your patterns are well-established.';
                    break;
                case 'new_patterns':
                    message = '✨ New patterns detected! Learning adapting to you.';
                    break;
            }

            if (message) {
                vscode.window.showInformationMessage(message);
            }
        } catch (error) {
            console.warn('Error showing trend notification:', error);
        }
    }
}
