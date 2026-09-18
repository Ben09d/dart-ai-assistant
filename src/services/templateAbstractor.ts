/**
 * Detects likely domain-specific identifiers in a code snippet (class-like
 * capitalized types and their lowercase variable derivatives) and replaces
 * them with generic placeholders, so a pattern learned from one project
 * (e.g. an Invoice-specific method) can be usefully suggested in an
 * unrelated project (e.g. market_app) without carrying project-specific
 * naming baggage.
 */

export interface AbstractionResult {
    template: string;
    replacements: Array<{ original: string; placeholder: string }>;
}

const DART_BUILTIN_TYPES = new Set([
    // Core Dart types
    'String', 'int', 'double', 'bool', 'num', 'dynamic', 'void', 'Object',
    'List', 'Map', 'Set', 'Future', 'Stream', 'DateTime', 'Duration',
    // Flutter core
    'Widget', 'BuildContext', 'State', 'StatefulWidget', 'StatelessWidget', 'Key',
    // Common Flutter widgets — anything users would recognize as framework, not domain
    'Scaffold', 'AppBar', 'Container', 'Column', 'Row', 'Stack', 'ListView',
    'GridView', 'SizedBox', 'Padding', 'Center', 'Align', 'Text', 'Icon',
    'Image', 'Card', 'ElevatedButton', 'TextButton', 'IconButton', 'TextField',
    'GestureDetector', 'InkWell', 'AnimatedContainer', 'FutureBuilder',
    'StreamBuilder', 'CircularProgressIndicator', 'Expanded', 'Flexible',
    'Wrap', 'RaisedButton', 'FlatButton', 'MaterialApp', 'MaterialPageRoute',
    'Navigator', 'Theme', 'ThemeData', 'TextStyle', 'EdgeInsets', 'BoxDecoration',
    'BorderRadius', 'Color', 'Colors', 'Icons', 'MainAxisAlignment',
    'CrossAxisAlignment', 'Alignment', 'BoxFit', 'Curves', 'FormField',
    'Form', 'DropdownButtonFormField', 'DropdownMenuItem', 'PopupMenuButton',
    'PopupMenuItem', 'InputDecoration',
]);

export function abstractTemplate(code: string): AbstractionResult {
    // Only target identifiers that are clearly VARIABLE/CLASS references
    // (preceded by a type-position or used as a receiver before a dot),
    // not string literal content or arbitrary capitalized words. This is
    // intentionally conservative — better to under-abstract than to
    // mangle string literals or Flutter widget names.
    const typeMatches = new Set<string>();

    // Match: "List<Invoice>", "Invoice invoice", "_invoices.where"
    const typeInContextPattern = /(?:<|:\s*|^\s*)([A-Z][a-zA-Z0-9]*)\b(?!\s*\()/gm;
    let match: RegExpExecArray | null;
    while ((match = typeInContextPattern.exec(code)) !== null) {
        const name = match[1];
        if (!DART_BUILTIN_TYPES.has(name)) {
            typeMatches.add(name);
        }
    }

    let template = code;
    const replacements: Array<{ original: string; placeholder: string }> = [];
    let genericIndex = 0;

    // Sort longest-first so "Quotation" doesn't get replaced before a
    // (hypothetical) longer overlapping match is considered.
    const sortedTypes = Array.from(typeMatches).sort((a, b) => b.length - a.length);

    for (const typeName of sortedTypes) {
        const genericLetter = String.fromCharCode(84 + genericIndex);
        genericIndex++;

        const typeRegex = new RegExp(`\\b${typeName}\\b`, 'g');
        const before = template;
        template = template.replace(typeRegex, genericLetter);
        if (template !== before) {
            replacements.push({ original: typeName, placeholder: genericLetter });
        }

        const lower = typeName.charAt(0).toLowerCase() + typeName.slice(1);
        const varPattern = new RegExp(`\\b_?${lower}s?\\b`, 'g');
        const genericVar = `item${genericIndex > 1 ? genericIndex : ''}`;
        template = template.replace(varPattern, (m) => {
            const isPlural = m.toLowerCase().endsWith('s') && m.toLowerCase() !== lower;
            const isPrivate = m.startsWith('_');
            const base = isPlural ? `${genericVar}s` : genericVar;
            return isPrivate ? `_${base}` : base;
        });
    }

    return { template, replacements };
}