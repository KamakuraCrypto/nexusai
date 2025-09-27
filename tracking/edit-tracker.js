#!/usr/bin/env node
/**
 * Edit-by-Edit Tracking System
 * Tracks every single edit operation with full diff history
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const diff = require('diff');
const { Logger } = require('../utils/logger');

class EditTracker {
    constructor(options = {}) {
        this.logger = new Logger('EditTracker');
        
        this.config = {
            storagePath: options.storagePath || path.join(process.cwd(), '.nexus', 'edits'),
            maxDiffSize: options.maxDiffSize || 1024 * 1024, // 1MB max diff
            trackLineNumbers: options.trackLineNumbers !== false,
            trackTimestamps: options.trackTimestamps !== false,
            compressOldEdits: options.compressOldEdits !== false
        };
        
        this.editHistory = [];
        this.fileEditMap = new Map(); // Track edits per file
        this.currentEditSession = null;
    }
    
    /**
     * Initialize edit tracking system
     */
    async initialize() {
        this.logger.info('✏️ Initializing edit tracking system');
        
        // Create directory structure
        await fs.ensureDir(this.config.storagePath);
        await fs.ensureDir(path.join(this.config.storagePath, 'by-file'));
        await fs.ensureDir(path.join(this.config.storagePath, 'by-turn'));
        await fs.ensureDir(path.join(this.config.storagePath, 'by-session'));
        await fs.ensureDir(path.join(this.config.storagePath, 'diffs'));
        await fs.ensureDir(path.join(this.config.storagePath, 'snapshots'));
        
        // Load edit history
        await this.loadEditHistory();
        
        this.logger.info(`✅ Edit tracker initialized with ${this.editHistory.length} historical edits`);
    }
    
    /**
     * Start a new edit session
     */
    startEditSession(metadata = {}) {
        const sessionId = this.generateEditSessionId();
        
        this.currentEditSession = {
            id: sessionId,
            startTime: new Date().toISOString(),
            conversationTurn: metadata.turn || 0,
            responseId: metadata.responseId || null,
            edits: [],
            metadata: metadata
        };
        
        this.logger.info(`🎯 Started edit session ${sessionId}`);
        return sessionId;
    }
    
    /**
     * Track a single edit operation
     */
    async trackEdit(filePath, oldContent, newContent, operation = 'edit') {
        const editId = this.generateEditId();
        const timestamp = new Date().toISOString();
        
        // Calculate diff
        const diffResult = this.calculateDiff(oldContent, newContent);
        
        // Create edit record
        const edit = {
            id: editId,
            timestamp: timestamp,
            filePath: filePath,
            operation: operation, // 'create', 'edit', 'delete', 'rename'
            conversationTurn: this.currentEditSession?.conversationTurn || 0,
            sessionId: this.currentEditSession?.id || null,
            diff: diffResult,
            metrics: {
                oldSize: oldContent ? oldContent.length : 0,
                newSize: newContent ? newContent.length : 0,
                linesAdded: diffResult.added,
                linesRemoved: diffResult.removed,
                linesChanged: diffResult.changed
            },
            hashes: {
                before: oldContent ? this.hashContent(oldContent) : null,
                after: newContent ? this.hashContent(newContent) : null
            }
        };
        
        // Store full content for restore capability
        await this.storeEditContent(edit, oldContent, newContent);
        
        // Save edit record
        await this.saveEdit(edit);
        
        // Update maps
        this.editHistory.push(edit);
        
        if (!this.fileEditMap.has(filePath)) {
            this.fileEditMap.set(filePath, []);
        }
        this.fileEditMap.get(filePath).push(editId);
        
        if (this.currentEditSession) {
            this.currentEditSession.edits.push(editId);
        }
        
        this.logger.debug(`📝 Tracked edit ${editId} for ${filePath}`);
        
        return editId;
    }
    
    /**
     * Calculate diff between old and new content
     */
    calculateDiff(oldContent, newContent) {
        if (!oldContent && !newContent) {
            return { patch: '', added: 0, removed: 0, changed: 0 };
        }
        
        if (!oldContent) {
            // New file
            const lines = newContent.split('\n');
            return {
                patch: `+++ ${newContent}`,
                added: lines.length,
                removed: 0,
                changed: 0,
                type: 'create'
            };
        }
        
        if (!newContent) {
            // Deleted file
            const lines = oldContent.split('\n');
            return {
                patch: `--- ${oldContent}`,
                added: 0,
                removed: lines.length,
                changed: 0,
                type: 'delete'
            };
        }
        
        // Calculate line diff
        const changes = diff.diffLines(oldContent, newContent);
        let added = 0, removed = 0, changed = 0;
        
        changes.forEach(change => {
            if (change.added) {
                added += change.count || 0;
            } else if (change.removed) {
                removed += change.count || 0;
            }
        });
        
        // Create unified diff
        const patch = diff.createPatch('file', oldContent, newContent);
        
        return {
            patch: patch,
            added: added,
            removed: removed,
            changed: Math.min(added, removed),
            type: 'edit'
        };
    }
    
    /**
     * Store edit content for restoration
     */
    async storeEditContent(edit, oldContent, newContent) {
        const contentDir = path.join(this.config.storagePath, 'snapshots', edit.id);
        await fs.ensureDir(contentDir);
        
        if (oldContent) {
            await fs.writeFile(path.join(contentDir, 'before.txt'), oldContent);
        }
        
        if (newContent) {
            await fs.writeFile(path.join(contentDir, 'after.txt'), newContent);
        }
        
        // Save diff separately
        const diffFile = path.join(this.config.storagePath, 'diffs', `${edit.id}.diff`);
        await fs.writeFile(diffFile, edit.diff.patch);
    }
    
    /**
     * Save edit record
     */
    async saveEdit(edit) {
        // Save main edit record
        const editFile = path.join(this.config.storagePath, `${edit.id}.json`);
        await fs.writeJson(editFile, edit, { spaces: 2 });
        
        // Save by file
        const fileName = path.basename(edit.filePath);
        const fileDir = path.join(this.config.storagePath, 'by-file', fileName);
        await fs.ensureDir(fileDir);
        
        const fileEditFile = path.join(fileDir, `${edit.id}.json`);
        await fs.writeJson(fileEditFile, edit, { spaces: 2 });
        
        // Save by turn
        if (edit.conversationTurn) {
            const turnDir = path.join(
                this.config.storagePath,
                'by-turn',
                `turn-${String(edit.conversationTurn).padStart(4, '0')}`
            );
            await fs.ensureDir(turnDir);
            
            const turnEditFile = path.join(turnDir, `${edit.id}.json`);
            await fs.writeJson(turnEditFile, edit, { spaces: 2 });
        }
        
        // Save by session
        if (edit.sessionId) {
            const sessionDir = path.join(
                this.config.storagePath,
                'by-session',
                edit.sessionId
            );
            await fs.ensureDir(sessionDir);
            
            const sessionEditFile = path.join(sessionDir, `${edit.id}.json`);
            await fs.writeJson(sessionEditFile, edit, { spaces: 2 });
        }
    }
    
    /**
     * End edit session
     */
    async endEditSession() {
        if (!this.currentEditSession) {
            return null;
        }
        
        this.currentEditSession.endTime = new Date().toISOString();
        this.currentEditSession.duration = 
            new Date(this.currentEditSession.endTime) - new Date(this.currentEditSession.startTime);
        
        // Save session summary
        const sessionFile = path.join(
            this.config.storagePath,
            'by-session',
            this.currentEditSession.id,
            'session.json'
        );
        await fs.writeJson(sessionFile, this.currentEditSession, { spaces: 2 });
        
        const sessionId = this.currentEditSession.id;
        this.currentEditSession = null;
        
        this.logger.info(`✅ Edit session ${sessionId} ended with ${this.currentEditSession?.edits.length || 0} edits`);
        
        return sessionId;
    }
    
    /**
     * Get edit by ID
     */
    async getEdit(editId) {
        const editFile = path.join(this.config.storagePath, `${editId}.json`);
        
        if (await fs.pathExists(editFile)) {
            return await fs.readJson(editFile);
        }
        
        return null;
    }
    
    /**
     * Get edits for file
     */
    async getEditsForFile(filePath) {
        const editIds = this.fileEditMap.get(filePath) || [];
        const edits = [];
        
        for (const editId of editIds) {
            const edit = await this.getEdit(editId);
            if (edit) {
                edits.push(edit);
            }
        }
        
        return edits;
    }
    
    /**
     * Get edits for conversation turn
     */
    async getEditsForTurn(turn) {
        const turnDir = path.join(
            this.config.storagePath,
            'by-turn',
            `turn-${String(turn).padStart(4, '0')}`
        );
        
        if (!await fs.pathExists(turnDir)) {
            return [];
        }
        
        const editFiles = await fs.readdir(turnDir);
        const edits = [];
        
        for (const file of editFiles) {
            if (file.endsWith('.json')) {
                const edit = await fs.readJson(path.join(turnDir, file));
                edits.push(edit);
            }
        }
        
        return edits;
    }
    
    /**
     * Restore file to state before edit
     */
    async restoreBeforeEdit(editId) {
        const edit = await this.getEdit(editId);
        if (!edit) {
            throw new Error(`Edit ${editId} not found`);
        }
        
        const beforeFile = path.join(
            this.config.storagePath,
            'snapshots',
            editId,
            'before.txt'
        );
        
        if (await fs.pathExists(beforeFile)) {
            const content = await fs.readFile(beforeFile, 'utf8');
            await fs.writeFile(edit.filePath, content);
            
            this.logger.info(`✅ Restored ${edit.filePath} to state before edit ${editId}`);
            return content;
        }
        
        return null;
    }
    
    /**
     * Replay edits up to a specific point
     */
    async replayEditsUpToTurn(turn, targetDir = null) {
        const edits = [];
        
        // Collect all edits up to turn
        for (let t = 0; t <= turn; t++) {
            const turnEdits = await this.getEditsForTurn(t);
            edits.push(...turnEdits);
        }
        
        // Sort by timestamp
        edits.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Replay edits
        const fileStates = new Map();
        
        for (const edit of edits) {
            const afterFile = path.join(
                this.config.storagePath,
                'snapshots',
                edit.id,
                'after.txt'
            );
            
            if (await fs.pathExists(afterFile)) {
                const content = await fs.readFile(afterFile, 'utf8');
                fileStates.set(edit.filePath, content);
            }
        }
        
        // Write final states
        if (targetDir) {
            await fs.ensureDir(targetDir);
            for (const [filePath, content] of fileStates) {
                const targetPath = path.join(targetDir, path.basename(filePath));
                await fs.writeFile(targetPath, content);
            }
        }
        
        this.logger.info(`✅ Replayed ${edits.length} edits up to turn ${turn}`);
        
        return fileStates;
    }
    
    /**
     * Generate edit timeline
     */
    async generateEditTimeline() {
        const timeline = {
            totalEdits: this.editHistory.length,
            filesChanged: this.fileEditMap.size,
            edits: []
        };
        
        for (const edit of this.editHistory) {
            timeline.edits.push({
                id: edit.id,
                timestamp: edit.timestamp,
                file: path.basename(edit.filePath),
                operation: edit.operation,
                turn: edit.conversationTurn,
                changes: `+${edit.metrics.linesAdded} -${edit.metrics.linesRemoved}`
            });
        }
        
        return timeline;
    }
    
    /**
     * Load edit history
     */
    async loadEditHistory() {
        const historyFile = path.join(this.config.storagePath, 'history.json');
        
        if (await fs.pathExists(historyFile)) {
            const history = await fs.readJson(historyFile);
            this.editHistory = history.edits || [];
            
            // Rebuild file map
            for (const edit of this.editHistory) {
                if (!this.fileEditMap.has(edit.filePath)) {
                    this.fileEditMap.set(edit.filePath, []);
                }
                this.fileEditMap.get(edit.filePath).push(edit.id);
            }
        }
    }
    
    /**
     * Save edit history
     */
    async saveEditHistory() {
        const historyFile = path.join(this.config.storagePath, 'history.json');
        await fs.writeJson(historyFile, {
            lastUpdated: new Date().toISOString(),
            totalEdits: this.editHistory.length,
            filesTracked: this.fileEditMap.size,
            edits: this.editHistory
        }, { spaces: 2 });
    }
    
    /**
     * Hash content
     */
    hashContent(content) {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }
    
    /**
     * Generate edit ID
     */
    generateEditId() {
        return `edit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Generate edit session ID
     */
    generateEditSessionId() {
        return `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
}

module.exports = EditTracker;

// CLI usage
if (require.main === module) {
    const program = require('commander');
    
    program
        .version('1.0.0')
        .description('Edit-by-edit tracking system');
    
    program
        .command('track <file>')
        .description('Track an edit to a file')
        .option('-o, --old <content>', 'Old content')
        .option('-n, --new <content>', 'New content')
        .option('-t, --turn <number>', 'Conversation turn', parseInt)
        .action(async (file, options) => {
            const tracker = new EditTracker();
            await tracker.initialize();
            
            tracker.startEditSession({ turn: options.turn });
            
            const editId = await tracker.trackEdit(
                file,
                options.old || '',
                options.new || '',
                options.old ? 'edit' : 'create'
            );
            
            await tracker.endEditSession();
            await tracker.saveEditHistory();
            
            console.log(`Tracked edit: ${editId}`);
        });
    
    program
        .command('history <file>')
        .description('Show edit history for a file')
        .action(async (file) => {
            const tracker = new EditTracker();
            await tracker.initialize();
            
            const edits = await tracker.getEditsForFile(file);
            console.log(`Found ${edits.length} edits for ${file}:`);
            
            edits.forEach(edit => {
                console.log(`\n[${edit.timestamp}] ${edit.id}`);
                console.log(`  Turn: ${edit.conversationTurn}`);
                console.log(`  Changes: +${edit.metrics.linesAdded} -${edit.metrics.linesRemoved}`);
            });
        });
    
    program
        .command('restore <editId>')
        .description('Restore file to state before edit')
        .action(async (editId) => {
            const tracker = new EditTracker();
            await tracker.initialize();
            
            await tracker.restoreBeforeEdit(editId);
        });
    
    program
        .command('timeline')
        .description('Generate edit timeline')
        .action(async () => {
            const tracker = new EditTracker();
            await tracker.initialize();
            
            const timeline = await tracker.generateEditTimeline();
            console.log(`Total edits: ${timeline.totalEdits}`);
            console.log(`Files changed: ${timeline.filesChanged}\n`);
            
            timeline.edits.forEach(edit => {
                console.log(`[${edit.timestamp}] ${edit.file} ${edit.changes}`);
            });
        });
    
    program.parse(process.argv);
}