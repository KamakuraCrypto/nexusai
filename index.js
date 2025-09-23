#!/usr/bin/env node

/**
 * Nexus AI Framework - Universal AI Development Platform
 * 
 * Main entry point for the framework that provides:
 * - Universal AI agent support (Claude, GPT, Gemini, Grok)
 * - Persistent memory across sessions
 * - Autonomous project creation and management
 * - Knowledge base integration
 * - Advanced git state tracking
 * 
 * @version 1.0.0-beta
 * @author Nexus AI Framework Team
 */

const { NexusAI } = require('./core/nexus-core');
const { Logger } = require('./utils/logger');
const { ConfigManager } = require('./config/config-manager');
const { MemorySystem } = require('./memory/memory-system');
const { KnowledgeBase } = require('./knowledge-base/knowledge-base');
const { GitIntegration } = require('./core/git-integration');

// ASCII Art Banner
const banner = `
┌─────────────────────────────────────────────────────────────────┐
│  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗     █████╗ ██╗     │
│  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝    ██╔══██╗██║     │
│  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗    ███████║██║     │
│  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║    ██╔══██║██║     │
│  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║    ██║  ██║██║     │
│  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚═╝     │
│                                                                 │
│         🚀 Universal AI Development Platform 🚀                │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                 │
│  • Universal AI Agent Support  • Persistent Memory System      │
│  • Autonomous Project Creation • Knowledge Base Integration    │
│  • Git State Tracking         • Enterprise-Ready Features     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
`;

class NexusFramework {
    constructor() {
        this.logger = new Logger('NexusFramework');
        this.config = new ConfigManager();
        this.memory = null;
        this.knowledgeBase = null;
        this.git = null;
        this.nexusAI = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            this.logger.info('🚀 Initializing Nexus AI Framework...');
            
            // Initialize configuration
            await this.config.load();
            this.logger.info('✅ Configuration loaded');

            // Initialize memory system
            this.memory = new MemorySystem(this.config.get('memory'));
            await this.memory.initialize();
            this.logger.info('✅ Memory system initialized');

            // Initialize knowledge base
            this.knowledgeBase = new KnowledgeBase(this.config.get('knowledgeBase'));
            await this.knowledgeBase.initialize();
            this.logger.info('✅ Knowledge base initialized');

            // Initialize git integration
            this.git = new GitIntegration(this.config.get('git'));
            await this.git.initialize();
            this.logger.info('✅ Git integration initialized');

            // Initialize core AI system
            this.nexusAI = new NexusAI({
                config: this.config,
                memory: this.memory,
                knowledgeBase: this.knowledgeBase,
                git: this.git
            });
            await this.nexusAI.initialize();
            this.logger.info('✅ Nexus AI core initialized');

            this.isInitialized = true;
            this.logger.info('🎉 Nexus AI Framework ready!');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Nexus AI Framework:', error);
            throw error;
        }
    }

    async showStatus() {
        if (!this.isInitialized) {
            console.log('❌ Nexus AI Framework not initialized. Run "nexus setup" first.');
            return;
        }

        const status = {
            framework: {
                version: require('./package.json').version,
                status: this.isInitialized ? 'Ready' : 'Not Initialized'
            },
            aiProviders: await this.nexusAI.getProviderStatus(),
            memory: await this.memory.getStatus(),
            knowledgeBase: await this.knowledgeBase.getStatus(),
            git: await this.git.getStatus()
        };

        console.log('\n📊 Nexus AI Framework Status');
        console.log('================================');
        console.log(`Framework Version: ${status.framework.version}`);
        console.log(`Status: ${status.framework.status}`);
        console.log(`\n🤖 AI Providers:`);
        Object.entries(status.aiProviders).forEach(([name, info]) => {
            console.log(`  • ${name}: ${info.status} ${info.available ? '✅' : '❌'}`);
        });
        console.log(`\n🧠 Memory System:`);
        console.log(`  • Context Size: ${status.memory.contextSize} tokens`);
        console.log(`  • Sessions: ${status.memory.sessions}`);
        console.log(`  • Vector Embeddings: ${status.memory.vectorCount}`);
        console.log(`\n📚 Knowledge Base:`);
        console.log(`  • Ecosystems: ${status.knowledgeBase.ecosystems.length}`);
        console.log(`  • Documents: ${status.knowledgeBase.documents}`);
        console.log(`  • Last Updated: ${status.knowledgeBase.lastUpdate}`);
        console.log(`\n📦 Git Integration:`);
        console.log(`  • Repository: ${status.git.repository || 'Not a git repo'}`);
        console.log(`  • Tracked Files: ${status.git.trackedFiles || 0}`);
        console.log(`  • State Snapshots: ${status.git.snapshots || 0}`);
    }

    displayBanner() {
        console.log(banner);
        console.log(`Version: ${require('./package.json').version}`);
        console.log('Documentation: https://docs.nexusai.dev');
        console.log('Community: https://discord.gg/nexusai\n');
    }

    async handleError(error) {
        this.logger.error('Nexus AI Framework Error:', error);
        
        // Try to save current state before exiting
        if (this.memory) {
            try {
                await this.memory.saveState();
                this.logger.info('Current state saved before exit');
            } catch (saveError) {
                this.logger.error('Failed to save state:', saveError);
            }
        }

        process.exit(1);
    }
}

// Main execution
async function main() {
    const nexus = new NexusFramework();
    
    // Handle uncaught errors gracefully
    process.on('uncaughtException', (error) => nexus.handleError(error));
    process.on('unhandledRejection', (error) => nexus.handleError(error));

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down Nexus AI Framework...');
        if (nexus.memory) {
            await nexus.memory.saveState();
            console.log('💾 State saved successfully');
        }
        console.log('✨ Goodbye!');
        process.exit(0);
    });

    try {
        // Check if this is a CLI command
        if (process.argv.length > 2) {
            const { CLI } = require('./bin/nexus-cli');
            const cli = new CLI(nexus);
            await cli.run(process.argv.slice(2));
            return;
        }

        // Interactive mode
        nexus.displayBanner();
        await nexus.initialize();
        await nexus.showStatus();
        
        // Keep the process alive for interactive use
        console.log('\n💡 Nexus AI Framework is running. Use "nexus --help" for commands.');
        console.log('Press Ctrl+C to exit.\n');
        
        // Start interactive session if no arguments provided
        const { InteractiveSession } = require('./core/interactive-session');
        const session = new InteractiveSession(nexus);
        await session.start();
        
    } catch (error) {
        await nexus.handleError(error);
    }
}

// Export for programmatic use
module.exports = { NexusFramework, NexusAI };

// Run if called directly
if (require.main === module) {
    main();
}