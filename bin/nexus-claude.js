#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
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
    
    // Connect components
    contextManager.setSummarizer(summarizer);
    conversationHooks.setContextManager(contextManager);
    conversationHooks.setSessionManager(sessionManager);
    conversationHooks.setFileTracker(fileTracker);
    conversationHooks.setArtifactManager(artifactManager);
    contextRestorer.setSessionManager(sessionManager);
    contextRestorer.setFileTracker(fileTracker);
    contextRestorer.setArtifactManager(artifactManager);
}

program
    .name('nexus-claude')
    .description('Claude Code integration for the Nexus AI Framework')
    .version('1.0.0');

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
            
            spinner.succeed(chalk.green('Claude Code integration initialized successfully!'));
            console.log(chalk.cyan('\nNext steps:'));
            console.log('  1. Run', chalk.yellow('nexus claude status'), 'to check context usage');
            console.log('  2. Run', chalk.yellow('nexus claude save'), 'to manually save session');
            console.log('  3. Run', chalk.yellow('nexus claude help'), 'for all available commands');
            
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
            
            const status = await contextManager.getStatus();
            const session = await sessionManager.getCurrentSession();
            const files = await fileTracker.getTrackedFiles();
            const artifacts = await artifactManager.getAllArtifacts();
            
            console.log(chalk.cyan.bold('\n═══ Claude Context Status ═══\n'));
            
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

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}