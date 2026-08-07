import * as vscode from 'vscode';
import { LearningEngine } from '../services/learningEngine';
import { AIService } from '../services/aiService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompletionSource =
    | 'learned'
    | 'widget'
    | 'method'
    | 'keyword'
    | 'snippet'
    | 'import'
    | 'provider'
    | 'firebase'
    | 'lifecycle';

export interface CompletionCandidate {
    text: string;
    label: string;
    kind: vscode.CompletionItemKind;
    detail: string;
    documentation: string;
    sortText: string;
    score: number;
    isSnippet: boolean;
    source: CompletionSource;
    insertText?: string;       // full snippet body (tab-stop aware)
    triggerChars?: string[];   // only show when these chars were typed
    tags?: string[];
}

export interface ContextProfile {
    isInsideBuildMethod: boolean;
    isInsideClass: boolean;
    isInsideStatefulWidget: boolean;
    isInsideStatelessWidget: boolean;
    isInsideAsyncFunction: boolean;
    isInsideTest: boolean;
    receiverType?: string;     // type before '.' for member completions
    currentClassName?: string;
    importsFirebase: boolean;
    importsProvider: boolean;
    importsRiverpod: boolean;
    importsHive: boolean;
    importsDio: boolean;
    linePrefix: string;
    surroundingText: string;
}

// ─── LRU Cache ────────────────────────────────────────────────────────────────

class LRUCache<V> {
    private readonly map = new Map<string, V>();

    constructor(private readonly maxSize: number) { }

    get(key: string): V | undefined {
        const val = this.map.get(key);
        if (val === undefined) return undefined;
        // Refresh position
        this.map.delete(key);
        this.map.set(key, val);
        return val;
    }

    set(key: string, val: V): void {
        if (this.map.has(key)) this.map.delete(key);
        else if (this.map.size >= this.maxSize) {
            this.map.delete(this.map.keys().next().value!);
        }
        this.map.set(key, val);
    }

    clear(): void { this.map.clear(); }
    get size(): number { return this.map.size; }
}

// ─── Completion Data ──────────────────────────────────────────────────────────

interface WidgetDef {
    name: string;
    snippet: string;   // uses $1, $2 … tab stops
    doc: string;
    deprecated?: boolean;
}

const FLUTTER_WIDGETS: WidgetDef[] = [
    { name: 'Scaffold', snippet: 'Scaffold(\n  appBar: AppBar(title: const Text(\'$1\')),\n  body: $2,\n)', doc: 'Material Design basic page structure.' },
    { name: 'AppBar', snippet: 'AppBar(\n  title: const Text(\'$1\'),\n  actions: [$2],\n)', doc: 'Material Design app bar.' },
    { name: 'Container', snippet: 'Container(\n  padding: const EdgeInsets.all($1),\n  child: $2,\n)', doc: 'A convenience widget that combines sizing, padding, decoration, and alignment.' },
    { name: 'Column', snippet: 'Column(\n  mainAxisAlignment: MainAxisAlignment.$1,\n  children: [$2],\n)', doc: 'Vertical layout widget.' },
    { name: 'Row', snippet: 'Row(\n  mainAxisAlignment: MainAxisAlignment.$1,\n  children: [$2],\n)', doc: 'Horizontal layout widget.' },
    { name: 'Stack', snippet: 'Stack(\n  alignment: Alignment.$1,\n  children: [$2],\n)', doc: 'Overlapping widget layout.' },
    { name: 'ListView', snippet: 'ListView.builder(\n  itemCount: $1,\n  itemBuilder: (context, index) {\n    return $2;\n  },\n)', doc: 'Scrollable list.' },
    { name: 'GridView', snippet: 'GridView.builder(\n  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(\n    crossAxisCount: $1,\n  ),\n  itemCount: $2,\n  itemBuilder: (context, index) {\n    return $3;\n  },\n)', doc: 'Scrollable grid.' },
    { name: 'SizedBox', snippet: 'SizedBox(width: $1, height: $2)', doc: 'Fixed-size box. Prefer over Container for whitespace.' },
    { name: 'Padding', snippet: 'Padding(\n  padding: const EdgeInsets.all($1),\n  child: $2,\n)', doc: 'Insets a child widget.' },
    { name: 'Center', snippet: 'Center(child: $1)', doc: 'Centers its child.' },
    { name: 'Align', snippet: 'Align(alignment: Alignment.$1, child: $2)', doc: 'Aligns its child within itself.' },
    { name: 'Text', snippet: 'Text(\n  \'$1\',\n  style: const TextStyle(fontSize: $2),\n)', doc: 'Styled text widget.' },
    { name: 'Icon', snippet: 'Icon(Icons.$1, size: $2)', doc: 'Material icon widget.' },
    { name: 'Image', snippet: 'Image.asset(\'$1\', fit: BoxFit.$2)', doc: 'Image display widget.' },
    { name: 'Card', snippet: 'Card(\n  elevation: $1,\n  child: $2,\n)', doc: 'Material card with elevation.' },
    { name: 'ElevatedButton', snippet: 'ElevatedButton(\n  onPressed: () {\n    $1\n  },\n  child: const Text(\'$2\'),\n)', doc: 'Material elevated button (replaces RaisedButton).' },
    { name: 'TextButton', snippet: 'TextButton(\n  onPressed: () {\n    $1\n  },\n  child: const Text(\'$2\'),\n)', doc: 'Material text button.' },
    { name: 'IconButton', snippet: 'IconButton(\n  icon: const Icon(Icons.$1),\n  onPressed: () {\n    $2\n  },\n)', doc: 'Tappable icon button.' },
    { name: 'TextField', snippet: 'TextField(\n  controller: $1,\n  decoration: const InputDecoration(\n    labelText: \'$2\',\n  ),\n)', doc: 'Text input field.' },
    { name: 'GestureDetector', snippet: 'GestureDetector(\n  onTap: () {\n    $1\n  },\n  child: $2,\n)', doc: 'Detects gestures on its child.' },
    { name: 'InkWell', snippet: 'InkWell(\n  onTap: () {\n    $1\n  },\n  child: $2,\n)', doc: 'Material ripple on tap.' },
    { name: 'AnimatedContainer', snippet: 'AnimatedContainer(\n  duration: const Duration(milliseconds: $1),\n  curve: Curves.$2,\n  child: $3,\n)', doc: 'Smoothly animates changes to Container properties.' },
    { name: 'FutureBuilder', snippet: 'FutureBuilder<$1>(\n  future: $2,\n  builder: (context, snapshot) {\n    if (snapshot.connectionState == ConnectionState.waiting) {\n      return const CircularProgressIndicator();\n    }\n    if (snapshot.hasError) return Text(\'Error: \${snapshot.error}\');\n    return $3;\n  },\n)', doc: 'Builds based on async Future result.' },
    { name: 'StreamBuilder', snippet: 'StreamBuilder<$1>(\n  stream: $2,\n  builder: (context, snapshot) {\n    if (!snapshot.hasData) return const CircularProgressIndicator();\n    return $3;\n  },\n)', doc: 'Builds based on Stream events.' },
    { name: 'CircularProgressIndicator', snippet: 'const CircularProgressIndicator()', doc: 'Material loading spinner.' },
    { name: 'Expanded', snippet: 'Expanded(\n  flex: $1,\n  child: $2,\n)', doc: 'Expands a child to fill available space in Row/Column.' },
    { name: 'Flexible', snippet: 'Flexible(flex: $1, child: $2)', doc: 'Flexibly sizes a child in Row/Column.' },
    { name: 'Wrap', snippet: 'Wrap(\n  spacing: $1,\n  runSpacing: $2,\n  children: [$3],\n)', doc: 'Wraps children to the next line when they overflow.' },
    { name: 'RaisedButton', snippet: 'ElevatedButton(onPressed: () { $1 }, child: const Text(\'$2\'))', doc: 'Deprecated — use ElevatedButton.', deprecated: true },
    { name: 'FlatButton', snippet: 'TextButton(onPressed: () { $1 }, child: const Text(\'$2\'))', doc: 'Deprecated — use TextButton.', deprecated: true },
];

interface SnippetDef {
    trigger: string;
    label: string;
    body: string;
    doc: string;
    tags: string[];
}

const DART_SNIPPETS: SnippetDef[] = [
    {
        trigger: 'slw', label: 'Stateless Widget',
        body: 'class $1 extends StatelessWidget {\n  const $1({super.key});\n\n  @override\n  Widget build(BuildContext context) {\n    return $2;\n  }\n}',
        doc: 'Full StatelessWidget boilerplate.', tags: ['flutter', 'widget'],
    },
    {
        trigger: 'nav', label: 'Navigator',
        body: 'Navigator.push(\n context, \n MaterialPageRoute(builder: (_) => $1(),\n)); ',
        doc: 'Class Navigator extends StatefulWidget.', tags: ['flutter', 'widget'],
    },
    {
        trigger: 'drop', label: 'DropdownButtonFormField',
        body: 'DropdownButtonFormField<String>(\n initialValue: $1,\n items: [$2]\n .map((e) => DropdownMenuItem(value: e, child: Text(e)))\n .toList(),\n onChanged: (v) => setState(() => $3 = v),\n decoration: $4,\n ),\n const SizedBox(height: $5),',
        doc: 'Creates a [DropdownButton] widget.', tags: ['flutter', 'widget'],
    },
    {
        trigger: 'pop', label: 'PopupMenuButton',
        body: 'PopupMenuButton<String>(\n onSelected: (value) { \n if(value == $1) { \n Navigator.push(\n context,\n MaterialPageRoute(\n builder: (_) => $2(\n index: index,\n $3: Map<dynamic, dynamic>.from($4), \n), \n), \n ).then((_) => setState(() {})); \n } else if (value == $5) { \n Navigator.push( \n context,\n MaterialPageRoute(\n builder: (_) => $6(\n index: $7,\n $8: Map<dynamic, dynamic>.from($9),\n ),\n ),\n ).then((_) => setState(() {}));\n } else if (value == $10) {\n $11;\n  }\n },\n itemBuilder: (BuildContext context) => [\n const PopupMenuItem(value: $12, child: Text($13)),\n const PopupMenuItem(value: $14, child: Text($14)),\n const PopupMenuItem(value: $15, child: Text($16),\n ),\n ],\n ),\n',
        doc: 'Creates a button that shows a popup menu.', tags: ['futter', 'widget'],
    },
    {
        trigger: 'Nav', label: 'Navigator',
        body: 'Navigator.push(\n context, \n MaterialPageRoute(builder: (_) => $1(),\n)); ',
        doc: 'Class Navigator extends StatefulWidget.', tags: ['flutter', 'widget'],
    },
    {
        trigger: 'sfw', label: 'Stateful Widget',
        body: 'class $1 extends StatefulWidget {\n  const $1({super.key});\n\n  @override\n  State<$1> createState() => _$1State();\n}\n\nclass _$1State extends State<$1> {\n  @override\n  Widget build(BuildContext context) {\n    return $2;\n  }\n\n  @override\n  void dispose() {\n    super.dispose();\n  }\n}',
        doc: 'Full StatefulWidget boilerplate with dispose().', tags: ['flutter', 'widget'],
    },
    {
        trigger: 'asyncfn', label: 'Async function',
        body: 'Future<$1> $2() async {\n  try {\n    $3\n  } catch (e, stack) {\n    debugPrint(\'Error: \$e\\n\$stack\');\n    rethrow;\n  }\n}',
        doc: 'Async function with try/catch and rethrow.', tags: ['async'],
    },
    {
        trigger: 'trycatch', label: 'Try-catch block',
        body: 'try {\n  $1\n} catch (e, stack) {\n  debugPrint(\'Error: \$e\\n\$stack\');\n  $2\n}',
        doc: 'Try-catch with stack trace.', tags: ['error-handling'],
    },
    {
        trigger: 'model', label: 'Data model class',
        body: 'class $1 {\n  const $1({required this.$2});\n\n  final $3 $2;\n\n  $1 copyWith({$3? $2}) {\n    return $1($2: $2 ?? this.$2);\n  }\n\n  Map<String, dynamic> toJson() => {\'$2\': $2};\n\n  factory $1.fromJson(Map<String, dynamic> json) =>\n      $1($2: json[\'$2\'] as $3);\n\n  @override\n  String toString() => \'$1($2: \$$2)\';\n}',
        doc: 'Immutable data model with copyWith, toJson, fromJson.', tags: ['model', 'json'],
    },
    {
        trigger: 'rivpod', label: 'Riverpod StateNotifier',
        body: 'final $1Provider = StateNotifierProvider<$2Notifier, $3>((ref) => $2Notifier());\n\nclass $2Notifier extends StateNotifier<$3> {\n  $2Notifier() : super($4);\n\n  void update($3 value) => state = value;\n}',
        doc: 'Riverpod StateNotifierProvider boilerplate.', tags: ['riverpod', 'state'],
    },
    {
        trigger: 'provchng', label: 'Provider ChangeNotifier',
        body: 'class $1 extends ChangeNotifier {\n  $2 _$3;\n\n  $2 get $3 => _$3;\n\n  set $3($2 value) {\n    _$3 = value;\n    notifyListeners();\n  }\n}',
        doc: 'ChangeNotifier class for Provider.', tags: ['provider', 'state'],
    },
    {
        trigger: 'fbcol', label: 'Firestore collection stream',
        body: 'StreamBuilder<QuerySnapshot>(\n  stream: FirebaseFirestore.instance.collection(\'$1\').snapshots(),\n  builder: (context, snapshot) {\n    if (!snapshot.hasData) return const CircularProgressIndicator();\n    final docs = snapshot.data!.docs;\n    return ListView.builder(\n      itemCount: docs.length,\n      itemBuilder: (context, index) {\n        final data = docs[index].data() as Map<String, dynamic>;\n        return ListTile(title: Text(data[\'$2\'] ?? \'\'));\n      },\n    );\n  },\n)',
        doc: 'StreamBuilder wired to a Firestore collection.', tags: ['firebase', 'firestore'],
    },
    {
        trigger: 'hivemodel', label: 'Hive model',
        body: 'part \'$1.g.dart\';\n\n@HiveType(typeId: $2)\nclass $3 extends HiveObject {\n  @HiveField(0)\n  late $4 $5;\n}',
        doc: 'Hive model with HiveType and HiveField annotations.', tags: ['hive', 'local-storage'],
    },
    {
        trigger: 'test', label: 'Unit test',
        body: 'test(\'$1\', () {\n  // Arrange\n  $2\n  // Act\n  $3\n  // Assert\n  expect($4, $5);\n});',
        doc: 'Unit test with Arrange-Act-Assert pattern.', tags: ['test'],
    },
    {
        trigger: 'widtest', label: 'Widget test',
        body: 'testWidgets(\'$1\', (WidgetTester tester) async {\n  await tester.pumpWidget(const MaterialApp(home: $2()));\n  expect(find.text(\'$3\'), findsOneWidget);\n});',
        doc: 'Flutter widget test boilerplate.', tags: ['test', 'flutter'],
    },
    {
        trigger: 'dio', label: 'Dio HTTP GET',
        body: 'final response = await Dio().get<Map<String, dynamic>>(\'$1\');\nif (response.statusCode == 200) {\n  final data = response.data!;\n  $2\n}',
        doc: 'Dio HTTP GET with status check.', tags: ['dio', 'network'],
    },
    {
        trigger: 'mmoney', label: 'MTN/Airtel Mobile Money request (Uganda)',
        body: '// Mobile Money Payment — UGX\nfinal payload = {\n  \'amount\': \'$1\',\n  \'currency\': \'UGX\',\n  \'externalId\': uuid.v4(),\n  \'payer\': {\'partyIdType\': \'MSISDN\', \'partyId\': \'+256$2\'},\n  \'payerMessage\': \'$3\',\n  \'payeeNote\': \'$4\',\n};',
        doc: 'MTN/Airtel Mobile Money request payload (Uganda, UGX).', tags: ['mobile-money', 'uganda'],
    },
];

// Dart methods keyed by receiver hint
const DART_METHODS: Record<string, Array<{ label: string; detail: string; snippet: string }>> = {
    'String': [
        { label: 'contains()', detail: 'bool contains(Pattern other) - Dart AI', snippet: 'contains(\'$1\')' },
        { label: 'split()', detail: 'List<String> split(Pattern pattern) - Dart AI', snippet: 'split(\'$1\')' },
        { label: 'trim()', detail: 'String trim() - Dart AI', snippet: 'trim()' },
        { label: 'toLowerCase()', detail: 'String toLowerCase() - Dart AI', snippet: 'toLowerCase()' },
        { label: 'toUpperCase()', detail: 'String toUpperCase() - Dart AI', snippet: 'toUpperCase()' },
        { label: 'replaceAll()', detail: 'String replaceAll(Pattern from, String replace) - Dart AI', snippet: 'replaceAll(\'$1\', \'$2\')' },
        { label: 'startsWith()', detail: 'bool startsWith(Pattern pattern) - Dart AI', snippet: 'startsWith(\'$1\')' },
        { label: 'endsWith()', detail: 'bool endsWith(String other) - Dart AI', snippet: 'endsWith(\'$1\')' },
        { label: 'isEmpty', detail: 'bool get isEmpty - Dart AI', snippet: 'isEmpty' },
        { label: 'isNotEmpty', detail: 'bool get isNotEmpty - Dart AI', snippet: 'isNotEmpty' },
        { label: 'length', detail: 'int get length - Dart AI', snippet: 'length' },
    ],
    'List': [
        { label: 'add()', detail: 'void add(E value) - Dart AI', snippet: 'add($1)' },
        { label: 'addAll()', detail: 'void addAll(Iterable<E> iterable) - Dart AI', snippet: 'addAll($1)' },
        { label: 'remove()', detail: 'bool remove(Object? value) - Dart AI', snippet: 'remove($1)' },
        { label: 'removeAt()', detail: 'E removeAt(int index) - Dart AI', snippet: 'removeAt($1)' },
        { label: 'where()', detail: 'Iterable<E> where(bool Function(E) test) - Dart AI', snippet: 'where(($1) => $2)' },
        { label: 'map()', detail: 'Iterable<T> map<T>(T Function(E) f) - Dart AI', snippet: 'map(($1) => $2).toList()' },
        { label: 'forEach()', detail: 'void forEach(void Function(E) action) - Dart AI', snippet: 'forEach(($1) {\n  $2\n})' },
        { label: 'sort()', detail: 'void sort([int Function(E, E)? compare]) - Dart AI', snippet: 'sort(($1, $2) => $1.compareTo($2))' },
        { label: 'contains()', detail: 'bool contains(Object? element) - Dart AI', snippet: 'contains($1)' },
        { label: 'firstWhere()', detail: 'E firstWhere(bool Function(E) test) - Dart AI', snippet: 'firstWhere(($1) => $2)' },
        { label: 'isEmpty', detail: 'bool get isEmpty - Dart AI', snippet: 'isEmpty' },
        { label: 'length', detail: 'int get length - Dart AI', snippet: 'length' },
        { label: 'first', detail: 'E get first - Dart AI', snippet: 'first' },
        { label: 'last', detail: 'E get last - Dart AI', snippet: 'last' },
    ],
    'Map': [
        { label: 'containsKey()', detail: 'bool containsKey(Object? key) - Dart AI', snippet: 'containsKey($1)' },
        { label: 'containsValue()', detail: 'bool containsValue(Object? value) - Dart AI', snippet: 'containsValue($1)' },
        { label: 'putIfAbsent()', detail: 'V putIfAbsent(K key, V Function() ifAbsent) - Dart AI', snippet: 'putIfAbsent($1, () => $2)' },
        { label: 'remove()', detail: 'V? remove(Object? key)', snippet: 'remove($1) - Dart AI' },
        { label: 'keys', detail: 'Iterable<K> get keys - Dart AI', snippet: 'keys' },
        { label: 'values', detail: 'Iterable<V> get values - Dart AI', snippet: 'values' },
        { label: 'entries', detail: 'Iterable<MapEntry<K,V>> get entries - Dart AI', snippet: 'entries' },
        { label: 'forEach()', detail: 'void forEach(void Function(K, V) action) - Dart AI', snippet: 'forEach(($1, $2) {\n  $3\n})' },
    ],
};

const DART_KEYWORDS = [
    'abstract', 'as', 'assert', 'async', 'await',
    'base', 'break', 'case', 'catch', 'class', 'const', 'continue', 'covariant',
    'default', 'deferred', 'do', 'dynamic',
    'else', 'enum', 'export', 'extends', 'extension', 'external',
    'factory', 'false', 'final', 'finally', 'for', 'Function',
    'get', 'hide', 'if', 'implements', 'import', 'in', 'interface',
    'late', 'library',
    'mixin',
    'new', 'null',
    'on', 'operator',
    'part',
    'required', 'rethrow', 'return',
    'sealed', 'set', 'show', 'static', 'super', 'switch', 'sync',
    'this', 'throw', 'true', 'try', 'typedef',
    'var', 'void',
    'when', 'while', 'with',
    'yield',
];

// ─── AdvancedCompletionEngine ─────────────────────────────────────────────────

/**
 * Advanced Code Completion Engine for Dart/Flutter.
 *
 * Improvements over v1:
 * - LRU cache instead of unbounded Map with naïve eviction.
 * - Rich context profile: detects StatefulWidget, async functions, imports (Firebase/Provider/Hive).
 * - 30+ widget completions with full tab-stop snippets and deprecation notes.
 * - Type-aware member completions (String, List, Map) inferred from receiver token.
 * - 12 production-ready code snippets including Riverpod, Firestore, Hive, Dio, Mobile Money.
 * - Trigger-char awareness: dot triggers member completions, import triggers package paths.
 * - Completion scoring considers prefix match quality, context relevance, and source priority.
 * - registerCustomCompletions() for runtime extension without subclassing.
 * - Deprecated widget detection: flags RaisedButton/FlatButton with migration snippet.
 */
export class AdvancedCompletionEngine {
    private readonly cache: LRUCache<CompletionCandidate[]>;
    private readonly MAX_RESULTS = 25;
    private readonly customCompletions: CompletionCandidate[] = [];

    constructor(
        private readonly learningEngine: LearningEngine,
        private readonly aiService: AIService
    ) {
        this.cache = new LRUCache(500);
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Register additional completions at runtime (e.g. from plugin settings).
     */
    registerCustomCompletions(completions: CompletionCandidate[]): void {
        this.customCompletions.push(...completions);
    }

    /**
     * Generate ranked, deduplicated completions for the cursor position.
     */
    async generateCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        triggerCharacter?: string
    ): Promise<CompletionCandidate[]> {
        const lineText = document.lineAt(position).text;
        const prefix = lineText.substring(0, position.character);
        const cacheKey = this._cacheKey(document.uri.toString(), prefix, triggerCharacter);

        const cached = this.cache.get(cacheKey);
        if (cached) return cached;
        const ctx = this._buildContextProfile(document, position, prefix);
        const candidates: CompletionCandidate[] = [];

        // Sources — ordered so higher-priority sources add first (tiebreak by insertion order)
        candidates.push(...this._learnedCompletions(prefix, ctx));
        candidates.push(...this._snippetCompletions(prefix, ctx));
        candidates.push(...this._widgetCompletions(prefix, ctx));
        candidates.push(...this._memberCompletions(prefix, ctx, triggerCharacter));
        candidates.push(...this._keywordCompletions(prefix));
        candidates.push(...this._importCompletions(prefix, ctx));
        candidates.push(...this._lifecycleCompletions(prefix, ctx));
        candidates.push(...this.customCompletions);

        const ranked = this._rank(candidates, prefix, ctx).slice(0, this.MAX_RESULTS);
        this.cache.set(cacheKey, ranked);
        return ranked;
    }

    clearCache(): void { this.cache.clear(); }

    // ── Context analysis ───────────────────────────────────────────────────────

    private _buildContextProfile(
        document: vscode.TextDocument,
        position: vscode.Position,
        prefix: string
    ): ContextProfile {
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(document.lineCount - 1, position.line + 2);
        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) lines.push(document.lineAt(i).text);
        const surrounding = lines.join('\n');
        const full = document.getText();

        // Detect receiver type for member completions (e.g. "myList." → "List")
        const receiverMatch = prefix.match(/(\w+)\.\s*$/);
        let receiverType: string | undefined;
        if (receiverMatch) {
            const varName = receiverMatch[1];
            const typeMatch = full.match(new RegExp(`(?:List|Map|String|Set)<[^>]*>\\s+${varName}\\b|(?:final|var|const)\\s+(List|Map|String|Set)[^\\s]*\\s+${varName}\\b`));
            if (typeMatch) {
                receiverType = ['List', 'Map', 'String', 'Set'].find(t => (typeMatch[0] || '').includes(t));
            }
            // Fallback: infer from variable name conventions
            if (!receiverType) {
                if (/list$|items?$|entries?$/i.test(varName)) receiverType = 'List';
                else if (/map$|dict$/i.test(varName)) receiverType = 'Map';
                else if (/str$|name$|text$|label$|title$/i.test(varName)) receiverType = 'String';
            }
        }

        const classMatch = full.match(/class\s+(\w+)/g);
        const currentClassName = classMatch ? classMatch[classMatch.length - 1]?.replace('class ', '') : undefined;

        return {
            isInsideBuildMethod: /Widget\s+build\s*\(/.test(surrounding),
            isInsideClass: /^\s*class\s+/.test(full),
            isInsideStatefulWidget: /extends\s+StatefulWidget/.test(full) || /extends\s+State</.test(full),
            isInsideStatelessWidget: /extends\s+StatelessWidget/.test(full),
            isInsideAsyncFunction: /async\s*(?:\{|=>)/.test(surrounding),
            isInsideTest: /testWidgets|flutter_test/.test(full),
            receiverType,
            currentClassName,
            importsFirebase: /firebase_core|cloud_firestore|firebase_auth/.test(full),
            importsProvider: /package:provider/.test(full),
            importsRiverpod: /package:riverpod|package:flutter_riverpod/.test(full),
            importsHive: /package:hive/.test(full),
            importsDio: /package:dio/.test(full),
            linePrefix: prefix,
            surroundingText: surrounding,
        };
    }

    // ── Completion sources ─────────────────────────────────────────────────────

    private _learnedCompletions(prefix: string, _ctx: ContextProfile): CompletionCandidate[] {
        if (prefix.trim().length < 2) return [];
        const patterns = this.learningEngine.getCompletionSuggestions(prefix);
        return patterns.map((p, i) => ({
            text: p, label: p,
            kind: vscode.CompletionItemKind.Text,
            detail: 'Learned from your code - Dart AI',
            documentation: 'Pattern inferred from your recent edits.',
            sortText: `0${String(i).padStart(3, '0')}`,
            score: 0.92 - i * 0.05,
            isSnippet: false,
            source: 'learned' as CompletionSource,
            tags: ['learned'],
        }));
    }

    private _snippetCompletions(prefix: string, ctx: ContextProfile): CompletionCandidate[] {
        const lp = prefix.trim().toLowerCase();
        return DART_SNIPPETS
            .filter(s => {
                if (!s.trigger.startsWith(lp) && !s.label.toLowerCase().startsWith(lp)) return false;
                // Context filtering
                if (s.tags.includes('firebase') && !ctx.importsFirebase) return false;
                if (s.tags.includes('riverpod') && !ctx.importsRiverpod) return false;
                if (s.tags.includes('provider') && !ctx.importsProvider) return false;
                if (s.tags.includes('hive') && !ctx.importsHive) return false;
                if (s.tags.includes('dio') && !ctx.importsDio) return false;
                return true;
            })
            .map(s => ({
                text: s.trigger,
                label: `${s.trigger} — ${s.label}`,
                kind: vscode.CompletionItemKind.Snippet,
                detail: 'Snippet - Dart AI',
                documentation: s.doc,
                sortText: `1${s.trigger}`,
                score: 0.88,
                isSnippet: true,
                insertText: s.body,
                source: 'snippet' as CompletionSource,
                tags: s.tags,
            }));
    }

    private _widgetCompletions(prefix: string, ctx: ContextProfile): CompletionCandidate[] {
        if (!ctx.isInsideBuildMethod && !ctx.isInsideStatefulWidget && !ctx.isInsideStatelessWidget) return [];
        const lp = prefix.trim().toLowerCase();
        return FLUTTER_WIDGETS
            .filter(w => w.name.toLowerCase().startsWith(lp))
            .map(w => ({
                text: w.name,
                label: w.deprecated ? `${w.name} ⚠ deprecated` : w.name,
                kind: vscode.CompletionItemKind.Class,
                detail: w.deprecated ? 'Flutter Widget (deprecated) - Dart AI' : 'Flutter Widget - Dart AI',
                documentation: w.doc,
                sortText: `2${w.name}`,
                score: w.deprecated ? 0.4 : 0.82,
                isSnippet: true,
                insertText: w.snippet,
                source: 'widget' as CompletionSource,
                tags: ['flutter', 'widget'],
            }));
    }

    private _memberCompletions(
        prefix: string,
        ctx: ContextProfile,
        triggerChar?: string
    ): CompletionCandidate[] {
        if (triggerChar !== '.' && !prefix.endsWith('.')) return [];
        const typeMethods = ctx.receiverType ? DART_METHODS[ctx.receiverType] : undefined;
        const pool = typeMethods ?? Object.values(DART_METHODS).flat();

        const memberPrefix = prefix.split('.').pop()?.toLowerCase() ?? '';
        return pool
            .filter(m => m.label.toLowerCase().startsWith(memberPrefix))
            .map(m => ({
                text: m.label,
                label: m.label,
                kind: m.label.endsWith('()') ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Property,
                detail: m.detail,
                documentation: `Dart ${ctx.receiverType ?? ''} member.`,
                sortText: `3${m.label}`,
                score: typeMethods ? 0.86 : 0.72, // boost when type is known
                isSnippet: m.snippet.includes('$'),
                insertText: m.snippet,
                source: 'method' as CompletionSource,
                tags: ['dart', 'member'],
            }));
    }

    private _keywordCompletions(prefix: string): CompletionCandidate[] {
        const lp = prefix.trim().toLowerCase();
        if (lp.length < 1) return [];
        return DART_KEYWORDS
            .filter(k => k.startsWith(lp))
            .map(k => ({
                text: k, label: k,
                kind: vscode.CompletionItemKind.Keyword,
                detail: 'Dart keyword - Dart AI',
                documentation: `Dart language keyword: ${k}`,
                sortText: `4${k}`,
                score: 0.78,
                isSnippet: false,
                source: 'keyword' as CompletionSource,
                tags: ['keyword'],
            }));
    }

    private _importCompletions(prefix: string, ctx: ContextProfile): CompletionCandidate[] {
        if (!prefix.trim().startsWith('import')) return [];
        const packages = [
            { pkg: 'package:flutter/material.dart', doc: 'Flutter Material Design library.' },
            { pkg: 'package:flutter/cupertino.dart', doc: 'Flutter Cupertino (iOS) library.' },
            { pkg: 'package:provider/provider.dart', doc: 'Provider state management.' },
            { pkg: 'package:flutter_riverpod/flutter_riverpod.dart', doc: 'Riverpod state management.' },
            { pkg: 'package:hive/hive.dart', doc: 'Hive local key-value storage.' },
            { pkg: 'package:hive_flutter/hive_flutter.dart', doc: 'Hive Flutter adapter.' },
            { pkg: 'package:firebase_core/firebase_core.dart', doc: 'Firebase Core.' },
            { pkg: 'package:cloud_firestore/cloud_firestore.dart', doc: 'Cloud Firestore.' },
            { pkg: 'package:firebase_auth/firebase_auth.dart', doc: 'Firebase Auth.' },
            { pkg: 'package:dio/dio.dart', doc: 'Dio HTTP client.' },
            { pkg: 'package:get_it/get_it.dart', doc: 'GetIt service locator.' },
            { pkg: 'package:go_router/go_router.dart', doc: 'GoRouter navigation.' },
            { pkg: 'package:flutter_test/flutter_test.dart', doc: 'Flutter testing library.' },
            { pkg: 'dart:async', doc: 'Dart async library (Stream, Future).' },
            { pkg: 'dart:convert', doc: 'Dart JSON/UTF-8 encode/decode.' },
        ];
        const query = prefix.replace(/import\s*['"]?/, '').toLowerCase();
        return packages
            .filter(p => p.pkg.includes(query))
            .map(p => ({
                text: `import '${p.pkg}';`,
                label: p.pkg,
                kind: vscode.CompletionItemKind.Module,
                detail: 'Package import - Dart AI',
                documentation: p.doc,
                sortText: `5${p.pkg}`,
                score: 0.75,
                isSnippet: false,
                source: 'import' as CompletionSource,
                tags: ['import'],
            }));
    }

    /** Lifecycle method completions inside StatefulWidget State classes. */
    private _lifecycleCompletions(prefix: string, ctx: ContextProfile): CompletionCandidate[] {
        if (!ctx.isInsideStatefulWidget) return [];
        const lp = prefix.trim().toLowerCase();
        const hooks = [
            {
                label: 'initState', doc: 'Called once when the State is inserted. Call super.initState() first.',
                snippet: '@override\nvoid initState() {\n  super.initState();\n  $1\n}',
            },
            {
                label: 'dispose', doc: 'Called when the State is removed. Dispose controllers here.',
                snippet: '@override\nvoid dispose() {\n  $1\n  super.dispose();\n}',
            },
            {
                label: 'didChangeDependencies', doc: 'Called after initState() and when dependencies change.',
                snippet: '@override\nvoid didChangeDependencies() {\n  super.didChangeDependencies();\n  $1\n}',
            },
            {
                label: 'didUpdateWidget', doc: 'Called when the parent rebuilds with a new widget instance.',
                snippet: `@override
void didUpdateWidget(covariant ${ctx.currentClassName ?? 'MyWidget'} oldWidget) {
    super.didUpdateWidget(oldWidget);
    $1
}`,
            },
            {
                label: 'setState', doc: 'Schedules a rebuild. Only assign state inside the callback.',
                snippet: 'setState(() {\n  $1\n});',
            },
        ];
        return hooks
            .filter(h => h.label.startsWith(lp))
            .map(h => ({
                text: h.label, label: h.label,
                kind: vscode.CompletionItemKind.Method,
                detail: 'StatefulWidget lifecycle - Dart AI',
                documentation: h.doc,
                sortText: `6${h.label}`,
                score: 0.84,
                isSnippet: true,
                insertText: h.snippet,
                source: 'lifecycle' as CompletionSource,
                tags: ['flutter', 'lifecycle'],
            }));
    }

    // ── Ranking ────────────────────────────────────────────────────────────────

    private _rank(
        candidates: CompletionCandidate[],
        prefix: string,
        _ctx: ContextProfile
    ): CompletionCandidate[] {
        const lp = prefix.trim().toLowerCase();

        const scored = candidates.map(c => {
            let score = c.score;
            const lt = c.text.toLowerCase();

            if (lt === lp) score += 0.30;                                   // exact match
            else if (lt.startsWith(lp)) score += 0.15;                     // prefix match
            else if (lt.includes(lp)) score += 0.05;                       // substring match

            if (c.kind === vscode.CompletionItemKind.Snippet) score += 0.05;
            if (c.kind === vscode.CompletionItemKind.Keyword) score += 0.03;
            if (c.source === 'learned') score += 0.08;

            return { ...c, score: Math.min(score, 1.0) };
        });

        // Deduplicate by label keeping highest score
        const seen = new Map<string, CompletionCandidate>();
        for (const c of scored) {
            const key = c.label.toLowerCase();
            if (!seen.has(key) || c.score > seen.get(key)!.score) seen.set(key, c);
        }

        return Array.from(seen.values()).sort((a, b) => b.score - a.score);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private _cacheKey(uri: string, prefix: string, trigger?: string): string {
        return `${uri}|${prefix.slice(-60)}|${trigger ?? ''}`;
    }
}