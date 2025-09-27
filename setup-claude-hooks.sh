#!/bin/bash
# Nexus AI Claude Code Hook Setup Script
# This script sets up the actual integration with Claude Code

set -e

echo ""
echo "🔗 Setting up Claude Code Hooks Integration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get the project directory (current directory or provided as argument)
PROJECT_DIR="${1:-$(pwd)}"
cd "$PROJECT_DIR"

echo "📂 Project directory: $PROJECT_DIR"

# Create .claude directory structure if it doesn't exist
mkdir -p .claude/hooks

# Copy hook scripts from Nexus AI installation
NEXUS_INSTALL_DIR="$HOME/.nexus-claude"
HOOKS_SOURCE_DIR="$NEXUS_INSTALL_DIR/.claude/hooks"

# First, ensure the hook scripts exist in the Nexus installation
if [ ! -d "$HOOKS_SOURCE_DIR" ]; then
    echo "⚠️  Creating hook templates in Nexus installation..."
    mkdir -p "$HOOKS_SOURCE_DIR"
    
    # Create the hook scripts in the Nexus installation directory
    cat > "$HOOKS_SOURCE_DIR/pre-compact.sh" << 'HOOK_EOF'
#!/bin/bash
# Nexus AI PreCompact Hook - Save context before compaction
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
NEXUS_DIR="${CLAUDE_PROJECT_DIR:-.}/.nexus"

if ! command -v nclaude &> /dev/null; then
    exit 0
fi

HOOK_INPUT=$(cat)
TOKEN_COUNT=$(echo "$HOOK_INPUT" | jq -r '.token_count // "unknown"' 2>/dev/null || echo "unknown")

nclaude save --name "auto-compact-$(date +%Y%m%d-%H%M%S)" \
             --description "Automatic save before context compaction at $TOKEN_COUNT tokens" \
             2>&1 | grep -E "saved|Checkpoint ID" >&2 || true
exit 0
HOOK_EOF

    cat > "$HOOKS_SOURCE_DIR/session-start.sh" << 'HOOK_EOF'
#!/bin/bash
# Nexus AI SessionStart Hook - Initialize session tracking
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
NEXUS_DIR="${CLAUDE_PROJECT_DIR:-.}/.nexus"

if ! command -v nclaude &> /dev/null; then
    exit 0
fi

if [ ! -f "$NEXUS_DIR/claude-config.json" ]; then
    nclaude init --force 2>&1 | grep -E "success|initialized" >&2 || true
fi

nclaude status 2>&1 | grep -E "Token|Session" >&2 || true
exit 0
HOOK_EOF

    cat > "$HOOKS_SOURCE_DIR/post-tool-use.sh" << 'HOOK_EOF'
#!/bin/bash
# Nexus AI PostToolUse Hook - Track file operations
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
NEXUS_DIR="${CLAUDE_PROJECT_DIR:-.}/.nexus"

if ! command -v nclaude &> /dev/null; then
    exit 0
fi

HOOK_INPUT=$(cat)
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

if [[ "$TOOL_NAME" == "Read" || "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
    FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_params.file_path // .tool_params.path // ""' 2>/dev/null || echo "")
    
    if [ -n "$FILE_PATH" ]; then
        TRACKING_FILE="$NEXUS_DIR/sessions/current_tracking.json"
        mkdir -p "$NEXUS_DIR/sessions"
        
        if [ -f "$TRACKING_FILE" ]; then
            jq ". + {\"$(date +%s)\": {tool: \"$TOOL_NAME\", file: \"$FILE_PATH\"}}" "$TRACKING_FILE" > "$TRACKING_FILE.tmp" && \
            mv "$TRACKING_FILE.tmp" "$TRACKING_FILE" 2>/dev/null || true
        else
            echo "{\"$(date +%s)\": {\"tool\": \"$TOOL_NAME\", \"file\": \"$FILE_PATH\"}}" > "$TRACKING_FILE"
        fi
    fi
fi
exit 0
HOOK_EOF

    cat > "$HOOKS_SOURCE_DIR/session-end.sh" << 'HOOK_EOF'
#!/bin/bash
# Nexus AI SessionEnd Hook - Save final session state
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"

if ! command -v nclaude &> /dev/null; then
    exit 0
fi

nclaude save --name "session-end-$(date +%Y%m%d-%H%M%S)" \
             --description "Final session save" \
             2>&1 | grep -E "saved|Checkpoint ID" >&2 || true
exit 0
HOOK_EOF

    chmod +x "$HOOKS_SOURCE_DIR"/*.sh
fi

# Copy hooks to project directory
echo "📋 Installing Claude Code hooks..."
cp -f "$HOOKS_SOURCE_DIR"/*.sh .claude/hooks/ 2>/dev/null || {
    # If source doesn't exist, create them directly
    echo "⚠️  Creating hooks directly in project..."
    
    # Use the embedded hooks from this script
    for hook in pre-compact session-start post-tool-use session-end; do
        if [ -f "/root/nexus/nexusai/.claude/hooks/${hook}.sh" ]; then
            cp "/root/nexus/nexusai/.claude/hooks/${hook}.sh" ".claude/hooks/${hook}.sh"
        fi
    done
}

# Make hooks executable
chmod +x .claude/hooks/*.sh 2>/dev/null || true

# Create or update Claude Code settings
SETTINGS_FILE=".claude/settings.local.json"
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "📝 Creating Claude Code settings..."
    cat > "$SETTINGS_FILE" << 'EOF'
{
  "permissions": {
    "allow": [
      "Bash(nclaude:*)",
      "Read(**/.nexus/**)",
      "Write(**/.nexus/**)"
    ]
  },
  "hooks": {
    "preCompact": ".claude/hooks/pre-compact.sh",
    "sessionStart": ".claude/hooks/session-start.sh",
    "sessionEnd": ".claude/hooks/session-end.sh",
    "postToolUse": ".claude/hooks/post-tool-use.sh"
  }
}
EOF
else
    echo "⚠️  Claude Code settings already exist. Please manually add hooks configuration if needed."
fi

# Initialize Nexus AI for this project
echo ""
echo "🚀 Initializing Nexus AI for this project..."
nclaude init

echo ""
echo "✅ Claude Code hooks integration complete!"
echo ""
echo "The following hooks are now active:"
echo "  • PreCompact: Automatically saves context before compaction"
echo "  • SessionStart: Initializes tracking when session starts"
echo "  • SessionEnd: Saves final state when session ends"
echo "  • PostToolUse: Tracks file operations and artifacts"
echo ""
echo "These hooks will run automatically during Claude Code usage."
echo "No manual intervention required!"
echo ""
echo "To verify installation, run: nclaude status"
echo ""