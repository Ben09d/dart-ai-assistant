import * as vscode from 'vscode';
import { KnowledgeBaseManager } from '../engines/knowledgeBaseManager';
import * as path from 'path';

/**
 * Register knowledge base management commands
 * These commands let you import, search, and use external knowledge
 */
export function registerKnowledgeBaseCommands(
    context: vscode.ExtensionContext,
    knowledgeBase: KnowledgeBaseManager
): void {
    // ═══════════════════════════════════════════════════════════════
    // ADD KNOWLEDGE FROM VARIOUS SOURCES
    // ═══════════════════════════════════════════════════════════════

    // Add from URL (tutorial, docs, article)
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.addKnowledgeFromUrl', async () => {
            const url = await vscode.window.showInputBox({
                prompt: 'Enter URL (GitHub link, blog post, documentation, etc.)',
                placeHolder: 'https://example.com/dart-tutorial',
                ignoreFocusOut: true
            });

            if (!url) return;

            const category = await vscode.window.showQuickPick(
                ['firebase', 'flutter', 'dart', 'uganda-patterns', 'storage', 'networking', 'general'],
                { placeHolder: 'Category for this knowledge' }
            );

            if (!category) return;

            vscode.window.showInformationMessage('Importing knowledge...');
            await knowledgeBase.addFromUrl(url, category);
            vscode.window.showInformationMessage('✓ Knowledge added to base!');
        })
    );

    // Add from local file (your tutorials, notes, code snippets)
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.addKnowledgeFromFile', async () => {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                filters: { 'All Files': ['*'] },
                title: 'Select knowledge file (markdown, code, docs, etc.)'
            });

            if (!files || files.length === 0) return;

            const category = await vscode.window.showQuickPick(
                ['firebase', 'flutter', 'dart', 'uganda-patterns', 'storage', 'networking', 'general'],
                { placeHolder: 'Category' }
            );

            if (!category) return;

            for (const file of files) {
                await knowledgeBase.addFromLocalFile(file.fsPath, category);
            }

            vscode.window.showInformationMessage(`✓ Added ${files.length} knowledge file(s)`);
        })
    );

    // Add from clipboard (copy-paste knowledge)
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.addKnowledgeFromClipboard', async () => {
            const title = await vscode.window.showInputBox({
                prompt: 'Give this knowledge a title',
                placeHolder: 'e.g., Firebase Auth Best Practices',
                ignoreFocusOut: true
            });

            if (!title) return;

            const category = await vscode.window.showQuickPick(
                ['firebase', 'flutter', 'dart', 'uganda-patterns', 'storage', 'networking', 'general'],
                { placeHolder: 'Category' }
            );

            if (!category) return;

            await knowledgeBase.addFromClipboard(category, title);
        })
    );

    // ═══════════════════════════════════════════════════════════════
    // SEARCH AND VIEW KNOWLEDGE
    // ═══════════════════════════════════════════════════════════════

    // Search knowledge base
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.searchKnowledge', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Search knowledge base',
                placeHolder: 'Firebase, Flutter patterns, Uganda MTN, etc.'
            });

            if (!query) return;

            const results = knowledgeBase.search(query);

            if (results.length === 0) {
                vscode.window.showInformationMessage('No results found. Add more knowledge!');
                return;
            }

            // Show results in quick pick
            const chosen = await vscode.window.showQuickPick(
                results.map(r => ({
                    label: r.title,
                    description: r.category,
                    item: r
                })),
                { placeHolder: 'Select to view' }
            );

            if (!chosen) return;

            // Open in webview
            showKnowledgeDetail(chosen.item, context);
        })
    );

    // View knowledge by category
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.viewKnowledgeByCategory', async () => {
            const category = await vscode.window.showQuickPick(
                ['firebase', 'flutter', 'dart', 'uganda-patterns', 'storage', 'networking', 'general'],
                { placeHolder: 'Select category' }
            );

            if (!category) return;

            const items = knowledgeBase.listByCategory(category);

            if (items.length === 0) {
                vscode.window.showInformationMessage(`No knowledge in "${category}" yet. Add some!`);
                return;
            }

            const chosen = await vscode.window.showQuickPick(
                items.map(item => ({
                    label: item.title,
                    description: `Added: ${new Date(item.addedDate).toLocaleDateString()}`,
                    item
                })),
                { placeHolder: 'Select knowledge' }
            );

            if (!chosen) return;
            showKnowledgeDetail(chosen.item, context);
        })
    );

    // View all knowledge statistics
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.knowledgeStats', () => {
            const stats = knowledgeBase.getStats();

            let report = `=== Knowledge Base Statistics ===\n\n`;
            report += `Total Items: ${stats.totalItems}\n`;
            report += `Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB\n\n`;
            report += `By Category:\n`;

            for (const [category, count] of Object.entries(stats.byCategory)) {
                report += `  • ${category}: ${count} items\n`;
            }

            const panel = vscode.window.createWebviewPanel(
                'knowledgeStats',
                'Knowledge Base Stats',
                vscode.ViewColumn.Two,
                {}
            );
            panel.webview.html = getStatsHtml(report);
        })
    );

    // ═══════════════════════════════════════════════════════════════
    // MANAGE KNOWLEDGE
    // ═══════════════════════════════════════════════════════════════

    // Export knowledge base (backup or share)
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.exportKnowledge', async () => {
            const saveUri = await vscode.window.showSaveDialog({
                filters: { 'JSON': ['json'] },
                saveLabel: 'Export Knowledge Base',
                defaultUri: vscode.Uri.file('dart-ai-knowledge.json')
            });

            if (!saveUri) return;

            const json = knowledgeBase.export();
            await vscode.workspace.fs.writeFile(
                saveUri,
                new TextEncoder().encode(json)
            );

            vscode.window.showInformationMessage('✓ Knowledge base exported!');
        })
    );

    // Import knowledge base (restore or team knowledge)
    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.importKnowledge', async () => {
            const files = await vscode.window.showOpenDialog({
                filters: { 'JSON': ['json'] },
                canSelectFiles: true,
                canSelectFolders: false,
                title: 'Import knowledge base'
            });

            if (!files || files.length === 0) return;

            const fileUri = files[0];
            const content = await vscode.workspace.fs.readFile(fileUri);
            const json = new TextDecoder().decode(content);

            await knowledgeBase.import(json);
        })
    );

    // ═══════════════════════════════════════════════════════════════
    // SPECIAL: Add common Uganda Flutter patterns
    // ═══════════════════════════════════════════════════════════════

    context.subscriptions.push(
        vscode.commands.registerCommand('dartAI.addUgandaPatternsLibrary', async () => {
            const patterns = `
# Uganda Flutter Development Patterns

## MTN Mobile Money Integration

### Validate MTN Phone Number
\`\`\`dart
final mtnRegex = RegExp(r'^256[0-9]{9}$');
bool isValidMTN(String phone) {
  return mtnRegex.hasMatch(phone);
}
\`\`\`

### Process MTN Payment
\`\`\`dart
Future<PaymentResult> processMTNPayment({
  required String phoneNumber,
  required int amountUGX,
  required String transactionRef,
}) async {
  // Validate amount is in hundreds (UGX smallest unit)
  if (amountUGX % 100 != 0) {
    throw Exception('Amount must be in hundreds (UGX)');
  }
  
  // Call MTN API
  final response = await httpClient.post(
    Uri.parse('https://mtn-api.ug/pay'),
    body: {
      'phone': phoneNumber,
      'amount': amountUGX,
      'reference': transactionRef,
    }
  );
  
  return PaymentResult.fromJson(response.body);
}
\`\`\`

## Airtel Money Integration

### Process Airtel Payment
\`\`\`dart
Future<bool> processAirtelPayment({
  required String phone,
  required int amount,
  required String reference,
}) async {
  final result = await airtelService.sendMoney(
    recipient: phone,
    amount: amount,
    transactionId: reference,
  );
  return result.success;
}
\`\`\`

## Firebase Firestore for Farm Apps

### Save Farm Animal Record
\`\`\`dart
Future<void> saveAnimal(Animal animal) async {
  await FirebaseFirestore.instance
    .collection('animals')
    .doc(animal.id)
    .set(animal.toMap());
}
\`\`\`

### Listen to Farm Animals (Real-time)
\`\`\`dart
Stream<List<Animal>> getAnimalsStream() {
  return FirebaseFirestore.instance
    .collection('animals')
    .snapshots()
    .map((snapshot) => snapshot.docs
      .map((doc) => Animal.fromMap(doc.data()))
      .toList()
    );
}
\`\`\`

## Hive Local Storage (Offline First)

### Setup Hive for Farm Data
\`\`\`dart
final box = await Hive.openBox<Animal>('animals');

// Add animal
await box.add(animal);

// Get all
final animals = box.values.toList();

// Update
await box.putAt(index, updatedAnimal);
\`\`\`

## Church Hymn App - Song Formatting

### Song Data Model
\`\`\`dart
class Song {
  final String id;
  final String title;
  final String lyrics;
  final List<String> languages; // ['English', 'Swahili', 'Luganda']
  final DateTime lastUsed;
  final int frequency;
  
  Song copyWith({DateTime? lastUsed, int? frequency}) {
    return Song(
      id: id,
      title: title,
      lyrics: lyrics,
      languages: languages,
      lastUsed: lastUsed ?? this.lastUsed,
      frequency: frequency ?? this.frequency,
    );
  }
}
\`\`\`

### Check Song Recently Used (28-day rule)
\`\`\`dart
bool isRecentlyUsed(Song song) {
  final daysSinceUsed = DateTime.now().difference(song.lastUsed).inDays;
  return daysSinceUsed <= 28;
}
\`\`\`

## Error Prevention Patterns

### Validate User Input
\`\`\`dart
String? validatePhoneNumber(String input) {
  if (input.isEmpty) return 'Phone number required';
  if (!RegExp(r'^256[0-9]{9}$').hasMatch(input)) {
    return 'Invalid Uganda phone number';
  }
  return null; // Valid
}
\`\`\`

### Safe Async Operations
\`\`\`dart
Future<T?> safeAsyncCall<T>(Future<T> Function() operation) async {
  try {
    return await operation();
  } catch (e) {
    debugPrint('Error: \$e');
    return null;
  }
}
\`\`\`

## Performance Tips for Low-RAM Devices

- Use const constructors where possible
- Limit Firestore real-time listeners
- Cache images locally with Image Caching
- Use pagination for large lists
- Defer non-critical operations

## Common Gotchas

1. **Currency**: Always use UGX (Uganda Shilling), 1 UGX is smallest unit
2. **Phone Format**: Uganda numbers are +256 internationally, 0 domestically
3. **Offline**: Plan for poor connectivity - use Hive for local fallback
4. **Firebase Rules**: Restrict Firestore to authenticated users only
`;

            await knowledgeBase.addFromClipboard('uganda-patterns', 'Uganda Flutter Development Patterns');
            vscode.window.showInformationMessage('✓ Uganda patterns library added!');
        })
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function showKnowledgeDetail(
    knowledge: any,
    context: vscode.ExtensionContext
): void {
    const panel = vscode.window.createWebviewPanel(
        'knowledgeDetail',
        knowledge.title,
        vscode.ViewColumn.Two,
        {}
    );

    panel.webview.html = getKnowledgeHtml(knowledge);
}

function getKnowledgeHtml(knowledge: any): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${knowledge.title}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    line-height: 1.6;
                }
                h1 { color: var(--vscode-textLink-foreground); }
                .meta {
                    padding: 10px;
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 5px;
                    margin: 20px 0;
                    font-size: 0.9em;
                }
                .tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin: 10px 0;
                }
                .tag {
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 0.85em;
                }
                pre {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
                code {
                    font-family: 'Courier New', monospace;
                }
            </style>
        </head>
        <body>
            <h1>${knowledge.title}</h1>
            
            <div class="meta">
                <strong>Category:</strong> ${knowledge.category}<br>
                <strong>Added:</strong> ${new Date(knowledge.addedDate).toLocaleString()}<br>
                <strong>Source:</strong> ${knowledge.source}
            </div>

            <div class="tags">
                ${knowledge.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('')}
            </div>

            <div class="content">
                <pre>${escapeHtml(knowledge.content)}</pre>
            </div>
        </body>
        </html>
    `;
}

function getStatsHtml(report: string): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h1 { color: var(--vscode-textLink-foreground); }
                pre {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 15px;
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <h1>📚 Knowledge Base Statistics</h1>
            <pre>${report}</pre>
        </body>
        </html>
    `;
}

function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}