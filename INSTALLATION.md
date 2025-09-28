# 🛠️ Nexus AI Installation Guide

This guide provides detailed installation instructions for all supported platforms.

## 📋 Prerequisites

### System Requirements

| Component | Requirement |
|-----------|-------------|
| **Node.js** | v16.0.0 or higher |
| **npm** | v7.0.0 or higher (comes with Node.js) |
| **git** | Any recent version |
| **OS** | Linux (Ubuntu 18.04+), macOS (10.14+), Windows 10+ |
| **RAM** | 512MB minimum, 1GB recommended |
| **Disk** | 500MB for system + storage for file versions |

### Platform-Specific Prerequisites

<details>
<summary><strong>🐧 Linux Prerequisites</strong></summary>

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install nodejs npm git
```

#### CentOS/RHEL/Fedora
```bash
# CentOS/RHEL 7-8
sudo yum install nodejs npm git

# CentOS/RHEL 9+ / Fedora
sudo dnf install nodejs npm git
```

#### Arch Linux
```bash
sudo pacman -S nodejs npm git
```

#### Manual Node.js Installation
```bash
# Download and install from NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

</details>

<details>
<summary><strong>🍎 macOS Prerequisites</strong></summary>

#### Using Homebrew (Recommended)
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and git
brew install node git
```

#### Using MacPorts
```bash
sudo port install nodejs18 git
```

#### Manual Installation
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Install the `.pkg` file
3. Install git from [git-scm.com](https://git-scm.com/) or Xcode Command Line Tools

</details>

<details>
<summary><strong>🪟 Windows Prerequisites</strong></summary>

#### Using winget (Windows 10 1809+)
```powershell
winget install OpenJS.NodeJS
winget install Git.Git
```

#### Using Chocolatey
```powershell
# Install Chocolatey first if not installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js and git
choco install nodejs git
```

#### Manual Installation
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Download Git from [git-scm.com](https://git-scm.com/)
3. Run both installers with default settings

</details>

---

## 🚀 Installation Methods

### Method 1: Automated Installation (Recommended)

The automated installers handle all setup steps including dependencies, service installation, and project initialization.

#### Linux/macOS
```bash
curl -fsSL https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-linux.sh | bash
```

#### Windows (PowerShell as Administrator)
```powershell
iwr -useb https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-windows.ps1 | iex
```

### Method 2: Manual Installation

For users who prefer manual control over the installation process.

#### Step 1: Clone Repository
```bash
git clone https://github.com/KamakuraCrypto/nexusai.git
cd nexusai
```

#### Step 2: Install Dependencies
```bash
npm install --production
```

#### Step 3: Make Scripts Executable (Linux/macOS)
```bash
chmod +x nexusai/bin/nexus-memory.js
chmod +x nexusai/daemon/nexus-watcher.js
chmod +x nexusai/scripts/*.sh
```

#### Step 4: Initialize in Your Project
```bash
cd /path/to/your/project
node /path/to/nexusai/nexusai/bin/nexus-memory.js init --full
```

### Method 3: Development Installation

For contributors and developers who want to modify the code.

```bash
# Clone with development branches
git clone https://github.com/KamakuraCrypto/nexusai.git
cd nexusai

# Install all dependencies (including dev dependencies)
npm install

# Run tests to verify installation
npm test

# Run linting
npm run lint

# Start development mode
npm run dev
```

---

## ⚙️ Service Installation

Nexus AI can run as a system service for 24/7 file monitoring.

### Linux (SystemD)

#### Automatic Service Installation
The Linux installer automatically offers SystemD service installation:
```bash
# During installation, choose 'y' when prompted for service installation
```

#### Manual Service Installation
```bash
# Copy service template
sudo cp nexusai/services/nexus-watcher.service /etc/systemd/system/nexus-watcher-$(whoami).service

# Edit service file to replace placeholders
sudo nano /etc/systemd/system/nexus-watcher-$(whoami).service

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable nexus-watcher-$(whoami).service
sudo systemctl start nexus-watcher-$(whoami).service
```

#### Service Management
```bash
# Check status
sudo systemctl status nexus-watcher-$(whoami).service

# View logs
sudo journalctl -u nexus-watcher-$(whoami).service -f

# Stop service
sudo systemctl stop nexus-watcher-$(whoami).service

# Restart service
sudo systemctl restart nexus-watcher-$(whoami).service

# Disable service
sudo systemctl disable nexus-watcher-$(whoami).service
```

### macOS (LaunchAgent)

#### Automatic LaunchAgent Installation
The macOS installer can set up a LaunchAgent:
```bash
# During installation, choose 'y' when prompted for LaunchAgent installation
```

#### Manual LaunchAgent Installation
```bash
# Copy plist template
cp nexusai/services/com.nexusai.watcher.plist ~/Library/LaunchAgents/

# Edit plist file to update paths
nano ~/Library/LaunchAgents/com.nexusai.watcher.plist

# Load and start service
launchctl load ~/Library/LaunchAgents/com.nexusai.watcher.plist
launchctl start com.nexusai.watcher
```

#### LaunchAgent Management
```bash
# Check status
launchctl list | grep nexusai

# View logs
tail -f ~/Library/Logs/nexus-watcher.log

# Stop service
launchctl stop com.nexusai.watcher

# Unload service
launchctl unload ~/Library/LaunchAgents/com.nexusai.watcher.plist
```

### Windows (Windows Service)

#### Automatic Service Installation
Run the Windows installer as Administrator to enable service installation:
```powershell
# Run PowerShell as Administrator and execute installer
```

#### Manual Service Installation
```powershell
# Run as Administrator
$serviceName = "NexusAI-Watcher-$env:USERNAME"
$scriptPath = "$env:USERPROFILE\nexusai\nexusai\daemon\nexus-watcher.js"

# Create service wrapper
$wrapperScript = @"
@echo off
cd /d "$PWD"
node "$scriptPath"
"@

$wrapperPath = "$env:USERPROFILE\nexusai\nexus-service-wrapper.bat"
$wrapperScript | Out-File -FilePath $wrapperPath -Encoding ASCII

# Install service
sc.exe create $serviceName binPath= $wrapperPath start= auto DisplayName= "Nexus AI File Watcher"
sc.exe start $serviceName
```

#### Service Management
```powershell
# Check status
Get-Service NexusAI-Watcher-$env:USERNAME

# Stop service
Stop-Service NexusAI-Watcher-$env:USERNAME

# Start service
Start-Service NexusAI-Watcher-$env:USERNAME

# Remove service
sc.exe delete NexusAI-Watcher-$env:USERNAME
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root (optional):

```bash
# Logging configuration
NEXUS_LOG_LEVEL=info                    # debug, info, warn, error
NEXUS_LOG_FILE=.nexus/logs/nexus.log   # Log file path

# Memory system configuration
NEXUS_MAX_WORKING_SET=100              # Maximum working set size
NEXUS_CONSOLIDATION_THRESHOLD=50       # When to trigger consolidation
NEXUS_DECAY_FACTOR=0.95                # Memory decay rate

# File watching configuration
NEXUS_MAX_FILE_SIZE=10MB               # Maximum file size to track
NEXUS_RETENTION_DAYS=365               # Days to keep file versions
NEXUS_IGNORE_PATTERNS=.git,node_modules,*.log  # Additional ignore patterns

# Performance configuration
NEXUS_DEBOUNCE_DELAY=100               # File change debounce delay (ms)
NEXUS_BATCH_SIZE=50                    # Batch processing size
```

### Configuration File

Create `nexus.config.js` in your project root:

```javascript
module.exports = {
  // File watching configuration
  watcher: {
    ignorePatterns: [
      '.git/**',
      'node_modules/**',
      '*.log',
      'dist/**',
      'build/**'
    ],
    maxFileSize: '10MB',
    debounceDelay: 100
  },
  
  // Memory system configuration
  memory: {
    maxWorkingSetSize: 100,
    consolidationThreshold: 50,
    decayFactor: 0.95,
    retentionDays: 365
  },
  
  // Logging configuration
  logging: {
    level: 'info',
    file: '.nexus/logs/nexus.log',
    maxSize: '10MB',
    maxFiles: 5
  }
};
```

---

## ✅ Verification

### Post-Installation Checks

#### 1. Basic Functionality
```bash
# Check installation
./nexus-memory --version

# Verify system status
./nexus-memory status

# Test initialization
./nexus-memory init --memory-only
```

#### 2. File Watching
```bash
# Start daemon manually
./nexus-memory daemon start --background

# Check daemon status
./nexus-memory daemon status

# Create a test file and verify tracking
echo "test" > test.txt
./nexus-memory timeline
```

#### 3. Memory System
```bash
# Check memory status
./nexus-memory memory status

# Generate context
./nexus-memory memory context

# Verify CLAUDE.md creation
cat CLAUDE.md
```

#### 4. Service Verification (if installed)

**Linux:**
```bash
sudo systemctl status nexus-watcher-$(whoami)
```

**macOS:**
```bash
launchctl list | grep nexusai
```

**Windows:**
```powershell
Get-Service NexusAI-Watcher-$env:USERNAME
```

---

## 🐛 Troubleshooting

### Common Issues

#### Permission Errors
```bash
# Fix executable permissions (Linux/macOS)
chmod +x nexus-memory
chmod +x nexusai/bin/nexus-memory.js

# Fix ownership issues
chown -R $(whoami):$(whoami) .nexus/
```

#### Service Issues
```bash
# Check service logs
sudo journalctl -u nexus-watcher-$(whoami) -n 50

# Restart service
sudo systemctl restart nexus-watcher-$(whoami)

# Verify service file
sudo systemctl cat nexus-watcher-$(whoami)
```

#### Node.js Version Issues
```bash
# Check Node.js version
node --version

# Update Node.js (using n package manager)
npm install -g n
sudo n stable
```

#### Port or File Access Issues
```bash
# Check file permissions
ls -la .nexus/

# Check for conflicting processes
ps aux | grep nexus

# Check disk space
df -h
```

### Getting Help

If you encounter issues not covered here:

1. Check the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
2. Search [GitHub Issues](https://github.com/KamakuraCrypto/nexusai/issues)
3. Create a new issue with:
   - Operating system and version
   - Node.js version (`node --version`)
   - Installation method used
   - Complete error message
   - Steps to reproduce

---

## 🔄 Updates

### Updating Nexus AI

#### Automatic Update
```bash
# Run the installer again to update
curl -fsSL https://raw.githubusercontent.com/KamakuraCrypto/nexusai/main/nexusai/scripts/install-linux.sh | bash
```

#### Manual Update
```bash
cd ~/nexusai
git pull origin main
npm install --production

# Restart services if running
sudo systemctl restart nexus-watcher-$(whoami)  # Linux
launchctl kickstart -k gui/$(id -u)/com.nexusai.watcher  # macOS
```

### Version Management

```bash
# Check current version
./nexus-memory --version

# Check for updates
git fetch origin
git log HEAD..origin/main --oneline

# View changelog
cat CHANGELOG.md
```

---

## 🗑️ Uninstallation

### Complete Removal

#### Stop Services First
```bash
# Linux
sudo systemctl stop nexus-watcher-$(whoami)
sudo systemctl disable nexus-watcher-$(whoami)
sudo rm /etc/systemd/system/nexus-watcher-$(whoami).service

# macOS
launchctl unload ~/Library/LaunchAgents/com.nexusai.watcher.plist
rm ~/Library/LaunchAgents/com.nexusai.watcher.plist

# Windows
Stop-Service NexusAI-Watcher-$env:USERNAME
sc.exe delete NexusAI-Watcher-$env:USERNAME
```

#### Remove Files
```bash
# Remove installation
rm -rf ~/nexusai

# Remove project data (optional - contains your file history!)
rm -rf .nexus/
rm -f CLAUDE.md
rm -f nexus-memory
```

---

This completes the comprehensive installation guide. For additional help, see the [main documentation](./README.md) or [troubleshooting guide](./docs/TROUBLESHOOTING.md).