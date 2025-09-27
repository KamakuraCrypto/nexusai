#!/usr/bin/env node

/**
 * Nexus File System Watcher Daemon
 * Monitors all file changes in real-time and maintains complete history
 * This provides git-like versioning for every single file change
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
const { Logger } = require('../utils/logger');

class NexusWatcher {
    constructor(options = {}) {
        this.logger = new Logger('NexusWatcher');
        
        this.config = {
            watchPath: options.watchPath || process.cwd(),
            storagePath: options.storagePath || path.join(process.cwd(), '.nexus', 'timeline'),
            ignorePaths: options.ignorePaths || [
                '.nexus',
                'node_modules',
                '.git',
                '*.log',
                '*.tmp',
                '.DS_Store'
            ],
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB max per file
            debounceDelay: options.debounceDelay || 500 // Wait 500ms after last change
        };
        
        // Timeline tracking
        this.timeline = {
            conversationTurn: 0,
            currentSnapshot: null,
            snapshots: new Map(),
            fileHistory: new Map(),
            operations: []
        };
        
        // File content store (git-like object storage)
        this.objectStore = new Map();
        
        // Debounce timers
        this.debounceTimers = new Map();
        
        // Watcher instance
        this.watcher = null;
        
        // Save queue to prevent concurrent writes
        this.saveInProgress = false;
        this.saveQueue = [];
    }
    
    /**
     * Start watching file system
     */
    async start() {
        this.logger.info(`🔍 Starting file system watcher on ${this.config.watchPath}`);
        
        // Ensure storage directories exist
        await fs.ensureDir(this.config.storagePath);
        await fs.ensureDir(path.join(this.config.storagePath, 'objects'));
        await fs.ensureDir(path.join(this.config.storagePath, 'snapshots'));
        await fs.ensureDir(path.join(this.config.storagePath, 'timeline'));
        
        // Load existing timeline if exists
        await this.loadTimeline();
        
        // Sync with conversation tracker if available
        await this.syncConversationTurn();
        
        // Create initial snapshot
        await this.createSnapshot('Initial state');
        
        // Initialize watcher with improved configuration
        this.watcher = chokidar.watch(this.config.watchPath, {
            ignored: this.config.ignorePaths,
            persistent: true,
            ignoreInitial: true, // Changed to true - we'll handle initial scan separately
            depth: 10,
            usePolling: true, // Enable polling to ensure all file system changes are detected
            interval: 1000, // Poll every second
            binaryInterval: 1000, // Poll binary files every second too
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });
        
        // Set up event handlers with comprehensive logging
        this.watcher
            .on('add', (filePath) => {
                this.logger.debug(`[EVENT] File added: ${filePath}`);
                this.handleFileAdd(filePath);
            })
            .on('change', (filePath) => {
                this.logger.debug(`[EVENT] File changed: ${filePath}`);
                this.handleFileChange(filePath);
            })
            .on('unlink', (filePath) => {
                this.logger.debug(`[EVENT] File deleted: ${filePath}`);
                this.handleFileDelete(filePath);
            })
            .on('addDir', (dirPath) => {
                this.logger.debug(`[EVENT] Directory added: ${dirPath}`);
            })
            .on('unlinkDir', (dirPath) => {
                this.logger.debug(`[EVENT] Directory deleted: ${dirPath}`);
            })
            .on('ready', () => {
                this.logger.info('✅ File watcher ready and monitoring');
                this.logger.info(`📊 Watching ${this.config.watchPath} with polling enabled`);
                
                // Periodically sync conversation turn
                setInterval(() => {
                    this.syncConversationTurn();
                }, 5000); // Every 5 seconds
            })
            .on('raw', (event, path, details) => {
                this.logger.debug(`[RAW EVENT] ${event}: ${path}`, details);
            })
            .on('error', (error) => {
                this.logger.error('Watcher error:', error);
            });
    }
    
    /**
     * Handle file addition
     */
    async handleFileAdd(filePath) {
        const relativePath = path.relative(this.config.watchPath, filePath);
        
        // Log immediately when file is detected
        this.logger.info(`🔍 Detected new file: ${relativePath}`);
        
        // Debounce rapid changes
        this.debounceChange(relativePath, async () => {
            try {
                const stats = await fs.stat(filePath);
                
                // Skip large files
                if (stats.size > this.config.maxFileSize) {
                    this.logger.warn(`Skipping large file: ${relativePath} (${stats.size} bytes)`);
                    return;
                }
                
                // Read file content
                const content = await fs.readFile(filePath);
                const hash = this.hashContent(content);
                
                // Store in object store
                this.objectStore.set(hash, content);
                await this.saveObject(hash, content);
                
                // Track in timeline
                const operation = {
                    type: 'add',
                    path: relativePath,
                    hash,
                    size: stats.size,
                    timestamp: new Date().toISOString(),
                    conversationTurn: this.timeline.conversationTurn
                };
                
                this.timeline.operations.push(operation);
                
                // Update file history
                if (!this.timeline.fileHistory.has(relativePath)) {
                    this.timeline.fileHistory.set(relativePath, []);
                }
                this.timeline.fileHistory.get(relativePath).push({
                    hash,
                    operation: 'add',
                    timestamp: operation.timestamp,
                    turn: this.timeline.conversationTurn
                });
                
                this.logger.debug(`📝 Added: ${relativePath} (${hash.substring(0, 8)})`);
                
                // Auto-save timeline
                await this.saveTimeline();
                
            } catch (error) {
                this.logger.error(`Error handling file add: ${relativePath}`, error);
            }
        });
    }
    
    /**
     * Handle file change
     */
    async handleFileChange(filePath) {
        const relativePath = path.relative(this.config.watchPath, filePath);
        
        // Log immediately when change is detected
        this.logger.info(`✏️ Detected file change: ${relativePath}`);
        
        this.debounceChange(relativePath, async () => {
            try {
                const stats = await fs.stat(filePath);
                
                if (stats.size > this.config.maxFileSize) {
                    return;
                }
                
                // Read new content
                const content = await fs.readFile(filePath);
                const newHash = this.hashContent(content);
                
                // Get previous hash
                const history = this.timeline.fileHistory.get(relativePath) || [];
                const previousHash = history.length > 0 ? history[history.length - 1].hash : null;
                
                // Only track if content actually changed
                if (previousHash !== newHash) {
                    // Store new version
                    this.objectStore.set(newHash, content);
                    await this.saveObject(newHash, content);
                    
                    // Track operation
                    const operation = {
                        type: 'change',
                        path: relativePath,
                        hash: newHash,
                        previousHash,
                        size: stats.size,
                        timestamp: new Date().toISOString(),
                        conversationTurn: this.timeline.conversationTurn
                    };
                    
                    this.timeline.operations.push(operation);
                    
                    // Update history
                    if (!this.timeline.fileHistory.has(relativePath)) {
                        this.timeline.fileHistory.set(relativePath, []);
                    }
                    this.timeline.fileHistory.get(relativePath).push({
                        hash: newHash,
                        operation: 'change',
                        timestamp: operation.timestamp,
                        turn: this.timeline.conversationTurn
                    });
                    
                    this.logger.debug(`✏️ Changed: ${relativePath} (${previousHash?.substring(0, 8)} → ${newHash.substring(0, 8)})`);
                    
                    await this.saveTimeline();
                }
                
            } catch (error) {
                this.logger.error(`Error handling file change: ${relativePath}`, error);
            }
        });
    }
    
    /**
     * Handle file deletion
     */
    async handleFileDelete(filePath) {
        const relativePath = path.relative(this.config.watchPath, filePath);
        
        // Log immediately when deletion is detected
        this.logger.info(`🗑️ Detected file deletion: ${relativePath}`);
        
        // Track deletion
        const operation = {
            type: 'delete',
            path: relativePath,
            timestamp: new Date().toISOString(),
            conversationTurn: this.timeline.conversationTurn
        };
        
        this.timeline.operations.push(operation);
        
        // Update history
        const history = this.timeline.fileHistory.get(relativePath) || [];
        if (history.length > 0) {
            history.push({
                hash: null,
                operation: 'delete',
                timestamp: operation.timestamp,
                turn: this.timeline.conversationTurn
            });
        }
        
        this.logger.debug(`🗑️ Deleted: ${relativePath}`);
        
        await this.saveTimeline();
    }
    
    /**
     * Debounce rapid file changes
     */
    debounceChange(filePath, callback) {
        // Clear existing timer
        if (this.debounceTimers.has(filePath)) {
            clearTimeout(this.debounceTimers.get(filePath));
        }
        
        // Set new timer
        const timer = setTimeout(() => {
            this.debounceTimers.delete(filePath);
            callback();
        }, this.config.debounceDelay);
        
        this.debounceTimers.set(filePath, timer);
    }
    
    /**
     * Create a snapshot of current state
     */
    async createSnapshot(description = '') {
        const snapshotId = crypto.randomBytes(8).toString('hex');
        
        const snapshot = {
            id: snapshotId,
            timestamp: new Date().toISOString(),
            conversationTurn: this.timeline.conversationTurn,
            description,
            files: new Map(),
            stats: {
                totalFiles: 0,
                totalSize: 0
            }
        };
        
        // Capture current state of all tracked files
        for (const [filePath, history] of this.timeline.fileHistory.entries()) {
            const lastEntry = history[history.length - 1];
            if (lastEntry && lastEntry.operation !== 'delete') {
                snapshot.files.set(filePath, {
                    hash: lastEntry.hash,
                    turn: lastEntry.turn
                });
                snapshot.stats.totalFiles++;
            }
        }
        
        this.timeline.snapshots.set(snapshotId, snapshot);
        this.timeline.currentSnapshot = snapshotId;
        
        // Save snapshot
        await this.saveSnapshot(snapshot);
        
        this.logger.info(`📸 Created snapshot: ${snapshotId} (${description})`);
        
        return snapshotId;
    }
    
    /**
     * Hash content for storage
     */
    hashContent(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    /**
     * Save object to disk
     */
    async saveObject(hash, content) {
        const objectPath = path.join(
            this.config.storagePath,
            'objects',
            hash.substring(0, 2),
            hash.substring(2)
        );
        
        await fs.ensureDir(path.dirname(objectPath));
        await fs.writeFile(objectPath, content);
    }
    
    /**
     * Load object from disk
     */
    async loadObject(hash) {
        if (this.objectStore.has(hash)) {
            return this.objectStore.get(hash);
        }
        
        const objectPath = path.join(
            this.config.storagePath,
            'objects',
            hash.substring(0, 2),
            hash.substring(2)
        );
        
        if (await fs.pathExists(objectPath)) {
            const content = await fs.readFile(objectPath);
            this.objectStore.set(hash, content);
            return content;
        }
        
        return null;
    }
    
    /**
     * Save timeline to disk
     */
    async saveTimeline() {
        // Queue the save operation
        return new Promise((resolve, reject) => {
            this.saveQueue.push({ resolve, reject });
            this.processSaveQueue();
        });
    }
    
    /**
     * Process save queue to prevent concurrent writes
     */
    async processSaveQueue() {
        if (this.saveInProgress || this.saveQueue.length === 0) {
            return;
        }
        
        this.saveInProgress = true;
        const batch = this.saveQueue.splice(0, this.saveQueue.length);
        
        try {
            const timelinePath = path.join(this.config.storagePath, 'timeline', 'current.json');
            const tempPath = path.join(this.config.storagePath, 'timeline', `current-${Date.now()}-${Math.random().toString(36).substring(7)}.json.tmp`);
            
            const timelineData = {
                conversationTurn: this.timeline.conversationTurn,
                currentSnapshot: this.timeline.currentSnapshot,
                operations: this.timeline.operations,
                fileHistory: Array.from(this.timeline.fileHistory.entries()),
                snapshots: Array.from(this.timeline.snapshots.entries()).map(([id, snapshot]) => ({
                    id,
                    ...snapshot,
                    files: Array.from(snapshot.files.entries())
                }))
            };
            
            await fs.ensureDir(path.dirname(timelinePath));
            
            // Write to temp file first with unique name
            await fs.writeJson(tempPath, timelineData, { spaces: 2 });
            
            // Atomically rename to avoid partial writes
            await fs.rename(tempPath, timelinePath);
            
            // Resolve all queued promises
            batch.forEach(item => item.resolve());
            
        } catch (error) {
            // Reject all queued promises
            batch.forEach(item => item.reject(error));
        } finally {
            this.saveInProgress = false;
            
            // Process any new items that were queued
            if (this.saveQueue.length > 0) {
                setTimeout(() => this.processSaveQueue(), 10);
            }
        }
    }
    
    /**
     * Load timeline from disk
     */
    async loadTimeline() {
        const timelinePath = path.join(this.config.storagePath, 'timeline', 'current.json');
        
        if (await fs.pathExists(timelinePath)) {
            try {
                // Check if file is empty
                const stats = await fs.stat(timelinePath);
                if (stats.size === 0) {
                    this.logger.warn('Timeline file is empty, starting fresh');
                    await fs.remove(timelinePath);
                    return;
                }
                
                const timelineData = await fs.readJson(timelinePath);
                
                this.timeline.conversationTurn = timelineData.conversationTurn || 0;
                this.timeline.currentSnapshot = timelineData.currentSnapshot;
                this.timeline.operations = timelineData.operations || [];
                this.timeline.fileHistory = new Map(timelineData.fileHistory || []);
                
                // Reconstruct snapshots
                if (timelineData.snapshots) {
                    for (const snapshot of timelineData.snapshots) {
                        const reconstructed = {
                            ...snapshot,
                            files: new Map(snapshot.files || [])
                        };
                        this.timeline.snapshots.set(snapshot.id, reconstructed);
                    }
                }
                
                this.logger.info(`📂 Loaded timeline with ${this.timeline.operations.length} operations`);
            } catch (error) {
                this.logger.error('Failed to load timeline, starting fresh:', error.message);
                // Remove corrupted file and start fresh
                await fs.remove(timelinePath);
            }
        }
    }
    
    /**
     * Save snapshot to disk
     */
    async saveSnapshot(snapshot) {
        const snapshotPath = path.join(
            this.config.storagePath,
            'snapshots',
            `${snapshot.id}.json`
        );
        
        const snapshotData = {
            ...snapshot,
            files: Array.from(snapshot.files.entries())
        };
        
        await fs.writeJson(snapshotPath, snapshotData, { spaces: 2 });
    }
    
    /**
     * Increment conversation turn
     */
    incrementTurn() {
        this.timeline.conversationTurn++;
        this.logger.info(`🔄 Conversation turn: ${this.timeline.conversationTurn}`);
        this.saveTimeline();
    }
    
    /**
     * Sync conversation turn with conversation tracker
     */
    async syncConversationTurn() {
        try {
            const conversationPath = path.join(this.config.watchPath, '.nexus', 'conversations', 'conversation.json');
            if (await fs.pathExists(conversationPath)) {
                const conversation = await fs.readJson(conversationPath);
                if (conversation.currentTurn !== undefined) {
                    this.timeline.conversationTurn = conversation.currentTurn;
                    this.logger.info(`🔄 Synced to conversation turn ${this.timeline.conversationTurn}`);
                }
            }
        } catch (error) {
            // Ignore errors, conversation tracking might not be initialized
            this.logger.debug('Could not sync conversation turn:', error.message);
        }
    }
    
    /**
     * Get file content at specific turn
     */
    async getFileAtTurn(filePath, turn) {
        const history = this.timeline.fileHistory.get(filePath);
        if (!history) return null;
        
        // Find the state at the specified turn
        let targetEntry = null;
        for (const entry of history) {
            if (entry.turn <= turn) {
                targetEntry = entry;
            } else {
                break;
            }
        }
        
        if (targetEntry && targetEntry.operation !== 'delete') {
            return await this.loadObject(targetEntry.hash);
        }
        
        return null;
    }
    
    /**
     * Stop watching
     */
    async stop() {
        if (this.watcher) {
            await this.watcher.close();
            this.logger.info('🛑 File watcher stopped');
        }
        
        // Clear all timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}

// Export for use as module
module.exports = NexusWatcher;

// Run as daemon if executed directly
if (require.main === module) {
    const watcher = new NexusWatcher();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n⏹️ Shutting down watcher...');
        await watcher.stop();
        process.exit(0);
    });
    
    // Start watching
    watcher.start().catch(error => {
        console.error('Failed to start watcher:', error);
        process.exit(1);
    });
}