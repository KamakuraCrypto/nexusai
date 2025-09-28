#!/bin/bash

# Nexus AI - Linux Installation Script
# https://github.com/KamakuraCrypto/nexusai

set -e

# Parse command line arguments
ALLOW_ROOT=false
for arg in "$@"; do
    case $arg in
        --allow-root)
            ALLOW_ROOT=true
            shift
            ;;
        *)
            # Unknown option
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/KamakuraCrypto/nexusai.git"

# Set installation directory based on user
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    INSTALL_DIR="/opt/nexusai"
else
    INSTALL_DIR="$HOME/nexusai"
fi

PROJECT_ROOT="$(pwd)"

echo -e "${BLUE}🧠 Nexus AI - Linux Installer${NC}"
echo -e "${BLUE}==========================================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    if [[ "$ALLOW_ROOT" != true ]]; then
        echo -e "${RED}❌ This script should not be run as root${NC}"
        echo "Please run as a regular user, or use --allow-root flag if you need system-wide installation."
        echo ""
        echo "Usage: $0 [--allow-root]"
        echo ""
        echo "Running as root is not recommended because:"
        echo "  • Files will be owned by root instead of your user"
        echo "  • SystemD service will be system-wide instead of user-specific"
        echo "  • May cause permission issues with project files"
        echo ""
        echo "Consider creating a regular user account for development work."
        exit 1
    else
        echo -e "${YELLOW}⚠️  WARNING: Running as root with --allow-root flag${NC}"
        echo -e "${YELLOW}   This will install Nexus AI system-wide to /opt/nexusai${NC}"
        echo -e "${YELLOW}   Files will be owned by root. Consider using a regular user instead.${NC}"
        echo ""
        sleep 3
    fi
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

# Create install directory with proper permissions if running as root
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    mkdir -p "$(dirname "$INSTALL_DIR")"
fi

if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${YELLOW}📁 Nexus AI directory exists, updating...${NC}"
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo -e "${YELLOW}📁 Cloning Nexus AI repository...${NC}"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Set proper permissions for root installation
    if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
        chmod -R 755 "$INSTALL_DIR"
        echo -e "${GREEN}✅ Set appropriate permissions for system-wide installation${NC}"
    fi
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

# Set symlink location based on user
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    # For root installation, create system-wide symlink
    LOCAL_BIN="/usr/local/bin/nclaude"
    if [[ -L "$LOCAL_BIN" ]] || [[ -f "$LOCAL_BIN" ]]; then
        rm -f "$LOCAL_BIN"
    fi
    ln -s "$NEXUS_BIN" "$LOCAL_BIN"
    chmod +x "$LOCAL_BIN"
    echo -e "${GREEN}✅ Created system-wide nclaude command at $LOCAL_BIN${NC}"
else
    # For user installation, create local symlink
    LOCAL_BIN="./nclaude"
    if [[ -L "$LOCAL_BIN" ]] || [[ -f "$LOCAL_BIN" ]]; then
        rm -f "$LOCAL_BIN"
    fi
    ln -s "$NEXUS_BIN" "$LOCAL_BIN"
    echo -e "${GREEN}✅ Created nclaude command link${NC}"
fi

# Initialize the system
echo -e "${YELLOW}🔧 Initializing memory system...${NC}"
node "$NEXUS_BIN" init --memory-only

# Setup SystemD service (optional)
if [[ "$SYSTEMD_AVAILABLE" == true ]]; then
    echo ""
    echo -e "${YELLOW}⚙️  SystemD Service Setup${NC}"
    
    # Different handling for root vs user installation
    if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
        echo -e "${YELLOW}⚠️  Root installation detected - SystemD service will be system-wide${NC}"
        echo "Do you want to install the system-wide SystemD service for 24/7 file monitoring? (y/N)"
        read -r INSTALL_SERVICE
        
        if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}📋 Installing system-wide SystemD service...${NC}"
            
            # Prepare service file for system-wide installation
            SERVICE_NAME="nexus-watcher-system"
            SERVICE_FILE="/tmp/$SERVICE_NAME.service"
            cp "$INSTALL_DIR/nexusai/services/nexus-watcher.service" "$SERVICE_FILE"
            
            # Replace placeholders for system service
            sed -i "s|%USER%|root|g" "$SERVICE_FILE"
            sed -i "s|%GROUP%|root|g" "$SERVICE_FILE"
            sed -i "s|%PROJECT_ROOT%|$PROJECT_ROOT|g" "$SERVICE_FILE"
            sed -i "s|%NODE_PATH%|$(which node)|g" "$SERVICE_FILE"
            sed -i "s|%NEXUS_ROOT%|$INSTALL_DIR|g" "$SERVICE_FILE"
            
            # Install service
            cp "$SERVICE_FILE" "/etc/systemd/system/$SERVICE_NAME.service"
            systemctl daemon-reload
            systemctl enable "$SERVICE_NAME.service"
            
            # Start service
            echo -e "${YELLOW}🚀 Starting Nexus AI daemon...${NC}"
            systemctl start "$SERVICE_NAME.service"
            
            # Check status
            if systemctl is-active --quiet "$SERVICE_NAME.service"; then
                echo -e "${GREEN}✅ System-wide SystemD service installed and started successfully${NC}"
                SYSTEMD_SERVICE_NAME="$SERVICE_NAME"
            else
                echo -e "${RED}❌ SystemD service failed to start${NC}"
                echo "Check logs with: journalctl -u $SERVICE_NAME.service"
            fi
            
            # Cleanup
            rm -f "$SERVICE_FILE"
        else
            echo -e "${YELLOW}⏭️  Skipping SystemD service installation${NC}"
            echo "You can start the daemon manually with:"
            echo "  node $NEXUS_BIN daemon start --background"
        fi
    else
        # Standard user installation
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
                SYSTEMD_SERVICE_NAME="nexus-watcher-$(whoami)"
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
fi

echo ""
echo -e "${GREEN}🎉 Installation Complete!${NC}"
echo -e "${GREEN}========================${NC}"
echo ""
echo -e "${BLUE}📚 Getting Started:${NC}"
echo ""
echo "1. Check system status:"
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    echo "   nclaude status  (system-wide installation)"
else
    echo "   ./nclaude status"
fi
echo ""
echo "2. View change timeline:"
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    echo "   nclaude timeline"
else
    echo "   ./nclaude timeline"
fi
echo ""
echo "3. Start daemon manually (if not using SystemD):"
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    echo "   nclaude daemon start --background"
else
    echo "   ./nclaude daemon start --background"
fi
echo ""
echo "4. Generate context for Claude:"
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    echo "   nclaude memory context"
else
    echo "   ./nclaude memory context"
fi
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "   Full documentation: $INSTALL_DIR/README.md"
if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
    echo "   CLI reference: nclaude --help"
else
    echo "   CLI reference: ./nclaude --help"
fi
echo "   GitHub: $REPO_URL"
echo ""
echo -e "${BLUE}🛠️  System Files:${NC}"
echo "   Installation: $INSTALL_DIR"
echo "   Project data: $PROJECT_ROOT/.nexus/"
echo "   Master context: $PROJECT_ROOT/CLAUDE.md"
echo ""

if [[ "$SYSTEMD_AVAILABLE" == true ]] && [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔧 Service Management:${NC}"
    if [[ $EUID -eq 0 ]] && [[ "$ALLOW_ROOT" == true ]]; then
        echo "   Check status: systemctl status $SYSTEMD_SERVICE_NAME"
        echo "   View logs: journalctl -u $SYSTEMD_SERVICE_NAME -f"
        echo "   Stop service: systemctl stop $SYSTEMD_SERVICE_NAME"
        echo "   Start service: systemctl start $SYSTEMD_SERVICE_NAME"
    else
        echo "   Check status: sudo systemctl status nexus-watcher-$(whoami)"
        echo "   View logs: sudo journalctl -u nexus-watcher-$(whoami) -f"
        echo "   Stop service: sudo systemctl stop nexus-watcher-$(whoami)"
        echo "   Start service: sudo systemctl start nexus-watcher-$(whoami)"
    fi
    echo ""
fi

echo -e "${GREEN}🧠 Nexus AI is now protecting your project context!${NC}"
echo -e "${GREEN}Never lose context again! 🚀${NC}"