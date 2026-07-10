# 🚀 Quick Start Guide - Dart AI Assistant Pro

Get up and running in 5 minutes!

## ⚡ Installation

```bash
# Option 1: From VS Code
# Press Ctrl+P and paste:
ext install dart-ai-assistant

# Option 2: Build from source
git clone https://github.com/yourusername/dart-ai-assistant.git
cd dart-ai-assistant
npm install
npm run compile
```

## 🎯 First Steps

### 1. Open a Dart File

Create or open any `.dart` file. The extension activates automatically!

### 2. Try Auto-Fix

```dart
// Write some code with an error (missing semicolon):
String message = "Hello"

// Press: Ctrl+Shift+F (Windows/Linux) or Cmd+Shift+F (Mac)
// Result: Automatically fixed!
String message = "Hello";
```

### 3. Test Smart Completion

```dart
// Type "Fut" and press Ctrl+Space:
Future<dynamic> myFunction() async {
  // code
  return result;
}
```

### 4. Run Security Scan

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type: "Dart AI: Security Scan"
3. View comprehensive security report!

### 5. Optimize Your Code

```dart
// Select this code:
var items = [1, 2, 3];
var doubled = [];
for (var i = 0; i < items.length; i++) {
  doubled.add(items[i] * 2);
}

// Run: Dart AI: Optimize Code
// Suggests:
final items = [1, 2, 3];
final doubled = items.map((n) => n * 2).toList();
```

## 🎮 Essential Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Fix Errors | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Complete Code | `Ctrl+Space` | `Cmd+Space` |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |

## 📋 Essential Commands

Open Command Palette and type:

- `Dart AI: Fix All Errors` - Auto-fix detected errors
- `Dart AI: Security Scan` - Run security analysis
- `Dart AI: Optimize Code` - Get optimization tips
- `Dart AI: Explain Code` - Understand complex code
- `Dart AI: Generate Tests` - Create unit tests

## ⚙️ Recommended Settings

Add to your VS Code settings:

```json
{
  "dartAI.enableAutoCorrect": true,
  "dartAI.enableLearning": true,
  "dartAI.autoFormat": true,
  "dartAI.securityLevel": "standard"
}
```

## 🎨 Flutter-Specific Features

### Widget Snippets

Type these prefixes and press `Ctrl+Space`:

- `stless` → StatelessWidget
- `stful` → StatefulWidget
- `scaffold` → Scaffold with AppBar
- `container` → Container widget
- `column` → Column widget
- `row` → Row widget
- `listview` → ListView.builder

### Example:

```dart
// Type "stless" and press Ctrl+Space:
class MyWidget extends StatelessWidget {
  const MyWidget({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container();
  }
}
```

## 🔒 Security Features

The extension automatically scans for:

✅ Hardcoded secrets (API keys, passwords)
✅ SQL injection vulnerabilities
✅ Insecure HTTP usage
✅ Weak cryptographic algorithms
✅ Path traversal issues
✅ XSS vulnerabilities

Example warning:

```dart
// ⚠️ Security issue detected!
String apiKey = "sk-1234567890"; // Hardcoded secret

// ✅ Better approach:
String getApiKey() {
  return Platform.environment['API_KEY'] ?? '';
}
```

## 🧠 Learning Features

The extension learns your style:

1. **Naming Conventions**: camelCase vs snake_case
2. **Code Structure**: Your preferred patterns
3. **Import Preferences**: Your favorite packages
4. **Fix History**: Remembers how you fix errors

Over time, suggestions become more personalized!

## 💡 Pro Tips

1. **Save Often**: Auto-formatting happens on save
2. **Review Fixes**: Always review auto-generated fixes
3. **Run Scans**: Regular security scans prevent issues
4. **Enable Learning**: Get better suggestions over time
5. **Use Shortcuts**: Much faster than menus

## 🐛 Troubleshooting

### Extension Not Working?

```bash
1. Check file extension is .dart
2. Reload VS Code: Ctrl+Shift+P → "Reload Window"
3. Check Output panel for errors
4. Reinstall extension
```

### Completions Too Slow?

```json
{
  "dartAI.suggestionDelay": 500
}
```

### Want Faster Performance?

```json
{
  "dartAI.securityLevel": "basic",
  "dartAI.enableLearning": false
}
```

## 📚 Learn More

- [Full Documentation](README.md)
- [Installation Guide](INSTALL.md)
- [Example Code](examples/demo.dart)
- [Changelog](CHANGELOG.md)

## 🎉 You're Ready!

Start coding and let Dart AI Assistant Pro help you write better code faster!

### Next Steps:

1. ✅ Extension installed
2. ✅ Quick start completed
3. 🚀 Start your next Dart/Flutter project
4. 🔍 Explore all features
5. ⭐ Star us on GitHub

---

**Need Help?** Open an issue on GitHub or email support@dartai.dev

**Happy Coding!** 🎯
