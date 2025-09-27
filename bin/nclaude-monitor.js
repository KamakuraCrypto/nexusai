#!/usr/bin/env node
/**
 * Monitoring Dashboard
 * Shows real-time status of conversation capture and tracking systems
 */

const path = require('path');
const fs = require('fs-extra');
const chalk = require('../utils/colors');
const Table = require('cli-table3');
const ConversationTracker = require('../tracking/conversation-tracker');
const ResponseCapture = require('../tracking/response-capture');
const EditTracker = require('../tracking/edit-tracker');
const AutoBackupDaemon = require('../utils/auto-backup-daemon');

const NEXUS_PATH = path.join(process.cwd(), '.nexus');

class Monitor {
    constructor() {
        this.conversationTracker = new ConversationTracker({
            storagePath: path.join(NEXUS_PATH, 'conversations')
        });
        this.responseCapture = new ResponseCapture({
            storagePath: path.join(NEXUS_PATH, 'responses')
        });
        this.editTracker = new EditTracker({
            storagePath: path.join(NEXUS_PATH, 'edits')
        });
        this.backupDaemon = new AutoBackupDaemon();
    }
    
    async initialize() {
        await this.conversationTracker.initialize();
        await this.responseCapture.initialize();
        await this.editTracker.initialize();
    }
    
    /**
     * Show comprehensive dashboard
     */
    async showDashboard() {
        console.clear();
        console.log(chalk.cyan('═══════════════════════════════════════'));
        console.log(chalk.cyan('        NEXUS AI MONITORING DASHBOARD'));
        console.log(chalk.cyan('═══════════════════════════════════════'));
        console.log();
        
        await this.initialize();
        
        // System Status
        await this.showSystemStatus();
        console.log();
        
        // Conversation Stats
        await this.showConversationStats();
        console.log();
        
        // Response Stats
        await this.showResponseStats();
        console.log();
        
        // Edit Stats
        await this.showEditStats();
        console.log();
        
        // Backup Status
        await this.showBackupStatus();
        console.log();
        
        // Recent Activity
        await this.showRecentActivity();
        console.log();
        
        // Storage Usage
        await this.showStorageUsage();
        
        console.log(chalk.gray('\nPress Ctrl+C to exit'));
    }
    
    /**
     * Show system status
     */
    async showSystemStatus() {
        console.log(chalk.yellow('📊 SYSTEM STATUS'));
        
        const table = new Table({
            head: ['Component', 'Status', 'Details'],
            colWidths: [20, 15, 50]
        });
        
        // Check conversation tracker
        const conversationStatus = this.conversationTracker.conversation ? 
            chalk.green('✅ Active') : chalk.red('❌ Inactive');
        const conversationDetails = this.conversationTracker.conversation ? 
            `ID: ${this.conversationTracker.conversation.id.substr(0, 20)}...` : 
            'No active conversation';
        
        table.push(['Conversation Tracker', conversationStatus, conversationDetails]);
        
        // Check response capture
        const responseStatus = this.responseCapture.responseHistory.length > 0 ? 
            chalk.green('✅ Active') : chalk.yellow('⚠️ No Data');
        const responseDetails = `${this.responseCapture.responseHistory.length} responses captured`;
        
        table.push(['Response Capture', responseStatus, responseDetails]);
        
        // Check edit tracker
        const editStatus = this.editTracker.editHistory.length > 0 ? 
            chalk.green('✅ Active') : chalk.yellow('⚠️ No Data');
        const editDetails = `${this.editTracker.editHistory.length} edits tracked`;
        
        table.push(['Edit Tracker', editStatus, editDetails]);
        
        // Check file watcher
        const watcherPidFile = path.join(NEXUS_PATH, 'watcher.pid');
        const watcherStatus = await fs.pathExists(watcherPidFile) ? 
            chalk.green('✅ Running') : chalk.red('❌ Stopped');
        const watcherDetails = await fs.pathExists(watcherPidFile) ? 
            `PID: ${await fs.readFile(watcherPidFile, 'utf8').catch(() => 'Unknown')}` : 
            'Not running';
        
        table.push(['File Watcher', watcherStatus, watcherDetails]);
        
        // Check backup daemon
        const backupPidFile = path.join(NEXUS_PATH, 'backup-daemon.pid');
        const backupStatus = await fs.pathExists(backupPidFile) ? 
            chalk.green('✅ Running') : chalk.red('❌ Stopped');
        const backupDetails = await fs.pathExists(backupPidFile) ? 
            'Automatic backups active' : 
            'No automatic backups';
        
        table.push(['Backup Daemon', backupStatus, backupDetails]);
        
        console.log(table.toString());
    }
    
    /**
     * Show conversation statistics
     */
    async showConversationStats() {
        console.log(chalk.yellow('💬 CONVERSATION STATISTICS'));
        
        const conversation = this.conversationTracker.conversation;
        if (!conversation) {
            console.log(chalk.gray('No active conversation'));
            return;
        }
        
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 30]
        });
        
        table.push(['Conversation ID', conversation.id]);
        table.push(['Started', new Date(conversation.startTime).toLocaleString()]);
        table.push(['Current Turn', conversation.currentTurn.toString()]);
        table.push(['Total Turns', conversation.turns.length.toString()]);
        
        // Calculate session duration
        const duration = Date.now() - new Date(conversation.startTime).getTime();
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        table.push(['Session Duration', `${hours}h ${minutes}m`]);
        
        // Tool usage
        if (conversation.toolUsage && conversation.toolUsage.length > 0) {
            const totalTools = conversation.toolUsage.reduce((sum, [_, stats]) => sum + stats.count, 0);
            table.push(['Tools Used', totalTools.toString()]);
        }
        
        // File operations
        if (conversation.fileOperations) {
            table.push(['File Operations', conversation.fileOperations.length.toString()]);
        }
        
        console.log(table.toString());
    }
    
    /**
     * Show response statistics
     */
    async showResponseStats() {
        console.log(chalk.yellow('🤖 RESPONSE STATISTICS'));
        
        const responses = this.responseCapture.responseHistory;
        
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 30]
        });
        
        table.push(['Total Responses', responses.length.toString()]);
        
        if (responses.length > 0) {
            const totalLength = responses.reduce((sum, r) => sum + r.length, 0);
            const avgLength = Math.round(totalLength / responses.length);
            
            table.push(['Average Length', `${avgLength} chars`]);
            table.push(['Total Content', `${Math.round(totalLength / 1024)} KB`]);
            
            const lastResponse = responses[responses.length - 1];
            table.push(['Last Response', new Date(lastResponse.timestamp).toLocaleString()]);
            
            // Responses with thinking
            const withThinking = responses.filter(r => r.hasThinking).length;
            table.push(['With Thinking', `${withThinking} (${Math.round(withThinking/responses.length*100)}%)`]);
        }
        
        console.log(table.toString());
    }
    
    /**
     * Show edit statistics
     */
    async showEditStats() {
        console.log(chalk.yellow('✏️ EDIT STATISTICS'));
        
        const edits = this.editTracker.editHistory;
        
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 30]
        });
        
        table.push(['Total Edits', edits.length.toString()]);
        table.push(['Files Changed', this.editTracker.fileEditMap.size.toString()]);
        
        if (edits.length > 0) {
            const totalAdded = edits.reduce((sum, e) => sum + e.metrics.linesAdded, 0);
            const totalRemoved = edits.reduce((sum, e) => sum + e.metrics.linesRemoved, 0);
            
            table.push(['Lines Added', totalAdded.toString()]);
            table.push(['Lines Removed', totalRemoved.toString()]);
            table.push(['Net Change', (totalAdded - totalRemoved).toString()]);
            
            const lastEdit = edits[edits.length - 1];
            table.push(['Last Edit', new Date(lastEdit.timestamp).toLocaleString()]);
            table.push(['Last File', path.basename(lastEdit.filePath)]);
            
            // Edit operations breakdown
            const operations = {};
            edits.forEach(e => {
                operations[e.operation] = (operations[e.operation] || 0) + 1;
            });
            
            const opSummary = Object.entries(operations)
                .map(([op, count]) => `${op}: ${count}`)
                .join(', ');
            table.push(['Operations', opSummary]);
        }
        
        console.log(table.toString());
    }
    
    /**
     * Show backup status
     */
    async showBackupStatus() {
        console.log(chalk.yellow('💾 BACKUP STATUS'));
        
        const backupPath = path.join(NEXUS_PATH, 'backups');
        const statsFile = path.join(backupPath, 'stats.json');
        
        let backupStats = {};
        if (await fs.pathExists(statsFile)) {
            backupStats = await fs.readJson(statsFile);
        }
        
        const table = new Table({
            head: ['Type', 'Count', 'Last Backup', 'Status'],
            colWidths: [15, 10, 25, 20]
        });
        
        // Quick backups
        const quickDir = path.join(backupPath, 'quick');
        const quickCount = await this.countBackups(quickDir);
        table.push([
            'Quick (5min)',
            quickCount.toString(),
            backupStats.lastBackup ? new Date(backupStats.lastBackup).toLocaleString() : 'Never',
            quickCount > 0 ? chalk.green('✅ Active') : chalk.red('❌ None')
        ]);
        
        // Hourly backups
        const hourlyDir = path.join(backupPath, 'hourly');
        const hourlyCount = await this.countBackups(hourlyDir);
        table.push([
            'Hourly',
            hourlyCount.toString(),
            hourlyCount > 0 ? 'Available' : 'None',
            hourlyCount > 0 ? chalk.green('✅ Active') : chalk.yellow('⚠️ None')
        ]);
        
        // Daily backups
        const dailyDir = path.join(backupPath, 'daily');
        const dailyCount = await this.countBackups(dailyDir);
        table.push([
            'Daily',
            dailyCount.toString(),
            dailyCount > 0 ? 'Available' : 'None',
            dailyCount > 0 ? chalk.green('✅ Active') : chalk.yellow('⚠️ None')
        ]);
        
        // Manual backups
        const manualDir = path.join(backupPath, 'manual');
        const manualCount = await this.countBackups(manualDir);
        table.push([
            'Manual',
            manualCount.toString(),
            manualCount > 0 ? 'Available' : 'None',
            manualCount > 0 ? chalk.blue('📦 Available') : chalk.gray('None')
        ]);
        
        console.log(table.toString());
        
        if (backupStats.totalBackups) {
            console.log(chalk.gray(`Total backups created: ${backupStats.totalBackups}`));
        }
        
        if (backupStats.lastError) {
            console.log(chalk.red(`Last error: ${backupStats.lastError}`));
        }
    }
    
    /**
     * Show recent activity
     */
    async showRecentActivity() {
        console.log(chalk.yellow('📈 RECENT ACTIVITY'));
        
        const activities = [];
        
        // Recent conversations
        const conversation = this.conversationTracker.conversation;
        if (conversation && conversation.turns) {
            const recentTurns = conversation.turns.slice(-5);
            recentTurns.forEach(turn => {
                activities.push({
                    timestamp: turn.timestamp,
                    type: turn.type === 'user' ? '👤 User' : '🤖 Assistant',
                    description: turn.content.substring(0, 50) + (turn.content.length > 50 ? '...' : ''),
                    category: 'conversation'
                });
            });
        }
        
        // Recent edits
        const recentEdits = this.editTracker.editHistory.slice(-5);
        recentEdits.forEach(edit => {
            activities.push({
                timestamp: edit.timestamp,
                type: '✏️ Edit',
                description: `${path.basename(edit.filePath)}: ${edit.operation} (+${edit.metrics.linesAdded} -${edit.metrics.linesRemoved})`,
                category: 'edit'
            });
        });
        
        // Sort by timestamp (most recent first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (activities.length === 0) {
            console.log(chalk.gray('No recent activity'));
            return;
        }
        
        const table = new Table({
            head: ['Time', 'Type', 'Description'],
            colWidths: [20, 15, 60]
        });
        
        activities.slice(0, 10).forEach(activity => {
            table.push([
                new Date(activity.timestamp).toLocaleString(),
                activity.type,
                activity.description
            ]);
        });
        
        console.log(table.toString());
    }
    
    /**
     * Show storage usage
     */
    async showStorageUsage() {
        console.log(chalk.yellow('💿 STORAGE USAGE'));
        
        const table = new Table({
            head: ['Directory', 'Size', 'Files', 'Description'],
            colWidths: [20, 12, 8, 40]
        });
        
        const directories = [
            { path: 'conversations', name: 'Conversations', desc: 'User prompts and conversation data' },
            { path: 'responses', name: 'Responses', desc: 'AI responses and thinking processes' },
            { path: 'edits', name: 'Edits', desc: 'File edit history and diffs' },
            { path: 'timeline', name: 'Timeline', desc: 'File version history (git-like)' },
            { path: 'backups', name: 'Backups', desc: 'Automatic and manual backups' },
            { path: 'claude', name: 'Claude Sessions', desc: 'Claude Code session data' }
        ];
        
        for (const dir of directories) {
            const dirPath = path.join(NEXUS_PATH, dir.path);
            const stats = await this.getDirectoryStats(dirPath);
            
            table.push([
                dir.name,
                this.formatSize(stats.size),
                stats.files.toString(),
                dir.desc
            ]);
        }
        
        // Total
        const totalStats = await this.getDirectoryStats(NEXUS_PATH);
        table.push([
            chalk.bold('TOTAL'),
            chalk.bold(this.formatSize(totalStats.size)),
            chalk.bold(totalStats.files.toString()),
            chalk.bold('All Nexus data')
        ]);
        
        console.log(table.toString());
    }
    
    /**
     * Count backups in directory
     */
    async countBackups(dir) {
        if (!await fs.pathExists(dir)) {
            return 0;
        }
        
        const files = await fs.readdir(dir);
        return files.length;
    }
    
    /**
     * Get directory statistics
     */
    async getDirectoryStats(dirPath) {
        if (!await fs.pathExists(dirPath)) {
            return { size: 0, files: 0 };
        }
        
        let totalSize = 0;
        let fileCount = 0;
        
        const calculateSize = async (currentPath) => {
            const stat = await fs.stat(currentPath);
            
            if (stat.isDirectory()) {
                const items = await fs.readdir(currentPath);
                for (const item of items) {
                    await calculateSize(path.join(currentPath, item));
                }
            } else {
                totalSize += stat.size;
                fileCount++;
            }
        };
        
        try {
            await calculateSize(dirPath);
        } catch (error) {
            // Ignore permission errors
        }
        
        return { size: totalSize, files: fileCount };
    }
    
    /**
     * Format file size
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Live monitoring mode
     */
    async startLiveMonitoring() {
        console.log(chalk.green('Starting live monitoring...'));
        console.log(chalk.gray('Press Ctrl+C to stop\n'));
        
        const update = async () => {
            await this.showDashboard();
            console.log(chalk.gray(`\nLast updated: ${new Date().toLocaleString()}`));
            console.log(chalk.gray('Refreshing in 30 seconds...'));
        };
        
        // Initial display
        await update();
        
        // Set up periodic updates
        const interval = setInterval(update, 30000); // Every 30 seconds
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            clearInterval(interval);
            console.log(chalk.yellow('\n\nMonitoring stopped'));
            process.exit(0);
        });
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        console.log(chalk.cyan('🏥 SYSTEM HEALTH CHECK\n'));
        
        let issues = 0;
        
        // Check if conversation is being tracked
        const conversation = this.conversationTracker.conversation;
        if (!conversation) {
            console.log(chalk.red('❌ No active conversation found'));
            issues++;
        } else {
            console.log(chalk.green('✅ Active conversation tracked'));
        }
        
        // Check if responses are being captured
        if (this.responseCapture.responseHistory.length === 0) {
            console.log(chalk.yellow('⚠️ No responses captured yet'));
            issues++;
        } else {
            console.log(chalk.green(`✅ ${this.responseCapture.responseHistory.length} responses captured`));
        }
        
        // Check if edits are being tracked
        if (this.editTracker.editHistory.length === 0) {
            console.log(chalk.yellow('⚠️ No edits tracked yet'));
            issues++;
        } else {
            console.log(chalk.green(`✅ ${this.editTracker.editHistory.length} edits tracked`));
        }
        
        // Check file watcher
        const watcherPidFile = path.join(NEXUS_PATH, 'watcher.pid');
        if (!await fs.pathExists(watcherPidFile)) {
            console.log(chalk.red('❌ File watcher not running'));
            console.log(chalk.gray('   Run: nclaude timeline watch --start'));
            issues++;
        } else {
            console.log(chalk.green('✅ File watcher running'));
        }
        
        // Check hooks
        const hooksDir = path.join(process.cwd(), '.claude', 'hooks');
        if (!await fs.pathExists(hooksDir)) {
            console.log(chalk.red('❌ Claude hooks not found'));
            console.log(chalk.gray('   Run: nclaude init'));
            issues++;
        } else {
            console.log(chalk.green('✅ Claude hooks configured'));
        }
        
        console.log();
        
        if (issues === 0) {
            console.log(chalk.green('🎉 All systems operational!'));
        } else {
            console.log(chalk.yellow(`⚠️ Found ${issues} issue(s) that need attention`));
        }
        
        return issues === 0;
    }
}

// CLI Interface
const program = require('commander');

program
    .version('1.0.0')
    .description('Nexus AI monitoring dashboard');

program
    .command('dashboard')
    .description('Show monitoring dashboard')
    .alias('show')
    .action(async () => {
        const monitor = new Monitor();
        await monitor.showDashboard();
    });

program
    .command('live')
    .description('Start live monitoring mode')
    .action(async () => {
        const monitor = new Monitor();
        await monitor.startLiveMonitoring();
    });

program
    .command('health')
    .description('Run system health check')
    .action(async () => {
        const monitor = new Monitor();
        await monitor.initialize();
        const healthy = await monitor.healthCheck();
        process.exit(healthy ? 0 : 1);
    });

// Default action
if (!process.argv.slice(2).length) {
    const monitor = new Monitor();
    monitor.showDashboard();
}

program.parse(process.argv);

module.exports = Monitor;