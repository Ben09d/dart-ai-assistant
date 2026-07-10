# Dart AI Assistant Pro 🚀

An advanced, AI-powered VS Code extension for Dart developers that provides intelligent code completion, automatic error correction, security scanning, and learning capabilities to supercharge your Dart and Flutter development workflow.

## ✨ Features

### 🤖 AI-Powered Assistance
- **Intelligent Code Completion**: Context-aware suggestions powered by AI
- **Auto-Correction**: Automatically fixes common errors and syntax issues
- **Smart Refactoring**: Get AI-suggested refactoring options
- **Code Explanation**: Understand complex code with detailed explanations
- **Test Generation**: Automatically generate comprehensive unit tests

### 🧠 Learning Ability
- **Pattern Recognition**: Learns from your coding patterns and preferences
- **Adaptive Suggestions**: Improves suggestions based on your coding style
- **Historical Analysis**: Remembers fixes you've applied to similar errors
- **Personalized Snippets**: Creates custom snippets based on your habits

### 🔒 Security Features
- **Security Scanning**: Detects vulnerabilities and security issues
- **Hardcoded Secrets Detection**: Identifies API keys, tokens, and passwords in code
- **SQL Injection Detection**: Finds potential SQL injection vulnerabilities
- **Cryptography Analysis**: Warns about weak cryptographic algorithms
- **Comprehensive Reports**: Detailed security analysis with recommendations

### ⚡ Performance & Productivity
- **Fast Code Writing**: Complete code blocks instantly
- **Automatic Formatting**: Formats code on save following Dart conventions
- **Smart Snippets**: Extensive library of Dart and Flutter snippets
- **Error Prevention**: Real-time error detection and suggestions
- **Optimized Code**: AI-powered code optimization suggestions

### 🎨 Code Quality
- **Best Practices**: Suggests Dart and Flutter best practices
- **Null Safety**: Helps with null-safe code
- **Type Inference**: Suggests explicit types where helpful
- **Import Organization**: Automatically sorts and organizes imports

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Press `Ctrl+P` / `Cmd+P`
3. Type: `ext install dart-ai-assistant`
4. Press Enter

### Manual Installation
1. Clone this repository
2. Run `npm install` in the project directory
3. Run `npm run compile`
4. Press `F5` to launch the extension in debug mode

## 🚀 Quick Start

1. Open any Dart or Flutter project
2. The extension activates automatically for `.dart` files
3. Start coding and enjoy AI-powered assistance!

### Keyboard Shortcuts

- `Ctrl+Shift+F` / `Cmd+Shift+F` - Fix all errors
- `Ctrl+Space` / `Cmd+Space` - Trigger code completion
- Save file - Auto-format (if enabled)

### Commands

Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type:

- `Dart AI: Fix All Errors` - Automatically fix detected errors
- `Dart AI: Optimize Code` - Get optimization suggestions
- `Dart AI: Security Scan` - Run comprehensive security analysis
- `Dart AI: Explain Code` - Get detailed code explanations
- `Dart AI: Generate Tests` - Create unit tests for your code
- `Dart AI: Intelligent Refactor` - Get refactoring suggestions
- `Dart AI: Complete Code Block` - Complete unfinished code

## ⚙️ Configuration

### Settings

Access settings via: `File > Preferences > Settings > Extensions > Dart AI Assistant`

```json
{
  // Enable automatic error correction
  "dartAI.enableAutoCorrect": true,
  
  // Enable learning from your coding patterns
  "dartAI.enableLearning": true,
  
  // Security scanning level: "basic", "standard", or "strict"
  "dartAI.securityLevel": "standard",
  
  // Automatically format code on save
  "dartAI.autoFormat": true,
  
  // Delay before showing suggestions (milliseconds)
  "dartAI.suggestionDelay": 300,
  
  // Optional: Anthropic API key for advanced AI features
  "dartAI.anthropicApiKey": ""
}
```

### API Key (Optional)

For enhanced AI features, you can provide an Anthropic API key:

1. Get an API key from [Anthropic](https://anthropic.com)
2. Add it to settings: `"dartAI.anthropicApiKey": "your-key-here"`
3. The extension works without an API key using built-in pattern matching

## 📚 Usage Examples

### Auto-Correction

```dart
// Before (with error)
String name = "John"  // Missing semicolon

// After pressing Ctrl+Shift+F
String name = "John"; // Fixed!
```

### Smart Completion

```dart
// Type "Fut" and press Ctrl+Space
Future<dynamic> functionName() async {
  // code
  return result;
}
```

### Security Scanning

```dart
// Detects security issues
String apiKey = "sk-1234567890abcdef"; // ⚠️ Hardcoded secret detected!
```

### Code Optimization

```dart
// Before
var items = [1, 2, 3];
var doubled = [];
for (var i = 0; i < items.length; i++) {
  doubled.add(items[i] * 2);
}

// After optimization (Select code → Dart AI: Optimize Code)
final items = [1, 2, 3];
final doubled = items.map((item) => item * 2).toList();
```

## 🎯 Features in Detail

### Learning Engine

The extension learns from your coding style:
- **Naming Conventions**: Detects whether you prefer camelCase or snake_case
- **Code Structure**: Learns your preferred class and function structures
- **Import Preferences**: Remembers your commonly used packages
- **Error Fixes**: Suggests fixes based on previous corrections

### Security Scanner

Comprehensive security analysis:
- Detects hardcoded secrets (API keys, passwords, tokens)
- Identifies SQL injection vulnerabilities
- Warns about insecure HTTP usage
- Flags weak cryptographic algorithms
- Checks for path traversal vulnerabilities
- Identifies potential XSS issues
- Detects insecure random number generation

### Code Formatter

Follows Dart style guide:
- Organizes imports (dart: → package: → relative)
- Proper indentation
- Consistent spacing around operators
- Trailing commas for multi-line collections
- Removes trailing whitespace

## 🔧 Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm test

# Package extension
vsce package
```

### Project Structure

```
dart-ai-assistant/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── services/
│   │   ├── aiService.ts       # AI-powered features
│   │   ├── dartAnalyzer.ts    # Error detection
│   │   ├── securityScanner.ts # Security analysis
│   │   ├── learningEngine.ts  # Pattern learning
│   │   └── codeFormatter.ts   # Code formatting
│   └── providers/
│       ├── completionProvider.ts  # Code completion
│       ├── snippetProvider.ts     # Snippet suggestions
│       └── diagnosticProvider.ts  # Error diagnostics
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🐛 Bug Reports

If you find a bug, please create an issue with:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)

## 💡 Feature Requests

Have an idea? Open an issue with the `enhancement` label!

## 🙏 Acknowledgments

- Built with ❤️ for the Dart and Flutter community
- Powered by AI technology for intelligent assistance
- Inspired by the need for smarter development tools

## 📧 Support

For support, email support@dartai.dev or open an issue on GitHub.

## 🌟 Show Your Support

Give a ⭐️ if this project helped you!

---

**Happy Coding with Dart AI Assistant Pro!** 🎉
