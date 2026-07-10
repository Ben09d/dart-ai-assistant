# Installation & Setup Guide

## Prerequisites

- Visual Studio Code 1.85.0 or higher
- Node.js 20.x or higher (for development)
- Dart SDK (for Dart development)
- Flutter SDK (optional, for Flutter development)

## Installation Methods

### Method 1: From VS Code Marketplace (Recommended)

1. Open Visual Studio Code
2. Click on the Extensions icon in the sidebar (or press `Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Dart AI Assistant Pro"
4. Click "Install"
5. Reload VS Code when prompted

### Method 2: From VSIX File

1. Download the `.vsix` file from releases
2. Open VS Code
3. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
4. Click the "..." menu at the top
5. Select "Install from VSIX..."
6. Choose the downloaded file

### Method 3: Manual Build

```bash
# Clone the repository
git clone https://github.com/yourusername/dart-ai-assistant.git
cd dart-ai-assistant

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
npm install -g vsce
vsce package

# Install the generated .vsix file in VS Code
```

## Initial Configuration

### Basic Setup

1. Open VS Code Settings:
   - `File > Preferences > Settings` (Windows/Linux)
   - `Code > Preferences > Settings` (Mac)

2. Search for "Dart AI"

3. Configure basic settings:
   ```json
   {
     "dartAI.enableAutoCorrect": true,
     "dartAI.enableLearning": true,
     "dartAI.autoFormat": true
   }
   ```

### Optional: API Key Setup

For advanced AI features, you can add an Anthropic API key:

1. Get an API key from [Anthropic](https://www.anthropic.com)

2. Add to settings:
   ```json
   {
     "dartAI.anthropicApiKey": "your-api-key-here"
   }
   ```

3. **Note**: The extension works without an API key using built-in pattern matching and heuristics.

### Security Level Configuration

Choose your security scanning level:

```json
{
  "dartAI.securityLevel": "standard"
}
```

Options:
- `"basic"` - Essential security checks only
- `"standard"` - Recommended for most users
- `"strict"` - Maximum security analysis

## First Time Usage

### 1. Open a Dart Project

```bash
# Create a new Dart project
dart create my_project
cd my_project
code .
```

### 2. Verify Extension is Active

Look for "Dart AI Assistant Pro activated!" message in the output panel.

### 3. Try Basic Features

**Auto-Completion:**
1. Open a `.dart` file
2. Start typing
3. Press `Ctrl+Space` to trigger suggestions

**Error Fixing:**
1. Write some code with an error
2. Press `Ctrl+Shift+F` to auto-fix
3. Review the fixes applied

**Security Scan:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Dart AI: Security Scan"
3. View the security report

## Troubleshooting

### Extension Not Activating

**Problem**: Extension doesn't activate when opening Dart files

**Solutions**:
1. Check if the file extension is `.dart`
2. Reload VS Code (`Ctrl+Shift+P` → "Reload Window")
3. Check the Output panel for error messages
4. Reinstall the extension

### Completions Not Working

**Problem**: Code completions aren't appearing

**Solutions**:
1. Verify `dartAI.suggestionDelay` isn't too high
2. Check if other Dart extensions are conflicting
3. Try disabling and re-enabling the extension
4. Clear VS Code cache

### Performance Issues

**Problem**: Extension is slow or causing lag

**Solutions**:
1. Increase `dartAI.suggestionDelay` value
2. Disable learning temporarily: `"dartAI.enableLearning": false`
3. Use "basic" security level
4. Close other resource-intensive extensions

### API Key Issues

**Problem**: AI features not working with API key

**Solutions**:
1. Verify API key is correct
2. Check API key permissions
3. Ensure network connectivity
4. Try without API key (uses built-in features)

## Updating

### Automatic Updates

VS Code automatically updates extensions. To manually check:

1. Go to Extensions
2. Find "Dart AI Assistant Pro"
3. Click "Update" if available

### Manual Update

1. Download new `.vsix` file
2. Uninstall current version
3. Install new version using "Install from VSIX"

## Uninstallation

### Clean Uninstall

1. Go to Extensions in VS Code
2. Find "Dart AI Assistant Pro"
3. Click "Uninstall"
4. Reload VS Code

### Remove Settings

To remove all extension data:

1. Open Command Palette
2. Run "Developer: Open User Settings (JSON)"
3. Remove all `dartAI.*` entries
4. Delete learning data: Search for "workbench.settings.storage" in settings

## Getting Help

### Documentation

- [README](README.md) - Main documentation
- [CHANGELOG](CHANGELOG.md) - Version history
- [GitHub Issues](https://github.com/yourusername/dart-ai-assistant/issues) - Bug reports

### Support Channels

- GitHub Issues: Bug reports and feature requests
- Email: support@dartai.dev
- Community Forum: discuss.dartai.dev

### Common Questions

**Q: Does this work offline?**
A: Yes! Built-in features work offline. API features require internet.

**Q: Is my code sent to external servers?**
A: Only if you use an API key. Built-in features are local-only.

**Q: Can I use this for commercial projects?**
A: Yes, the extension is free for commercial use.

**Q: Does it support Flutter?**
A: Yes! Flutter is fully supported with special Widget snippets.

**Q: Can I customize snippets?**
A: Yes, the learning engine creates custom snippets from your patterns.

## Tips for Best Experience

1. **Enable Learning**: Let the extension learn your style for better suggestions
2. **Run Security Scans**: Regularly scan for vulnerabilities
3. **Use Shortcuts**: Learn the keyboard shortcuts for faster workflow
4. **Review Fixes**: Always review auto-fixes before committing
5. **Update Regularly**: Keep the extension updated for new features

## Next Steps

1. ✅ Extension installed and configured
2. 📖 Read the [README](README.md) for feature details
3. 🚀 Start coding with AI assistance
4. 🔒 Run your first security scan
5. ⭐ Star the project on GitHub

---

**Happy coding with Dart AI Assistant Pro!** 🎉
