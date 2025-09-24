# 🚀 Nexus AI Claude Edition

**Never lose work in Claude Code again.** Bulletproof context management, automatic session persistence, and instant recovery.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ⚡ Quick Install (30 seconds)

### Windows
```bash
# Extract zip, then:
install.bat
```

### Mac/Linux
```bash
# Extract zip, then:
./install.sh
```

### Manual Install
```bash
npm install
npm link
```

That's it! Now use `nclaude` from anywhere.

## 🎯 What This Solves

Your friend lost critical work when Claude's context reset. **This stops that from ever happening again.**

- **Automatic Backups**: Every change is saved before Claude acts
- **Context Management**: Prevents token overflow with smart compaction
- **Session Persistence**: Resume exactly where you left off
- **Zero Configuration**: Works immediately after install

## 📚 Commands

### Basic Usage

```bash
nclaude init      # Initialize in any project (run once)
nclaude status    # Check token usage & session info
nclaude save      # Create checkpoint before risky changes
nclaude restore   # Restore after problems
nclaude help      # Show all commands
```

### In Claude Code

You can also use these as slash commands:

```
/nclaude status
/nclaude save "before-refactor"
/nclaude restore
/nclaude compact
```

## 🛠️ How It Works

### 1. Initialize Once
```bash
cd your-project
nclaude init
```

Creates `.nexus/` directory with:
- Session storage
- Artifact versioning
- Configuration
- Automatic hooks

### 2. Automatic Protection

The framework runs hooks during your Claude session:

| Hook | Triggers At | Action |
|------|------------|--------|
| `beforeContextWindow` | 180k tokens | Auto-compacts conversation |
| `onArtifactCreation` | Code generation | Versions all code |
| `onFileOperation` | File edits | Tracks changes |
| `onErrorEncountered` | Errors | Preserves context |
| `onContextReset` | Session end | Saves everything |

### 3. Manual Control

Save before big changes:
```bash
nclaude save "working-auth"
```

Check status anytime:
```bash
nclaude status

Token Usage: ████████████░░░░ 75%
Session: active-2hrs
Files: 23 tracked
Artifacts: 42 saved
```

Restore if needed:
```bash
nclaude restore
# or specific checkpoint
nclaude restore "working-auth"
```

## 📖 Command Reference

### `nclaude init`
Initialize Claude protection in current project
- Creates `.nexus/` configuration
- Sets up automatic hooks
- One-time setup per project

### `nclaude status`
Show current context usage
```
Token Usage: ████████░░ 80% (160k/200k)
Session: session-abc123
Started: 2 hours ago
Checkpoints: 5 saved
Files Tracked: 42
Artifacts: 18 (JavaScript, Python)
```

### `nclaude save [name]`
Create named checkpoint
```bash
nclaude save "before-database-migration"
```

### `nclaude restore [checkpoint]`
Restore from checkpoint
```bash
nclaude restore                    # Last checkpoint
nclaude restore --list             # Show all
nclaude restore "before-refactor"  # Specific
```

### `nclaude compact`
Manually compact conversation
```bash
nclaude compact
# Compacted: 180k → 95k tokens (47% saved)
```

### `nclaude search <query>`
Search all artifacts
```bash
nclaude search "database"
# Found 3 artifacts...
```

### `nclaude export`
Export session data
```bash
nclaude export --output ./backup.zip
```

### `nclaude clean`
Remove old sessions
```bash
nclaude clean --days 30
```

### `nclaude hooks`
Manage hooks
```bash
nclaude hooks --list
nclaude hooks --test beforeContextWindow
```

## 🎮 Real-World Examples

### Scenario 1: Long Coding Session
```bash
# You've been coding for hours
$ nclaude status
Token Usage: ████████████████░░ 85%

# Auto-compaction triggers at 90%, but you can do it manually
$ nclaude compact
Compacted: 170k → 95k tokens (44% saved)
```

### Scenario 2: Before Risky Changes
```bash
# About to refactor critical code
$ nclaude save "working-payment-system"
Checkpoint created: working-payment-system

# If something breaks, restore
$ nclaude restore "working-payment-system"
Restored: All files and context recovered
```

### Scenario 3: Claude Conversation Reset
```bash
# Claude: "I need to start a new conversation"
# You: No problem!

$ nclaude restore
Restored: 127 messages, 42 files, 18 artifacts
Token usage: 95k/200k

# Claude now has full context of previous work
```

## 🔧 Configuration

Default settings work perfectly, but you can customize:

`.nexus/claude-config.json`:
```json
{
  "context": {
    "maxTokens": 200000,
    "compactionThreshold": 180000,
    "warningThreshold": 170000
  },
  "sessions": {
    "autosaveInterval": 300000,  // 5 minutes
    "maxCheckpoints": 10
  },
  "artifacts": {
    "maxVersions": 10,
    "autoExtractPatterns": true
  }
}
```

## 🚨 Troubleshooting

### "Command not found"
```bash
# Reinstall globally
npm link

# Or use npx
npx nclaude status
```

### "Cannot find module"
```bash
# Reinstall dependencies
npm install
```

### Windows Issues
- Use Command Prompt or PowerShell (not Git Bash)
- Run as Administrator if permission errors

## 🤝 How It Integrates with Claude

1. **Automatic Hooks**: Monitors Claude's operations
2. **Token Tracking**: Knows exactly how much context is used
3. **Smart Compaction**: Preserves important, summarizes rest
4. **Session Persistence**: Survives conversation resets
5. **Artifact Versioning**: Every code block saved

## 📊 What Gets Saved

- ✅ All code artifacts with versions
- ✅ File operation history
- ✅ Error contexts
- ✅ Conversation summaries
- ✅ Current task state
- ✅ File dependencies

## 🎯 Best Practices

1. **Initialize immediately** after starting a project
2. **Save checkpoints** before major changes
3. **Check status** when conversation feels long
4. **Export sessions** for important work
5. **Clean old data** monthly

## 📄 License

MIT - Use freely in any project

## 🔗 Links

- [Documentation](https://github.com/nexus-framework/nexus-ai-claude)
- [Report Issues](https://github.com/nexus-framework/nexus-ai-claude/issues)
- [Changelog](https://github.com/nexus-framework/nexus-ai-claude/releases)

---

**Built specifically for Claude Code users who refuse to lose work.**

*Your conversation. Your context. Your control.*