#!/usr/bin/env node

/**
 * Enhanced Nexus AI Framework CLI
 * User-friendly interface inspired by SpecKit and SuperClaude
 * Provides interactive menus, shortcuts, and enhanced discoverability
 */

const { Command } = require('commander');
const inquirer = require('inquirer');
const { CLI } = require('./nexus-cli');
const { NexusFramework } = require('../index');

// Simple color helper
const colors = {
    cyan: (str) => `\x1b[36m${str}\x1b[0m`,
    green: (str) => `\x1b[32m${str}\x1b[0m`,
    yellow: (str) => `\x1b[33m${str}\x1b[0m`,
    blue: (str) => `\x1b[34m${str}\x1b[0m`,
    red: (str) => `\x1b[31m${str}\x1b[0m`,
    magenta: (str) => `\x1b[35m${str}\x1b[0m`,
    bold: (str) => `\x1b[1m${str}\x1b[0m`,
    dim: (str) => `\x1b[2m${str}\x1b[0m`
};

class EnhancedCLI {
    constructor() {
        this.program = new Command();
        this.nexus = new NexusFramework();
        this.cli = new CLI(this.nexus);
        
        this.setupProgram();
        this.addEnhancedCommands();
        this.addQuickActions();
        this.addAliases();
    }
    
    setupProgram() {
        this.program
            .name('nexus')
            .description(colors.cyan('🚀 Nexus AI Framework - Universal AI Development Platform'))
            .version(require('../package.json').version, '-v, --version', 'Display version number')
            .option('-d, --debug', 'Enable debug mode')
            .option('-q, --quiet', 'Suppress non-essential output')
            .option('--no-banner', 'Disable ASCII banner display')
            .configureHelp({
                sortSubcommands: true,
                subcommandTerm: (cmd) => colors.cyan(cmd.name()) + colors.dim(' ' + cmd.usage())
            });
    }
    
    addEnhancedCommands() {
        // Enhanced init command with smart defaults
        this.program
            .command('init [project-name]')
            .description('🚀 Create AI-native project with autonomous research and planning')
            .option('-i, --interactive', 'Interactive project creation (default)', true)
            .option('-q, --quick', 'Quick setup with smart defaults')
            .option('-t, --template <template>', 'Project template (react, vue, node, python, solana)')
            .option('--ecosystem <ecosystem>', 'Target ecosystem (web3, ai, fullstack, defi)')
            .option('--ai-models <models>', 'AI models: claude, gpt4, gemini, grok')
            .action(async (projectName, options) => {
                await this.handleEnhancedInit(projectName, options);
            });
        
        // Smart continue command
        this.program
            .command('continue')
            .aliases(['c', 'resume'])
            .description('🔄 Continue working with full AI context memory')
            .option('-s, --session <id>', 'Resume specific session')
            .option('--list', 'List available sessions')
            .action(async (options) => {
                await this.handleSmartContinue(options);
            });
        
        // Enhanced ask command with context awareness
        this.program
            .command('ask <question>')
            .aliases(['q', 'query'])
            .description('🤔 Ask AI with full project context and knowledge base')
            .option('-m, --model <model>', 'AI model: claude, gpt4, gemini, grok')
            .option('-c, --context', 'Include full project context', true)
            .option('--kb <knowledge-base>', 'Query specific knowledge base')
            .action(async (question, options) => {
                await this.handleContextualAsk(question, options);
            });
        
        // Smart build command
        this.program
            .command('build [target]')
            .aliases(['b', 'make'])
            .description('🔨 Build project with AI assistance and quality gates')
            .option('-f, --feature <feature>', 'Build specific feature')
            .option('-t, --tests', 'Include test generation')
            .option('-d, --docs', 'Generate documentation')
            .option('--fix', 'Auto-fix issues found during build')
            .action(async (target, options) => {
                await this.handleSmartBuild(target, options);
            });
        
        // Project import with enhanced safety
        this.program
            .command('import [project-path]')
            .aliases(['import-project', 'adopt'])
            .description('🚀 Import existing project into Nexus Framework (BULLETPROOF)')
            .option('--analyze-first', 'Analyze project before importing')
            .option('--backup', 'Create comprehensive backup first', true)
            .option('--no-hooks', 'Skip installing framework hooks')
            .action(async (projectPath, options) => {
                await this.handleSafeImport(projectPath, options);
            });
        
        // Project analysis
        this.program
            .command('analyze [project-path]')
            .aliases(['analyse', 'scan'])
            .description('📊 Analyze project structure and generate comprehensive docs')
            .option('--detailed', 'Generate detailed analysis report')
            .option('--update-docs', 'Update existing documentation')
            .action(async (projectPath, options) => {
                await this.handleProjectAnalysis(projectPath, options);
            });
        
        // Knowledge base commands with shortcuts
        const kbCommand = this.program
            .command('kb')
            .aliases(['knowledge', 'docs'])
            .description('📚 Knowledge base management and queries');
        
        kbCommand
            .command('sync [ecosystem]')
            .description('🔄 Sync knowledge base with latest documentation')
            .option('--all', 'Sync all ecosystems')
            .option('--force', 'Force complete resync')
            .action(async (ecosystem, options) => {
                await this.handleKBSync(ecosystem, options);
            });
        
        kbCommand
            .command('search <query>')
            .aliases(['find', 'lookup'])
            .description('🔍 Search knowledge base')
            .option('-e, --ecosystem <ecosystem>', 'Search specific ecosystem')
            .action(async (query, options) => {
                await this.handleKBSearch(query, options);
            });
        
        // Memory/session management
        const memoryCommand = this.program
            .command('memory')
            .aliases(['session', 'checkpoint'])
            .description('🧠 Memory and session management');
        
        memoryCommand
            .command('save [name]')
            .description('💾 Create memory checkpoint')
            .option('--auto-name', 'Auto-generate checkpoint name')
            .action(async (name, options) => {
                await this.handleMemorySave(name, options);
            });
        
        memoryCommand
            .command('list')
            .aliases(['ls'])
            .description('📋 List available checkpoints')
            .action(async () => {
                await this.cli.executeCommand('memory-list', {});
            });
        
        // Quick status
        this.program
            .command('status')
            .aliases(['info', 'st'])
            .description('📊 Show framework and project status')
            .option('--detailed', 'Show detailed information')
            .option('--json', 'Output as JSON')
            .action(async (options) => {
                await this.cli.executeCommand('status', options);
            });
        
        // Setup command
        this.program
            .command('setup')
            .description('🛠️ Setup and configure Nexus AI Framework')
            .option('--quick', 'Quick setup with defaults')
            .option('--advanced', 'Advanced configuration')
            .action(async (options) => {
                await this.handleSetup(options);
            });
    }
    
    addQuickActions() {
        // Interactive command menu
        this.program
            .command('menu')
            .aliases(['interactive', 'i'])
            .description('📋 Interactive command menu')
            .action(async () => {
                await this.showInteractiveMenu();
            });
        
        // Quick project health check
        this.program
            .command('doctor')
            .aliases(['health', 'check'])
            .description('🩺 Diagnose project and framework health')
            .option('--fix', 'Automatically fix issues')
            .action(async (options) => {
                await this.cli.executeCommand('doctor', options);
            });
        
        // Quick help
        this.program
            .command('guide')
            .aliases(['tutorial', 'help-me'])
            .description('📖 Show getting started guide')
            .action(async () => {
                await this.showGettingStartedGuide();
            });
        
        // Quick examples
        this.program
            .command('examples')
            .aliases(['demo', 'samples'])
            .description('💡 Show common usage examples')
            .action(async () => {
                await this.showExamples();
            });
    }
    
    addAliases() {
        // Add some convenient aliases as separate commands
        this.program
            .command('new')
            .description('🆕 Alias for: nexus init (create new project)')
            .action(async () => {
                await this.handleEnhancedInit(null, { interactive: true });
            });
        
        this.program
            .command('start')
            .description('▶️ Alias for: nexus continue (resume work)')
            .action(async () => {
                await this.handleSmartContinue({});
            });
        
        this.program
            .command('sync')
            .description('🔄 Alias for: nexus kb sync --all')
            .action(async () => {
                await this.handleKBSync(null, { all: true });
            });
    }
    
    // Enhanced command handlers
    async handleEnhancedInit(projectName, options) {
        if (options.quick) {
            console.log(colors.cyan('🚀 Quick Project Setup...'));
            await this.cli.executeCommand('init', { 
                projectName, 
                skipQuestions: true, 
                research: true,
                interactive: false
            });
        } else {
            console.log(colors.cyan('🎯 Enhanced Project Creation...'));
            await this.cli.executeCommand('init', { projectName, ...options });
        }
    }
    
    async handleSmartContinue(options) {
        if (options.list) {
            console.log(colors.yellow('📋 Available Sessions:'));
            await this.cli.executeCommand('memory-list', {});
            return;
        }
        
        console.log(colors.green('🔄 Resuming with full AI context...'));
        await this.cli.executeCommand('continue', options);
    }
    
    async handleContextualAsk(question, options) {
        console.log(colors.blue(`🤔 Asking with full context: "${question}"`));
        await this.cli.executeCommand('ask', { question, ...options });
    }
    
    async handleSmartBuild(target, options) {
        console.log(colors.magenta('🔨 Smart Build with AI Assistance...'));
        await this.cli.executeCommand('build', { target, ...options });
    }
    
    async handleSafeImport(projectPath, options) {
        if (options.analyzeFirst) {
            console.log(colors.yellow('📊 Analyzing project before import...'));
            await this.cli.executeCommand('analyze-project', { 
                projectPath: projectPath || process.cwd() 
            });
        }
        
        console.log(colors.green('🚀 Safe Project Import with Bulletproof Protection...'));
        await this.cli.executeCommand('import-project', { 
            projectPath: projectPath || process.cwd(), 
            ...options 
        });
    }
    
    async handleProjectAnalysis(projectPath, options) {
        console.log(colors.blue('📊 Comprehensive Project Analysis...'));
        await this.cli.executeCommand('analyze-project', { 
            projectPath: projectPath || process.cwd(), 
            ...options 
        });
    }
    
    async handleKBSync(ecosystem, options) {
        if (options.all) {
            console.log(colors.cyan('🔄 Syncing all knowledge bases...'));
            await this.cli.executeCommand('kb-sync', { ecosystems: ['solana', 'ethereum', 'ai-ml'] });
        } else {
            console.log(colors.cyan(`🔄 Syncing ${ecosystem || 'selected'} knowledge base...`));
            await this.cli.executeCommand('kb-sync', { ecosystem, ...options });
        }
    }
    
    async handleKBSearch(query, options) {
        console.log(colors.blue(`🔍 Searching knowledge base: "${query}"`));
        await this.cli.executeCommand('kb-query', { question: query, ...options });
    }
    
    async handleMemorySave(name, options) {
        if (options.autoName) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            name = `checkpoint_${timestamp}`;
        }
        
        console.log(colors.green(`💾 Creating memory checkpoint: ${name || 'auto-generated'}...`));
        await this.cli.executeCommand('memory-save', { name, ...options });
    }
    
    async handleSetup(options) {
        console.log(colors.cyan('🛠️ Setting up Nexus AI Framework...'));
        await this.cli.executeCommand('setup', options);
    }
    
    async showInteractiveMenu() {
        console.log(colors.bold(colors.cyan('\\n🚀 Nexus AI Framework - Interactive Menu\\n')));
        
        const choices = [
            { name: '🆕 Create new AI-native project', value: 'init' },
            { name: '🔄 Continue existing project', value: 'continue' },
            { name: '🚀 Import existing project', value: 'import' },
            { name: '📊 Analyze project structure', value: 'analyze' },
            { name: '🤔 Ask AI assistant', value: 'ask' },
            { name: '🔨 Build project', value: 'build' },
            { name: '📚 Sync knowledge base', value: 'kb-sync' },
            { name: '🔍 Search knowledge base', value: 'kb-search' },
            { name: '💾 Save memory checkpoint', value: 'memory-save' },
            { name: '📋 Show project status', value: 'status' },
            { name: '🩺 Run health check', value: 'doctor' },
            { name: '🛠️ Setup framework', value: 'setup' },
            { name: '📖 Show examples', value: 'examples' },
            { name: '❌ Exit', value: 'exit' }
        ];
        
        try {
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'command',
                    message: 'What would you like to do?',
                    choices,
                    pageSize: 15
                }
            ]);
            
            await this.executeMenuChoice(answer.command);
        } catch (error) {
            console.log(colors.yellow('\\n👋 Goodbye!'));
        }
    }
    
    async executeMenuChoice(choice) {
        switch (choice) {
            case 'init':
                await this.handleEnhancedInit(null, { interactive: true });
                break;
            case 'continue':
                await this.handleSmartContinue({});
                break;
            case 'import':
                await this.handleSafeImport(null, { analyzeFirst: true });
                break;
            case 'analyze':
                await this.handleProjectAnalysis(null, { detailed: true });
                break;
            case 'ask':
                const askAnswer = await inquirer.prompt([
                    { type: 'input', name: 'question', message: 'What would you like to ask?' }
                ]);
                await this.handleContextualAsk(askAnswer.question, { context: true });
                break;
            case 'build':
                await this.handleSmartBuild(null, { tests: true, docs: true });
                break;
            case 'kb-sync':
                await this.handleKBSync(null, { all: true });
                break;
            case 'kb-search':
                const searchAnswer = await inquirer.prompt([
                    { type: 'input', name: 'query', message: 'What would you like to search for?' }
                ]);
                await this.handleKBSearch(searchAnswer.query, {});
                break;
            case 'memory-save':
                await this.handleMemorySave(null, { autoName: true });
                break;
            case 'status':
                await this.cli.executeCommand('status', { detailed: true });
                break;
            case 'doctor':
                await this.cli.executeCommand('doctor', { fix: true });
                break;
            case 'setup':
                await this.handleSetup({ advanced: true });
                break;
            case 'examples':
                await this.showExamples();
                break;
            case 'exit':
                console.log(colors.green('\\n👋 Happy coding with Nexus AI!'));
                process.exit(0);
                break;
        }
    }
    
    async showGettingStartedGuide() {
        console.log(colors.bold(colors.cyan('\\n📖 Nexus AI Framework - Getting Started Guide\\n')));
        
        const guide = `
${colors.yellow('🚀 Quick Start:')}
  ${colors.green('nexus init')}           Create new AI-native project
  ${colors.green('nexus import')}         Import existing project  
  ${colors.green('nexus continue')}       Resume work with full context
  ${colors.green('nexus ask "question"')} Ask AI assistant

${colors.yellow('🔧 Project Management:')}
  ${colors.green('nexus status')}         Show project status
  ${colors.green('nexus analyze')}        Analyze project structure
  ${colors.green('nexus build')}          Build with AI assistance
  ${colors.green('nexus doctor')}         Health check and fixes

${colors.yellow('📚 Knowledge Base:')}
  ${colors.green('nexus kb sync')}        Sync all knowledge bases
  ${colors.green('nexus kb search')}      Search documentation
  ${colors.green('nexus sync')}           Quick sync shortcut

${colors.yellow('💾 Memory Management:')}
  ${colors.green('nexus memory save')}    Save checkpoint
  ${colors.green('nexus memory list')}    List checkpoints
  ${colors.green('nexus memory restore')} Restore from checkpoint

${colors.yellow('🎯 Quick Actions:')}
  ${colors.green('nexus menu')}           Interactive command menu
  ${colors.green('nexus new')}            Quick new project
  ${colors.green('nexus start')}          Quick resume
  ${colors.green('nexus examples')}       Show usage examples

${colors.yellow('🆘 Help:')}
  ${colors.green('nexus --help')}         Show all commands
  ${colors.green('nexus <command> --help')} Show command help
  ${colors.green('nexus guide')}          Show this guide
`;
        
        console.log(guide);
        
        console.log(colors.cyan('\\n💡 Pro Tips:'));
        console.log('  • Use tab completion for command discovery');
        console.log('  • All operations are automatically backed up');
        console.log('  • AI maintains full context across sessions');
        console.log('  • Knowledge bases prevent AI "retraining"');
        console.log('  • Hook system integrates seamlessly');
    }
    
    async showExamples() {
        console.log(colors.bold(colors.cyan('\\n💡 Nexus AI Framework - Usage Examples\\n')));
        
        const examples = `
${colors.yellow('🚀 Creating Projects:')}
  ${colors.green('nexus init my-solana-dapp')}           Create Solana DApp
  ${colors.green('nexus init --template react')}        Create React app
  ${colors.green('nexus init --ecosystem web3')}        Create Web3 project
  ${colors.green('nexus init --quick')}                 Quick setup

${colors.yellow('🔄 Working with Existing Projects:')}
  ${colors.green('nexus import /path/to/project')}      Import existing project
  ${colors.green('nexus import --analyze-first')}       Analyze before import
  ${colors.green('nexus analyze --detailed')}           Detailed project analysis
  ${colors.green('nexus continue --session abc123')}    Resume specific session

${colors.yellow('🤔 AI Assistance:')}
  ${colors.green('nexus ask "How do I deploy to Vercel?"')}           General question
  ${colors.green('nexus ask "Optimize this React component"')}        Code help
  ${colors.green('nexus ask --model claude "Explain this error"')}    Specific model
  ${colors.green('nexus ask --kb solana "How to use Meteora?"')}      Knowledge base query

${colors.yellow('🔨 Building and Development:')}
  ${colors.green('nexus build --tests')}                Build with tests
  ${colors.green('nexus build --feature auth')}         Build specific feature
  ${colors.green('nexus build --fix')}                  Auto-fix issues
  ${colors.green('nexus doctor --fix')}                 Diagnose and fix

${colors.yellow('📚 Knowledge Management:')}
  ${colors.green('nexus kb sync solana')}               Sync Solana docs
  ${colors.green('nexus kb search "Jupiter swap"')}     Search knowledge base
  ${colors.green('nexus sync')}                         Quick sync all
  ${colors.green('nexus kb sync --force')}              Force resync

${colors.yellow('💾 Session Management:')}
  ${colors.green('nexus memory save "before-refactor"')}    Named checkpoint
  ${colors.green('nexus memory save --auto-name')}          Auto-named checkpoint
  ${colors.green('nexus memory list')}                      List checkpoints
  ${colors.green('nexus memory restore checkpoint-123')}    Restore checkpoint

${colors.yellow('🎯 Productivity Shortcuts:')}
  ${colors.green('nexus menu')}                         Interactive menu
  ${colors.green('nexus new')}                          Quick new project
  ${colors.green('nexus start')}                        Quick resume
  ${colors.green('nexus c')}                            Continue (alias)
  ${colors.green('nexus q "question"')}                 Quick ask (alias)
`;
        
        console.log(examples);
        
        console.log(colors.blue('\\n🔗 Workflow Examples:'));
        console.log(colors.dim('  1. New project:    nexus new → nexus ask "setup guide" → nexus build'));
        console.log(colors.dim('  2. Existing:       nexus import → nexus analyze → nexus continue'));
        console.log(colors.dim('  3. Development:    nexus continue → nexus ask → nexus build → nexus memory save'));
        console.log(colors.dim('  4. Learning:       nexus sync → nexus ask "best practices" → nexus examples'));
    }
    
    async run() {
        // Show banner unless disabled
        if (!process.argv.includes('--no-banner')) {
            this.showBanner();
        }
        
        // If no arguments provided, show interactive menu
        if (process.argv.length <= 2) {
            await this.showInteractiveMenu();
            return;
        }
        
        // Parse and execute commands
        this.program.parse();
    }
    
    showBanner() {
        const banner = `
${colors.cyan('╔══════════════════════════════════════════════════════════════╗')}
${colors.cyan('║')}                    ${colors.bold(colors.yellow('🚀 NEXUS AI FRAMEWORK'))}                    ${colors.cyan('║')}
${colors.cyan('║')}              ${colors.green('Universal AI Development Platform')}               ${colors.cyan('║')}
${colors.cyan('║')}                                                              ${colors.cyan('║')}
${colors.cyan('║')}  ${colors.blue('✨ Bulletproof Data Protection')}   ${colors.blue('🧠 Persistent Memory')}    ${colors.cyan('║')}
${colors.cyan('║')}  ${colors.blue('📚 Live Knowledge Bases')}          ${colors.blue('🤖 Multi-AI Support')}     ${colors.cyan('║')}
${colors.cyan('║')}  ${colors.blue('🔄 Context Awareness')}             ${colors.blue('⚡ Smart Analysis')}       ${colors.cyan('║')}
${colors.cyan('╚══════════════════════════════════════════════════════════════╝')}

${colors.yellow('💡 Quick commands:')} ${colors.green('nexus new')}, ${colors.green('nexus start')}, ${colors.green('nexus ask')}, ${colors.green('nexus menu')}
${colors.yellow('📖 Need help?')} ${colors.green('nexus guide')} or ${colors.green('nexus examples')}
`;
        console.log(banner);
    }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
    console.error(colors.red('\\n❌ Unexpected error:'), error.message);
    console.log(colors.yellow('💡 Try: nexus doctor --fix'));
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error(colors.red('\\n❌ Unhandled promise rejection:'), error.message);
    console.log(colors.yellow('💡 Try: nexus doctor --fix'));
    process.exit(1);
});

// Run the enhanced CLI
const enhancedCLI = new EnhancedCLI();
enhancedCLI.run().catch(error => {
    console.error(colors.red('CLI Error:'), error.message);
    process.exit(1);
});

module.exports = { EnhancedCLI };