# Change Log

All notable changes to the "Dart AI Assistant" extension will be documented in this file.

## [Unreleased]

### Added
- 📚 **Import Project for Learning** — instantly train the Learning Engine, Advanced Learning Engine, Code Prediction Engine, and Knowledge Base from an existing project folder instead of waiting on organic typing. Capped at 100 files, prioritized by most recently modified.
- 🔍 **Real Dart Analyzer Integration** — save-time diagnostics now run the actual `dart analyze` compiler (scoped correctly to the saved file), in addition to fast regex-based feedback while typing.
- 🖱 **Clickable Code Health & Prevention Reports** — issues in `Dart AI: Show Code Health` and `Dart AI: Prevent Errors` are now clickable, jumping straight to the affected line. Reports auto-refresh on save while visible.

### Fixed
- Consolidated three overlapping error-detection systems into clear ownership: DartAnalyzer owns the Problems panel, ErrorPrevention/PatternPredictor own reports and the status bar — eliminating duplicate/contradictory error counts.
- Fixed a debounce bug where rapid typing could queue multiple stale diagnostic passes instead of cancelling superseded ones.
- Merged duplicate `onDidChangeTextDocument` watchers into a single debounced pass, halving redundant analysis work per keystroke.
- Fixed a Knowledge Base singleton bug where two separate manager instances could exist in memory simultaneously, causing inconsistent search/import results.
- Fixed the auto-formatter re-triggering itself on save, which could cause spacing to grow unpredictably across repeated saves.
- Fixed several false-positive error detections: indented comments, ternary expressions, block comments (`/* */`), `@override` annotations, generic type declarations, `catch`/`on` blocks being misread as function declarations, and Flutter/Dart package imports being flagged as unused.
- Fixed a double-activation bug caused by a deprecated `vscode` npm package conflicting with `@types/vscode`.

## [1.0.0] - 2024-02-14

### Added
- 🎉 Initial release of Dart AI Assistant
- 🤖 AI-powered code completion and suggestions
- ⚡ Automatic error correction
- 🧠 Learning engine that adapts to your coding style
- 🔒 Comprehensive security scanning
- 🎨 Automatic code formatting
- 📝 Intelligent code snippets
- 🔍 Real-time error detection
- 🧪 Automatic test generation
- ✅ Code explanation feature
- 🛠 Smart refactoring suggestions
- 🚀 Performance optimization recommendations

### Features
- **Auto-Correction**: Automatically fixes syntax errors, missing semicolons, undefined variables, and more
- **Smart Completion**: Context-aware code completion for Dart and Flutter
- **Learning Ability**: Learns from your coding patterns and preferences
- **Security Scanner**: Detects hardcoded secrets, SQL injection, weak crypto, and more
- **Code Formatter**: Formats code according to Dart style guide
- **Snippet Library**: Extensive collection of Dart and Flutter snippets
- **AI Integration**: Optional Anthropic API integration for advanced features

### Commands
- `Dart AI: Fix All Errors` - Automatically fix detected errors
- `Dart AI: Optimize Code` - Get code optimization suggestions
- `Dart AI: Security Scan` - Run security analysis
- `Dart AI: Explain Code` - Get detailed explanations
- `Dart AI: Generate Tests` - Create unit tests
- `Dart AI: Intelligent Refactor` - Get refactoring options
- `Dart AI: Complete Code Block` - Complete unfinished code

### Keyboard Shortcuts
- `Ctrl+Shift+F` / `Cmd+Shift+F` - Fix all errors
- `Ctrl+Space` / `Cmd+Space` - Trigger completions

### Settings
- `dartAI.enableAutoCorrect` - Enable automatic error correction
- `dartAI.enableLearning` - Enable learning from coding patterns
- `dartAI.securityLevel` - Set security scanning level (basic/standard/strict)
- `dartAI.autoFormat` - Enable automatic formatting on save
- `dartAI.suggestionDelay` - Set delay before showing suggestions
- `dartAI.anthropicApiKey` - Optional API key for advanced AI features

---

## Roadmap

### Upcoming Features
- [ ] Support for more Dart frameworks (AngularDart, Aqueduct, etc.)
- [ ] More advanced refactoring patterns
- [ ] Collaboration features
- [ ] Performance profiling
- [ ] Dependency analysis
- [ ] Code complexity metrics
- [ ] Custom rule configuration
- [ ] Team learning capabilities
- [ ] Cloud sync for learned patterns

### Known Issues
- None reported yet

---

**Thank you for using Dart AI Assistant!**