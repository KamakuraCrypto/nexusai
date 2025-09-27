/**
 * Claude Session Manager
 * Manages persistent session state across Claude conversations
 * Handles session recovery, branching, and replay capabilities
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class ClaudeSessionManager {
    constructor(contextManager, hooks) {
        this.contextManager = contextManager;
        this.hooks = hooks;
        this.logger = new Logger('ClaudeSessionManager');
        
        // Session configuration
        this.config = {
            maxSessions: 10,
            sessionTimeout: 3600000, // 1 hour
            autoSaveInterval: 300000, // 5 minutes
            sessionPath: path.join(process.cwd(), '.nexus', 'claude', 'sessions'),
            activePath: path.join(process.cwd(), '.nexus', 'claude', 'active-session.json')
        };
        
        // Current session state
        this.currentSession = null;
        this.sessions = new Map();
        this.autoSaveTimer = null;
        
        // Session metrics
        this.metrics = {
            totalSessions: 0,
            totalRestores: 0,
            totalSaves: 0,
            averageSessionDuration: 0
        };
    }
    
    /**
     * Initialize session manager
     */
    async initialize() {
        this.logger.info('🔄 Initializing Claude Session Manager...');
        
        try {
            // Ensure directories exist
            await fs.ensureDir(this.config.sessionPath);
            await fs.ensureDir(path.dirname(this.config.activePath));
            
            // Load existing sessions
            await this.loadSessions();
            
            // Check for active session
            const resumed = await this.resumeActiveSession();
            
            if (!resumed) {
                // Start new session if no active session
                await this.startNewSession();
            }
            
            // Start auto-save
            this.startAutoSave();
            
            // Register hooks
            this.registerHooks();
            
            this.logger.info('✅ Session Manager initialized');
            this.logger.info(`📊 Current session: ${this.currentSession?.id}`);
            
        } catch (error) {
            this.logger.error('Failed to initialize session manager:', error);
            throw error;
        }
    }
    
    /**
     * Start a new session
     */
    async startNewSession(options = {}) {
        const {
            projectName = 'default',
            branch = false,
            parentSessionId = null
        } = options;
        
        // Create session object
        const session = {
            id: this.generateSessionId(),
            projectName,
            startTime: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            endTime: null,
            status: 'active',
            
            // Branching support
            parentSessionId,
            branchPoint: branch ? Date.now() : null,
            children: [],
            
            // Session data
            context: {
                messages: [],
                artifacts: new Map(),
                files: new Map(),
                decisions: [],
                errors: [],
                tasks: []
            },
            
            // Metrics
            metrics: {
                messageCount: 0,
                tokenUsage: 0,
                compactionCount: 0,
                fileOperations: 0,
                artifactCreations: 0
            },
            
            // Checkpoints
            checkpoints: []
        };
        
        // If branching, copy parent context
        if (branch && parentSessionId) {
            const parent = this.sessions.get(parentSessionId);
            if (parent) {
                session.context = this.deepCloneContext(parent.context);
                parent.children.push(session.id);
            }
        }
        
        // Set as current session
        this.currentSession = session;
        this.sessions.set(session.id, session);
        
        // Save session
        await this.saveSession(session.id);
        
        // Update active session
        await this.updateActiveSession(session.id);
        
        // Trigger hook (if available)
        if (this.hooks && this.hooks.trigger) {
            await this.hooks.trigger('onSessionStart', { sessionId: session.id });
        }
        
        this.logger.info(`🆕 Started new session: ${session.id}`);
        
        this.metrics.totalSessions++;
        
        return session.id;
    }
    
    /**
     * End current session
     */
    async endSession(sessionId = null) {
        const id = sessionId || this.currentSession?.id;
        if (!id) return;
        
        const session = this.sessions.get(id);
        if (!session) return;
        
        // Update session
        session.endTime = new Date().toISOString();
        session.status = 'ended';
        session.lastActivity = new Date().toISOString();
        
        // Calculate duration
        const duration = new Date(session.endTime) - new Date(session.startTime);
        session.metrics.duration = duration;
        
        // Save final state
        await this.saveSession(id);
        
        // Trigger hook
        if (this.hooks && this.hooks.trigger) {
            await this.hooks.trigger('onSessionEnd', {
                sessionId: id,
                duration,
                metrics: session.metrics
            });
        }
        
        // Clear current if it's the active session
        if (this.currentSession?.id === id) {
            this.currentSession = null;
            await fs.remove(this.config.activePath);
        }
        
        this.logger.info(`🏁 Ended session: ${id}`);
        
        // Update average duration
        this.updateAverageDuration(duration);
    }
    
    /**
     * Save session to disk
     */
    async saveSession(sessionId = null) {
        const id = sessionId || this.currentSession?.id;
        if (!id) return;
        
        const session = this.sessions.get(id);
        if (!session) return;
        
        try {
            // Update last activity
            session.lastActivity = new Date().toISOString();
            
            // Prepare session data for serialization
            const sessionData = {
                ...session,
                context: {
                    ...session.context,
                    artifacts: Array.from(session.context.artifacts.entries()),
                    files: Array.from(session.context.files.entries())
                }
            };
            
            // Save to file
            const sessionFile = path.join(this.config.sessionPath, `${id}.json`);
            await fs.writeJson(sessionFile, sessionData, { spaces: 2 });
            
            this.metrics.totalSaves++;
            
            this.logger.debug(`💾 Saved session: ${id}`);
            
            return true;
        } catch (error) {
            this.logger.error(`Failed to save session ${id}:`, error);
            return false;
        }
    }
    
    /**
     * Load session from disk
     */
    async loadSession(sessionId) {
        try {
            const sessionFile = path.join(this.config.sessionPath, `${sessionId}.json`);
            
            if (!await fs.pathExists(sessionFile)) {
                return null;
            }
            
            const sessionData = await fs.readJson(sessionFile);
            
            // Restore Maps
            const session = {
                ...sessionData,
                context: {
                    ...sessionData.context,
                    artifacts: new Map(sessionData.context.artifacts),
                    files: new Map(sessionData.context.files)
                }
            };
            
            this.sessions.set(sessionId, session);
            
            this.logger.debug(`📂 Loaded session: ${sessionId}`);
            
            return session;
        } catch (error) {
            this.logger.error(`Failed to load session ${sessionId}:`, error);
            return null;
        }
    }
    
    /**
     * Load all sessions
     */
    async loadSessions() {
        try {
            const files = await fs.readdir(this.config.sessionPath);
            const sessionFiles = files.filter(f => f.endsWith('.json'));
            
            for (const file of sessionFiles) {
                const sessionId = file.replace('.json', '');
                await this.loadSession(sessionId);
            }
            
            this.logger.info(`📚 Loaded ${sessionFiles.length} sessions`);
            
        } catch (error) {
            this.logger.error('Failed to load sessions:', error);
        }
    }
    
    /**
     * Resume active session
     */
    async resumeActiveSession() {
        try {
            if (!await fs.pathExists(this.config.activePath)) {
                return false;
            }
            
            const activeData = await fs.readJson(this.config.activePath);
            const session = await this.loadSession(activeData.sessionId);
            
            if (!session) {
                return false;
            }
            
            // Check if session is still valid (not timed out)
            const lastActivity = new Date(session.lastActivity);
            const now = new Date();
            const timeSinceActivity = now - lastActivity;
            
            if (timeSinceActivity > this.config.sessionTimeout) {
                this.logger.info('⏱️ Previous session timed out');
                await this.endSession(session.id);
                return false;
            }
            
            // Resume session
            this.currentSession = session;
            session.status = 'resumed';
            
            // Restore context to manager
            await this.restoreSessionContext(session);
            
            // Trigger hook
            if (this.hooks && this.hooks.trigger) {
                await this.hooks.trigger('onSessionResume', {
                    sessionId: session.id,
                    timeSinceActivity
                });
            }
            
            this.logger.info(`▶️ Resumed session: ${session.id}`);
            this.metrics.totalRestores++;
            
            return true;
            
        } catch (error) {
            this.logger.error('Failed to resume active session:', error);
            return false;
        }
    }
    
    /**
     * Switch to a different session
     */
    async switchSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            // Try to load from disk
            const loaded = await this.loadSession(sessionId);
            if (!loaded) {
                throw new Error(`Session not found: ${sessionId}`);
            }
        }
        
        // Save current session if exists
        if (this.currentSession) {
            await this.saveSession(this.currentSession.id);
        }
        
        // Switch to new session
        this.currentSession = this.sessions.get(sessionId);
        
        // Restore context
        await this.restoreSessionContext(this.currentSession);
        
        // Update active session
        await this.updateActiveSession(sessionId);
        
        this.logger.info(`🔄 Switched to session: ${sessionId}`);
        
        return this.currentSession;
    }
    
    /**
     * Create session checkpoint
     */
    async createCheckpoint(checkpointData) {
        if (!this.currentSession) return null;
        
        // Handle both old format (string label) and new format (object)
        let label, name, description, context, files, artifacts;
        
        if (typeof checkpointData === 'string') {
            label = checkpointData;
            name = checkpointData;
        } else if (typeof checkpointData === 'object' && checkpointData !== null) {
            label = checkpointData.name || checkpointData.label;
            name = checkpointData.name || checkpointData.label;
            description = checkpointData.description;
            context = checkpointData.context;
            files = checkpointData.files;
            artifacts = checkpointData.artifacts;
        }
        
        const checkpoint = {
            id: crypto.randomBytes(8).toString('hex'),
            sessionId: this.currentSession.id,
            timestamp: new Date().toISOString(),
            name: name || `checkpoint-${Date.now()}`,
            label,
            description,
            context: context || this.deepCloneContext(this.currentSession.context),
            files,
            artifacts,
            metrics: { ...this.currentSession.metrics }
        };
        
        // Add to session checkpoints
        this.currentSession.checkpoints.push({
            id: checkpoint.id,
            timestamp: checkpoint.timestamp,
            label
        });
        
        // Save checkpoint
        const checkpointPath = path.join(
            this.config.sessionPath,
            'checkpoints',
            `${checkpoint.id}.json`
        );
        
        await fs.ensureDir(path.dirname(checkpointPath));
        await fs.writeJson(checkpointPath, checkpoint, { spaces: 2 });
        
        // Save session
        await this.saveSession();
        
        this.logger.info(`📸 Created checkpoint: ${checkpoint.id} ${label ? `(${label})` : ''}`);
        
        return checkpoint;
    }
    
    /**
     * Restore from checkpoint
     */
    async restoreCheckpoint(checkpointId) {
        const checkpointPath = path.join(
            this.config.sessionPath,
            'checkpoints',
            `${checkpointId}.json`
        );
        
        if (!await fs.pathExists(checkpointPath)) {
            throw new Error(`Checkpoint not found: ${checkpointId}`);
        }
        
        const checkpoint = await fs.readJson(checkpointPath);
        
        // Restore to current session
        if (this.currentSession) {
            this.currentSession.context = this.deepCloneContext(checkpoint.context);
            this.currentSession.metrics = { ...checkpoint.metrics };
            
            // Restore to context manager
            await this.restoreSessionContext(this.currentSession);
            
            // Save session
            await this.saveSession();
            
            this.logger.info(`🔄 Restored checkpoint: ${checkpointId}`);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Branch from current session
     */
    async branchSession(branchName = null) {
        if (!this.currentSession) {
            throw new Error('No active session to branch from');
        }
        
        // Create checkpoint first
        const checkpointId = await this.createCheckpoint(`Branch point: ${branchName}`);
        
        // Create new branched session
        const branchedSessionId = await this.startNewSession({
            projectName: this.currentSession.projectName,
            branch: true,
            parentSessionId: this.currentSession.id
        });
        
        this.logger.info(`🌿 Created branch: ${branchedSessionId} from ${this.currentSession.id}`);
        
        return {
            sessionId: branchedSessionId,
            checkpointId,
            parentSessionId: this.currentSession.id
        };
    }
    
    /**
     * Get session history
     */
    async getSessionHistory(sessionId = null) {
        const id = sessionId || this.currentSession?.id;
        if (!id) return [];
        
        const session = this.sessions.get(id);
        if (!session) return [];
        
        const history = [];
        
        // Build history from messages
        for (const message of session.context.messages) {
            history.push({
                type: 'message',
                timestamp: message.timestamp,
                role: message.role,
                preview: message.content.substring(0, 100)
            });
        }
        
        // Add file operations
        for (const [file, operations] of session.context.files) {
            for (const op of operations) {
                history.push({
                    type: 'file',
                    timestamp: op.timestamp,
                    file,
                    operation: op.type
                });
            }
        }
        
        // Add artifacts
        for (const [id, artifact] of session.context.artifacts) {
            history.push({
                type: 'artifact',
                timestamp: artifact.createdAt,
                artifactId: id,
                language: artifact.language
            });
        }
        
        // Sort by timestamp
        history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return history;
    }
    
    /**
     * Export session for sharing
     */
    async exportSession(sessionId = null, options = {}) {
        const id = sessionId || this.currentSession?.id;
        if (!id) return null;
        
        const session = this.sessions.get(id);
        if (!session) return null;
        
        const {
            includeMessages = true,
            includeArtifacts = true,
            includeFiles = false,
            compress = true
        } = options;
        
        // Prepare export data
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            session: {
                id: session.id,
                projectName: session.projectName,
                duration: session.endTime ? 
                    new Date(session.endTime) - new Date(session.startTime) : 
                    Date.now() - new Date(session.startTime),
                metrics: session.metrics
            }
        };
        
        if (includeMessages) {
            exportData.messages = session.context.messages;
        }
        
        if (includeArtifacts) {
            exportData.artifacts = Array.from(session.context.artifacts.entries());
        }
        
        if (includeFiles) {
            exportData.files = Array.from(session.context.files.entries());
        }
        
        // Save export
        const exportPath = path.join(
            this.config.sessionPath,
            'exports',
            `${id}-export-${Date.now()}.json`
        );
        
        await fs.ensureDir(path.dirname(exportPath));
        
        if (compress) {
            // TODO: Add compression
            await fs.writeJson(exportPath, exportData);
        } else {
            await fs.writeJson(exportPath, exportData, { spaces: 2 });
        }
        
        this.logger.info(`📤 Exported session: ${id}`);
        
        return exportPath;
    }
    
    /**
     * Import session from export
     */
    async importSession(exportPath) {
        if (!await fs.pathExists(exportPath)) {
            throw new Error(`Export file not found: ${exportPath}`);
        }
        
        const exportData = await fs.readJson(exportPath);
        
        // Create new session from export
        const sessionId = await this.startNewSession({
            projectName: exportData.session.projectName
        });
        
        const session = this.sessions.get(sessionId);
        
        // Import data
        if (exportData.messages) {
            session.context.messages = exportData.messages;
        }
        
        if (exportData.artifacts) {
            session.context.artifacts = new Map(exportData.artifacts);
        }
        
        if (exportData.files) {
            session.context.files = new Map(exportData.files);
        }
        
        // Save session
        await this.saveSession(sessionId);
        
        this.logger.info(`📥 Imported session: ${sessionId}`);
        
        return sessionId;
    }
    
    /**
     * Update session metrics
     */
    updateMetrics(type, value = 1) {
        if (!this.currentSession) return;
        
        if (this.currentSession.metrics[type] !== undefined) {
            this.currentSession.metrics[type] += value;
        }
    }
    
    /**
     * Get session statistics
     */
    getStatistics() {
        const stats = {
            totalSessions: this.sessions.size,
            activeSessions: 0,
            totalMessages: 0,
            totalArtifacts: 0,
            totalFiles: 0,
            averageDuration: this.metrics.averageSessionDuration,
            metrics: this.metrics
        };
        
        for (const session of this.sessions.values()) {
            if (session.status === 'active' || session.status === 'resumed') {
                stats.activeSessions++;
            }
            
            stats.totalMessages += session.context.messages.length;
            stats.totalArtifacts += session.context.artifacts.size;
            stats.totalFiles += session.context.files.size;
        }
        
        return stats;
    }
    
    /**
     * Clean old sessions
     */
    async cleanOldSessions(daysToKeep = 30) {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        const toDelete = [];
        
        for (const [id, session] of this.sessions) {
            const lastActivity = new Date(session.lastActivity);
            
            if (lastActivity < cutoffDate && session.status === 'ended') {
                toDelete.push(id);
            }
        }
        
        for (const id of toDelete) {
            this.sessions.delete(id);
            const sessionFile = path.join(this.config.sessionPath, `${id}.json`);
            await fs.remove(sessionFile);
        }
        
        this.logger.info(`🧹 Cleaned ${toDelete.length} old sessions`);
        
        return toDelete.length;
    }
    
    // Private methods
    
    /**
     * Generate session ID
     */
    generateSessionId() {
        return `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Deep clone context
     */
    deepCloneContext(context) {
        return {
            messages: [...context.messages],
            artifacts: new Map(context.artifacts),
            files: new Map(context.files),
            decisions: [...context.decisions],
            errors: [...context.errors],
            tasks: [...context.tasks]
        };
    }
    
    /**
     * Restore session context to managers
     */
    async restoreSessionContext(session) {
        // Restore to context manager
        if (this.contextManager) {
            // Restore messages
            for (const message of session.context.messages) {
                await this.contextManager.addMessage(message.content, {
                    role: message.role,
                    priority: message.priority,
                    metadata: message.metadata
                });
            }
            
            // Restore artifacts
            for (const [id, artifact] of session.context.artifacts) {
                this.contextManager.trackArtifact(id, artifact.content, artifact);
            }
            
            // Restore file references
            for (const [file, operations] of session.context.files) {
                for (const op of operations) {
                    this.contextManager.trackFileOperation(op.type, file);
                }
            }
        }
        
        // Trigger restoration hook
        if (this.hooks && this.hooks.trigger) {
            await this.hooks.trigger('afterSessionRestore', {
                sessionId: session.id,
                messageCount: session.context.messages.length,
                artifactCount: session.context.artifacts.size,
                fileCount: session.context.files.size
            });
        }
    }
    
    /**
     * Update active session file
     */
    async updateActiveSession(sessionId) {
        await fs.writeJson(this.config.activePath, {
            sessionId,
            timestamp: new Date().toISOString()
        }, { spaces: 2 });
    }
    
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        this.autoSaveTimer = setInterval(async () => {
            if (this.currentSession) {
                await this.saveSession();
                this.logger.debug('⏰ Auto-saved session');
            }
        }, this.config.autoSaveInterval);
    }
    
    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    /**
     * Register session hooks
     */
    registerHooks() {
        if (this.hooks && this.hooks.register) {
            // Save on pause
            this.hooks.register('onConversationPause', async () => {
                await this.saveSession();
            });
            
            // Update metrics on various events
            this.hooks.register('onArtifactCreation', () => {
                this.updateMetrics('artifactCreations');
            });
            
            this.hooks.register('onFileOperation', () => {
                this.updateMetrics('fileOperations');
            });
            
            this.hooks.register('onContextCompaction', () => {
                this.updateMetrics('compactionCount');
            });
        }
    }
    
    /**
     * Update average session duration
     */
    updateAverageDuration(duration) {
        const currentTotal = this.metrics.averageSessionDuration * (this.metrics.totalSessions - 1);
        this.metrics.averageSessionDuration = (currentTotal + duration) / this.metrics.totalSessions;
    }
    
    /**
     * Cleanup on shutdown
     */
    async shutdown() {
        this.stopAutoSave();
        
        if (this.currentSession) {
            await this.saveSession();
        }
        
        this.logger.info('Session manager shut down');
    }
}

module.exports = ClaudeSessionManager;