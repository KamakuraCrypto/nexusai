#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('../utils/colors');
const ora = require('ora').default || require('ora');
const inquirer = require('inquirer').default || require('inquirer');
const fs = require('fs-extra');
const path = require('path');

// Import Claude components
const ClaudeContextManager = require('../core/claude-context-manager');
const ClaudeConversationHooks = require('../core/claude-conversation-hooks');
const ClaudeSessionManager = require('../sessions/claude-session-manager');
const ClaudeFileTracker = require('../tracking/claude-file-tracker');
const ClaudeSummarizer = require('../compaction/claude-summarizer');
const ClaudeContextRestorer = require('../restoration/claude-context-restorer');
const ClaudeArtifactManager = require('../artifacts/claude-artifact-manager');

const program = new Command();

// Initialize managers
let contextManager;
let conversationHooks;
let sessionManager;
let fileTracker;
let summarizer;
let contextRestorer;
let artifactManager;

async function initializeManagers() {
    const configPath = path.join(process.cwd(), '.nexus', 'claude-config.json');
    const config = await fs.readJson(configPath).catch(() => ({}));
    
    contextManager = new ClaudeContextManager(config.context || {});
    conversationHooks = new ClaudeConversationHooks(config.hooks || {});
    sessionManager = new ClaudeSessionManager(config.sessions || {});
    fileTracker = new ClaudeFileTracker(config.tracking || {});
    summarizer = new ClaudeSummarizer(config.summarizer || {});
    contextRestorer = new ClaudeContextRestorer(config.restoration || {});
    artifactManager = new ClaudeArtifactManager(config.artifacts || {});
    
    // Initialize managers
    if (contextManager.initialize) await contextManager.initialize();
    if (sessionManager.initialize) await sessionManager.initialize();
    if (fileTracker.initialize) await fileTracker.initialize();
    if (artifactManager.initialize) await artifactManager.initialize();
    
    // Connect components (if methods exist)
    if (contextManager.setSummarizer) contextManager.setSummarizer(summarizer);
    if (conversationHooks.setContextManager) conversationHooks.setContextManager(contextManager);
    if (conversationHooks.setSessionManager) conversationHooks.setSessionManager(sessionManager);
    if (conversationHooks.setFileTracker) conversationHooks.setFileTracker(fileTracker);
    if (conversationHooks.setArtifactManager) conversationHooks.setArtifactManager(artifactManager);
    if (contextRestorer.setSessionManager) contextRestorer.setSessionManager(sessionManager);
    if (contextRestorer.setFileTracker) contextRestorer.setFileTracker(fileTracker);
    if (contextRestorer.setArtifactManager) contextRestorer.setArtifactManager(artifactManager);
}

program
    .name('nclaude')
    .description('🤖 Nexus AI - Professional Claude Code Integration Framework')
    .version('3.0.0')
    .addHelpText('before', `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NEXUS AI - Enterprise Claude Code Framework
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Professional conversation capture, monitoring, and recovery tools
`)
    .addHelpText('after', `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK START:
  
  nclaude init                    # Initialize in your project
  nclaude monitor dashboard       # View system status
  nclaude transcript list         # Show captured conversations
  nclaude help-all               # Complete documentation

NEW FEATURES:
  
  nclaude transcript <action>     # Conversation capture system
  nclaude monitor [live]          # Real-time monitoring dashboard  
  nclaude recover <action>        # File recovery and timeline tools

CLAUDE INTEGRATION:
  
  Slash commands in Claude Code:
  /nclaude status                 # Check current session
  /nclaude save "checkpoint"      # Create backup point
  /nclaude restore               # Restore from backup

ENTERPRISE FEATURES:
  
  • Complete conversation capture and analysis
  • Real-time monitoring with live dashboard  
  • Professional file recovery and versioning
  • Automatic backup and session management
  • Git-like timeline and object storage

DOCUMENTATION:
  https://github.com/nexus-framework/nexus-ai-claude
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Initialize Claude integration
program
    .command('init')
    .description('Initialize Claude Code integration for current project')
    .option('-f, --force', 'Force reinitialize even if already configured')
    .action(async (options) => {
        const spinner = ora('Initializing Claude Code integration...').start();
        
        try {
            const nexusDir = path.join(process.cwd(), '.nexus');
            const configPath = path.join(nexusDir, 'claude-config.json');
            
            if (await fs.exists(configPath) && !options.force) {
                spinner.warn('Claude integration already initialized. Use --force to reinitialize.');
                return;
            }
            
            await fs.ensureDir(nexusDir);
            await fs.ensureDir(path.join(nexusDir, 'sessions'));
            await fs.ensureDir(path.join(nexusDir, 'artifacts'));
            await fs.ensureDir(path.join(nexusDir, 'summaries'));
            await fs.ensureDir(path.join(nexusDir, 'backups'));
            
            const config = {
                version: '1.0.0',
                initialized: new Date().toISOString(),
                context: {
                    maxTokens: 200000,
                    compactionThreshold: 180000,
                    warningThreshold: 170000
                },
                sessions: {
                    maxSessionSize: 100 * 1024 * 1024, // 100MB
                    autosaveInterval: 5 * 60 * 1000, // 5 minutes
                    maxCheckpoints: 10
                },
                tracking: {
                    maxTrackedFiles: 1000,
                    priorityDecayRate: 0.1
                },
                summarizer: {
                    aggressiveness: 'balanced',
                    preserveCodeBlocks: true,
                    preserveErrors: true
                },
                restoration: {
                    maxHistoryDepth: 50,
                    includeFileContents: true
                },
                artifacts: {
                    maxVersions: 10,
                    autoExtractPatterns: true
                }
            };
            
            await fs.writeJson(configPath, config, { spaces: 2 });
            
            // Create .gitignore for nexus directory
            const gitignorePath = path.join(nexusDir, '.gitignore');
            const gitignoreContent = `
sessions/
backups/
*.tmp
*.log
.env
`;
            await fs.writeFile(gitignorePath, gitignoreContent.trim());
            
            // Auto-start the watcher daemon
            spinner.text = 'Starting timeline watcher...';
            const WatcherDaemon = require('../utils/watcher-daemon');
            const daemon = new WatcherDaemon();
            const watcherStarted = await daemon.start({ silent: true });
            
            if (watcherStarted) {
                spinner.succeed(chalk.green('Claude Code integration initialized successfully!'));
                console.log(chalk.green('✅ Timeline watcher started automatically'));
            } else {
                spinner.succeed(chalk.green('Claude Code integration initialized successfully!'));
                console.log(chalk.yellow('⚠️ Timeline watcher could not be started automatically'));
                console.log(chalk.cyan('Run'), chalk.yellow('nclaude timeline watch'), chalk.cyan('to start it manually'));
            }
            
            console.log(chalk.cyan('\nNext steps:'));
            console.log('  1. Run', chalk.yellow('nclaude status'), 'to check context usage');
            console.log('  2. Run', chalk.yellow('nclaude save'), 'to manually save session');
            console.log('  3. Run', chalk.yellow('nclaude timeline show'), 'to view timeline');
            console.log('  4. Run', chalk.yellow('nclaude help'), 'for all available commands');
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to initialize Claude integration'));
            console.error(error);
            process.exit(1);
        }
    });

// Save current session
program
    .command('save')
    .description('Save current Claude session and context')
    .option('-n, --name <name>', 'Name for this save point')
    .option('-d, --description <description>', 'Description of current state')
    .action(async (options) => {
        const spinner = ora('Saving Claude session...').start();
        
        try {
            await initializeManagers();
            
            const checkpoint = await sessionManager.createCheckpoint({
                name: options.name || `checkpoint-${Date.now()}`,
                description: options.description,
                context: await contextManager.getCurrentContext(),
                files: await fileTracker.getTrackedFiles(),
                artifacts: await artifactManager.getAllArtifacts()
            });
            
            spinner.succeed(chalk.green(`Session saved: ${checkpoint.name}`));
            console.log(chalk.cyan('Checkpoint ID:'), checkpoint.id);
            
            if (checkpoint.description) {
                console.log(chalk.cyan('Description:'), checkpoint.description);
            }
            
            process.exit(0);
        } catch (error) {
            spinner.fail(chalk.red('Failed to save session'));
            console.error(error);
            process.exit(1);
        }
    });

// Restore session
program
    .command('restore [checkpointId]')
    .description('Restore a previous Claude session')
    .option('-l, --list', 'List available checkpoints')
    .option('-f, --format <format>', 'Output format (human, json, markdown)', 'human')
    .action(async (checkpointId, options) => {
        try {
            await initializeManagers();
            
            if (options.list) {
                const checkpoints = await sessionManager.listCheckpoints();
                
                if (checkpoints.length === 0) {
                    console.log(chalk.yellow('No checkpoints available'));
                    return;
                }
                
                console.log(chalk.cyan('\nAvailable checkpoints:'));
                checkpoints.forEach(cp => {
                    console.log(`\n  ${chalk.yellow(cp.id)}`);
                    console.log(`    Name: ${cp.name}`);
                    console.log(`    Created: ${new Date(cp.created).toLocaleString()}`);
                    if (cp.description) {
                        console.log(`    Description: ${cp.description}`);
                    }
                });
                return;
            }
            
            if (!checkpointId) {
                const checkpoints = await sessionManager.listCheckpoints();
                
                if (checkpoints.length === 0) {
                    console.log(chalk.yellow('No checkpoints available to restore'));
                    return;
                }
                
                const { selected } = await inquirer.prompt([{
                    type: 'list',
                    name: 'selected',
                    message: 'Select checkpoint to restore:',
                    choices: checkpoints.map(cp => ({
                        name: `${cp.name} (${new Date(cp.created).toLocaleString()})`,
                        value: cp.id
                    }))
                }]);
                
                checkpointId = selected;
            }
            
            const spinner = ora('Restoring session...').start();
            const restored = await contextRestorer.restoreFromCheckpoint(checkpointId, {
                format: options.format
            });
            
            if (options.format === 'json') {
                spinner.stop();
                console.log(JSON.stringify(restored, null, 2));
            } else if (options.format === 'markdown') {
                spinner.stop();
                console.log(restored.formatted);
            } else {
                spinner.succeed(chalk.green('Session restored successfully!'));
                console.log(chalk.cyan('\nRestored context:'));
                console.log(`  Messages: ${restored.messageCount}`);
                console.log(`  Files: ${restored.fileCount}`);
                console.log(`  Artifacts: ${restored.artifactCount}`);
                console.log(`  Token usage: ${restored.tokenCount} / ${contextManager.maxTokens}`);
            }
            
        } catch (error) {
            console.error(chalk.red('Failed to restore session:'), error.message);
            process.exit(1);
        }
    });

// Compact current context
program
    .command('compact')
    .description('Manually compact current conversation context')
    .option('-a, --aggressive', 'Use aggressive compaction')
    .option('-p, --preview', 'Preview what would be compacted')
    .action(async (options) => {
        try {
            await initializeManagers();
            
            if (options.preview) {
                const preview = await contextManager.previewCompaction();
                console.log(chalk.cyan('\nCompaction preview:'));
                console.log(`  Current tokens: ${preview.currentTokens}`);
                console.log(`  After compaction: ${preview.estimatedTokens}`);
                console.log(`  Reduction: ${preview.reductionPercentage}%`);
                console.log(`\n  Items to summarize: ${preview.itemsToSummarize}`);
                console.log(`  Items to compress: ${preview.itemsToCompress}`);
                console.log(`  Items to preserve: ${preview.itemsToPreserve}`);
                return;
            }
            
            const spinner = ora('Compacting context...').start();
            
            const before = await contextManager.getCurrentTokenCount();
            const result = await contextManager.compactContext({
                aggressive: options.aggressive
            });
            const after = await contextManager.getCurrentTokenCount();
            
            spinner.succeed(chalk.green('Context compacted successfully!'));
            console.log(chalk.cyan('\nCompaction results:'));
            console.log(`  Before: ${before} tokens`);
            console.log(`  After: ${after} tokens`);
            console.log(`  Saved: ${before - after} tokens (${Math.round((before - after) / before * 100)}%)`);
            
        } catch (error) {
            console.error(chalk.red('Failed to compact context:'), error.message);
            process.exit(1);
        }
    });

// Show context status
program
    .command('status')
    .description('Show current Claude context status')
    .option('-d, --detailed', 'Show detailed breakdown')
    .action(async (options) => {
        try {
            await initializeManagers();
            
            let status, session, files, artifacts;
            
            try {
                status = await contextManager.getStatus();
            } catch (e) {
                status = { currentTokens: 0, maxTokens: 200000 };
            }
            
            try {
                session = sessionManager.getCurrentSession ? await sessionManager.getCurrentSession() : null;
            } catch (e) {
                session = null;
            }
            
            try {
                files = fileTracker.getTrackedFiles ? await fileTracker.getTrackedFiles() : new Map();
            } catch (e) {
                files = new Map();
            }
            
            try {
                artifacts = artifactManager.getAllArtifacts ? await artifactManager.getAllArtifacts() : new Map();
            } catch (e) {
                artifacts = new Map();
            }
            
            console.log(chalk.bold(chalk.cyan('\n═══ Claude Context Status ═══\n')));
            
            // Token usage bar
            const percentage = (status.currentTokens / status.maxTokens) * 100;
            const barLength = 30;
            const filledLength = Math.round(barLength * percentage / 100);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
            
            let barColor = chalk.green;
            if (percentage > 90) barColor = chalk.red;
            else if (percentage > 85) barColor = chalk.yellow;
            
            console.log('Token Usage:');
            console.log(`  ${barColor(bar)} ${percentage.toFixed(1)}%`);
            console.log(`  ${status.currentTokens.toLocaleString()} / ${status.maxTokens.toLocaleString()} tokens\n`);
            
            // Session info
            if (session) {
                console.log('Current Session:');
                console.log(`  ID: ${chalk.yellow(session.id)}`);
                console.log(`  Started: ${new Date(session.started).toLocaleString()}`);
                console.log(`  Checkpoints: ${session.checkpoints?.length || 0}`);
                console.log(`  Messages: ${session.context?.messages?.length || 0}\n`);
            }
            
            // File tracking
            console.log('File Tracking:');
            console.log(`  Tracked files: ${files.size}`);
            if (files.size > 0) {
                const recentFiles = Array.from(files.values())
                    .sort((a, b) => new Date(b.lastModified || b.lastRead) - new Date(a.lastModified || a.lastRead))
                    .slice(0, 5);
                console.log('  Recent files:');
                recentFiles.forEach(f => {
                    const icon = f.lastModified > f.lastRead ? '✏️ ' : '👁️ ';
                    console.log(`    ${icon} ${path.basename(f.path)}`);
                });
            }
            console.log();
            
            // Artifacts
            console.log('Artifacts:');
            console.log(`  Total artifacts: ${artifacts.size}`);
            if (artifacts.size > 0) {
                const languages = new Set();
                artifacts.forEach(a => languages.add(a.language));
                console.log(`  Languages: ${Array.from(languages).join(', ')}`);
            }
            console.log();
            
            // Watcher daemon status
            try {
                const WatcherDaemon = require('../utils/watcher-daemon');
                const daemon = new WatcherDaemon();
                const watcherStatus = await daemon.getStatus();
                
                console.log('Timeline Watcher:');
                if (watcherStatus.running) {
                    console.log(`  Status: ${chalk.green('✅ Running')} (PID: ${watcherStatus.pid})`);
                    if (watcherStatus.uptime) {
                        const hours = Math.floor(watcherStatus.uptime / (1000 * 60 * 60));
                        const minutes = Math.floor((watcherStatus.uptime % (1000 * 60 * 60)) / (1000 * 60));
                        console.log(`  Uptime: ${hours}h ${minutes}m`);
                    }
                } else {
                    console.log(`  Status: ${chalk.red('❌ Not running')}`);
                    console.log('  Use: nclaude timeline watch --start to begin tracking');
                }
            } catch (error) {
                console.log('Timeline Watcher:');
                console.log(`  Status: ${chalk.yellow('⚠️ Error checking status')}`);
            }
            
            if (options.detailed) {
                console.log(chalk.cyan('\n═══ Detailed Breakdown ═══\n'));
                
                // Token breakdown
                console.log('Token Distribution:');
                const breakdown = status.breakdown || {};
                Object.entries(breakdown).forEach(([category, tokens]) => {
                    const pct = (tokens / status.currentTokens * 100).toFixed(1);
                    console.log(`  ${category}: ${tokens.toLocaleString()} (${pct}%)`);
                });
                
                // Memory usage
                console.log('\nMemory Usage:');
                const memUsage = process.memoryUsage();
                console.log(`  Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
                console.log(`  Total: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
            }
            
            process.exit(0);
        } catch (error) {
            console.error(chalk.red('Failed to get status:'), error.message);
            process.exit(1);
        }
    });

// Search artifacts
program
    .command('search <query>')
    .description('Search through Claude artifacts')
    .option('-t, --type <type>', 'Filter by type (code, text, config)')
    .option('-l, --language <language>', 'Filter by language')
    .option('-n, --limit <limit>', 'Maximum results', '10')
    .action(async (query, options) => {
        try {
            await initializeManagers();
            
            const results = await artifactManager.searchArtifacts(query, {
                type: options.type,
                language: options.language,
                limit: parseInt(options.limit)
            });
            
            if (results.length === 0) {
                console.log(chalk.yellow('No artifacts found matching your query'));
                return;
            }
            
            console.log(chalk.cyan(`\nFound ${results.length} artifact(s):\n`));
            
            results.forEach((artifact, index) => {
                console.log(chalk.yellow(`${index + 1}. ${artifact.title || artifact.id}`));
                console.log(`   Language: ${artifact.language}`);
                console.log(`   Created: ${new Date(artifact.created).toLocaleString()}`);
                if (artifact.description) {
                    console.log(`   Description: ${artifact.description}`);
                }
                
                // Show snippet
                const lines = artifact.content.split('\n').slice(0, 3);
                console.log(chalk.gray('   Preview:'));
                lines.forEach(line => {
                    console.log(chalk.gray(`     ${line.substring(0, 60)}${line.length > 60 ? '...' : ''}`));
                });
                console.log();
            });
            
        } catch (error) {
            console.error(chalk.red('Search failed:'), error.message);
            process.exit(1);
        }
    });

// Export artifacts
program
    .command('export')
    .description('Export Claude artifacts and context')
    .option('-o, --output <path>', 'Output directory', './claude-export')
    .option('-f, --format <format>', 'Export format (json, markdown, archive)', 'archive')
    .option('-i, --include <items>', 'What to include (all, artifacts, sessions, files)', 'all')
    .action(async (options) => {
        const spinner = ora('Exporting Claude data...').start();
        
        try {
            await initializeManagers();
            
            const outputPath = path.resolve(options.output);
            await fs.ensureDir(outputPath);
            
            const includeAll = options.include === 'all';
            const include = options.include.split(',').map(i => i.trim());
            
            const exportData = {
                exported: new Date().toISOString(),
                version: '1.0.0'
            };
            
            // Export artifacts
            if (includeAll || include.includes('artifacts')) {
                spinner.text = 'Exporting artifacts...';
                const artifacts = await artifactManager.exportAllArtifacts();
                exportData.artifacts = artifacts;
                
                if (options.format !== 'json') {
                    const artifactsDir = path.join(outputPath, 'artifacts');
                    await fs.ensureDir(artifactsDir);
                    
                    for (const [id, artifact] of artifacts) {
                        const ext = artifact.language === 'javascript' ? '.js' : 
                                  artifact.language === 'python' ? '.py' :
                                  artifact.language === 'typescript' ? '.ts' : '.txt';
                        const filename = `${artifact.title || id}${ext}`.replace(/[^a-z0-9.-]/gi, '_');
                        await fs.writeFile(
                            path.join(artifactsDir, filename),
                            artifact.content
                        );
                    }
                }
            }
            
            // Export sessions
            if (includeAll || include.includes('sessions')) {
                spinner.text = 'Exporting sessions...';
                const sessions = await sessionManager.exportSessions();
                exportData.sessions = sessions;
                
                if (options.format === 'markdown') {
                    const sessionsFile = path.join(outputPath, 'sessions.md');
                    let markdown = '# Claude Sessions\n\n';
                    
                    for (const session of sessions) {
                        markdown += `## Session ${session.id}\n`;
                        markdown += `**Started:** ${session.started}\n`;
                        markdown += `**Messages:** ${session.messageCount}\n\n`;
                        
                        if (session.checkpoints) {
                            markdown += '### Checkpoints\n';
                            session.checkpoints.forEach(cp => {
                                markdown += `- ${cp.name} (${cp.created})\n`;
                            });
                            markdown += '\n';
                        }
                    }
                    
                    await fs.writeFile(sessionsFile, markdown);
                }
            }
            
            // Export tracked files
            if (includeAll || include.includes('files')) {
                spinner.text = 'Exporting file tracking data...';
                const files = await fileTracker.exportTracking();
                exportData.files = files;
                
                if (options.format === 'markdown') {
                    const filesFile = path.join(outputPath, 'tracked-files.md');
                    let markdown = '# Tracked Files\n\n';
                    
                    const sortedFiles = Array.from(files.values())
                        .sort((a, b) => b.priority - a.priority);
                    
                    markdown += '| File | Reads | Writes | Priority | Last Modified |\n';
                    markdown += '|------|-------|---------|----------|---------------|\n';
                    
                    sortedFiles.forEach(file => {
                        markdown += `| ${file.path} | ${file.readCount} | ${file.writeCount} | ${file.priority.toFixed(2)} | ${file.lastModified || 'N/A'} |\n`;
                    });
                    
                    await fs.writeFile(filesFile, markdown);
                }
            }
            
            // Create archive if requested
            if (options.format === 'archive') {
                spinner.text = 'Creating archive...';
                const archiver = require('archiver');
                const output = fs.createWriteStream(path.join(outputPath, 'claude-export.zip'));
                const archive = archiver('zip', { zlib: { level: 9 } });
                
                archive.pipe(output);
                archive.directory(outputPath, false);
                
                await new Promise((resolve, reject) => {
                    output.on('close', resolve);
                    archive.on('error', reject);
                    archive.finalize();
                });
            }
            
            // Write main export file
            if (options.format === 'json') {
                await fs.writeJson(
                    path.join(outputPath, 'claude-export.json'),
                    exportData,
                    { spaces: 2 }
                );
            }
            
            spinner.succeed(chalk.green(`Export completed to ${outputPath}`));
            
        } catch (error) {
            spinner.fail(chalk.red('Export failed'));
            console.error(error);
            process.exit(1);
        }
    });

// Clean old data
program
    .command('clean')
    .description('Clean old sessions and artifacts')
    .option('-d, --days <days>', 'Delete items older than N days', '30')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options) => {
        try {
            await initializeManagers();
            
            const days = parseInt(options.days);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            // Count items to delete
            const stats = await sessionManager.getCleanupStats(cutoffDate);
            
            console.log(chalk.cyan(`\nItems older than ${days} days:`));
            console.log(`  Sessions: ${stats.sessions}`);
            console.log(`  Checkpoints: ${stats.checkpoints}`);
            console.log(`  Artifacts: ${stats.artifacts}`);
            console.log(`  Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB\n`);
            
            if (stats.sessions === 0 && stats.checkpoints === 0 && stats.artifacts === 0) {
                console.log(chalk.green('Nothing to clean!'));
                return;
            }
            
            let confirm = options.yes;
            if (!confirm) {
                const answer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Do you want to proceed with cleanup?',
                    default: false
                }]);
                confirm = answer.confirm;
            }
            
            if (!confirm) {
                console.log(chalk.yellow('Cleanup cancelled'));
                return;
            }
            
            const spinner = ora('Cleaning old data...').start();
            
            const result = await sessionManager.cleanup(cutoffDate);
            await artifactManager.cleanup(cutoffDate);
            
            spinner.succeed(chalk.green('Cleanup completed!'));
            console.log(chalk.cyan('\nCleaned:'));
            console.log(`  Sessions: ${result.sessionsDeleted}`);
            console.log(`  Checkpoints: ${result.checkpointsDeleted}`);
            console.log(`  Space freed: ${(result.spaceFreed / 1024 / 1024).toFixed(2)} MB`);
            
        } catch (error) {
            console.error(chalk.red('Cleanup failed:'), error.message);
            process.exit(1);
        }
    });

// Hook management
program
    .command('hooks')
    .description('Manage Claude conversation hooks')
    .option('-l, --list', 'List registered hooks')
    .option('-t, --test <hook>', 'Test a specific hook')
    .action(async (options) => {
        try {
            await initializeManagers();
            
            if (options.list) {
                const hooks = conversationHooks.getRegisteredHooks();
                
                console.log(chalk.cyan('\nRegistered hooks:\n'));
                
                Object.entries(hooks).forEach(([name, handlers]) => {
                    console.log(chalk.yellow(`${name}:`));
                    if (handlers.length === 0) {
                        console.log('  (no handlers registered)');
                    } else {
                        handlers.forEach((handler, index) => {
                            console.log(`  ${index + 1}. ${handler.name || 'anonymous'}`);
                        });
                    }
                    console.log();
                });
                
                return;
            }
            
            if (options.test) {
                console.log(chalk.cyan(`Testing hook: ${options.test}`));
                
                const testData = {
                    beforeContextWindow: { tokens: 150000 },
                    onArtifactCreation: { id: 'test', content: 'console.log("test")', language: 'javascript' },
                    onToolUse: { tool: 'read_file', params: { path: '/test.js' } },
                    onFileOperation: { operation: 'read', path: '/test.js' },
                    onErrorEncountered: { error: new Error('Test error'), context: {} },
                    onContextReset: { reason: 'manual', savedState: {} }
                };
                
                const data = testData[options.test];
                if (!data) {
                    console.log(chalk.red(`Unknown hook: ${options.test}`));
                    return;
                }
                
                await conversationHooks.emit(options.test, data);
                console.log(chalk.green('Hook test completed'));
            }
            
        } catch (error) {
            console.error(chalk.red('Hook operation failed:'), error.message);
            process.exit(1);
        }
    });

// Setup Claude Code hooks
program
    .command('setup-hooks')
    .description('Setup Claude Code hooks for automatic integration')
    .option('-f, --force', 'Force reinstall hooks even if they exist')
    .action(async (options) => {
        const spinner = ora('Setting up Claude Code hooks...').start();
        
        try {
            const projectDir = process.cwd();
            const claudeDir = path.join(projectDir, '.claude');
            const hooksDir = path.join(claudeDir, 'hooks');
            
            // Create directories
            await fs.ensureDir(hooksDir);
            
            // Define hooks
            const hooks = {
                'pre-compact.sh': `#!/bin/bash
# Nexus AI PreCompact Hook
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
if ! command -v nclaude &> /dev/null; then exit 0; fi
HOOK_INPUT=$(cat)
TOKEN_COUNT=$(echo "$HOOK_INPUT" | jq -r '.token_count // "unknown"' 2>/dev/null || echo "unknown")
nclaude save --name "auto-compact-$(date +%Y%m%d-%H%M%S)" --description "Auto-save at $TOKEN_COUNT tokens" 2>&1 >&2 || true
exit 0`,
                
                'session-start.sh': `#!/bin/bash
# Nexus AI SessionStart Hook
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
if ! command -v nclaude &> /dev/null; then exit 0; fi
if [ ! -f ".nexus/claude-config.json" ]; then
    nclaude init --force 2>&1 >&2 || true
fi
nclaude status 2>&1 | grep -E "Token|Session" >&2 || true
exit 0`,
                
                'session-end.sh': `#!/bin/bash
# Nexus AI SessionEnd Hook
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
if ! command -v nclaude &> /dev/null; then exit 0; fi
nclaude save --name "session-end-$(date +%Y%m%d-%H%M%S)" --description "Session end save" 2>&1 >&2 || true
exit 0`,
                
                'post-tool-use.sh': `#!/bin/bash
# Nexus AI PostToolUse Hook
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
NEXUS_DIR="\${CLAUDE_PROJECT_DIR:-.}/.nexus"
if ! command -v nclaude &> /dev/null; then exit 0; fi
HOOK_INPUT=$(cat)
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
if [[ "$TOOL_NAME" =~ ^(Read|Edit|Write)$ ]]; then
    FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_params.file_path // .tool_params.path // ""' 2>/dev/null || echo "")
    if [ -n "$FILE_PATH" ]; then
        mkdir -p "$NEXUS_DIR/sessions"
        TRACKING_FILE="$NEXUS_DIR/sessions/current_tracking.json"
        if [ -f "$TRACKING_FILE" ]; then
            jq ". + {\\"$(date +%s)\\": {tool: \\"$TOOL_NAME\\", file: \\"$FILE_PATH\\"}}" "$TRACKING_FILE" > "$TRACKING_FILE.tmp" && mv "$TRACKING_FILE.tmp" "$TRACKING_FILE" 2>/dev/null || true
        else
            echo "{\\"$(date +%s)\\": {\\"tool\\": \\"$TOOL_NAME\\", \\"file\\": \\"$FILE_PATH\\"}}" > "$TRACKING_FILE"
        fi
    fi
fi
exit 0`
            };
            
            // Check if hooks already exist
            let existingHooks = 0;
            for (const hookName of Object.keys(hooks)) {
                if (await fs.exists(path.join(hooksDir, hookName))) {
                    existingHooks++;
                }
            }
            
            if (existingHooks > 0 && !options.force) {
                spinner.warn(`Found ${existingHooks} existing hooks. Use --force to overwrite.`);
                return;
            }
            
            // Write hook files
            for (const [filename, content] of Object.entries(hooks)) {
                const hookPath = path.join(hooksDir, filename);
                await fs.writeFile(hookPath, content);
                await fs.chmod(hookPath, 0o755);
            }
            
            // Update settings.local.json
            const settingsPath = path.join(claudeDir, 'settings.local.json');
            let settings = {};
            
            if (await fs.exists(settingsPath)) {
                try {
                    settings = await fs.readJson(settingsPath);
                } catch (e) {
                    settings = {};
                }
            }
            
            // Add hook configurations
            if (!settings.hooks) {
                settings.hooks = {};
            }
            
            settings.hooks = {
                ...settings.hooks,
                preCompact: ".claude/hooks/pre-compact.sh",
                sessionStart: ".claude/hooks/session-start.sh",
                sessionEnd: ".claude/hooks/session-end.sh",
                postToolUse: ".claude/hooks/post-tool-use.sh"
            };
            
            // Add permissions for nclaude
            if (!settings.permissions) {
                settings.permissions = { allow: [], deny: [], ask: [] };
            }
            if (!settings.permissions.allow) {
                settings.permissions.allow = [];
            }
            
            const requiredPermissions = [
                "Bash(nclaude:*)",
                "Read(**/.nexus/**)",
                "Write(**/.nexus/**)"
            ];
            
            for (const perm of requiredPermissions) {
                if (!settings.permissions.allow.includes(perm)) {
                    settings.permissions.allow.push(perm);
                }
            }
            
            await fs.writeJson(settingsPath, settings, { spaces: 2 });
            
            spinner.succeed(chalk.green('Claude Code hooks installed successfully!'));
            
            console.log(chalk.cyan('\n✅ The following hooks are now active:'));
            console.log('  • PreCompact: Auto-saves before context compaction');
            console.log('  • SessionStart: Initializes Nexus AI tracking');
            console.log('  • SessionEnd: Saves final session state');
            console.log('  • PostToolUse: Tracks file operations');
            
            console.log(chalk.cyan('\n💡 These hooks will run automatically during Claude Code usage.'));
            console.log('   No manual intervention required!');
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to setup hooks'));
            console.error(error);
            process.exit(1);
        }
    });

// Reset everything
program
    .command('reset')
    .description('Reset Claude integration (dangerous!)')
    .option('-y, --yes', 'Skip confirmation')
    .option('--keep-config', 'Keep configuration file')
    .action(async (options) => {
        if (!options.yes) {
            const answer = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: chalk.red('This will delete ALL Claude data. Are you sure?'),
                default: false
            }]);
            
            if (!answer.confirm) {
                console.log(chalk.yellow('Reset cancelled'));
                return;
            }
        }
        
        const spinner = ora('Resetting Claude integration...').start();
        
        try {
            const nexusDir = path.join(process.cwd(), '.nexus');
            
            if (!options.keepConfig) {
                await fs.remove(nexusDir);
            } else {
                // Keep config but remove everything else
                const config = await fs.readJson(path.join(nexusDir, 'claude-config.json'));
                await fs.remove(path.join(nexusDir, 'sessions'));
                await fs.remove(path.join(nexusDir, 'artifacts'));
                await fs.remove(path.join(nexusDir, 'summaries'));
                await fs.remove(path.join(nexusDir, 'backups'));
                
                // Recreate directories
                await fs.ensureDir(path.join(nexusDir, 'sessions'));
                await fs.ensureDir(path.join(nexusDir, 'artifacts'));
                await fs.ensureDir(path.join(nexusDir, 'summaries'));
                await fs.ensureDir(path.join(nexusDir, 'backups'));
            }
            
            spinner.succeed(chalk.green('Claude integration reset successfully'));
            
            if (!options.keepConfig) {
                console.log(chalk.cyan('\nRun "nexus claude init" to reinitialize'));
            }
            
        } catch (error) {
            spinner.fail(chalk.red('Reset failed'));
            console.error(error);
            process.exit(1);
        }
    });

// Timeline command
program
    .command('timeline <action>')
    .description('Timeline and time-travel functionality')
    .option('-n, --limit <number>', 'Number of items to show')
    .option('-p, --preview', 'Preview changes without applying')
    .option('-t, --temp', 'Use temporary directory')
    .option('-d, --detach', 'Run in background')
    .action(async (action, options) => {
        // Delegate to timeline command
        const { execFileSync } = require('child_process');
        const timelinePath = path.join(__dirname, 'nclaude-timeline.js');
        
        const args = [action];
        if (options.limit) args.push('-n', options.limit);
        if (options.preview) args.push('-p');
        if (options.temp) args.push('-t');
        if (options.detach) args.push('-d');
        
        try {
            execFileSync('node', [timelinePath, ...args], { stdio: 'inherit' });
        } catch (error) {
            process.exit(1);
        }
    })
    .on('--help', () => {
        console.log('');
        console.log('Timeline Actions:');
        console.log('  watch              Start file system watcher');
        console.log('  show               Display conversation timeline');
        console.log('  restore <turn>     Restore files to specific turn');
        console.log('  compare <t1> <t2>  Compare two turns');
        console.log('  turn               Mark new conversation turn');
        console.log('  snapshot [desc]    Create snapshot of current state');
        console.log('');
        console.log('Examples:');
        console.log('  $ nclaude timeline watch');
        console.log('  $ nclaude timeline show');
        console.log('  $ nclaude timeline restore 8');
        console.log('  $ nclaude timeline compare 8 12');
    });

// Transcript command - conversation data access
program
    .command('transcript <action> [sessionId]')
    .description('Access captured conversation transcripts')
    .option('-s, --session <id>', 'Specify session ID')
    .option('-l, --limit <number>', 'Limit number of results')
    .action(async (action, sessionId, options) => {
        const { execFileSync } = require('child_process');
        const transcriptPath = path.join(__dirname, 'nclaude-transcript.js');
        
        try {
            const args = [action];
            // Add sessionId as positional argument for show command
            if (sessionId) {
                args.push(sessionId);
            }
            if (options.session) args.push('--session', options.session);
            if (options.limit) args.push('--limit', options.limit);
            
            execFileSync('node', [transcriptPath, ...args], { 
                stdio: 'inherit',
                cwd: process.cwd()
            });
        } catch (error) {
            console.error(chalk.red('Transcript command failed'));
            process.exit(1);
        }
    });

// Monitor command - system dashboard
program
    .command('monitor [command]')
    .description('System monitoring and dashboard')
    .option('-r, --refresh <seconds>', 'Auto-refresh interval')
    .option('-l, --live', 'Live monitoring mode')
    .action(async (command = 'dashboard', options) => {
        const { execFileSync } = require('child_process');
        let scriptPath;
        
        if (options.live || command === 'live') {
            scriptPath = path.join(__dirname, 'nclaude-monitor-live.js');
            command = 'start';
        } else {
            scriptPath = path.join(__dirname, 'nclaude-monitor.js');
        }
        
        try {
            const args = [command];
            if (options.refresh) args.push('--refresh', options.refresh);
            
            execFileSync('node', [scriptPath, ...args], { 
                stdio: 'inherit',
                cwd: process.cwd()
            });
        } catch (error) {
            console.error(chalk.red('Monitor command failed'));
            process.exit(1);
        }
    });

// Recovery command - restore functionality  
program
    .command('recover <action> [target] [id]')
    .description('Recovery and restoration tools')
    .option('-f, --file <path>', 'File path for recovery')
    .option('-i, --id <id>', 'Edit or backup ID')
    .option('-t, --timestamp <time>', 'Backup timestamp')
    .option('-l, --limit <number>', 'Limit number of results')
    .action(async (action, target, id, options) => {
        const { execFileSync } = require('child_process');
        const recoveryPath = path.join(__dirname, 'nclaude-recover.js');
        
        try {
            const args = [action];
            // Add positional arguments
            if (target) args.push(target);
            if (id) args.push(id);
            // Add optional arguments
            if (options.file) args.push(options.file);
            if (options.id) args.push(options.id);
            if (options.timestamp) args.push(options.timestamp);
            if (options.limit) args.push(options.limit);
            
            execFileSync('node', [recoveryPath, ...args], { 
                stdio: 'inherit',
                cwd: process.cwd()
            });
        } catch (error) {
            console.error(chalk.red('Recovery command failed'));
            process.exit(1);
        }
    });

// Comprehensive help command
program
    .command('help-all')
    .description('Show comprehensive help for all Nexus AI features')
    .action(async () => {
        console.log(`
${chalk.cyan.bold('═══════════════════════════════════════════════════════════════════')}
${chalk.cyan.bold('                    NEXUS AI - COMPREHENSIVE HELP                    ')}
${chalk.cyan.bold('═══════════════════════════════════════════════════════════════════')}

${chalk.yellow.bold('🎯 OVERVIEW:')}
Nexus AI is a comprehensive Claude Code integration framework that provides:
• Complete conversation capture and analysis
• Real-time monitoring and dashboard
• File recovery and timeline restoration
• Automatic backup and session management
• Professional-grade data safety and workflow tools

${chalk.yellow.bold('📋 CORE COMMANDS:')}

${chalk.green('nclaude init [options]')}
  Initialize Nexus AI in your project
  Options:
    -f, --force       Force reinitialize
  Example: nclaude init --force

${chalk.green('nclaude status [options]')}
  Show current session status and token usage
  Options:
    -v, --verbose     Detailed status information
  Example: nclaude status --verbose

${chalk.green('nclaude save [name] [options]')}
  Create checkpoint/backup of current state
  Options:
    -m, --message     Add description message
  Example: nclaude save "before-refactor" --message "Working auth system"

${chalk.green('nclaude restore [checkpoint] [options]')}
  Restore from checkpoint or backup
  Options:
    --list           Show available checkpoints
    -f, --force      Force restore without confirmation
  Example: nclaude restore "before-refactor"

${chalk.green('nclaude compact [options]')}
  Manually compact conversation to save tokens
  Options:
    --preview        Show what will be compacted
  Example: nclaude compact --preview

${chalk.yellow.bold('💬 CONVERSATION COMMANDS:')}

${chalk.green('nclaude transcript <action> [sessionId]')}
  Access captured conversation transcripts
  Actions:
    list             List all captured sessions
    show <id>        Show conversation details
    parse <file>     Parse transcript file
  Options:
    -s, --session    Specify session ID
    -l, --limit      Limit number of results
  Examples:
    nclaude transcript list
    nclaude transcript show current-session
    nclaude transcript parse ~/.claude/projects/.../session.jsonl

${chalk.yellow.bold('📊 MONITORING COMMANDS:')}

${chalk.green('nclaude monitor [command]')}
  System monitoring and dashboard
  Commands:
    dashboard        Show monitoring dashboard (default)
    live            Start live monitoring mode
  Options:
    -r, --refresh    Auto-refresh interval
    -l, --live       Live monitoring mode
  Examples:
    nclaude monitor dashboard
    nclaude monitor live
    nclaude monitor --refresh 5

${chalk.yellow.bold('🔧 RECOVERY COMMANDS:')}

${chalk.green('nclaude recover <action> [target] [id]')}
  Recovery and restoration tools
  Actions:
    list-edits <file>         Show edit history for file
    restore-file <file> <id>  Restore file to specific edit
    list-conversations        Show available conversations
    restore-conversation <id> Show conversation content
    list-backups             Show available backups
    restore-backup <time>     Restore from backup
    show-timeline [limit]     Show activity timeline
  Options:
    -f, --file       File path for recovery
    -i, --id         Edit or backup ID
    -t, --timestamp  Backup timestamp
    -l, --limit      Limit number of results
  Examples:
    nclaude recover list-edits ./src/main.js
    nclaude recover restore-file ./src/main.js edit-123
    nclaude recover show-timeline 20

${chalk.yellow.bold('📦 EXPORT/IMPORT COMMANDS:')}

${chalk.green('nclaude export [options]')}
  Export session data and artifacts
  Options:
    --format         Export format (json, markdown, archive)
    --output         Output directory
    --include        What to include (artifacts, sessions, files)
  Example: nclaude export --format markdown --output ./backup

${chalk.green('nclaude search <query> [options]')}
  Search through artifacts and conversations
  Options:
    --type          Search type (code, conversation, files)
    --format        Output format
  Example: nclaude search "authentication" --type code

${chalk.yellow.bold('🛠️ UTILITY COMMANDS:')}

${chalk.green('nclaude clean [options]')}
  Clean old sessions and artifacts
  Options:
    --days          Keep last N days (default: 30)
    --force         Skip confirmation
  Example: nclaude clean --days 14

${chalk.green('nclaude hooks [options]')}
  Manage Claude conversation hooks
  Options:
    --list          List all hooks
    --test          Test hook functionality
  Example: nclaude hooks --list

${chalk.green('nclaude timeline <action> [options]')}
  Timeline and file versioning
  Actions:
    watch           Start file watcher
    show            Show timeline
    restore <id>    Restore to specific point
    compare <a> <b> Compare two points
  Examples:
    nclaude timeline watch
    nclaude timeline show
    nclaude timeline restore 8

${chalk.yellow.bold('🔍 DIRECT ACCESS COMMANDS:')}

${chalk.cyan('These commands can also be run directly:')}
${chalk.green('nclaude-transcript')}     Advanced transcript management
${chalk.green('nclaude-monitor')}        Real-time system monitoring  
${chalk.green('nclaude-recover')}        File and data recovery tools
${chalk.green('nclaude-export')}         Data export utilities

${chalk.yellow.bold('💡 CLAUDE CODE INTEGRATION:')}

${chalk.cyan('Slash Commands (use in Claude):')}
/nclaude status              Check current status
/nclaude save <name>         Create checkpoint
/nclaude restore            Restore last checkpoint
/nclaude compact            Compact conversation

${chalk.cyan('Automatic Hooks:')}
• UserPromptSubmit          Captures user prompts
• Stop                      Captures AI responses when complete
• PostToolUse              Tracks file operations
• SessionStart/End         Manages session lifecycle
• PreCompact               Handles conversation compaction

${chalk.yellow.bold('📁 DATA ORGANIZATION:')}

${chalk.cyan('.nexus/ Directory Structure:')}
├── conversations/          Captured conversation data
├── responses/             AI responses and thinking
├── edits/                File edit history with diffs
├── timeline/             Git-like object storage
├── backups/              Automatic backup storage
├── claude/               Claude Code integration data
└── sessions/             Session management

${chalk.yellow.bold('🚀 GETTING STARTED:')}

${chalk.cyan('1. Initialize in your project:')}
   cd your-project && nclaude init

${chalk.cyan('2. Check system status:')}
   nclaude monitor dashboard

${chalk.cyan('3. View captured conversations:')}
   nclaude transcript list

${chalk.cyan('4. Create a checkpoint:')}
   nclaude save "initial-setup"

${chalk.cyan('5. Start live monitoring:')}
   nclaude monitor live

${chalk.yellow.bold('📚 DOCUMENTATION:')}
• Full Documentation: README.md
• Hook Configuration: .claude/settings.local.json
• Configuration: .nexus/claude-config.json
• Troubleshooting: nclaude help <command>

${chalk.yellow.bold('🔗 SUPPORT:')}
• Repository: https://github.com/nexus-framework/nexus-ai-claude
• Issues: https://github.com/nexus-framework/nexus-ai-claude/issues
• License: MIT (see LICENSE file)

${chalk.cyan.bold('═══════════════════════════════════════════════════════════════════')}
${chalk.yellow('TIP:')} Use ${chalk.green('nclaude help <command>')} for detailed help on specific commands
${chalk.cyan.bold('═══════════════════════════════════════════════════════════════════')}
`);
    });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}