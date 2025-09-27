# 🚀 Nexus AI - Professional Claude Code Integration Framework

**Enterprise-grade conversation capture, monitoring, and recovery tools for Claude Code users.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version: 3.0.0](https://img.shields.io/badge/Version-3.0.0-blue.svg)](https://github.com/nexus-framework/nexus-ai-claude)
[![Node.js](https://img.shields.io/badge/Node.js-14%2B-green.svg)](https://nodejs.org/)

## ⚡ Overview

Nexus AI is a comprehensive Claude Code integration framework designed for professional developers and teams who require robust data safety, conversation tracking, and workflow management. Built for scalability and enterprise use, it provides complete visibility and control over your Claude Code interactions.

### 🎯 Core Features

- **📝 Complete Conversation Capture** - Every prompt, response, and thinking process automatically saved
- **📊 Real-time Monitoring Dashboard** - Live system status and conversation analytics
- **🔧 Professional Recovery Tools** - File-level restoration with diff tracking
- **💾 Enterprise Backup System** - Automated backups with retention policies
- **🔄 Git-like Timeline Storage** - Version control for all file operations
- **⚙️ Claude Code Integration** - Seamless hooks for automatic operation

## 🏃‍♂️ Quick Installation

### Automated Installation (Recommended)
```bash
# Extract the distribution package
unzip nexusai-v3-complete.zip
cd nexusai-distribution

# Run the installer
./install.sh
```

### Windows Installation
```cmd
# Extract the package, then:
install.bat
```

### Manual Installation
```bash
npm install
npm link
nclaude init
```

## 📋 Command Reference

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `nclaude init` | Initialize framework in project | `nclaude init --force` |
| `nclaude status` | Show session and token status | `nclaude status --verbose` |
| `nclaude save [name]` | Create checkpoint/backup | `nclaude save "stable-build"` |
| `nclaude restore [checkpoint]` | Restore from backup | `nclaude restore "stable-build"` |
| `nclaude help-all` | Show comprehensive help | `nclaude help-all` |

### Conversation Management

| Command | Description | Example |
|---------|-------------|---------|
| `nclaude transcript list` | List captured conversations | `nclaude transcript list` |
| `nclaude transcript show <id>` | Display conversation details | `nclaude transcript show current-session` |
| `nclaude transcript parse <file>` | Parse Claude transcript file | `nclaude transcript parse ~/.claude/projects/.../session.jsonl` |

### System Monitoring

| Command | Description | Example |
|---------|-------------|---------|
| `nclaude monitor dashboard` | Show monitoring dashboard | `nclaude monitor dashboard` |
| `nclaude monitor live` | Start live monitoring | `nclaude monitor live` |
| `nclaude-monitor` | Direct access to monitor tools | `nclaude-monitor dashboard` |

### Recovery & Restoration

| Command | Description | Example |
|---------|-------------|---------|
| `nclaude recover list-edits <file>` | Show file edit history | `nclaude recover list-edits ./src/main.js` |
| `nclaude recover restore-file <file> <id>` | Restore file to specific state | `nclaude recover restore-file ./src/main.js edit-123` |
| `nclaude recover show-timeline` | Display activity timeline | `nclaude recover show-timeline 20` |
| `nclaude recover list-backups` | Show available backups | `nclaude recover list-backups` |

### Export & Utilities

| Command | Description | Example |
|---------|-------------|---------|
| `nclaude export` | Export session data | `nclaude export --format markdown` |
| `nclaude search <query>` | Search artifacts and conversations | `nclaude search "authentication"` |
| `nclaude clean` | Clean old sessions | `nclaude clean --days 30` |
| `nclaude timeline watch` | Start file watcher | `nclaude timeline watch` |

## 🔧 Enterprise Configuration

### Project Initialization
```bash
cd your-project
nclaude init
```

This creates the `.nexus/` directory structure:
```
.nexus/
├── conversations/     # Captured conversation data
├── responses/        # AI responses and thinking processes
├── edits/           # File edit history with diffs
├── timeline/        # Git-like object storage
├── backups/         # Automatic backup storage
├── claude/          # Claude Code integration data
└── sessions/        # Session management files
```

### Configuration Files

#### `.nexus/claude-config.json` - Core Configuration
```json
{
  "context": {
    "maxTokens": 200000,
    "compactionThreshold": 180000,
    "warningThreshold": 170000
  },
  "capture": {
    "conversations": true,
    "responses": true,
    "thinking": true,
    "toolUse": true
  },
  "monitoring": {
    "realTime": true,
    "dashboard": true,
    "alerts": true
  },
  "backup": {
    "automatic": true,
    "retention": "30d",
    "compression": true
  }
}
```

#### `.claude/settings.local.json` - Hook Configuration
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {"type": "command", "command": ".claude/hooks/user-prompt-submit.sh"}
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {"type": "command", "command": ".claude/hooks/stop.sh"}
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {"type": "command", "command": ".claude/hooks/post-tool-use.sh"}
        ]
      }
    ]
  }
}
```

## 🎮 Real-World Usage Examples

### Development Workflow
```bash
# Initialize project
nclaude init

# Start monitoring
nclaude monitor live &

# Work with Claude Code...
# (Conversations automatically captured)

# Check system status
nclaude status
# Token Usage: ████████████░░░░ 75% (150k/200k)
# Conversations: 25 captured
# Responses: 127 saved
# Files: 42 tracked

# Create checkpoint before major changes
nclaude save "pre-refactor"

# View captured conversations
nclaude transcript list
# current-session: 2h 45m, 127 responses, 150k tokens

# Show conversation details
nclaude transcript show current-session
```

### Recovery Scenarios
```bash
# Check file edit history
nclaude recover list-edits ./src/auth.js
# edit-123 | 2023-12-01 14:30 | Added JWT validation
# edit-124 | 2023-12-01 14:45 | Fixed token refresh

# Restore file to previous state
nclaude recover restore-file ./src/auth.js edit-123

# View system activity timeline
nclaude recover show-timeline 10
# 🤖 14:45 | AI response (245 chars)
# ✏️ 14:30 | Edited auth.js
# 💬 14:15 | Started conversation (25 turns)
```

### Data Export and Analysis
```bash
# Export conversations to markdown
nclaude export --format markdown --output ./reports

# Search for specific topics
nclaude search "authentication" --type conversation

# Export session archive
nclaude export --format archive --output ./backup.zip
```

## 🔗 Claude Code Integration

### Automatic Hooks
Nexus AI integrates with Claude Code through automated hooks:

- **UserPromptSubmit** - Captures every user prompt with metadata
- **Stop** - Captures AI responses when conversation ends
- **PostToolUse** - Tracks all file operations and tool usage
- **SessionStart/End** - Manages session lifecycle
- **PreCompact** - Handles conversation compaction

### Slash Commands
Use these commands directly in Claude Code:
```
/nclaude status              # Check session status
/nclaude save "checkpoint"   # Create named checkpoint
/nclaude restore            # Restore last checkpoint
/nclaude compact            # Manually compact conversation
```

### Real-time Monitoring
```bash
# View live dashboard
nclaude monitor dashboard

# Start background monitoring
nclaude monitor live
```

## 📊 Data Architecture

### Storage Structure
- **Conversations**: Complete chat history with metadata
- **Responses**: AI responses with thinking processes extracted
- **Timeline**: Git-like object storage for file versions
- **Edits**: Individual file changes with full diffs
- **Backups**: Compressed archives with retention policies

### Data Formats
- **JSON**: Structured conversation and metadata
- **JSONL**: Claude transcript parsing
- **Markdown**: Human-readable exports
- **Compressed Archives**: Backup storage

## 🛠️ Advanced Features

### Timeline and Versioning
```bash
# Start file watcher
nclaude timeline watch

# Show timeline
nclaude timeline show

# Restore to specific point
nclaude timeline restore 8

# Compare two points
nclaude timeline compare 8 12
```

### Backup Management
```bash
# List all backups
nclaude recover list-backups

# Restore from specific backup
nclaude recover restore-backup 20231201-143000

# Configure backup retention
nclaude clean --days 30
```

### System Monitoring
```bash
# Health check
nclaude monitor health

# System status
nclaude monitor status

# Live monitoring with refresh
nclaude monitor --refresh 5
```

## 🔍 Troubleshooting

### Common Issues

**Command Not Found**
```bash
# Ensure global installation
npm link

# Or use npx
npx nclaude status
```

**Missing Dependencies**
```bash
# Reinstall
npm install
nclaude init
```

**Hook Configuration Issues**
```bash
# Test hooks
nclaude hooks --test
nclaude hooks --list
```

**Permission Errors (Windows)**
- Run Command Prompt as Administrator
- Ensure Node.js is properly installed
- Check antivirus software restrictions

### Data Recovery
```bash
# Emergency conversation recovery
nclaude recover list-conversations

# File restoration
nclaude recover list-edits <file>
nclaude recover restore-file <file> <edit-id>

# Backup restoration
nclaude recover restore-backup <timestamp>
```

## 🎯 Best Practices

### Enterprise Deployment
1. **Initialize immediately** in all new projects
2. **Configure retention policies** based on team needs
3. **Set up monitoring dashboards** for team visibility
4. **Regular backup exports** for compliance
5. **Document recovery procedures** for team members

### Performance Optimization
1. **Monitor token usage** with `nclaude status`
2. **Use conversation compaction** before hitting limits
3. **Regular cleanup** of old sessions
4. **Configure appropriate retention** policies

### Security Considerations
1. **Review captured data** before sharing projects
2. **Configure `.gitignore`** to exclude sensitive logs
3. **Regular backup exports** to secure storage
4. **Access control** for shared development environments

## 🤝 Contributing

We welcome contributions from the community:

1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** Pull Request

### Development Setup
```bash
git clone https://github.com/nexus-framework/nexus-ai-claude.git
cd nexus-ai-claude
npm install
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links & Support

- **Repository**: [GitHub](https://github.com/nexus-framework/nexus-ai-claude)
- **Documentation**: [Wiki](https://github.com/nexus-framework/nexus-ai-claude/wiki)
- **Issue Tracker**: [Issues](https://github.com/nexus-framework/nexus-ai-claude/issues)
- **Releases**: [Changelog](https://github.com/nexus-framework/nexus-ai-claude/releases)

## 🏢 Enterprise Support

For enterprise deployments, custom integrations, or commercial support:
- **Email**: enterprise@nexus-ai.dev
- **Documentation**: Full API documentation available
- **Training**: Team onboarding and training available
- **SLA**: Service level agreements for enterprise customers

---

**Built for professional Claude Code users who demand enterprise-grade reliability and data safety.**

*Your conversations. Your data. Your control.*