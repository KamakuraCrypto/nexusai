# 🧠 Nexus AI

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue.svg)](https://github.com/KamakuraCrypto/nexusai)
[![GitHub Issues](https://img.shields.io/github/issues/KamakuraCrypto/nexusai.svg)](https://github.com/KamakuraCrypto/nexusai/issues)
[![GitHub Stars](https://img.shields.io/github/stars/KamakuraCrypto/nexusai.svg)](https://github.com/KamakuraCrypto/nexusai/stargazers)

**Your Claude companion for persistent memory** 

Never lose context again! Nexus AI enhances Claude with persistent memory across conversation resets, 24/7 file monitoring with Git-like versioning, and intelligent knowledge accumulation.

[🚀 Quick Start](#-quick-start) • [📚 Documentation](#-documentation) • [💡 Features](#-features) • [🛠️ Installation](#️-installation) • [🤝 Contributing](#-contributing)

</div>

---

## 🌟 Why Nexus AI?

**The Problem**: Claude AI loses context when conversations reset, making long-term projects frustrating and inefficient.

**The Solution**: Nexus AI becomes Claude's memory companion, providing **project-scoped** intelligence:
- 🔄 **Preserves context** across conversation boundaries
- 📁 **Tracks every file change** with complete version history (per project)
- 🧠 **Accumulates knowledge** from every interaction (project-specific)
- ⏰ **Enables time travel** to any previous file state
- 🤖 **Auto-recovers context** for new Claude sessions
- 🔒 **Privacy-focused** - monitors only your specific project directory

---

## 🚀 Quick Start

### One-Command Installation

**Linux/macOS (Regular User):**
```bash
curl -fsSL https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-linux.sh | bash
```

**Linux/macOS (Root/System-wide):**
```bash
curl -fsSL https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-linux.sh | bash -s -- --allow-root
```

> **⚠️ Important:** Root installation only affects binary location - Nexus AI always operates per-project:
> - 📁 **Each project** needs separate `nclaude init` 
> - 🔍 **Monitoring scope** is always project-specific, never system-wide
> - 💾 **Data storage** is always in project's `.nexus/` directory
> - 🔒 **No system-wide file monitoring** occurs for security
>
> Regular user installation is recommended for development work.

**Windows (PowerShell as Administrator):**
```powershell
iwr -useb https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-windows.ps1 | iex
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/KamakuraCrypto/nexusai.git
cd nexusai

# Install dependencies
npm install

# Initialize in your project
cd /path/to/your/project
node /path/to/nexusai/nexusai/bin/nclaude.js init --full

# Verify installation
./nclaude status
```

---

## 💡 Features

### 🔄 Persistent Context Memory
- **Never lose progress**: Context survives conversation resets
- **Automatic recovery**: New Claude sessions get full context
- **Smart consolidation**: Important information prioritized

### 📁 Complete File Versioning
- **Git-like tracking**: Every file change saved with timestamps
- **Time travel**: Restore any file to any previous version
- **Diff generation**: See exactly what changed between versions
- **Real-time monitoring**: 24/7 file watching with zero overhead

### 🧠 Intelligent Knowledge Accumulation
- **Pattern recognition**: Learn from coding patterns and decisions
- **Error tracking**: Remember solutions to problems
- **Decision history**: Track technical choices and reasoning
- **Learning persistence**: Knowledge builds up over time

### ⚙️ Enterprise-Ready
- **Cross-platform**: Linux, macOS, Windows support
- **Service integration**: SystemD, LaunchAgent, Windows Service
- **Security hardened**: Minimal permissions, isolated execution
- **Performance optimized**: Efficient file watching and storage

---

## 🛠️ Installation

### System Requirements

- **Node.js**: v16.0.0 or higher
- **Operating System**: Linux (Ubuntu 18.04+), macOS (10.14+), Windows 10+
- **Disk Space**: 500MB minimum + storage for file versions
- **Memory**: 512MB RAM minimum, 1GB recommended

### Platform-Specific Installation

<details>
<summary><strong>🐧 Linux Installation</strong></summary>

#### Automated Installation (Regular User)
```bash
curl -fsSL https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-linux.sh | bash
```

#### Automated Installation (Root/System-wide)
```bash
curl -fsSL https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-linux.sh | bash -s -- --allow-root
```

> **⚠️ Root Installation Important Notes:**
> - 📍 **Binary location only:** Root installation places the `nclaude` command system-wide
> - 📁 **Project-scoped operation:** Each project still needs separate `nclaude init`
> - 🔍 **No system monitoring:** Daemon only monitors individual project directories
> - 💾 **Per-project data:** Each project has its own `.nexus/` directory
> - ⚠️ **Permission issues:** Files owned by root may cause problems with project files
>
> Consider creating a regular user account for development work.

#### Manual Installation
```bash
# Install prerequisites (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install nodejs npm git

# Clone and install
git clone https://github.com/KamakuraCrypto/nexusai.git ~/nexusai
cd ~/nexusai
npm install --production

# Initialize in your project
cd /path/to/your/project
node ~/nexusai/nexusai/bin/nclaude.js init --full
```

#### SystemD Service (Optional)
The installer can automatically set up a SystemD service for 24/7 monitoring:
```bash
# Check service status
sudo systemctl status nexus-watcher-$(whoami)

# View logs
sudo journalctl -u nexus-watcher-$(whoami) -f
```

</details>

<details>
<summary><strong>🍎 macOS Installation</strong></summary>

#### Automated Installation
```bash
curl -fsSL https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-macos.sh | bash
```

#### Manual Installation
```bash
# Install prerequisites with Homebrew
brew install node git

# Clone and install
git clone https://github.com/KamakuraCrypto/nexusai.git ~/nexusai
cd ~/nexusai
npm install --production

# Initialize in your project
cd /path/to/your/project
node ~/nexusai/nexusai/bin/nclaude.js init --full
```

#### LaunchAgent Service (Optional)
The installer can set up a LaunchAgent for automatic startup:
```bash
# Check service status
launchctl list | grep nexusai

# View logs
tail -f ~/Library/Logs/nexus-watcher.log
```

</details>

<details>
<summary><strong>🪟 Windows Installation</strong></summary>

#### Automated Installation (PowerShell as Administrator)
```powershell
iwr -useb https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-windows.ps1 | iex
```

#### Manual Installation
```powershell
# Install prerequisites
winget install OpenJS.NodeJS
winget install Git.Git

# Clone and install
git clone https://github.com/KamakuraCrypto/nexusai.git $env:USERPROFILE\nexusai
cd $env:USERPROFILE\nexusai
npm install --production

# Initialize in your project
cd C:\path\to\your\project
node $env:USERPROFILE\nexusai\nexusai\bin\nclaude.js init --full
```

#### Windows Service (Optional)
Run the installer as Administrator to enable Windows Service installation:
```powershell
# Check service status
Get-Service NexusAI-Watcher-$env:USERNAME

# View service logs in Event Viewer
```

</details>

---

## 📚 Documentation

### Quick Reference

| Command | Description | Example |
|---------|-------------|---------|
| `nclaude init` | Initialize system | `nclaude init --full` |
| `nclaude status` | Show system status | `nclaude status --verbose` |
| `nclaude timeline` | View change history | `nclaude timeline src/main.js` |
| `nclaude restore` | Restore file versions | `nclaude restore src/main.js --list` |
| `nclaude memory` | Memory management | `nclaude memory context` |
| `nclaude daemon` | Daemon control | `nclaude daemon start` |

### Common Workflows

<details>
<summary><strong>🔧 Initial Setup</strong></summary>

```bash
# Complete system initialization
nclaude init --full

# Verify everything is working
nclaude status

# Check daemon status
nclaude daemon status
```

</details>

<details>
<summary><strong>📅 Daily Operation</strong></summary>

```bash
# View recent changes
nclaude timeline

# Check memory system health
nclaude memory status

# Update Claude context
nclaude memory context
```

</details>

<details>
<summary><strong>⏰ File Recovery</strong></summary>

```bash
# List available versions
nclaude restore src/main.js --list

# Preview what would change
nclaude restore src/main.js --preview

# Restore to latest version
nclaude restore src/main.js

# Restore to specific timestamp
nclaude restore src/main.js 1640995200000
```

</details>

<details>
<summary><strong>🧠 Knowledge Management</strong></summary>

```bash
# Auto-analyze conversations
nclaude transcript analyze --watch

# Process accumulated knowledge
nclaude memory consolidate

# Generate current context
nclaude memory context --update
```

</details>

### Complete Documentation

- **CLI Reference** - Use `nclaude --help` for complete command documentation
- **GitHub Repository** - Full source code and examples

---

## 🏗️ Architecture

```
Nexus AI
├── 🧠 Memory Consolidator      # Knowledge accumulation & context preservation
├── 👁️  File Watcher Daemon     # 24/7 file monitoring with versioning
├── 📝 Transcript Analyzer      # Conversation pattern extraction
├── 💾 Version Storage          # Git-like file history management
└── 🔄 Context Recovery         # Automatic session restoration
```

### Key Components

- **Memory Consolidator**: Intelligently manages working memory and long-term storage
- **File Watcher**: Real-time monitoring with efficient change detection
- **Transcript Analyzer**: Extracts patterns, decisions, and learnings from conversations
- **Version Storage**: Complete file history with diff generation
- **Context Recovery**: Seamless context restoration for new Claude sessions

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Fork the repository
git clone https://github.com/YOUR_USERNAME/nexusai.git
cd nexusai

# Install development dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint
```

### Contribution Guidelines

1. **Fork** the repository and create a feature branch
2. **Write tests** for new functionality
3. **Follow** the existing code style and conventions
4. **Update documentation** for any API changes
5. **Submit** a pull request with a clear description

### Development Priorities

- 🔬 **Enhanced Pattern Recognition**: Improve AI conversation analysis
- 🚀 **Performance Optimization**: Reduce memory usage and improve speed
- 🔌 **IDE Integration**: VS Code, IntelliJ, and other editor plugins
- 🌐 **Cloud Sync**: Optional cloud backup and synchronization
- 📊 **Analytics Dashboard**: Web interface for memory visualization

See our [Contributing Guide](./CONTRIBUTING.md) for detailed information.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙋 Support & Community

### Getting Help

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/KamakuraCrypto/nexusai/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/KamakuraCrypto/nexusai/discussions)
- 📖 **Documentation**: [Wiki](https://github.com/KamakuraCrypto/nexusai/wiki)
- 💬 **Community**: [Discord Server](https://discord.gg/nexusai) *(coming soon)*

### Project Status

- ✅ **Core Features**: Complete and stable
- 🔄 **Active Development**: Regular updates and improvements
- 🛡️ **Security**: Regular security audits and updates
- 📈 **Growing Community**: Join us in building the future of AI memory

---

## 🌟 Acknowledgments

Special thanks to:
- **Anthropic** for creating Claude AI
- **The Open Source Community** for inspiration and contributions
- **Early Adopters** for feedback and testing
- **Contributors** who help make Nexus AI better

---

<div align="center">

**🧠 Never lose context again with Nexus AI! 🚀**

[⭐ Star us on GitHub](https://github.com/KamakuraCrypto/nexusai) • [🐛 Report Issues](https://github.com/KamakuraCrypto/nexusai/issues) • [💬 Join Discord](https://discord.gg/nexusai)

*Built with ❤️ for the AI community*

</div>