#!/bin/bash

# Nexus AI Everlasting Memory System - Linux Installation Script
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

echo -e "${BLUE}🧠 Nexus AI Everlasting Memory System - Linux Installer${NC}"
echo -e "${BLUE}==========================================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   echo "Please run as a regular user. SystemD service will be installed with proper permissions."
   exit 1
fi

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
    echo "  Ubuntu/Debian: sudo apt-get install nodejs npm"
    echo "  CentOS/RHEL: sudo yum install nodejs npm"
    echo "  Or visit: https://nodejs.org/"
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
    echo "Please install npm first"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm $NPM_VERSION found${NC}"

# Check git
if ! command_exists git; then
    echo -e "${RED}❌ git not found${NC}"
    echo "Please install git first:"
    echo "  Ubuntu/Debian: sudo apt-get install git"
    echo "  CentOS/RHEL: sudo yum install git"
    exit 1
fi

echo -e "${GREEN}✅ git found${NC}"

# Check SystemD (optional)
if command_exists systemctl; then
    echo -e "${GREEN}✅ SystemD found - daemon service available${NC}"
    SYSTEMD_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  SystemD not found - daemon service will not be available${NC}"
    SYSTEMD_AVAILABLE=false
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
chmod +x nexusai/bin/nexus-memory.js
chmod +x nexusai/daemon/nexus-watcher.js
chmod +x nexusai/scripts/*.sh

echo -e "${GREEN}✅ Nexus AI installed successfully${NC}"
echo ""

# Initialize in current project
echo -e "${YELLOW}🚀 Initializing Nexus AI in current project...${NC}"
cd "$PROJECT_ROOT"

# Create symlink to nexus-memory command
NEXUS_BIN="$INSTALL_DIR/nexusai/bin/nexus-memory.js"
LOCAL_BIN="./nexus-memory"

if [[ -L "$LOCAL_BIN" ]] || [[ -f "$LOCAL_BIN" ]]; then
    rm -f "$LOCAL_BIN"
fi

ln -s "$NEXUS_BIN" "$LOCAL_BIN"
echo -e "${GREEN}✅ Created nexus-memory command link${NC}"

# Initialize the system
echo -e "${YELLOW}🔧 Initializing memory system...${NC}"
node "$NEXUS_BIN" init --memory-only

# Setup SystemD service (optional)
if [[ "$SYSTEMD_AVAILABLE" == true ]]; then
    echo ""
    echo -e "${YELLOW}⚙️  SystemD Service Setup${NC}"
    echo "Do you want to install the SystemD service for 24/7 file monitoring? (y/N)"
    read -r INSTALL_SERVICE
    
    if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}📋 Installing SystemD service...${NC}"
        
        # Prepare service file
        SERVICE_FILE="/tmp/nexus-watcher-$(whoami).service"
        cp "$INSTALL_DIR/nexusai/services/nexus-watcher.service" "$SERVICE_FILE"
        
        # Replace placeholders
        sed -i "s|%USER%|$(whoami)|g" "$SERVICE_FILE"
        sed -i "s|%GROUP%|$(id -gn)|g" "$SERVICE_FILE"
        sed -i "s|%PROJECT_ROOT%|$PROJECT_ROOT|g" "$SERVICE_FILE"
        sed -i "s|%NODE_PATH%|$(which node)|g" "$SERVICE_FILE"
        sed -i "s|%NEXUS_ROOT%|$INSTALL_DIR|g" "$SERVICE_FILE"
        
        # Install service
        sudo cp "$SERVICE_FILE" "/etc/systemd/system/nexus-watcher-$(whoami).service"
        sudo systemctl daemon-reload
        sudo systemctl enable "nexus-watcher-$(whoami).service"
        
        # Start service
        echo -e "${YELLOW}🚀 Starting Nexus AI daemon...${NC}"
        sudo systemctl start "nexus-watcher-$(whoami).service"
        
        # Check status
        if sudo systemctl is-active --quiet "nexus-watcher-$(whoami).service"; then
            echo -e "${GREEN}✅ SystemD service installed and started successfully${NC}"
        else
            echo -e "${RED}❌ SystemD service failed to start${NC}"
            echo "Check logs with: sudo journalctl -u nexus-watcher-$(whoami).service"
        fi
        
        # Cleanup
        rm -f "$SERVICE_FILE"
    else
        echo -e "${YELLOW}⏭️  Skipping SystemD service installation${NC}"
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
echo "   ./nexus-memory status"
echo ""
echo "2. View change timeline:"
echo "   ./nexus-memory timeline"
echo ""
echo "3. Start daemon manually (if not using SystemD):"
echo "   ./nexus-memory daemon start --background"
echo ""
echo "4. Generate context for Claude:"
echo "   ./nexus-memory memory context"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "   Full documentation: $INSTALL_DIR/README.md"
echo "   CLI reference: ./nexus-memory --help"
echo "   GitHub: $REPO_URL"
echo ""
echo -e "${BLUE}🛠️  System Files:${NC}"
echo "   Installation: $INSTALL_DIR"
echo "   Project data: $PROJECT_ROOT/.nexus/"
echo "   Master context: $PROJECT_ROOT/CLAUDE.md"
echo ""

if [[ "$SYSTEMD_AVAILABLE" == true ]] && [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔧 Service Management:${NC}"
    echo "   Check status: sudo systemctl status nexus-watcher-$(whoami)"
    echo "   View logs: sudo journalctl -u nexus-watcher-$(whoami) -f"
    echo "   Stop service: sudo systemctl stop nexus-watcher-$(whoami)"
    echo "   Start service: sudo systemctl start nexus-watcher-$(whoami)"
    echo ""
fi

echo -e "${GREEN}🧠 Nexus AI is now protecting your project context!${NC}"
echo -e "${GREEN}Never lose context again! 🚀${NC}"