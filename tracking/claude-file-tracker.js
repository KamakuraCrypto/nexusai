/**
 * Claude File Tracker
 * Tracks every file Claude reads, writes, or edits
 * Provides intelligent file prioritization and change detection
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class ClaudeFileTracker {
    constructor(contextManager, sessionManager) {
        this.contextManager = contextManager;
        this.sessionManager = sessionManager;
        this.logger = new Logger('ClaudeFileTracker');
        
        // Tracking configuration
        this.config = {
            maxTrackedFiles: 1000,
            checksumAlgorithm: 'sha256',
            diffTracking: true,
            dependencyTracking: true,
            storagePath: path.join(process.cwd(), '.nexus', 'claude', 'file-tracking'),
            priorityPatterns: {
                critical: [
                    'package.json',
                    'tsconfig.json',
                    '.env',
                    'next.config.js',
                    'vite.config.js',
                    'webpack.config.js'
                ],
                high: [
                    /^src\/index\.(js|ts|jsx|tsx)$/,
                    /^pages\/_app\.(js|ts|jsx|tsx)$/,
                    /^app\/layout\.(js|ts|jsx|tsx)$/,
                    /config\.(js|ts|json)$/
                ],
                medium: [
                    /\.(js|ts|jsx|tsx)$/,
                    /\.(css|scss|sass)$/,
                    /README\.md$/i
                ],
                low: [
                    /\.(md|txt)$/,
                    /test|spec/i,
                    /\.(json|yml|yaml)$/
                ]
            }
        };
        
        // File tracking state
        this.trackedFiles = new Map();
        this.fileHashes = new Map();
        this.dependencyGraph = new Map();
        this.changeHistory = [];
        
        // Metrics
        this.metrics = {
            totalReads: 0,
            totalWrites: 0,
            totalEdits: 0,
            uniqueFiles: 0,
            totalChanges: 0
        };
    }
    
    /**
     * Initialize file tracker
     */
    async initialize() {
        this.logger.info('📁 Initializing Claude File Tracker...');
        
        try {
            // Ensure directories exist
            await fs.ensureDir(this.config.storagePath);
            
            // Load previous tracking data
            await this.loadTrackingData();
            
            // Start file watching
            this.startFileWatching();
            
            this.logger.info('✅ File Tracker initialized');
            this.logger.info(`📊 Tracking ${this.trackedFiles.size} files`);
            
        } catch (error) {
            this.logger.error('Failed to initialize file tracker:', error);
            throw error;
        }
    }
    
    /**
     * Track file read operation
     */
    async trackRead(filePath, content = null) {
        const normalizedPath = this.normalizePath(filePath);
        
        // Get or create file entry
        let fileEntry = this.trackedFiles.get(normalizedPath);
        
        if (!fileEntry) {
            fileEntry = await this.createFileEntry(normalizedPath);
            this.trackedFiles.set(normalizedPath, fileEntry);
            this.metrics.uniqueFiles++;
        }
        
        // Update read tracking
        fileEntry.lastRead = new Date().toISOString();
        fileEntry.readCount++;
        fileEntry.operations.push({
            type: 'read',
            timestamp: new Date().toISOString(),
            sessionId: this.sessionManager?.currentSession?.id
        });
        
        // Calculate hash if content provided
        if (content) {
            const hash = this.calculateHash(content);
            
            if (fileEntry.currentHash && fileEntry.currentHash !== hash) {
                // File changed since last read
                await this.detectChanges(normalizedPath, fileEntry.currentHash, hash, content);
            }
            
            fileEntry.currentHash = hash;
            fileEntry.size = Buffer.byteLength(content);
            fileEntry.lines = content.split('\n').length;
        }
        
        // Update priority based on access
        this.updateFilePriority(fileEntry);
        
        // Extract dependencies if applicable
        if (this.config.dependencyTracking) {
            await this.extractDependencies(normalizedPath, content);
        }
        
        // Update context manager
        if (this.contextManager) {
            this.contextManager.trackFileOperation('read', normalizedPath, content);
        }
        
        this.metrics.totalReads++;
        
        this.logger.debug(`📖 Tracked read: ${normalizedPath}`);
        
        return fileEntry;
    }
    
    /**
     * Track file write operation
     */
    async trackWrite(filePath, content) {
        const normalizedPath = this.normalizePath(filePath);
        
        // Get or create file entry
        let fileEntry = this.trackedFiles.get(normalizedPath);
        
        if (!fileEntry) {
            fileEntry = await this.createFileEntry(normalizedPath);
            this.trackedFiles.set(normalizedPath, fileEntry);
            this.metrics.uniqueFiles++;
        }
        
        // Store previous version
        if (fileEntry.currentHash) {
            fileEntry.previousVersions.push({
                hash: fileEntry.currentHash,
                timestamp: fileEntry.lastWrite || fileEntry.createdAt,
                size: fileEntry.size
            });
        }
        
        // Update write tracking
        fileEntry.lastWrite = new Date().toISOString();
        fileEntry.writeCount++;
        fileEntry.operations.push({
            type: 'write',
            timestamp: new Date().toISOString(),
            sessionId: this.sessionManager?.currentSession?.id
        });
        
        // Calculate new hash
        const hash = this.calculateHash(content);
        fileEntry.currentHash = hash;
        fileEntry.size = Buffer.byteLength(content);
        fileEntry.lines = content.split('\n').length;
        
        // Mark as critical since Claude wrote to it
        fileEntry.priority = Math.max(fileEntry.priority, 100);
        fileEntry.claudeGenerated = true;
        
        // Track change
        this.changeHistory.push({
            file: normalizedPath,
            type: 'write',
            timestamp: new Date().toISOString(),
            hash,
            sessionId: this.sessionManager?.currentSession?.id
        });
        
        // Update dependencies
        if (this.config.dependencyTracking) {
            await this.extractDependencies(normalizedPath, content);
        }
        
        // Update context manager
        if (this.contextManager) {
            this.contextManager.trackFileOperation('write', normalizedPath, content);
        }
        
        this.metrics.totalWrites++;
        this.metrics.totalChanges++;
        
        this.logger.info(`✏️ Tracked write: ${normalizedPath}`);
        
        return fileEntry;
    }
    
    /**
     * Track file edit operation
     */
    async trackEdit(filePath, oldContent, newContent) {
        const normalizedPath = this.normalizePath(filePath);
        
        // Get or create file entry
        let fileEntry = this.trackedFiles.get(normalizedPath);
        
        if (!fileEntry) {
            fileEntry = await this.createFileEntry(normalizedPath);
            this.trackedFiles.set(normalizedPath, fileEntry);
            this.metrics.uniqueFiles++;
        }
        
        // Store diff
        const diff = await this.createDiff(oldContent, newContent);
        
        fileEntry.edits.push({
            timestamp: new Date().toISOString(),
            diff,
            sessionId: this.sessionManager?.currentSession?.id,
            oldHash: this.calculateHash(oldContent),
            newHash: this.calculateHash(newContent)
        });
        
        // Update edit tracking
        fileEntry.lastEdit = new Date().toISOString();
        fileEntry.editCount++;
        fileEntry.operations.push({
            type: 'edit',
            timestamp: new Date().toISOString(),
            sessionId: this.sessionManager?.currentSession?.id
        });
        
        // Update hash and size
        fileEntry.currentHash = this.calculateHash(newContent);
        fileEntry.size = Buffer.byteLength(newContent);
        fileEntry.lines = newContent.split('\n').length;
        
        // Increase priority for edited files
        fileEntry.priority = Math.max(fileEntry.priority, 100);
        
        // Track change
        this.changeHistory.push({
            file: normalizedPath,
            type: 'edit',
            timestamp: new Date().toISOString(),
            diff,
            sessionId: this.sessionManager?.currentSession?.id
        });
        
        // Update dependencies if changed
        if (this.config.dependencyTracking) {
            await this.extractDependencies(normalizedPath, newContent);
        }
        
        // Update context manager
        if (this.contextManager) {
            this.contextManager.trackFileOperation('edit', normalizedPath, newContent);
        }
        
        this.metrics.totalEdits++;
        this.metrics.totalChanges++;
        
        this.logger.info(`📝 Tracked edit: ${normalizedPath}`);
        
        return fileEntry;
    }
    
    /**
     * Get files for re-reading on session restore
     */
    async getFilesForRestore() {
        const filesToRestore = [];
        
        // Sort files by priority and access time
        const sortedFiles = Array.from(this.trackedFiles.entries())
            .sort((a, b) => {
                // First sort by priority
                const priorityDiff = b[1].priority - a[1].priority;
                if (priorityDiff !== 0) return priorityDiff;
                
                // Then by last access
                const aTime = new Date(a[1].lastAccess);
                const bTime = new Date(b[1].lastAccess);
                return bTime - aTime;
            });
        
        // Get top priority files
        for (const [filePath, fileEntry] of sortedFiles.slice(0, 20)) {
            if (await fs.pathExists(filePath)) {
                filesToRestore.push({
                    path: filePath,
                    priority: fileEntry.priority,
                    lastAccess: fileEntry.lastAccess,
                    claudeGenerated: fileEntry.claudeGenerated
                });
            }
        }
        
        // Always include critical files
        for (const pattern of this.config.priorityPatterns.critical) {
            const criticalPath = path.join(process.cwd(), pattern);
            if (await fs.pathExists(criticalPath) && 
                !filesToRestore.some(f => f.path === criticalPath)) {
                filesToRestore.push({
                    path: criticalPath,
                    priority: 1000,
                    lastAccess: new Date().toISOString(),
                    claudeGenerated: false
                });
            }
        }
        
        return filesToRestore;
    }
    
    /**
     * Get all tracked files for checkpointing
     */
    async getTrackedFiles() {
        const trackedFiles = {};
        
        for (const [filePath, fileEntry] of this.trackedFiles.entries()) {
            trackedFiles[filePath] = {
                priority: fileEntry.priority,
                lastAccess: fileEntry.lastAccess,
                checksum: fileEntry.checksum,
                changeCount: fileEntry.changeCount,
                claudeGenerated: fileEntry.claudeGenerated,
                operations: fileEntry.operations.slice(-5) // Keep last 5 operations
            };
        }
        
        return trackedFiles;
    }
    
    /**
     * Build dependency graph
     */
    async buildDependencyGraph() {
        const graph = new Map();
        
        for (const [filePath, fileEntry] of this.trackedFiles) {
            if (fileEntry.dependencies.length > 0) {
                graph.set(filePath, {
                    dependencies: fileEntry.dependencies,
                    dependents: []
                });
            }
        }
        
        // Build reverse dependencies
        for (const [filePath, node] of graph) {
            for (const dep of node.dependencies) {
                if (graph.has(dep)) {
                    graph.get(dep).dependents.push(filePath);
                }
            }
        }
        
        this.dependencyGraph = graph;
        
        return graph;
    }
    
    /**
     * Get file impact analysis
     */
    async getFileImpact(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        
        // Build fresh dependency graph
        await this.buildDependencyGraph();
        
        const impact = {
            file: normalizedPath,
            directDependents: [],
            allDependents: new Set(),
            impactLevel: 'low'
        };
        
        // Get direct dependents
        const node = this.dependencyGraph.get(normalizedPath);
        if (node) {
            impact.directDependents = node.dependents;
            
            // Get all dependents recursively
            const visited = new Set();
            const queue = [...node.dependents];
            
            while (queue.length > 0) {
                const dep = queue.shift();
                if (!visited.has(dep)) {
                    visited.add(dep);
                    impact.allDependents.add(dep);
                    
                    const depNode = this.dependencyGraph.get(dep);
                    if (depNode) {
                        queue.push(...depNode.dependents);
                    }
                }
            }
        }
        
        // Determine impact level
        if (impact.allDependents.size > 10) {
            impact.impactLevel = 'critical';
        } else if (impact.allDependents.size > 5) {
            impact.impactLevel = 'high';
        } else if (impact.allDependents.size > 2) {
            impact.impactLevel = 'medium';
        }
        
        return impact;
    }
    
    /**
     * Get change summary
     */
    getChangeSummary() {
        const summary = {
            totalChanges: this.changeHistory.length,
            recentChanges: this.changeHistory.slice(-10),
            filesByChangeCount: {},
            changesByType: {
                write: 0,
                edit: 0
            }
        };
        
        // Count changes by file
        for (const change of this.changeHistory) {
            if (!summary.filesByChangeCount[change.file]) {
                summary.filesByChangeCount[change.file] = 0;
            }
            summary.filesByChangeCount[change.file]++;
            summary.changesByType[change.type]++;
        }
        
        // Sort files by change count
        summary.mostChanged = Object.entries(summary.filesByChangeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        return summary;
    }
    
    /**
     * Save tracking data
     */
    async saveTrackingData() {
        try {
            const dataPath = path.join(this.config.storagePath, 'tracking-data.json');
            
            const data = {
                version: '1.0',
                savedAt: new Date().toISOString(),
                files: Array.from(this.trackedFiles.entries()),
                changeHistory: this.changeHistory.slice(-1000), // Keep last 1000 changes
                metrics: this.metrics
            };
            
            await fs.writeJson(dataPath, data, { spaces: 2 });
            
            this.logger.debug('💾 Saved tracking data');
            
        } catch (error) {
            this.logger.error('Failed to save tracking data:', error);
        }
    }
    
    /**
     * Load tracking data
     */
    async loadTrackingData() {
        try {
            const dataPath = path.join(this.config.storagePath, 'tracking-data.json');
            
            if (!await fs.pathExists(dataPath)) {
                return;
            }
            
            const data = await fs.readJson(dataPath);
            
            this.trackedFiles = new Map(data.files);
            this.changeHistory = data.changeHistory || [];
            this.metrics = data.metrics || this.metrics;
            
            this.logger.info(`📂 Loaded tracking data for ${this.trackedFiles.size} files`);
            
        } catch (error) {
            this.logger.error('Failed to load tracking data:', error);
        }
    }
    
    // Private methods
    
    /**
     * Create file entry
     */
    async createFileEntry(filePath) {
        const stats = await fs.stat(filePath).catch(() => null);
        
        return {
            path: filePath,
            createdAt: new Date().toISOString(),
            lastAccess: new Date().toISOString(),
            lastRead: null,
            lastWrite: null,
            lastEdit: null,
            readCount: 0,
            writeCount: 0,
            editCount: 0,
            size: stats?.size || 0,
            lines: 0,
            currentHash: null,
            previousVersions: [],
            edits: [],
            operations: [],
            dependencies: [],
            dependents: [],
            priority: this.calculateInitialPriority(filePath),
            claudeGenerated: false
        };
    }
    
    /**
     * Calculate initial file priority
     */
    calculateInitialPriority(filePath) {
        const fileName = path.basename(filePath);
        const relPath = path.relative(process.cwd(), filePath);
        
        // Check critical patterns
        if (this.config.priorityPatterns.critical.includes(fileName)) {
            return 1000;
        }
        
        // Check high priority patterns
        for (const pattern of this.config.priorityPatterns.high) {
            if (pattern.test(relPath)) {
                return 100;
            }
        }
        
        // Check medium priority patterns
        for (const pattern of this.config.priorityPatterns.medium) {
            if (pattern.test(relPath)) {
                return 10;
            }
        }
        
        return 1; // Low priority default
    }
    
    /**
     * Update file priority based on access
     */
    updateFilePriority(fileEntry) {
        // Increase priority based on access frequency
        const accessScore = fileEntry.readCount + (fileEntry.writeCount * 2) + (fileEntry.editCount * 3);
        
        if (accessScore > 10) {
            fileEntry.priority = Math.min(1000, fileEntry.priority * 1.5);
        }
        
        // Recent access boosts priority
        const lastAccess = new Date(fileEntry.lastAccess);
        const hoursSinceAccess = (Date.now() - lastAccess) / (1000 * 60 * 60);
        
        if (hoursSinceAccess < 1) {
            fileEntry.priority = Math.min(1000, fileEntry.priority * 1.2);
        }
        
        fileEntry.lastAccess = new Date().toISOString();
    }
    
    /**
     * Normalize file path
     */
    normalizePath(filePath) {
        return path.resolve(filePath);
    }
    
    /**
     * Calculate file hash
     */
    calculateHash(content) {
        return crypto
            .createHash(this.config.checksumAlgorithm)
            .update(content)
            .digest('hex');
    }
    
    /**
     * Create diff between versions
     */
    async createDiff(oldContent, newContent) {
        // Simple diff tracking - could be enhanced with proper diff library
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        const diff = {
            added: newLines.length - oldLines.length,
            removed: 0,
            modified: 0
        };
        
        // Basic line count difference
        if (diff.added < 0) {
            diff.removed = Math.abs(diff.added);
            diff.added = 0;
        }
        
        return diff;
    }
    
    /**
     * Detect file changes
     */
    async detectChanges(filePath, oldHash, newHash, content) {
        this.logger.info(`🔄 File changed: ${filePath}`);
        
        this.changeHistory.push({
            file: filePath,
            type: 'external',
            timestamp: new Date().toISOString(),
            oldHash,
            newHash,
            sessionId: this.sessionManager?.currentSession?.id
        });
        
        // Notify context manager
        if (this.contextManager) {
            this.contextManager.trackFileOperation('changed', filePath, content);
        }
    }
    
    /**
     * Extract dependencies from file content
     */
    async extractDependencies(filePath, content) {
        if (!content) return;
        
        const fileEntry = this.trackedFiles.get(filePath);
        if (!fileEntry) return;
        
        const dependencies = new Set();
        
        // JavaScript/TypeScript imports
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
        
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const dep = this.resolveImportPath(match[1], filePath);
            if (dep) dependencies.add(dep);
        }
        
        while ((match = requireRegex.exec(content)) !== null) {
            const dep = this.resolveImportPath(match[1], filePath);
            if (dep) dependencies.add(dep);
        }
        
        fileEntry.dependencies = Array.from(dependencies);
    }
    
    /**
     * Resolve import path to absolute path
     */
    resolveImportPath(importPath, fromFile) {
        // Skip node_modules
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return null;
        }
        
        const dir = path.dirname(fromFile);
        let resolved = path.resolve(dir, importPath);
        
        // Try adding extensions
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
        for (const ext of extensions) {
            if (fs.existsSync(resolved + ext)) {
                return resolved + ext;
            }
        }
        
        // Try index files
        const indexFiles = ['index.js', 'index.ts', 'index.jsx', 'index.tsx'];
        for (const indexFile of indexFiles) {
            const indexPath = path.join(resolved, indexFile);
            if (fs.existsSync(indexPath)) {
                return indexPath;
            }
        }
        
        return fs.existsSync(resolved) ? resolved : null;
    }
    
    /**
     * Start file watching
     */
    startFileWatching() {
        // Could implement file system watching here
        // For now, periodic save
        setInterval(() => {
            this.saveTrackingData();
        }, 60000); // Save every minute
    }
    
    /**
     * Get statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            trackedFiles: this.trackedFiles.size,
            totalOperations: this.metrics.totalReads + this.metrics.totalWrites + this.metrics.totalEdits,
            averageFileSize: this.calculateAverageFileSize(),
            mostAccessedFiles: this.getMostAccessedFiles(),
            recentlyModified: this.getRecentlyModified()
        };
    }
    
    /**
     * Calculate average file size
     */
    calculateAverageFileSize() {
        let totalSize = 0;
        let count = 0;
        
        for (const fileEntry of this.trackedFiles.values()) {
            if (fileEntry.size > 0) {
                totalSize += fileEntry.size;
                count++;
            }
        }
        
        return count > 0 ? Math.round(totalSize / count) : 0;
    }
    
    /**
     * Get most accessed files
     */
    getMostAccessedFiles() {
        return Array.from(this.trackedFiles.entries())
            .map(([path, entry]) => ({
                path,
                totalAccess: entry.readCount + entry.writeCount + entry.editCount
            }))
            .sort((a, b) => b.totalAccess - a.totalAccess)
            .slice(0, 10);
    }
    
    /**
     * Get recently modified files
     */
    getRecentlyModified() {
        return Array.from(this.trackedFiles.entries())
            .filter(([_, entry]) => entry.lastWrite || entry.lastEdit)
            .map(([path, entry]) => ({
                path,
                lastModified: entry.lastEdit || entry.lastWrite
            }))
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
            .slice(0, 10);
    }
}

module.exports = ClaudeFileTracker;