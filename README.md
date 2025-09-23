# 🚀 Nexus AI Framework - Claude Code Edition

**Never Lose Work in Claude Code Again - Bulletproof Context Management & Session Persistence**

[![npm version](https://img.shields.io/npm/v/nexus-ai.svg)](https://www.npmjs.com/package/nexus-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Compatible](https://img.shields.io/badge/Claude-Compatible-blue.svg)](https://claude.ai)
[![Downloads](https://img.shields.io/npm/dm/nexus-ai.svg)](https://www.npmjs.com/package/nexus-ai)

## 🎯 The Problem This Solves

Your friend just lost critical work in Claude Code. Conversations reset. Context disappears. Hours of progress vanish. **This stops now.**

Nexus AI is the first framework specifically designed for Claude Code that provides:
- **Bulletproof data protection** with atomic rollback
- **200k token context management** with automatic compaction
- **Session persistence** across conversation resets
- **Zero retraining** - Claude remembers everything

### 🛡️ Claude Code Features

#### Context Management (200k tokens)
- **Automatic Compaction**: Triggers at 180k tokens to prevent overflow
- **Priority Retention**: Critical code and errors preserved, less important content summarized
- **Smart Compression**: Multi-level strategies based on content importance
- **Token Tracking**: Real-time monitoring of context usage

#### Session Persistence
- **Checkpoint System**: Save/restore conversation state at any point
- **Session Branching**: Create multiple paths from any checkpoint
- **Artifact Versioning**: Track all code Claude generates with full history
- **File Tracking**: Every read/write/edit operation recorded with timestamps

#### Conversation Hooks
- **beforeContextWindow**: Triggered before hitting token limit
- **onArtifactCreation**: Captures every code snippet Claude creates
- **onFileOperation**: Tracks all file system interactions
- **onErrorEncountered**: Preserves error context for debugging
- **onContextReset**: Automatic state save before conversation ends

## ⚡ Quick Start for Claude Code

### One-Command Installation
```bash
npm install -g nexus-ai
nexus claude init
```

That's it! Your Claude Code sessions are now bulletproof.

### After Claude Resets Your Conversation
```bash
nexus claude restore    # Instantly restore your last session
nexus claude status     # Check current token usage
nexus claude save       # Manually checkpoint important moments
```

## 🌟 Why Nexus for Claude Code?

### 1. Built Specifically for Claude's Architecture
- **200k Token Window**: Optimized for Claude's exact context limits
- **Artifact Management**: Tracks every code block Claude generates
- **Smart Compaction**: Uses Claude-compatible summarization techniques
- **Session Format**: Restoration formatted for Claude's understanding

### 2. Universal GitHub Repository Analysis
```bash
nexus analyze https://github.com/any/repository
```
- Analyzes any codebase in any language
- Generates AI-readable documentation
- Maps component relationships
- Creates knowledge graphs

### 3. Documentation Scraping & Indexing
```bash
nexus docs https://docs.example.com
```
- Scrapes any documentation website
- Parses PDFs, Markdown, HTML
- Creates searchable knowledge bases
- Real-time updates

### 4. Plug-and-Play for Existing Projects
```bash
nexus import /path/to/your/project
```
- Works with any existing codebase
- Zero configuration required
- Doesn't change your workflow
- Transparent AI enhancement

## 📚 Claude-Specific Commands

### Essential Claude Commands
```bash
nexus claude init             # Initialize Claude integration
nexus claude status           # Show token usage & session info
nexus claude save             # Create checkpoint of current conversation
nexus claude restore          # Restore from last checkpoint
nexus claude compact          # Manually compact conversation
nexus claude search <query>   # Search through all artifacts
nexus claude export           # Export session data
nexus claude hooks            # Manage conversation hooks
```

### Real-Time Status Display
```bash
nexus claude status --detailed

═══ Claude Context Status ═══

Token Usage:
  ████████████████████░░░░░░░░░░ 67.3%
  134,600 / 200,000 tokens

Current Session:
  ID: session-abc123
  Started: 2024-01-15 10:30 AM
  Checkpoints: 5
  Messages: 127

File Tracking:
  Tracked files: 42
  Recent files:
    ✏️ src/index.ts
    ✏️ components/Header.tsx
    👁️ package.json

Artifacts:
  Total artifacts: 18
  Languages: javascript, typescript, python
```

### Project Management
```bash
nexus new                     # Create new AI-native project
nexus import <path>           # Import existing project
nexus status                  # Show project status
nexus build                   # Build with AI assistance
```

### Knowledge Base
```bash
nexus kb add <source>         # Add knowledge source
nexus kb search "query"       # Search knowledge bases
nexus kb sync                 # Sync all knowledge bases
nexus kb list                 # List available knowledge bases
```

## 🔧 How It Works

### AI Model Hooks System
```javascript
// Automatically triggered on context compaction
{
  "beforeCompaction": "summarize_conversation",
  "afterCompaction": "restore_critical_context",
  "onSessionStart": "read_important_files",
  "onSessionEnd": "save_memory_checkpoint"
}
```

### Conversation Memory Architecture
1. **Sliding Window**: Maintains optimal context size
2. **Priority Retention**: Keeps critical information
3. **Smart Summarization**: Compresses old conversations
4. **Instant Restoration**: Zero startup time

## 🛠️ Zero Configuration Required

Nexus works out of the box with Claude Code. Just run:
```bash
nexus claude init
```

### Optional Advanced Configuration
```javascript
// .nexus/claude-config.json (auto-generated)
{
  "context": {
    "maxTokens": 200000,           // Claude's limit
    "compactionThreshold": 180000, // When to compact
    "warningThreshold": 170000     // When to warn
  },
  "sessions": {
    "autosaveInterval": 300000,    // Every 5 minutes
    "maxCheckpoints": 10           // Checkpoint history
  },
  "artifacts": {
    "maxVersions": 10,             // Version history depth
    "autoExtractPatterns": true    // Learn from your code
  }
}
```

## 🎯 Use Cases

### For Individual Developers
- Never lose work due to AI context resets
- Maintain project continuity across sessions
- Build complex projects without retraining AI
- Instant documentation for any codebase

### For Teams
- Shared AI knowledge across team members
- Consistent project understanding
- Automatic documentation updates
- Zero onboarding time for new members

### For Open Source Projects
- Instant codebase analysis for contributors
- Automatic documentation generation
- AI-assisted issue resolution
- Community knowledge preservation

## 🚀 Advanced Features

### GitHub Repository Analysis
```bash
# Analyze any repository
nexus analyze https://github.com/facebook/react

# Output includes:
# - Complete architecture map
# - Component relationships
# - Dependency analysis
# - Usage patterns
# - Best practices extraction
```

### Documentation Scraping
```bash
# Scrape any documentation
nexus docs https://react.dev

# Creates:
# - Searchable knowledge base
# - AI-optimized summaries
# - Cross-referenced content
# - Instant answers to questions
```

### Multi-AI Support
- Claude (Anthropic)
- GPT-4 (OpenAI)
- Gemini (Google)
- Grok (xAI)
- Local models (Ollama)

## 📊 Performance

- **Zero Overhead**: Transparent operation
- **Instant Recovery**: Millisecond rollbacks
- **Efficient Storage**: Smart compression
- **Fast Analysis**: Parallel processing
- **Minimal Dependencies**: Lightweight core

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone the repository
git clone https://github.com/nexus-framework/nexus-ai.git

# Install dependencies
cd nexus-ai && npm install

# Run tests
npm test

# Build for production
npm run build
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🌐 Community & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/nexus-framework/nexus-ai/issues)
- **Discussions**: [Join the community](https://github.com/nexus-framework/nexus-ai/discussions)
- **Twitter**: [@NexusAIFramework](https://twitter.com/NexusAIFramework)

## 🎉 Why Nexus AI?

> "I lost 3 days of work when Claude's context reset. Never again." - Early User

Nexus AI was born from frustration with AI development tools that:
- Lose context and require constant retraining
- Don't preserve work between sessions
- Can't analyze existing codebases effectively
- Require complex configuration

We built Nexus AI to be:
- **Bulletproof**: Never lose work
- **Persistent**: Remember everything
- **Universal**: Work with any project
- **Simple**: Zero configuration

## 🚦 Quick Start with Claude Code

1. **Install Nexus AI**:
   ```bash
   npm install -g nexus-ai
   ```

2. **Initialize Claude integration**:
   ```bash
   cd your-project
   nexus claude init
   ```

3. **Check your Claude status anytime**:
   ```bash
   nexus claude status
   ```

4. **When Claude needs to reset**:
   ```bash
   nexus claude restore
   ```

That's it! Your Claude sessions are now bulletproof.

## 📈 Roadmap

- [x] AI model hooks for conversation continuity
- [x] GitHub repository analysis
- [x] Documentation scraping
- [x] One-command installation
- [ ] Visual Studio Code extension
- [ ] Web interface
- [ ] Team collaboration features
- [ ] Cloud sync (optional)
- [ ] AI model fine-tuning
- [ ] Custom knowledge base training

## 💡 Philosophy

Nexus AI follows these principles:
1. **Never lose user work** - Data protection is paramount
2. **Zero configuration** - It should just work
3. **Transparent operation** - Don't change how developers work
4. **Universal compatibility** - Support everything
5. **Community first** - Built by developers, for developers

---

**Built with ❤️ for the millions of vibecoders building the future with AI**

*Nexus AI - Never lose context. Never lose work. Just build.*