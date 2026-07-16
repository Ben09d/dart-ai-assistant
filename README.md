# 🚀 Dart AI Assistant

AI-powered Dart/Flutter development assistant with real-time learning, code prediction, and intelligent error detection.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🧠 **Advanced Learning Engine** – Learns your coding patterns and naming conventions
- 🔮 **Code Prediction** – Predicts your next lines of code based on your style
- 🔧 **Smart Error Detection** – Catches syntax errors, undefined variables, and type mismatches
- 🎨 **Auto Code Formatting** – Keeps your Dart code clean and consistent
- 🔒 **Security Scanning** – Detects common vulnerabilities
- 📊 **Learning Dashboard** – Visual insights into your coding style and progress
- 💡 **100+ Snippets** – Flutter and Dart code snippets built-in

---

## 📦 Installation

### From Source (Available Now)

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
code --install-extension dart-ai-assistant-1.0.0.vsix
```

Or in VS Code: **Extensions → ... → Install from VSIX**

### From Marketplace

*Coming soon! This extension will be available on the VS Code Marketplace.*

---

## 🚀 Usage

1. Open any `.dart` file
2. Start coding — the extension learns as you go
3. Use `Ctrl+Shift+F` to auto-fix errors
4. Check `Ctrl+Shift+P → "Dart AI: View Learning Dashboard"` for insights

### Key Commands

| Command | Description |
|---------|-------------|
| `Dart AI: Fix All Errors` | Auto-correct detected errors |
| `Dart AI: View Learning Dashboard` | See your coding pattern stats |
| `Dart AI: Show Next Line Predictions` | Get predicted next lines |
| `Dart AI: Security Scan` | Scan for vulnerabilities |

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

**⭐ If you find this useful, consider starring the repo!**