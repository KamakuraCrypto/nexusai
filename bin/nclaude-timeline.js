#!/usr/bin/env node

/**
 * Nexus Timeline Commands
 * Advanced time-travel functionality for Claude conversations
 */

const { Command } = require('commander');
const chalk = require('../utils/colors');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora').default || require('ora');
const NexusWatcher = require('../tracking/nexus-watcher');
const ConversationTracker = require('../tracking/conversation-tracker');

const program = new Command();

// Storage paths
const NEXUS_PATH = path.join(process.cwd(), '.nexus');
const TIMELINE_PATH = path.join(NEXUS_PATH, 'timeline');
const CONVERSATION_PATH = path.join(NEXUS_PATH, 'conversations');

/**
 * Start the watcher daemon
 */
program
    .command('watch')
    .description('Start the file system watcher daemon')
    .option('-d, --detach', 'Run in background')
    .action(async (options) => {
        const spinner = ora('Starting file system watcher...').start();
        
        try {
            const watcher = new NexusWatcher({
                watchPath: process.cwd(),
                storagePath: TIMELINE_PATH
            });
            
            await watcher.start();
            spinner.succeed(chalk.green('File watcher started successfully'));
            
            if (options.detach) {
                console.log(chalk.cyan('Running in background. Use "nclaude timeline stop" to stop watching.'));
                // In a real implementation, we'd fork this process
                process.exit(0);
            } else {
                console.log(chalk.cyan('Watching for file changes. Press Ctrl+C to stop.'));
                
                // Keep process alive
                process.on('SIGINT', async () => {
                    console.log(chalk.yellow('\nStopping watcher...'));
                    await watcher.stop();
                    process.exit(0);
                });
            }
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to start watcher'));
            console.error(error);
            process.exit(1);
        }
    });

/**
 * Show timeline visualization
 */
program
    .command('show')
    .description('Display conversation timeline')
    .option('-n, --limit <number>', 'Number of turns to show', '10')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
        try {
            const conversationPath = path.join(CONVERSATION_PATH, 'conversation.json');
            
            if (!await fs.pathExists(conversationPath)) {
                console.log(chalk.yellow('No conversation history found'));
                return;
            }
            
            const conversation = await fs.readJson(conversationPath);
            const limit = parseInt(options.limit);
            
            console.log(chalk.cyan('\n═══ Conversation Timeline ═══\n'));
            console.log(chalk.gray(`Conversation ID: ${conversation.id}`));
            console.log(chalk.gray(`Started: ${new Date(conversation.startTime).toLocaleString()}`));
            console.log(chalk.gray(`Total turns: ${conversation.currentTurn}\n`));
            
            // Show turns
            const turnsToShow = conversation.turns.slice(-limit);
            
            for (const turn of turnsToShow) {
                const marker = turn.type === 'user' ? '👤' : '🤖';
                const color = turn.type === 'user' ? chalk.blue : chalk.green;
                
                console.log(`${marker} ${color(`Turn ${turn.number}`)}: ${chalk.gray(new Date(turn.timestamp).toLocaleTimeString())}`);
                
                // Show content preview
                const preview = turn.content.substring(0, 100);
                console.log(`   ${preview}${turn.content.length > 100 ? '...' : ''}`);
                
                // Show tools if present
                if (turn.tools && turn.tools.length > 0) {
                    console.log(chalk.gray(`   🔧 Tools used: ${turn.tools.length}`));
                }
                
                // Show file operations for this turn
                if (conversation.fileOperations) {
                    const turnOps = conversation.fileOperations.filter(op => op.turnNumber === turn.number);
                    if (turnOps.length > 0) {
                        for (const op of turnOps) {
                            const opIcon = op.operation === 'Write' ? '📝' : op.operation === 'Edit' ? '✏️' : '👁️';
                            console.log(chalk.gray(`   ${opIcon} ${op.operation}: ${op.path}`));
                        }
                    }
                }
                
                console.log();
            }
            
            // Show summary
            if (conversation.toolUsage && conversation.toolUsage.length > 0) {
                console.log(chalk.cyan('═══ Tool Usage Summary ═══\n'));
                for (const [name, stats] of conversation.toolUsage) {
                    console.log(`  ${name}: ${stats.count} uses (${stats.successes} ✅, ${stats.failures} ❌)`);
                }
                console.log();
            }
            
            // Show modified files
            if (conversation.fileOperations && conversation.fileOperations.length > 0) {
                const uniqueFiles = [...new Set(conversation.fileOperations.map(op => op.path))];
                console.log(chalk.cyan('═══ Modified Files ═══\n'));
                for (const file of uniqueFiles.slice(0, 10)) {
                    console.log(`  📁 ${file}`);
                }
                if (uniqueFiles.length > 10) {
                    console.log(chalk.gray(`  ... and ${uniqueFiles.length - 10} more`));
                }
                console.log();
            }
            
            process.exit(0);
            
        } catch (error) {
            console.error(chalk.red('Failed to display timeline:'), error.message);
            process.exit(1);
        }
    });

/**
 * Restore to specific turn
 */
program
    .command('restore <turn>')
    .description('Restore files to state at specific turn')
    .option('-p, --preview', 'Preview changes without applying')
    .option('-t, --temp', 'Restore to temporary directory')
    .action(async (turnNumber, options) => {
        const spinner = ora('Analyzing timeline...').start();
        
        try {
            const turn = parseInt(turnNumber);
            const timelineDataPath = path.join(TIMELINE_PATH, 'timeline', 'current.json');
            
            if (!await fs.pathExists(timelineDataPath)) {
                spinner.fail(chalk.red('No timeline data found'));
                process.exit(1);
            }
            
            const timelineData = await fs.readJson(timelineDataPath);
            const watcher = new NexusWatcher({ storagePath: TIMELINE_PATH });
            
            // Load timeline data
            await watcher.loadTimeline();
            
            spinner.text = `Restoring to turn ${turn}...`;
            
            const targetDir = options.temp 
                ? path.join(NEXUS_PATH, 'temp', `turn-${turn}`)
                : process.cwd();
            
            if (options.temp) {
                await fs.ensureDir(targetDir);
            }
            
            let restoredFiles = 0;
            const changes = [];
            
            // Restore each file to its state at the specified turn
            for (const [filePath, history] of watcher.timeline.fileHistory.entries()) {
                const content = await watcher.getFileAtTurn(filePath, turn);
                
                if (content !== null) {
                    const fullPath = path.join(targetDir, filePath);
                    
                    if (options.preview) {
                        // Just show what would be restored
                        const currentExists = await fs.pathExists(fullPath);
                        changes.push({
                            path: filePath,
                            action: currentExists ? 'modify' : 'create',
                            size: content.length
                        });
                    } else {
                        // Actually restore the file
                        await fs.ensureDir(path.dirname(fullPath));
                        await fs.writeFile(fullPath, content);
                        restoredFiles++;
                    }
                }
            }
            
            spinner.succeed(chalk.green(`Restoration complete`));
            
            if (options.preview) {
                console.log(chalk.cyan('\n═══ Preview of Changes ═══\n'));
                for (const change of changes) {
                    const icon = change.action === 'create' ? '➕' : '✏️';
                    console.log(`  ${icon} ${change.path} (${change.size} bytes)`);
                }
                console.log(chalk.gray(`\n${changes.length} files would be restored`));
            } else {
                console.log(chalk.green(`✅ Restored ${restoredFiles} files to turn ${turn}`));
                
                if (options.temp) {
                    console.log(chalk.cyan(`Files restored to: ${targetDir}`));
                }
            }
            
            process.exit(0);
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to restore'));
            console.error(error);
            process.exit(1);
        }
    });

/**
 * Compare two turns
 */
program
    .command('compare <turn1> <turn2>')
    .description('Compare file states between two turns')
    .option('-d, --detailed', 'Show detailed diff')
    .action(async (turn1, turn2, options) => {
        const spinner = ora('Comparing turns...').start();
        
        try {
            const t1 = parseInt(turn1);
            const t2 = parseInt(turn2);
            
            const watcher = new NexusWatcher({ storagePath: TIMELINE_PATH });
            await watcher.loadTimeline();
            
            const differences = {
                added: [],
                removed: [],
                modified: []
            };
            
            // Get all files from both turns
            const allFiles = new Set();
            for (const [filePath] of watcher.timeline.fileHistory.entries()) {
                allFiles.add(filePath);
            }
            
            for (const filePath of allFiles) {
                const content1 = await watcher.getFileAtTurn(filePath, t1);
                const content2 = await watcher.getFileAtTurn(filePath, t2);
                
                if (content1 === null && content2 !== null) {
                    differences.added.push(filePath);
                } else if (content1 !== null && content2 === null) {
                    differences.removed.push(filePath);
                } else if (content1 !== null && content2 !== null) {
                    if (!content1.equals(content2)) {
                        differences.modified.push({
                            path: filePath,
                            size1: content1.length,
                            size2: content2.length,
                            sizeDiff: content2.length - content1.length
                        });
                    }
                }
            }
            
            spinner.succeed(chalk.green('Comparison complete'));
            
            console.log(chalk.cyan(`\n═══ Changes from Turn ${t1} to Turn ${t2} ═══\n`));
            
            if (differences.added.length > 0) {
                console.log(chalk.green(`➕ Added (${differences.added.length}):`));
                for (const file of differences.added) {
                    console.log(`   ${file}`);
                }
                console.log();
            }
            
            if (differences.removed.length > 0) {
                console.log(chalk.red(`➖ Removed (${differences.removed.length}):`));
                for (const file of differences.removed) {
                    console.log(`   ${file}`);
                }
                console.log();
            }
            
            if (differences.modified.length > 0) {
                console.log(chalk.yellow(`✏️ Modified (${differences.modified.length}):`));
                for (const file of differences.modified) {
                    const sign = file.sizeDiff > 0 ? '+' : '';
                    console.log(`   ${file.path} (${sign}${file.sizeDiff} bytes)`);
                }
            }
            
            const total = differences.added.length + differences.removed.length + differences.modified.length;
            console.log(chalk.gray(`\nTotal changes: ${total}`));
            
            process.exit(0);
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to compare'));
            console.error(error);
            process.exit(1);
        }
    });

/**
 * Mark new turn in conversation
 */
program
    .command('turn')
    .description('Mark a new conversation turn')
    .action(async () => {
        try {
            const watcher = new NexusWatcher({ storagePath: TIMELINE_PATH });
            await watcher.loadTimeline();
            
            watcher.incrementTurn();
            
            console.log(chalk.green(`✅ Advanced to turn ${watcher.timeline.conversationTurn}`));
            
            // Also update conversation tracker if it exists
            const conversationPath = path.join(CONVERSATION_PATH, 'conversation.json');
            if (await fs.pathExists(conversationPath)) {
                const conversation = await fs.readJson(conversationPath);
                conversation.currentTurn = watcher.timeline.conversationTurn;
                await fs.writeJson(conversationPath, conversation, { spaces: 2 });
            }
            
            process.exit(0);
            
        } catch (error) {
            console.error(chalk.red('Failed to mark turn:'), error.message);
            process.exit(1);
        }
    });

/**
 * Create snapshot
 */
program
    .command('snapshot [description]')
    .description('Create a snapshot of current state')
    .action(async (description = '') => {
        const spinner = ora('Creating snapshot...').start();
        
        try {
            const watcher = new NexusWatcher({ storagePath: TIMELINE_PATH });
            await watcher.loadTimeline();
            
            const snapshotId = await watcher.createSnapshot(description || `Manual snapshot at turn ${watcher.timeline.conversationTurn}`);
            
            spinner.succeed(chalk.green('Snapshot created successfully'));
            console.log(chalk.cyan('Snapshot ID:'), snapshotId);
            
            process.exit(0);
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to create snapshot'));
            console.error(error);
            process.exit(1);
        }
    });

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
    program.outputHelp();
}