#!/bin/bash

# Nexus AI Claude Edition - One-Line Installer
# Usage: curl -sSL https://nexus-ai.dev/install | sh
# Or: ./install.sh

set -e

echo ""
echo "  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗"
echo "  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝"
echo "  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗"
echo "  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║"
echo "  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║"
echo "  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
echo ""
echo "  🤖 Claude Edition - Never Lose Work Again"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "   Please install Node.js from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    exit 1
fi

echo "✅ npm detected: $(npm --version)"
echo ""

# Get installation directory
INSTALL_DIR="$HOME/.nexus-claude"
echo "📦 Installing to: $INSTALL_DIR"

# Create directory
mkdir -p "$INSTALL_DIR"

# Copy files if running locally, or download if remote
if [ -f "package.json" ]; then
    echo "📂 Local installation detected..."
    cp -r . "$INSTALL_DIR/"
else
    echo "⬇️  Downloading Nexus Claude..."
    # In production, this would download from GitHub
    curl -sSL https://github.com/nexus-framework/nexus-ai-claude/archive/main.zip -o /tmp/nexus-claude.zip
    unzip -q /tmp/nexus-claude.zip -d /tmp/
    mv /tmp/nexus-ai-claude-main/* "$INSTALL_DIR/"
    rm -rf /tmp/nexus-claude.zip /tmp/nexus-ai-claude-main
fi

cd "$INSTALL_DIR"

echo "📦 Installing dependencies..."
npm install --quiet --no-fund --no-audit

echo "🔗 Creating global command..."
npm link --quiet

echo ""
echo "✨ Installation complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Quick Start:"
echo ""
echo "  nclaude init      # Initialize in current project"
echo "  nclaude status    # Check Claude context usage"
echo "  nclaude help      # Show all commands"
echo ""
echo "📚 Documentation: https://github.com/nexus-framework/nexus-ai-claude"
echo ""
echo "💡 Tip: Run 'nclaude init' in any project to protect your Claude sessions"
echo ""