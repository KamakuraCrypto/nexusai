#!/bin/bash

# Nexus AI - macOS Installation Script
# https://github.com/KamakuraCrypto/nexusai

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/KamakuraCrypto/nexusai.git"
INSTALL_DIR="$HOME/nexusai"
PROJECT_ROOT="$(pwd)"

echo -e "${BLUE}🧠 Nexus AI - macOS Installer${NC}"
echo -e "${BLUE}=========================================================${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Please install Node.js (v16.0.0 or higher) first:"
    echo "  Option 1: Download from https://nodejs.org/"
    echo "  Option 2: Use Homebrew: brew install node"
    echo "  Option 3: Use MacPorts: sudo port install nodejs18"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [[ $NODE_MAJOR -lt 16 ]]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old${NC}"
    echo "Please upgrade to Node.js v16.0.0 or higher"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"

# Check npm
if ! command_exists npm; then
    echo -e "${RED}❌ npm not found${NC}"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm $NPM_VERSION found${NC}"

# Check git
if ! command_exists git; then
    echo -e "${RED}❌ git not found${NC}"
    echo "Please install git first:"
    echo "  Option 1: Install Xcode Command Line Tools: xcode-select --install"
    echo "  Option 2: Use Homebrew: brew install git"
    echo "  Option 3: Download from https://git-scm.com/"
    exit 1
fi

echo -e "${GREEN}✅ git found${NC}"

# Check if Homebrew is available (for potential future use)
if command_exists brew; then
    echo -e "${GREEN}✅ Homebrew found${NC}"
    HOMEBREW_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Homebrew not found (optional)${NC}"
    HOMEBREW_AVAILABLE=false
fi

# Check launchd for daemon support
if [[ -d "/Library/LaunchDaemons" ]] || [[ -d "$HOME/Library/LaunchAgents" ]]; then
    echo -e "${GREEN}✅ launchd found - daemon service available${NC}"
    LAUNCHD_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  launchd not available - daemon service will not be available${NC}"
    LAUNCHD_AVAILABLE=false
fi

echo ""

# Clone or update repository
echo -e "${YELLOW}📦 Installing Nexus AI...${NC}"

if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${YELLOW}📁 Nexus AI directory exists, updating...${NC}"
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo -e "${YELLOW}📁 Cloning Nexus AI repository...${NC}"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production

# Make scripts executable
chmod +x nexusai/bin/nclaude.js
chmod +x nexusai/daemon/nexus-watcher.js
chmod +x nexusai/scripts/*.sh

echo -e "${GREEN}✅ Nexus AI installed successfully${NC}"
echo ""

# Initialize in current project
echo -e "${YELLOW}🚀 Initializing Nexus AI in current project...${NC}"
cd "$PROJECT_ROOT"

# Create symlink to nclaude command
NEXUS_BIN="$INSTALL_DIR/nexusai/bin/nclaude.js"
LOCAL_BIN="./nclaude"

if [[ -L "$LOCAL_BIN" ]] || [[ -f "$LOCAL_BIN" ]]; then
    rm -f "$LOCAL_BIN"
fi

ln -s "$NEXUS_BIN" "$LOCAL_BIN"
echo -e "${GREEN}✅ Created nclaude command link${NC}"

# Initialize the system
echo -e "${YELLOW}🔧 Initializing memory system...${NC}"
node "$NEXUS_BIN" init --memory-only

# Setup launchd service (optional)
if [[ "$LAUNCHD_AVAILABLE" == true ]]; then
    echo ""
    echo -e "${YELLOW}⚙️  LaunchAgent Setup${NC}"
    echo "Do you want to install the LaunchAgent for 24/7 file monitoring? (y/N)"
    read -r INSTALL_SERVICE
    
    if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}📋 Installing LaunchAgent...${NC}"
        
        # Create LaunchAgent plist
        PLIST_NAME="com.nexusai.watcher.$(whoami).plist"
        PLIST_FILE="$HOME/Library/LaunchAgents/$PLIST_NAME"
        
        cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$INSTALL_DIR/nexusai/daemon/nexus-watcher.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>NEXUS_PROJECT_ROOT</key>
        <string>$PROJECT_ROOT</string>
        <key>NEXUS_LOG_LEVEL</key>
        <string>info</string>
    </dict>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/nexus-watcher.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/nexus-watcher-error.log</string>
</dict>
</plist>
EOF

        # Load the service
        launchctl load "$PLIST_FILE"
        
        # Start the service
        echo -e "${YELLOW}🚀 Starting Nexus AI daemon...${NC}"
        launchctl start "$PLIST_NAME"
        
        # Check status
        sleep 2
        if launchctl list | grep -q "$PLIST_NAME"; then
            echo -e "${GREEN}✅ LaunchAgent installed and started successfully${NC}"
        else
            echo -e "${RED}❌ LaunchAgent failed to start${NC}"
            echo "Check logs at: $HOME/Library/Logs/nexus-watcher-error.log"
        fi
        
    else
        echo -e "${YELLOW}⏭️  Skipping LaunchAgent installation${NC}"
        echo "You can start the daemon manually with:"
        echo "  node $NEXUS_BIN daemon start --background"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Installation Complete!${NC}"
echo -e "${GREEN}========================${NC}"
echo ""
echo -e "${BLUE}📚 Getting Started:${NC}"
echo ""
echo "1. Check system status:"
echo "   ./nclaude status"
echo ""
echo "2. View change timeline:"
echo "   ./nclaude timeline"
echo ""
echo "3. Start daemon manually (if not using LaunchAgent):"
echo "   ./nclaude daemon start --background"
echo ""
echo "4. Generate context for Claude:"
echo "   ./nclaude memory context"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "   Full documentation: $INSTALL_DIR/README.md"
echo "   CLI reference: ./nclaude --help"
echo "   GitHub: $REPO_URL"
echo ""
echo -e "${BLUE}🛠️  System Files:${NC}"
echo "   Installation: $INSTALL_DIR"
echo "   Project data: $PROJECT_ROOT/.nexus/"
echo "   Master context: $PROJECT_ROOT/CLAUDE.md"
echo ""

if [[ "$LAUNCHD_AVAILABLE" == true ]] && [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔧 Service Management:${NC}"
    echo "   Check status: launchctl list | grep nexusai"
    echo "   View logs: tail -f $HOME/Library/Logs/nexus-watcher.log"
    echo "   Stop service: launchctl stop $PLIST_NAME"
    echo "   Start service: launchctl start $PLIST_NAME"
    echo "   Uninstall: launchctl unload $PLIST_FILE && rm $PLIST_FILE"
    echo ""
fi

if [[ "$HOMEBREW_AVAILABLE" == true ]]; then
    echo -e "${BLUE}💡 Tip:${NC}"
    echo "   Consider adding nexus-memory to your PATH:"
    echo "   echo 'export PATH=\"$INSTALL_DIR/nexusai/bin:\$PATH\"' >> ~/.zshrc"
    echo ""
fi

echo -e "${GREEN}🧠 Nexus AI is now protecting your project context!${NC}"
echo -e "${GREEN}Never lose context again! 🚀${NC}"