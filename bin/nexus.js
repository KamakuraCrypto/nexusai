#!/usr/bin/env node

/**
 * Nexus AI Framework CLI
 * Command-line interface for the Universal AI Development Platform
 */

const { Command } = require('commander');
const { CLI } = require('./nexus-cli');
const { NexusFramework } = require('../index');

const program = new Command();
const nexus = new NexusFramework();

program
    .name('nexus')
    .description('Universal AI Development Platform')
    .version(require('../package.json').version, '-v, --version', 'Display version number')
    .option('-d, --debug', 'Enable debug mode')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--no-banner', 'Disable ASCII banner display');

// Initialize command
program
    .command('init [project-name]')
    .description('🚀 Create a new AI-native project with autonomous research and planning')
    .option('-i, --interactive', 'Enable interactive project creation mode', true)
    .option('-r, --research', 'Enable autonomous research mode', true)
    .option('-t, --template <template>', 'Use specific project template')
    .option('--ecosystem <ecosystem>', 'Target ecosystem (web3, ai, fullstack, defi)')
    .option('--ai-models <models>', 'Comma-separated list of AI models to use')
    .option('--skip-questions', 'Skip interactive questions (use defaults)')
    .action(async (projectName, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('init', { projectName, ...options });
    });

// Continue command
program
    .command('continue')
    .description('🔄 Continue working on existing project with full context memory')
    .option('-s, --session <id>', 'Resume specific session')
    .option('--restore <checkpoint>', 'Restore from specific checkpoint')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('continue', options);
    });

// Status command  
program
    .command('status')
    .description('📊 Show comprehensive framework and project status')
    .option('--detailed', 'Show detailed status information')
    .option('--json', 'Output status in JSON format')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('status', options);
    });

// Ask command
program
    .command('ask <question>')
    .description('🤔 Ask AI assistant with full knowledge base access')
    .option('-m, --model <model>', 'Specify AI model (claude, gpt, gemini, grok)')
    .option('-k, --knowledge-base <kb>', 'Query specific knowledge base')
    .option('--context', 'Include full project context in query')
    .action(async (question, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('ask', { question, ...options });
    });

// Build command
program
    .command('build [target]')
    .description('🔨 Build project with AI assistance and quality gates')
    .option('-f, --feature <feature>', 'Build specific feature')
    .option('-t, --tests', 'Include automated test generation')
    .option('-d, --docs', 'Generate documentation')
    .option('--security-scan', 'Run security analysis')
    .action(async (target, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('build', { target, ...options });
    });

// Knowledge Base commands
const kbCommand = program
    .command('kb')
    .description('📚 Knowledge base management');

kbCommand
    .command('sync [ecosystem]')
    .description('Synchronize knowledge base with external sources')
    .option('--ecosystems <ecosystems>', 'Comma-separated ecosystems to sync')
    .option('--protocols <protocols>', 'Specific protocols to analyze')
    .option('--force', 'Force full resynchronization')
    .action(async (ecosystem, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('kb-sync', { ecosystem, ...options });
    });

kbCommand
    .command('query <question>')
    .description('Query knowledge base directly')
    .option('-e, --ecosystem <ecosystem>', 'Search specific ecosystem')
    .option('--similarity <threshold>', 'Similarity threshold (0-1)', '0.8')
    .action(async (question, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('kb-query', { question, ...options });
    });

kbCommand
    .command('list')
    .description('List available knowledge bases')
    .option('--detailed', 'Show detailed information')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('kb-list', options);
    });

// Memory commands
const memoryCommand = program
    .command('memory')
    .description('🧠 Memory system management');

memoryCommand
    .command('save [name]')
    .description('Create memory checkpoint')
    .option('--description <desc>', 'Checkpoint description')
    .action(async (name, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('memory-save', { name, ...options });
    });

memoryCommand
    .command('restore <name>')
    .description('Restore from memory checkpoint')
    .option('--confirm', 'Skip confirmation prompt')
    .action(async (name, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('memory-restore', { name, ...options });
    });

memoryCommand
    .command('list')
    .description('List memory checkpoints')
    .option('--detailed', 'Show detailed checkpoint information')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('memory-list', options);
    });

// AI Provider commands
const aiCommand = program
    .command('ai')
    .description('🤖 AI provider management');

aiCommand
    .command('providers')
    .description('List available AI providers')
    .option('--status', 'Show provider status')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('ai-providers', options);
    });

aiCommand
    .command('configure <provider>')
    .description('Configure AI provider')
    .option('--api-key <key>', 'Set API key')
    .option('--endpoint <url>', 'Set custom endpoint')
    .action(async (provider, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('ai-configure', { provider, ...options });
    });

// Config commands
const configCommand = program
    .command('config')
    .description('⚙️ Configuration management');

configCommand
    .command('set <key> <value>')
    .description('Set configuration value')
    .action(async (key, value) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('config-set', { key, value });
    });

configCommand
    .command('get [key]')
    .description('Get configuration value(s)')
    .action(async (key) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('config-get', { key });
    });

configCommand
    .command('reset')
    .description('Reset configuration to defaults')
    .option('--confirm', 'Skip confirmation prompt')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('config-reset', options);
    });

// Setup command
program
    .command('setup')
    .description('🛠️ Setup Nexus AI Framework')
    .option('--quick', 'Quick setup with defaults')
    .option('--advanced', 'Advanced setup with all options')
    .option('--docker', 'Setup for Docker environment')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('setup', options);
    });

// Update command
program
    .command('update')
    .description('📦 Update Nexus AI Framework')
    .option('--check-only', 'Check for updates without installing')
    .option('--beta', 'Include beta versions')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('update', options);
    });

// Doctor command
program
    .command('doctor')
    .description('🩺 Diagnose system and configuration issues')
    .option('--fix', 'Automatically fix common issues')
    .option('--detailed', 'Show detailed diagnostic information')
    .action(async (options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('doctor', options);
    });

// Export command
program
    .command('export [format]')
    .description('📤 Export project or knowledge base')
    .option('--output <file>', 'Output file path')
    .option('--include-memory', 'Include memory data')
    .option('--compress', 'Compress output')
    .action(async (format, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('export', { format, ...options });
    });

// Import Framework into Project command
program
    .command('import-project [project-path]')
    .description('🚀 Import Nexus AI Framework into existing project (BULLETPROOF)')
    .option('--force', 'Force import even if framework already exists')
    .option('--no-backup', 'Skip creating safety backup (NOT RECOMMENDED)')
    .option('--no-hooks', 'Skip installing framework hooks')
    .option('--no-docs', 'Skip generating documentation')
    .option('--no-state-tracking', 'Skip setting up state tracking')
    .action(async (projectPath, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('import-project', { projectPath: projectPath || process.cwd(), ...options });
    });

// Analyze Project command
program
    .command('analyze-project [project-path]')
    .description('📊 Analyze existing project structure and generate comprehensive docs')
    .option('--detailed', 'Generate detailed analysis report')
    .option('--ai-optimize', 'Optimize for AI understanding', true)
    .action(async (projectPath, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('analyze-project', { projectPath: projectPath || process.cwd(), ...options });
    });

// Import Data command (existing functionality)
program
    .command('import <file>')
    .description('📥 Import project or knowledge base data')
    .option('--merge', 'Merge with existing data')
    .option('--overwrite', 'Overwrite existing data')
    .action(async (file, options) => {
        const cli = new CLI(nexus);
        await cli.executeCommand('import', { file, ...options });
    });

// Claude Code Integration
program
    .command('claude <command>')
    .description('🤖 Claude Code integration and context management')
    .option('--help', 'Show Claude-specific commands')
    .action(async (command, options) => {
        if (options.help || !command) {
            console.log('\nClaude Code Commands:');
            console.log('  init       - Initialize Claude Code integration');
            console.log('  status     - Show Claude context status');
            console.log('  save       - Save current session');
            console.log('  restore    - Restore previous session');
            console.log('  compact    - Compact conversation context');
            console.log('  search     - Search artifacts');
            console.log('  export     - Export Claude data');
            console.log('  clean      - Clean old data');
            console.log('  hooks      - Manage conversation hooks');
            console.log('  reset      - Reset Claude integration');
            console.log('\nRun "nexus-claude <command> --help" for detailed options');
            return;
        }
        
        // Delegate to nexus-claude CLI
        const { spawn } = require('child_process');
        const claudeCliPath = require('path').join(__dirname, 'nexus-claude.js');
        const args = [command, ...process.argv.slice(process.argv.indexOf(command) + 1)];
        
        const claudeProcess = spawn('node', [claudeCliPath, ...args], {
            stdio: 'inherit',
            env: process.env
        });
        
        claudeProcess.on('exit', (code) => {
            process.exit(code);
        });
    });

// Parse command line arguments
program.parse();

// Handle no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}