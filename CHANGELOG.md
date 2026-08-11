# Change Log

All notable changes to the "Dart AI Assistant" extension will be documented in this file.

## [1.0.9] - 2026

The largest release to date — a comprehensive engine-by-engine overhaul covering learning, prediction, completion, error detection, and AI integration, plus two major new features.

### Added
- 📚 **Import Project for Learning** — instantly train the Learning Engine, Advanced Learning Engine, Code Prediction Engine, and Knowledge Base from an existing project folder instead of waiting weeks of organic typing. Capped at 100 files, prioritized by most recently modified.
- 🔍 **Real Dart Analyzer Integration** — save-time diagnostics now run the actual `dart analyze` compiler (correctly scoped to the saved file only), alongside fast regex-based feedback while typing.
- 🖱 **Clickable Code Health & Prevention Reports** — issues in `Dart AI: Show Code Health` and `Dart AI: Prevent Errors` are now clickable, jumping straight to the affected line. Reports auto-refresh on save while visible, and now include real syntax errors alongside style/best-practice findings.
- 🔎 **`Dart AI: Search Patterns`** — new debug/power-user command to inspect exactly what the Learning Engine has recorded.
- 📂 **Pattern Categories breakdown** on the Learning Dashboard, showing pattern diversity across error-handling, null-safety, state management, and more.
- 🧠 **9 new pattern detectors**: try/catch/finally/throw, null-aware access, null coalescing, non-null assertions, named constructors, extension methods, enums, and mixins.
- ✨ **AdvancedLearningEngine now contributes to code completions** — confidence-scored, relationship-aware suggestions now appear in the completion dropdown, not just in dashboards.

### Fixed — Architecture
- Consolidated three overlapping error-detection systems into clear ownership: DartAnalyzer owns the Problems panel, ErrorPrevention/PatternPredictor own reports and the status bar — eliminating duplicate/contradictory error counts.
- Fixed a debounce bug where rapid typing could queue multiple stale diagnostic passes instead of cancelling superseded ones.
- Merged duplicate `onDidChangeTextDocument` watchers into a single debounced pass, halving redundant analysis work per keystroke.
- Fixed a Knowledge Base singleton bug where two separate manager instances could exist in memory simultaneously, causing inconsistent search/import results.

### Fixed — Learning Engine
- Fixed a signature mismatch in `getCompletionSuggestions()` that would have broken compilation once file-type filtering was wired in elsewhere.
- Removed a legacy save path that corrupted pattern tags on every write (Set/Date objects were serialized incorrectly) — added a self-healing migration that automatically repairs any user's data corrupted by earlier versions.
- Fixed an argument-order bug where the entire document text was being passed as a file-type field, corrupting pattern metadata.
- Fixed `.reverse()` silently mutating fix history as a side effect on every lookup.
- Switched save-time analysis to the richer, previously-unused `analyzeDocument()` method — pattern detection goes from 3 categories to 20; **every version prior to this one was silently capped at a fraction of its intended learning capability.**

### Fixed — Advanced Learning Engine
- Added a 500-pattern cap with frequency/recency-based eviction — previously grew unbounded with no limit.
- Removed a crash risk in `getStatistics()` where a missing active editor could throw during code-smell detection.

### Fixed — Code Prediction Engine
- Fixed a sequence cap that was effectively infinite (a stray extra-long number disabled the intended 300-sequence limit).
- Fixed a confidence-threshold scale mismatch (0–1 vs 0–100) that meant low-confidence predictions were never actually filtered out.
- Removed dead code in context-aware prediction; fixed closing-brace suggestions that were computed but never returned.
- Cleaned up memory-estimate formatting in prediction statistics.

### Fixed — Pattern Predictor
- Fixed a type mismatch and dead fallback path in next-pattern prediction that meant AdvancedLearningEngine's suggestions were never actually used as a fallback.
- Hardened three whole-document regex checks (nested loops, setState-in-loop, string-concatenation-in-loop) with brace-aware scanning, eliminating false positives across unrelated functions in the same file.

### Fixed — Hover Provider
- Restored a completely non-functional "Your usage" hover section (a broken method-name check meant it never fired, regardless of usage history).
- Added a minimum word-length guard to prevent noisy substring matches on short/common words.

### Fixed — AI Service
- Eliminated a duplicate, less-robust AI code path (`callAI`/`builtInAI` using `axios` directly) that bypassed caching, retry logic, and offline fallback. `generateTests()` and `completeCode()` now route through the same robust, cached, retryable path as every other AI feature.
- Removed dead code and the now-unused `axios` dependency.

### Fixed — Completion Engine
- Fixed `getCompletionSuggestions()` calls to properly filter by file type.
- Fixed a typo in snippet tagging.

### Fixed — Formatting & Detection (carried over from mid-cycle testing)
- Fixed auto-formatter re-triggering itself on save, which could cause spacing to grow unpredictably across repeated saves.
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