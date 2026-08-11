# 🚀 Dart AI Assistant

AI-powered Dart/Flutter development assistant with real-time learning, code prediction, and intelligent error detection.

![Version](https://img.shields.io/badge/version-1.0.9-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Marketplace](https://img.shields.io/badge/marketplace-live-brightgreen)

---

## ✨ Features

- 🧠 **Advanced Learning Engine** – Learns your coding patterns and naming conventions
- 📚 **Import Project for Learning** – Instantly train the extension on an existing project instead of waiting weeks
- 🏹 **Code Prediction** – Predicts your next lines of code based on your style
- 🛠 **Smart Error Detection** – Real Dart compiler diagnostics on save, plus live regex-based feedback while typing
- 🎨 **Auto Code Formatting** – Keeps your Dart code clean and consistent
- 🔒 **Security Scanning** – Detects common vulnerabilities
- 📊 **Code Health Reports** – Clickable, auto-refreshing error/warning reports that jump straight to the line
- 📈 **Learning Dashboard** – Visual insights into your coding style and progress
- 📖 **Knowledge Base** – Import docs, tutorials, and notes for context-aware suggestions
- ✅ **100+ Snippets** – Flutter and Dart code snippets built-in, including Uganda-specific Mobile Money patterns

---

## 📦 Installation

### From the VS Code Marketplace (Recommended)

Search for **"Dart AI Assistant"** in the Extensions panel (`Ctrl+Shift+X`), or install directly:

```bash
code --install-extension a-i-0-studio.dart-ai-assistant
```

Or visit the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=a-i-0-studio.dart-ai-assistant).

### From Source

```bash
# Clone the repository
git clone https://github.com/Ben09d/dart-ai-assistant.git
cd dart-ai-assistant

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
npm install -g @vscode/vsce
vsce package
```

Then install the generated `.vsix` file:
```bash
code --install-extension dart-ai-assistant-1.0.9.vsix
```

Or in VS Code: **Extensions → ... → Install from VSIX**

---

## 🚀 Usage

1. Open any `.dart` file
2. Start coding — the extension learns as you go
3. **New:** Run `Ctrl+Shift+P → "Dart AI: Import Project for Learning"` to instantly train on an existing project
4. Use `Ctrl+Shift+F` to auto-fix errors
5. Check `Ctrl+Shift+P → "Dart AI: View Learning Dashboard"` for insights

### Key Commands

| Command | Description |
|---------|-------------|
| `Dart AI: Fix All Errors` | Auto-correct detected errors |
| `Dart AI: Import Project for Learning` | Train instantly from an existing project's codebase |
| `Dart AI: View Learning Dashboard` | See your coding pattern stats |
| `Dart AI: Show Next Line Predictions` | Get predicted next lines |
| `Dart AI: Show Code Health` | Clickable error/warning report for the current file |
| `Dart AI: Security Scan` | Scan for vulnerabilities |
| `Dart AI: Search Knowledge Base` | Search imported docs and notes |

---

## ⚙️ Configuration

```json
{
  "dartAI.enableAutoCorrect": true,
  "dartAI.enableLearning": true,
  "dartAI.securityLevel": "standard",
  "dartAI.autoFormat": true,
  "dartAI.anthropicApiKey": ""
}
```

Optional: Add an Anthropic API key for AI-powered suggestions and explanations.

> **Note:** Real syntax-error detection uses the Dart SDK's `dart analyze` on save, so the [official Dart extension](https://marketplace.visualstudio.com/items?itemName=Dart-Code.dart-code) should also be installed alongside this one for the full experience (syntax highlighting, hot reload, debugging).

---

## 🔐 Privacy

All learning data stays **local** on your machine. Nothing is sent externally unless you provide an API key for AI features.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repo
2. Create your branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👤 Author

Built by [Ben09d](https://github.com/Ben09d) — Freelance Flutter Developer

---

**⭐ If you find this useful, consider starring the repo, or leaving a review on the [Marketplace](https://marketplace.visualstudio.com/items?itemName=a-i-0-studio.dart-ai-assistant)!**