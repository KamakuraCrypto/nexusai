# 🎯 Claude Code Integration - Hook System

## Quick Setup

After installation, run this in your project:

```bash
nclaude init
```

This automatically sets up hooks that Claude can use to:
- Track token usage in real-time
- Save checkpoints before risky operations
- Compact conversations when approaching limits
- Restore context after conversation resets

## Available Commands in Claude

You can run these commands directly in Claude conversations:

### `/nclaude status`
Shows current token usage and session info
```
Token Usage: ████████████████░░░░ 80%
Current Session: session-123
Files Tracked: 42
Artifacts: 18
```

### `/nclaude save [name]`
Creates a checkpoint before making big changes
```
/nclaude save "before-refactor"
```

### `/nclaude restore [checkpoint]`
Restores from a previous checkpoint
```
/nclaude restore
# or
/nclaude restore "before-refactor"
```

### `/nclaude compact`
Manually compacts the conversation to free up tokens
```
/nclaude compact
# Compacted: 170,000 → 95,000 tokens (44% saved)
```

### `/nclaude search <query>`
Search through all code artifacts Claude has created
```
/nclaude search "database connection"
```

### `/nclaude export`
Export session data for backup
```
/nclaude export
```

## Automatic Hooks

These hooks run automatically during your Claude session:

### `beforeContextWindow`
- **Triggers**: At 180k tokens (90% of limit)
- **Action**: Automatically compacts conversation
- **Preserves**: Critical code, errors, current task

### `onArtifactCreation`
- **Triggers**: When Claude creates code
- **Action**: Versions and stores the artifact
- **Use**: Can retrieve any previous version

### `onFileOperation`
- **Triggers**: On read/write/edit operations
- **Action**: Tracks file dependencies
- **Use**: Knows which files are most important

### `onErrorEncountered`
- **Triggers**: When errors occur
- **Action**: Preserves error context
- **Use**: Errors never get lost in compaction

### `onContextReset`
- **Triggers**: Before conversation ends
- **Action**: Saves complete session state
- **Use**: Full restoration with `/nclaude restore`

## Configuration

The hooks are configured in `.nexus/claude-config.json`:

```json
{
  "hooks": {
    "autoCompact": true,
    "compactThreshold": 180000,
    "preserveErrors": true,
    "trackArtifacts": true,
    "autoSave": true,
    "saveInterval": 300000
  }
}
```

## Examples

### Before a Big Refactor
```
User: I want to refactor the entire authentication system
Claude: Let me save a checkpoint first
/nclaude save "pre-auth-refactor"
[Makes changes...]
```

### When Context is Getting Full
```
Claude: I notice we're at 85% token usage
/nclaude compact
[Continues with fresh context]
```

### After a Conversation Reset
```
User: [New conversation] Continue where we left off
Claude: Let me restore our previous session
/nclaude restore
[Has full context of previous work]
```

## Advanced Usage

### Custom Hooks

You can add custom hooks in `.nexus/hooks/`:

```javascript
// .nexus/hooks/custom.js
module.exports = {
  beforeSave: async (context) => {
    // Run tests before saving
    await runTests();
  },
  
  afterRestore: async (context) => {
    // Re-read important files
    await readCriticalFiles();
  }
};
```

### Hook Priorities

Hooks run in priority order:
1. **Critical**: Errors, current file
2. **High**: Recent edits, artifacts
3. **Medium**: File reads, searches
4. **Low**: Old conversations

### Token Optimization

The system uses smart compression:
- **Summarization**: Old conversations → summaries
- **Compression**: Medium priority → compressed
- **Preservation**: Critical content → unchanged

## Troubleshooting

### "Hook not triggered"
- Check `.nexus/claude-config.json` exists
- Ensure `autoCompact` is `true`
- Run `nclaude status` to verify setup

### "Context not restored"
- Check for saved sessions: `nclaude restore --list`
- Ensure checkpoint exists
- Try manual restore with checkpoint ID

### "Compaction too aggressive"
- Adjust `compactThreshold` in config
- Set custom priorities for important files
- Use `preservePatterns` to protect content

## Best Practices

1. **Save before risky operations**
   ```
   /nclaude save "before-database-migration"
   ```

2. **Check status regularly**
   ```
   /nclaude status
   ```

3. **Export important sessions**
   ```
   /nclaude export --output ./backups/
   ```

4. **Use meaningful checkpoint names**
   ```
   /nclaude save "working-auth-system"
   ```

5. **Compact proactively**
   - Don't wait for auto-compact
   - Manual compact when switching tasks

## Support

For issues or questions:
- GitHub: https://github.com/nexus-framework/nexus-ai-claude
- Documentation: Run `nclaude help hooks`