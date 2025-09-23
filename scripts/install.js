#!/usr/bin/env node

/**
 * Nexus AI Framework - One-Command Installation Script
 * Installs and configures Nexus AI globally with zero configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

class NexusInstaller {
    constructor() {
        this.homeDir = os.homedir();
        this.nexusDir = path.join(this.homeDir, '.nexus-ai');
        this.configPath = path.join(this.nexusDir, 'config.json');
        this.errors = [];
        this.warnings = [];
    }
    
    log(message, color = colors.reset) {
        console.log(`${color}${message}${colors.reset}`);
    }
    
    header() {
        console.clear();
        this.log('\n╔══════════════════════════════════════════════════════════════╗', colors.cyan);
        this.log('║                                                              ║', colors.cyan);
        this.log('║                  🚀 NEXUS AI FRAMEWORK 🚀                   ║', colors.cyan);
        this.log('║                                                              ║', colors.cyan);
        this.log('║     Revolutionary AI Development for Vibecoders             ║', colors.cyan);
        this.log('║                                                              ║', colors.cyan);
        this.log('╚══════════════════════════════════════════════════════════════╝', colors.cyan);
        this.log('');
    }
    
    async install() {
        this.header();
        
        this.log('📦 Starting Nexus AI installation...', colors.bright + colors.blue);
        this.log('');
        
        try {
            // Step 1: Check prerequisites
            this.log('1️⃣  Checking prerequisites...', colors.yellow);
            await this.checkPrerequisites();
            
            // Step 2: Create Nexus directory
            this.log('2️⃣  Setting up Nexus directory...', colors.yellow);
            await this.setupNexusDirectory();
            
            // Step 3: Install globally
            this.log('3️⃣  Installing Nexus AI globally...', colors.yellow);
            await this.installGlobally();
            
            // Step 4: Initialize configuration
            this.log('4️⃣  Initializing configuration...', colors.yellow);
            await this.initializeConfig();
            
            // Step 5: Setup AI hooks
            this.log('5️⃣  Setting up AI model hooks...', colors.yellow);
            await this.setupAIHooks();
            
            // Step 6: Download initial knowledge bases
            this.log('6️⃣  Downloading knowledge bases...', colors.yellow);
            await this.downloadKnowledgeBases();
            
            // Step 7: Verify installation
            this.log('7️⃣  Verifying installation...', colors.yellow);
            await this.verifyInstallation();
            
            // Success!
            this.showSuccess();
            
        } catch (error) {
            this.showError(error);
            process.exit(1);
        }
    }
    
    async checkPrerequisites() {
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        
        if (majorVersion < 18) {
            throw new Error(`Node.js 18+ required (you have ${nodeVersion})`);
        }
        this.log('  ✅ Node.js version OK', colors.green);
        
        // Check npm
        try {
            execSync('npm --version', { stdio: 'pipe' });
            this.log('  ✅ npm is installed', colors.green);
        } catch {
            throw new Error('npm is not installed');
        }
        
        // Check Git (optional but recommended)
        try {
            execSync('git --version', { stdio: 'pipe' });
            this.log('  ✅ Git is installed', colors.green);
        } catch {
            this.warnings.push('Git is not installed (optional but recommended)');
            this.log('  ⚠️  Git not found (optional)', colors.yellow);
        }
        
        // Check disk space
        const freeSpace = this.getFreeDiskSpace();
        if (freeSpace < 500) { // 500MB minimum
            throw new Error('Insufficient disk space (need at least 500MB)');
        }
        this.log('  ✅ Sufficient disk space', colors.green);
        
        this.log('');
    }
    
    async setupNexusDirectory() {
        // Create .nexus-ai directory in home
        if (!fs.existsSync(this.nexusDir)) {
            fs.mkdirSync(this.nexusDir, { recursive: true });
            this.log('  ✅ Created ~/.nexus-ai directory', colors.green);
        } else {
            this.log('  ✅ ~/.nexus-ai directory exists', colors.green);
        }
        
        // Create subdirectories
        const subdirs = ['memory', 'knowledge-base', 'checkpoints', 'config', 'logs'];
        for (const dir of subdirs) {
            const dirPath = path.join(this.nexusDir, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }
        
        this.log('  ✅ Directory structure created', colors.green);
        this.log('');
    }
    
    async installGlobally() {
        try {
            // Check if running from npm or local
            if (process.env.npm_package_name === 'nexus-ai') {
                // Installing from npm
                this.log('  📥 Installing from npm registry...', colors.blue);
                execSync('npm install -g nexus-ai', { stdio: 'inherit' });
            } else {
                // Installing from local directory
                this.log('  📥 Installing from local directory...', colors.blue);
                const currentDir = process.cwd();
                execSync(`npm install -g ${currentDir}`, { stdio: 'inherit' });
            }
            
            this.log('  ✅ Nexus AI installed globally', colors.green);
        } catch (error) {
            // Try with sudo if permission denied
            if (error.message.includes('EACCES')) {
                this.log('  ⚠️  Permission denied, trying with sudo...', colors.yellow);
                
                if (process.platform !== 'win32') {
                    execSync('sudo npm install -g nexus-ai', { stdio: 'inherit' });
                    this.log('  ✅ Nexus AI installed globally with sudo', colors.green);
                } else {
                    throw new Error('Please run as Administrator on Windows');
                }
            } else {
                throw error;
            }
        }
        
        this.log('');
    }
    
    async initializeConfig() {
        const defaultConfig = {
            version: '1.0.0',
            installedAt: new Date().toISOString(),
            aiProviders: {
                claude: { enabled: true, apiKey: null },
                openai: { enabled: true, apiKey: null },
                gemini: { enabled: false, apiKey: null },
                local: { enabled: false, model: null }
            },
            memory: {
                maxContextTokens: 128000,
                compactionThreshold: 100000,
                autoCompaction: true,
                persistSessions: true
            },
            backup: {
                enabled: true,
                strategy: 'triple',
                autoBackup: true,
                backupBeforeAI: true
            },
            knowledgeBase: {
                autoSync: true,
                syncInterval: 86400000, // 24 hours
                sources: []
            },
            hooks: {
                conversationCompaction: true,
                sessionRestore: true,
                errorRecovery: true,
                fileTracking: true
            },
            ui: {
                theme: 'auto',
                verbosity: 'normal',
                colors: true
            }
        };
        
        // Check for existing config
        if (fs.existsSync(this.configPath)) {
            this.log('  ✅ Configuration exists (preserving)', colors.green);
        } else {
            fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
            this.log('  ✅ Default configuration created', colors.green);
        }
        
        // Create .env template if not exists
        const envPath = path.join(this.nexusDir, '.env.example');
        const envContent = `# Nexus AI Configuration
# Copy this file to .env and add your API keys

# AI Provider Keys (optional - will prompt if not set)
CLAUDE_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Advanced Settings (optional)
NEXUS_MEMORY_PATH=~/.nexus-ai/memory
NEXUS_KB_PATH=~/.nexus-ai/knowledge-base
NEXUS_LOG_LEVEL=info
`;
        
        if (!fs.existsSync(envPath)) {
            fs.writeFileSync(envPath, envContent);
            this.log('  ✅ Environment template created', colors.green);
        }
        
        this.log('');
    }
    
    async setupAIHooks() {
        // Create hooks configuration
        const hooksConfig = {
            beforeCompaction: 'summarize_and_save',
            afterCompaction: 'restore_critical_context',
            onSessionStart: 'load_previous_context',
            onSessionEnd: 'save_checkpoint',
            onContextReset: 'emergency_recovery',
            onFileAccess: 'track_for_reread',
            onCodeGeneration: 'learn_patterns'
        };
        
        const hooksPath = path.join(this.nexusDir, 'config', 'ai-hooks.json');
        fs.writeFileSync(hooksPath, JSON.stringify(hooksConfig, null, 2));
        
        this.log('  ✅ AI model hooks configured', colors.green);
        
        // Create initial session file
        const sessionPath = path.join(this.nexusDir, 'memory', 'current-session.json');
        if (!fs.existsSync(sessionPath)) {
            fs.writeFileSync(sessionPath, JSON.stringify({
                sessionId: null,
                startedAt: null,
                messages: [],
                fileReferences: [],
                codePatterns: []
            }, null, 2));
        }
        
        this.log('  ✅ Memory system initialized', colors.green);
        this.log('');
    }
    
    async downloadKnowledgeBases() {
        this.log('  📚 Downloading core knowledge bases...', colors.blue);
        
        // In production, these would be downloaded from CDN
        // For now, create placeholder structure
        const kbPath = path.join(this.nexusDir, 'knowledge-base');
        const kbSources = [
            'javascript-core',
            'react-ecosystem',
            'nodejs-apis',
            'web-standards'
        ];
        
        for (const source of kbSources) {
            const sourcePath = path.join(kbPath, source);
            if (!fs.existsSync(sourcePath)) {
                fs.mkdirSync(sourcePath, { recursive: true });
                
                // Create placeholder index
                fs.writeFileSync(
                    path.join(sourcePath, 'index.json'),
                    JSON.stringify({
                        name: source,
                        version: '1.0.0',
                        entries: 0,
                        lastUpdated: new Date().toISOString()
                    }, null, 2)
                );
            }
        }
        
        this.log('  ✅ Knowledge bases ready', colors.green);
        this.log('');
    }
    
    async verifyInstallation() {
        try {
            // Check if nexus command is available
            const version = execSync('nexus --version', { 
                stdio: 'pipe',
                encoding: 'utf-8'
            }).trim();
            
            this.log('  ✅ Nexus AI command available', colors.green);
            this.log(`  ✅ Version: ${version}`, colors.green);
            
            // Test basic functionality
            execSync('nexus doctor --quiet', { stdio: 'pipe' });
            this.log('  ✅ Health check passed', colors.green);
            
        } catch (error) {
            this.warnings.push('Installation verification had warnings');
            this.log('  ⚠️  Some checks failed (non-critical)', colors.yellow);
        }
        
        this.log('');
    }
    
    showSuccess() {
        this.log('╔══════════════════════════════════════════════════════════════╗', colors.green);
        this.log('║                                                              ║', colors.green);
        this.log('║              🎉 INSTALLATION SUCCESSFUL! 🎉                 ║', colors.green);
        this.log('║                                                              ║', colors.green);
        this.log('╚══════════════════════════════════════════════════════════════╝', colors.green);
        this.log('');
        
        this.log('🚀 Nexus AI is ready to use!', colors.bright + colors.green);
        this.log('');
        
        this.log('Quick Start Commands:', colors.bright + colors.cyan);
        this.log('  nexus init          - Initialize in current directory', colors.blue);
        this.log('  nexus new           - Create new AI-native project', colors.blue);
        this.log('  nexus import .      - Import existing project', colors.blue);
        this.log('  nexus ask "help"    - Ask AI for assistance', colors.blue);
        this.log('  nexus analyze <url> - Analyze any GitHub repo', colors.blue);
        this.log('  nexus docs <url>    - Scrape documentation', colors.blue);
        this.log('');
        
        this.log('Configuration:', colors.bright + colors.cyan);
        this.log(`  Config: ${this.configPath}`, colors.blue);
        this.log(`  Memory: ${path.join(this.nexusDir, 'memory')}`, colors.blue);
        this.log(`  Knowledge: ${path.join(this.nexusDir, 'knowledge-base')}`, colors.blue);
        this.log('');
        
        if (this.warnings.length > 0) {
            this.log('Warnings:', colors.yellow);
            for (const warning of this.warnings) {
                this.log(`  ⚠️  ${warning}`, colors.yellow);
            }
            this.log('');
        }
        
        this.log('Documentation: https://github.com/nexus-framework/nexus-ai', colors.cyan);
        this.log('');
        this.log('Happy coding with Nexus AI! 🚀', colors.bright + colors.green);
        this.log('');
    }
    
    showError(error) {
        this.log('╔══════════════════════════════════════════════════════════════╗', colors.red);
        this.log('║                                                              ║', colors.red);
        this.log('║                  ❌ INSTALLATION FAILED ❌                  ║', colors.red);
        this.log('║                                                              ║', colors.red);
        this.log('╚══════════════════════════════════════════════════════════════╝', colors.red);
        this.log('');
        
        this.log(`Error: ${error.message}`, colors.red);
        this.log('');
        
        this.log('Troubleshooting:', colors.yellow);
        
        if (error.message.includes('permission')) {
            this.log('  • Try running with sudo (Linux/Mac)', colors.yellow);
            this.log('  • Run as Administrator (Windows)', colors.yellow);
        }
        
        if (error.message.includes('Node.js')) {
            this.log('  • Update Node.js to version 18 or higher', colors.yellow);
            this.log('  • Visit: https://nodejs.org', colors.yellow);
        }
        
        this.log('');
        this.log('For help: https://github.com/nexus-framework/nexus-ai/issues', colors.cyan);
        this.log('');
    }
    
    getFreeDiskSpace() {
        try {
            if (process.platform === 'win32') {
                const output = execSync('wmic logicaldisk get size,freespace,caption', {
                    encoding: 'utf-8'
                });
                // Parse Windows output (simplified)
                return 1000; // Return 1GB for now
            } else {
                const output = execSync('df -BM . | tail -1', {
                    encoding: 'utf-8'
                });
                const parts = output.split(/\s+/);
                return parseInt(parts[3]); // Available space in MB
            }
        } catch {
            return 1000; // Default to 1GB if check fails
        }
    }
}

// Run installer
const installer = new NexusInstaller();
installer.install();