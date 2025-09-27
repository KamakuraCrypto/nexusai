#!/usr/bin/env node
/**
 * Auto-Backup Daemon
 * Automatically creates backups of conversations, responses, and edits
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');
const { Logger } = require('./logger');

class AutoBackupDaemon {
    constructor(options = {}) {
        this.logger = new Logger('AutoBackupDaemon');
        
        this.config = {
            projectPath: options.projectPath || process.cwd(),
            nexusPath: options.nexusPath || path.join(process.cwd(), '.nexus'),
            backupPath: options.backupPath || path.join(process.cwd(), '.nexus', 'backups'),
            
            // Backup intervals
            quickBackupInterval: options.quickBackupInterval || '*/5 * * * *', // Every 5 minutes
            hourlyBackupInterval: options.hourlyBackupInterval || '0 * * * *',  // Every hour
            dailyBackupInterval: options.dailyBackupInterval || '0 0 * * *',   // Every day
            
            // Retention policies
            keepQuickBackups: options.keepQuickBackups || 12,     // 12 * 5min = 1 hour
            keepHourlyBackups: options.keepHourlyBackups || 48,   // 48 hours = 2 days
            keepDailyBackups: options.keepDailyBackups || 30,     // 30 days
            
            // Compression
            compressBackups: options.compressBackups !== false,
            compressAfterDays: options.compressAfterDays || 1,
            
            // What to backup
            backupConversations: options.backupConversations !== false,
            backupResponses: options.backupResponses !== false,
            backupEdits: options.backupEdits !== false,
            backupTimeline: options.backupTimeline !== false,
            backupCode: options.backupCode !== false,
            
            pidFile: options.pidFile || path.join(process.cwd(), '.nexus', 'backup-daemon.pid'),
            logFile: options.logFile || path.join(process.cwd(), '.nexus', 'backup-daemon.log')
        };
        
        this.isRunning = false;
        this.tasks = [];
        this.stats = {
            totalBackups: 0,
            lastBackup: null,
            lastError: null,
            backupSizes: {}
        };
    }
    
    /**
     * Start the backup daemon
     */
    async start() {
        if (this.isRunning) {
            this.logger.warn('Backup daemon is already running');
            return;
        }
        
        this.logger.info('🔄 Starting auto-backup daemon');
        
        // Ensure directories exist
        await fs.ensureDir(this.config.backupPath);
        await fs.ensureDir(path.join(this.config.backupPath, 'quick'));
        await fs.ensureDir(path.join(this.config.backupPath, 'hourly'));
        await fs.ensureDir(path.join(this.config.backupPath, 'daily'));
        await fs.ensureDir(path.join(this.config.backupPath, 'manual'));
        
        // Load existing stats
        await this.loadStats();
        
        // Schedule backup tasks
        this.scheduleBackups();
        
        // Create PID file
        await fs.writeFile(this.config.pidFile, process.pid.toString());
        
        this.isRunning = true;
        this.logger.info('✅ Auto-backup daemon started');
        
        // Handle graceful shutdown
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
        
        // Initial backup
        await this.createQuickBackup();
    }
    
    /**
     * Stop the backup daemon
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.logger.info('⏹️ Stopping auto-backup daemon');
        
        // Stop all scheduled tasks
        this.tasks.forEach(task => {
            if (task.destroy) {
                task.destroy();
            }
        });
        this.tasks = [];
        
        // Remove PID file
        try {
            await fs.remove(this.config.pidFile);
        } catch (error) {
            // Ignore if file doesn't exist
        }
        
        // Save stats
        await this.saveStats();
        
        this.isRunning = false;
        this.logger.info('✅ Auto-backup daemon stopped');
        
        process.exit(0);
    }
    
    /**
     * Schedule backup tasks
     */
    scheduleBackups() {
        // Quick backups (every 5 minutes)
        const quickTask = cron.schedule(this.config.quickBackupInterval, async () => {
            await this.createQuickBackup();
        }, { scheduled: false });
        
        // Hourly backups
        const hourlyTask = cron.schedule(this.config.hourlyBackupInterval, async () => {
            await this.createHourlyBackup();
        }, { scheduled: false });
        
        // Daily backups
        const dailyTask = cron.schedule(this.config.dailyBackupInterval, async () => {
            await this.createDailyBackup();
        }, { scheduled: false });
        
        // Cleanup task (every 6 hours)
        const cleanupTask = cron.schedule('0 */6 * * *', async () => {
            await this.cleanupOldBackups();
        }, { scheduled: false });
        
        // Start all tasks
        quickTask.start();
        hourlyTask.start();
        dailyTask.start();
        cleanupTask.start();
        
        this.tasks = [quickTask, hourlyTask, dailyTask, cleanupTask];
        
        this.logger.info('📅 Backup schedules configured');
    }
    
    /**
     * Create quick backup (lightweight)
     */
    async createQuickBackup() {
        const backupId = `quick-${Date.now()}`;
        const backupDir = path.join(this.config.backupPath, 'quick', backupId);
        
        try {
            await fs.ensureDir(backupDir);
            
            // Backup conversations and responses only
            if (this.config.backupConversations) {
                await this.backupDirectory(
                    path.join(this.config.nexusPath, 'conversations'),
                    path.join(backupDir, 'conversations')
                );
            }
            
            if (this.config.backupResponses) {
                await this.backupDirectory(
                    path.join(this.config.nexusPath, 'responses'),
                    path.join(backupDir, 'responses')
                );
            }
            
            // Create backup manifest
            await this.createBackupManifest(backupDir, 'quick');
            
            this.stats.totalBackups++;
            this.stats.lastBackup = new Date().toISOString();
            
            this.logger.debug(`📦 Created quick backup: ${backupId}`);
            
            // Cleanup old quick backups
            await this.cleanupBackupType('quick', this.config.keepQuickBackups);
            
        } catch (error) {
            this.logger.error(`Failed to create quick backup: ${error.message}`);
            this.stats.lastError = error.message;
        }
    }
    
    /**
     * Create hourly backup (moderate)
     */
    async createHourlyBackup() {
        const backupId = `hourly-${Date.now()}`;
        const backupDir = path.join(this.config.backupPath, 'hourly', backupId);
        
        try {
            await fs.ensureDir(backupDir);
            
            // Backup conversations, responses, and recent edits
            if (this.config.backupConversations) {
                await this.backupDirectory(
                    path.join(this.config.nexusPath, 'conversations'),
                    path.join(backupDir, 'conversations')
                );
            }
            
            if (this.config.backupResponses) {
                await this.backupDirectory(
                    path.join(this.config.nexusPath, 'responses'),
                    path.join(backupDir, 'responses')
                );
            }
            
            if (this.config.backupEdits) {
                // Only backup recent edits (last 24 hours)
                await this.backupRecentEdits(backupDir);
            }
            
            // Backup Claude sessions
            await this.backupDirectory(
                path.join(this.config.nexusPath, 'claude'),
                path.join(backupDir, 'claude')
            );
            
            // Create backup manifest
            await this.createBackupManifest(backupDir, 'hourly');
            
            this.stats.totalBackups++;
            this.stats.lastBackup = new Date().toISOString();
            
            this.logger.info(`📦 Created hourly backup: ${backupId}`);
            
            // Cleanup old hourly backups
            await this.cleanupBackupType('hourly', this.config.keepHourlyBackups);
            
        } catch (error) {
            this.logger.error(`Failed to create hourly backup: ${error.message}`);
            this.stats.lastError = error.message;
        }
    }
    
    /**
     * Create daily backup (comprehensive)
     */
    async createDailyBackup() {
        const backupId = `daily-${Date.now()}`;
        const backupDir = path.join(this.config.backupPath, 'daily', backupId);
        
        try {
            await fs.ensureDir(backupDir);
            
            // Backup everything
            if (this.config.backupConversations) {
                await this.backupDirectory(
                    path.join(this.config.nexusPath, 'conversations'),
                    path.join(backupDir, 'conversations')
                );
            }
            
            if (this.config.backupResponses) {
                await this.backupDirectory(
                    path.join(this.config.nexusPath, 'responses'),
                    path.join(backupDir, 'responses')
                );
            }
            
            if (this.config.backupEdits) {
                await this.backupDirectory(
                    path.join(this.config.nexusPath, 'edits'),
                    path.join(backupDir, 'edits')
                );
            }
            
            if (this.config.backupTimeline) {
                // Backup timeline metadata, not full objects (too large)
                await this.backupTimelineMetadata(backupDir);
            }
            
            // Backup important project files
            if (this.config.backupCode) {
                await this.backupProjectFiles(backupDir);
            }
            
            // Create backup manifest
            await this.createBackupManifest(backupDir, 'daily');
            
            // Compress if enabled
            if (this.config.compressBackups) {
                await this.compressBackup(backupDir);
            }
            
            this.stats.totalBackups++;
            this.stats.lastBackup = new Date().toISOString();
            
            this.logger.info(`📦 Created daily backup: ${backupId}`);
            
            // Cleanup old daily backups
            await this.cleanupBackupType('daily', this.config.keepDailyBackups);
            
        } catch (error) {
            this.logger.error(`Failed to create daily backup: ${error.message}`);
            this.stats.lastError = error.message;
        }
    }
    
    /**
     * Backup a directory
     */
    async backupDirectory(sourcePath, targetPath) {
        if (!await fs.pathExists(sourcePath)) {
            return;
        }
        
        await fs.copy(sourcePath, targetPath, {
            preserveTimestamps: true,
            filter: (src) => {
                // Skip temporary files and large objects
                const basename = path.basename(src);
                if (basename.startsWith('.') || basename.endsWith('.tmp')) {
                    return false;
                }
                
                // Skip very large files (> 10MB)
                try {
                    const stat = fs.statSync(src);
                    if (stat.size > 10 * 1024 * 1024) {
                        return false;
                    }
                } catch (error) {
                    // Ignore stat errors
                }
                
                return true;
            }
        });
    }
    
    /**
     * Backup recent edits only
     */
    async backupRecentEdits(backupDir) {
        const editsPath = path.join(this.config.nexusPath, 'edits');
        if (!await fs.pathExists(editsPath)) {
            return;
        }
        
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentEditsDir = path.join(backupDir, 'recent-edits');
        await fs.ensureDir(recentEditsDir);
        
        // Copy only recent edit files
        const files = await fs.readdir(editsPath);
        for (const file of files) {
            const filePath = path.join(editsPath, file);
            const stat = await fs.stat(filePath);
            
            if (stat.mtime.getTime() > oneDayAgo) {
                await fs.copy(filePath, path.join(recentEditsDir, file));
            }
        }
    }
    
    /**
     * Backup timeline metadata
     */
    async backupTimelineMetadata(backupDir) {
        const timelinePath = path.join(this.config.nexusPath, 'timeline');
        if (!await fs.pathExists(timelinePath)) {
            return;
        }
        
        const metadataDir = path.join(backupDir, 'timeline-metadata');
        await fs.ensureDir(metadataDir);
        
        // Copy timeline files but not object store
        const items = await fs.readdir(timelinePath);
        for (const item of items) {
            if (item !== 'objects') {
                const itemPath = path.join(timelinePath, item);
                await fs.copy(itemPath, path.join(metadataDir, item));
            }
        }
    }
    
    /**
     * Backup important project files
     */
    async backupProjectFiles(backupDir) {
        const projectDir = path.join(backupDir, 'project-files');
        await fs.ensureDir(projectDir);
        
        const importantFiles = [
            'package.json',
            'package-lock.json',
            '.claude/settings.local.json',
            'README.md',
            'CLAUDE_HOOKS.md'
        ];
        
        for (const file of importantFiles) {
            const sourcePath = path.join(this.config.projectPath, file);
            if (await fs.pathExists(sourcePath)) {
                const targetPath = path.join(projectDir, file);
                await fs.ensureDir(path.dirname(targetPath));
                await fs.copy(sourcePath, targetPath);
            }
        }
    }
    
    /**
     * Create backup manifest
     */
    async createBackupManifest(backupDir, type) {
        const manifest = {
            id: path.basename(backupDir),
            type: type,
            timestamp: new Date().toISOString(),
            projectPath: this.config.projectPath,
            contents: [],
            stats: {
                totalSize: 0,
                fileCount: 0
            }
        };
        
        // Calculate backup size and file count
        const calculateStats = async (dir, relativePath = '') => {
            const items = await fs.readdir(dir);
            
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = await fs.stat(itemPath);
                const itemRelativePath = path.join(relativePath, item);
                
                if (stat.isDirectory()) {
                    manifest.contents.push({
                        path: itemRelativePath,
                        type: 'directory',
                        size: 0
                    });
                    await calculateStats(itemPath, itemRelativePath);
                } else {
                    manifest.contents.push({
                        path: itemRelativePath,
                        type: 'file',
                        size: stat.size,
                        mtime: stat.mtime.toISOString()
                    });
                    manifest.stats.totalSize += stat.size;
                    manifest.stats.fileCount++;
                }
            }
        };
        
        await calculateStats(backupDir);
        
        const manifestPath = path.join(backupDir, 'manifest.json');
        await fs.writeJson(manifestPath, manifest, { spaces: 2 });
        
        this.stats.backupSizes[type] = manifest.stats.totalSize;
    }
    
    /**
     * Compress backup directory
     */
    async compressBackup(backupDir) {
        const archivePath = `${backupDir}.tar.gz`;
        
        return new Promise((resolve, reject) => {
            const tar = spawn('tar', [
                '-czf', archivePath,
                '-C', path.dirname(backupDir),
                path.basename(backupDir)
            ]);
            
            tar.on('close', async (code) => {
                if (code === 0) {
                    // Remove original directory after successful compression
                    await fs.remove(backupDir);
                    resolve();
                } else {
                    reject(new Error(`tar exited with code ${code}`));
                }
            });
            
            tar.on('error', reject);
        });
    }
    
    /**
     * Cleanup old backups
     */
    async cleanupOldBackups() {
        await this.cleanupBackupType('quick', this.config.keepQuickBackups);
        await this.cleanupBackupType('hourly', this.config.keepHourlyBackups);
        await this.cleanupBackupType('daily', this.config.keepDailyBackups);
        
        this.logger.debug('🧹 Cleaned up old backups');
    }
    
    /**
     * Cleanup specific backup type
     */
    async cleanupBackupType(type, keepCount) {
        const backupTypeDir = path.join(this.config.backupPath, type);
        if (!await fs.pathExists(backupTypeDir)) {
            return;
        }
        
        const backups = await fs.readdir(backupTypeDir);
        
        // Sort by creation time (newest first)
        const backupStats = await Promise.all(
            backups.map(async (backup) => {
                const backupPath = path.join(backupTypeDir, backup);
                const stat = await fs.stat(backupPath);
                return {
                    name: backup,
                    path: backupPath,
                    mtime: stat.mtime
                };
            })
        );
        
        backupStats.sort((a, b) => b.mtime - a.mtime);
        
        // Remove old backups
        const toRemove = backupStats.slice(keepCount);
        for (const backup of toRemove) {
            await fs.remove(backup.path);
            this.logger.debug(`🗑️ Removed old backup: ${backup.name}`);
        }
    }
    
    /**
     * Create manual backup
     */
    async createManualBackup(name) {
        const backupId = `manual-${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const backupDir = path.join(this.config.backupPath, 'manual', backupId);
        
        await fs.ensureDir(backupDir);
        
        // Full backup
        await this.backupDirectory(
            this.config.nexusPath,
            path.join(backupDir, 'nexus')
        );
        
        await this.createBackupManifest(backupDir, 'manual');
        
        this.logger.info(`📦 Created manual backup: ${backupId}`);
        
        return backupId;
    }
    
    /**
     * Get backup status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            stats: this.stats,
            config: {
                quickBackupInterval: this.config.quickBackupInterval,
                hourlyBackupInterval: this.config.hourlyBackupInterval,
                dailyBackupInterval: this.config.dailyBackupInterval
            }
        };
    }
    
    /**
     * Load stats
     */
    async loadStats() {
        const statsFile = path.join(this.config.backupPath, 'stats.json');
        
        if (await fs.pathExists(statsFile)) {
            this.stats = { ...this.stats, ...(await fs.readJson(statsFile)) };
        }
    }
    
    /**
     * Save stats
     */
    async saveStats() {
        const statsFile = path.join(this.config.backupPath, 'stats.json');
        await fs.writeJson(statsFile, this.stats, { spaces: 2 });
    }
}

module.exports = AutoBackupDaemon;

// CLI usage
if (require.main === module) {
    const program = require('commander');
    
    program
        .version('1.0.0')
        .description('Auto-backup daemon for Nexus AI');
    
    program
        .command('start')
        .description('Start the backup daemon')
        .option('-c, --config <file>', 'Config file path')
        .action(async (options) => {
            const daemon = new AutoBackupDaemon(options.config ? require(options.config) : {});
            await daemon.start();
            
            // Keep process alive
            process.on('SIGINT', () => daemon.stop());
            process.on('SIGTERM', () => daemon.stop());
        });
    
    program
        .command('backup <name>')
        .description('Create manual backup')
        .action(async (name) => {
            const daemon = new AutoBackupDaemon();
            const backupId = await daemon.createManualBackup(name);
            console.log(`Created backup: ${backupId}`);
        });
    
    program
        .command('status')
        .description('Show backup status')
        .action(async () => {
            const daemon = new AutoBackupDaemon();
            const status = daemon.getStatus();
            
            console.log('Backup Daemon Status:');
            console.log(`  Running: ${status.isRunning}`);
            console.log(`  Total backups: ${status.stats.totalBackups}`);
            console.log(`  Last backup: ${status.stats.lastBackup || 'Never'}`);
            
            if (status.stats.lastError) {
                console.log(`  Last error: ${status.stats.lastError}`);
            }
        });
    
    program.parse(process.argv);
}