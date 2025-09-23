/**
 * Claude Context Manager
 * Specialized context management for Claude's 200k token window
 * Handles automatic compaction, priority retention, and context optimization
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class ClaudeContextManager {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('ClaudeContextManager');
        
        // Claude-specific configuration
        this.config = {
            maxContextTokens: 200000,      // Claude's context window
            compactionThreshold: 180000,   // Start compaction at 90%
            warningThreshold: 150000,      // Warn at 75%
            criticalThreshold: 190000,     // Critical at 95%
            
            // Token estimation (rough approximation)
            avgTokensPerChar: 0.25,        // ~4 chars per token
            
            // Priority levels for content retention
            priorities: {
                CRITICAL: 1000,    // Must keep (current task, recent errors)
                HIGH: 100,         // Important (project structure, dependencies)
                MEDIUM: 10,        // Useful (older code, documentation)
                LOW: 1            // Optional (examples, old conversations)
            },
            
            // Auto-management settings
            autoCompact: true,
            autoSave: true,
            autoRestore: true,
            saveInterval: 10,  // Save every 10 messages
            
            // Memory paths
            memoryPath: path.join(process.cwd(), '.nexus', 'claude', 'memory'),
            checkpointPath: path.join(process.cwd(), '.nexus', 'claude', 'checkpoints')
        };
        
        // Current context state
        this.contextState = {
            currentTokens: 0,
            messageCount: 0,
            sessionId: null,
            startTime: null,
            lastSave: null,
            lastCompaction: null,
            compactionCount: 0,
            
            // Content tracking
            messages: [],
            artifacts: new Map(),
            fileReferences: new Map(),
            toolUsage: [],
            decisions: [],
            errors: [],
            
            // Priority queue for retention
            priorityQueue: new Map()
        };
        
        // Performance metrics
        this.metrics = {
            totalTokensSaved: 0,
            compressionRatio: 0,
            avgResponseTime: 0,
            compactionEvents: []
        };
    }
    
    /**
     * Initialize the context manager
     */
    async initialize() {
        this.logger.info('🚀 Initializing Claude Context Manager...');
        
        try {
            // Ensure directories exist
            await fs.ensureDir(this.config.memoryPath);
            await fs.ensureDir(this.config.checkpointPath);
            
            // Start new session
            this.contextState.sessionId = this.generateSessionId();
            this.contextState.startTime = new Date().toISOString();
            
            // Load previous session if exists
            if (this.config.autoRestore) {
                await this.restorePreviousSession();
            }
            
            // Start monitoring
            this.startContextMonitoring();
            
            this.logger.info('✅ Claude Context Manager initialized');
            this.logger.info(`📊 Session ID: ${this.contextState.sessionId}`);
            this.logger.info(`💾 Context: ${this.contextState.currentTokens}/${this.config.maxContextTokens} tokens`);
            
        } catch (error) {
            this.logger.error('Failed to initialize:', error);
            throw error;
        }
    }
    
    /**
     * Add a message to context and track tokens
     */
    async addMessage(message, options = {}) {
        const {
            role = 'user',
            priority = this.config.priorities.MEDIUM,
            metadata = {}
        } = options;
        
        // Estimate tokens
        const tokens = this.estimateTokens(message);
        const totalTokens = this.contextState.currentTokens + tokens;
        
        // Check if we need to compact
        if (totalTokens > this.config.compactionThreshold && this.config.autoCompact) {
            this.logger.warn('⚠️ Approaching context limit, initiating compaction...');
            await this.compactContext();
        }
        
        // Create message object
        const messageObj = {
            id: crypto.randomBytes(8).toString('hex'),
            timestamp: new Date().toISOString(),
            role,
            content: message,
            tokens,
            priority,
            metadata,
            compressed: false
        };
        
        // Add to messages
        this.contextState.messages.push(messageObj);
        this.contextState.currentTokens = totalTokens;
        this.contextState.messageCount++;
        
        // Add to priority queue
        this.contextState.priorityQueue.set(messageObj.id, {
            priority,
            tokens,
            timestamp: Date.now()
        });
        
        // Extract and track references
        this.extractReferences(message, messageObj.id);
        
        // Auto-save if needed
        if (this.config.autoSave && 
            this.contextState.messageCount % this.config.saveInterval === 0) {
            await this.saveCheckpoint();
        }
        
        // Emit metrics
        this.updateMetrics();
        
        return {
            messageId: messageObj.id,
            currentTokens: this.contextState.currentTokens,
            utilizationPercent: (this.contextState.currentTokens / this.config.maxContextTokens) * 100
        };
    }
    
    /**
     * Track artifact creation
     */
    trackArtifact(artifactId, content, metadata = {}) {
        const artifact = {
            id: artifactId,
            content,
            tokens: this.estimateTokens(content),
            createdAt: new Date().toISOString(),
            references: [],
            ...metadata
        };
        
        this.contextState.artifacts.set(artifactId, artifact);
        
        this.logger.debug(`📝 Tracked artifact: ${artifactId} (${artifact.tokens} tokens)`);
    }
    
    /**
     * Track file operations
     */
    trackFileOperation(operation, filePath, content = null) {
        const fileOp = {
            operation,  // 'read', 'write', 'edit', 'delete'
            filePath,
            timestamp: new Date().toISOString(),
            tokens: content ? this.estimateTokens(content) : 0
        };
        
        // Update file references
        if (!this.contextState.fileReferences.has(filePath)) {
            this.contextState.fileReferences.set(filePath, {
                firstAccess: fileOp.timestamp,
                lastAccess: fileOp.timestamp,
                operations: [],
                totalTokens: 0,
                priority: this.config.priorities.HIGH
            });
        }
        
        const fileRef = this.contextState.fileReferences.get(filePath);
        fileRef.lastAccess = fileOp.timestamp;
        fileRef.operations.push(operation);
        fileRef.totalTokens += fileOp.tokens;
        
        // Increase priority for recently accessed files
        if (operation === 'edit' || operation === 'write') {
            fileRef.priority = this.config.priorities.CRITICAL;
        }
        
        this.logger.debug(`📁 Tracked ${operation} on ${filePath}`);
    }
    
    /**
     * Track tool usage
     */
    trackToolUsage(tool, parameters, result = null) {
        const usage = {
            tool,
            parameters,
            result: result ? String(result).substring(0, 100) : null,
            timestamp: new Date().toISOString(),
            tokens: this.estimateTokens(JSON.stringify(parameters))
        };
        
        this.contextState.toolUsage.push(usage);
        
        // Keep only recent tool usage
        if (this.contextState.toolUsage.length > 100) {
            this.contextState.toolUsage = this.contextState.toolUsage.slice(-50);
        }
    }
    
    /**
     * Track decisions made
     */
    trackDecision(decision, reasoning, impact = 'low') {
        const decisionObj = {
            decision,
            reasoning,
            impact,  // 'low', 'medium', 'high', 'critical'
            timestamp: new Date().toISOString(),
            relatedFiles: [],
            outcome: null
        };
        
        this.contextState.decisions.push(decisionObj);
        
        // Prioritize critical decisions
        if (impact === 'critical' || impact === 'high') {
            decisionObj.priority = this.config.priorities.CRITICAL;
        }
        
        this.logger.info(`🎯 Tracked decision: ${decision} (${impact} impact)`);
    }
    
    /**
     * Track errors and their solutions
     */
    trackError(error, solution = null, context = {}) {
        const errorObj = {
            error: error.message || error,
            solution,
            context,
            timestamp: new Date().toISOString(),
            resolved: !!solution
        };
        
        this.contextState.errors.push(errorObj);
        
        // Keep errors with solutions at higher priority
        if (solution) {
            errorObj.priority = this.config.priorities.HIGH;
        }
        
        this.logger.debug(`❌ Tracked error: ${errorObj.error}`);
    }
    
    /**
     * Compact the context intelligently
     */
    async compactContext() {
        this.logger.info('🗜️ Starting intelligent context compaction...');
        
        const startTokens = this.contextState.currentTokens;
        const startTime = Date.now();
        
        try {
            // Step 1: Categorize content by priority
            const categorized = this.categorizeContent();
            
            // Step 2: Summarize low-priority content
            const summarized = await this.summarizeContent(categorized.low);
            
            // Step 3: Compress medium-priority content
            const compressed = await this.compressContent(categorized.medium);
            
            // Step 4: Preserve critical content
            const preserved = categorized.critical;
            
            // Step 5: Rebuild context
            const newMessages = [
                ...summarized,
                ...compressed,
                ...preserved
            ];
            
            // Step 6: Update state
            this.contextState.messages = newMessages;
            this.contextState.currentTokens = this.calculateTotalTokens(newMessages);
            this.contextState.lastCompaction = new Date().toISOString();
            this.contextState.compactionCount++;
            
            // Step 7: Save compaction checkpoint
            await this.saveCompactionCheckpoint(categorized);
            
            // Calculate metrics
            const endTime = Date.now();
            const savedTokens = startTokens - this.contextState.currentTokens;
            const compressionRatio = (savedTokens / startTokens) * 100;
            
            this.metrics.totalTokensSaved += savedTokens;
            this.metrics.compressionRatio = compressionRatio;
            this.metrics.compactionEvents.push({
                timestamp: new Date().toISOString(),
                savedTokens,
                compressionRatio,
                duration: endTime - startTime
            });
            
            this.logger.info(`✅ Compaction complete!`);
            this.logger.info(`📊 Saved ${savedTokens} tokens (${compressionRatio.toFixed(1)}% compression)`);
            this.logger.info(`⏱️ Duration: ${endTime - startTime}ms`);
            
            return {
                success: true,
                savedTokens,
                compressionRatio,
                currentTokens: this.contextState.currentTokens
            };
            
        } catch (error) {
            this.logger.error('Compaction failed:', error);
            
            // Fallback: aggressive compaction
            return await this.aggressiveCompaction();
        }
    }
    
    /**
     * Categorize content by priority
     */
    categorizeContent() {
        const categorized = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };
        
        // Recent messages (last 20) are critical
        const recentThreshold = Math.max(0, this.contextState.messages.length - 20);
        
        this.contextState.messages.forEach((msg, index) => {
            // Determine priority
            let priority = msg.priority || this.config.priorities.MEDIUM;
            
            // Recent messages get boosted priority
            if (index >= recentThreshold) {
                priority = Math.max(priority, this.config.priorities.HIGH);
            }
            
            // Current task context is critical
            if (msg.metadata?.currentTask) {
                priority = this.config.priorities.CRITICAL;
            }
            
            // Errors and solutions are high priority
            if (msg.content.toLowerCase().includes('error') && 
                msg.content.toLowerCase().includes('fix')) {
                priority = Math.max(priority, this.config.priorities.HIGH);
            }
            
            // Categorize
            if (priority >= this.config.priorities.CRITICAL) {
                categorized.critical.push(msg);
            } else if (priority >= this.config.priorities.HIGH) {
                categorized.high.push(msg);
            } else if (priority >= this.config.priorities.MEDIUM) {
                categorized.medium.push(msg);
            } else {
                categorized.low.push(msg);
            }
        });
        
        this.logger.debug(`Categorized: ${categorized.critical.length} critical, ${categorized.high.length} high, ${categorized.medium.length} medium, ${categorized.low.length} low`);
        
        return categorized;
    }
    
    /**
     * Summarize low-priority content
     */
    async summarizeContent(messages) {
        if (messages.length === 0) return [];
        
        // Group messages by topic/time
        const groups = this.groupMessages(messages);
        const summarized = [];
        
        for (const group of groups) {
            const summary = {
                id: crypto.randomBytes(8).toString('hex'),
                timestamp: group[0].timestamp,
                role: 'system',
                content: this.createSummary(group),
                tokens: 0,  // Will calculate after
                priority: this.config.priorities.LOW,
                metadata: {
                    type: 'summary',
                    originalMessages: group.length,
                    originalTokens: group.reduce((sum, m) => sum + m.tokens, 0)
                },
                compressed: true
            };
            
            summary.tokens = this.estimateTokens(summary.content);
            summarized.push(summary);
        }
        
        return summarized;
    }
    
    /**
     * Create a summary of messages
     */
    createSummary(messages) {
        const topics = new Set();
        const files = new Set();
        const decisions = [];
        const errors = [];
        
        messages.forEach(msg => {
            // Extract topics
            if (msg.metadata?.topic) {
                topics.add(msg.metadata.topic);
            }
            
            // Extract file references
            const fileMatches = msg.content.match(/[\w\-./]+\.\w+/g);
            if (fileMatches) {
                fileMatches.forEach(f => files.add(f));
            }
            
            // Extract decisions
            if (msg.content.includes('decided') || msg.content.includes('will')) {
                decisions.push(msg.content.substring(0, 100));
            }
            
            // Extract errors
            if (msg.content.toLowerCase().includes('error')) {
                errors.push(msg.content.substring(0, 100));
            }
        });
        
        let summary = `[Summary of ${messages.length} messages]\n`;
        
        if (topics.size > 0) {
            summary += `Topics: ${Array.from(topics).join(', ')}\n`;
        }
        
        if (files.size > 0) {
            summary += `Files discussed: ${Array.from(files).join(', ')}\n`;
        }
        
        if (decisions.length > 0) {
            summary += `Key decisions: ${decisions.slice(0, 3).join('; ')}\n`;
        }
        
        if (errors.length > 0) {
            summary += `Errors encountered: ${errors.length} (resolved)\n`;
        }
        
        return summary;
    }
    
    /**
     * Compress medium-priority content
     */
    async compressContent(messages) {
        return messages.map(msg => {
            // Remove redundant whitespace
            let compressed = msg.content.replace(/\s+/g, ' ').trim();
            
            // Truncate long code blocks
            compressed = compressed.replace(/```[\s\S]{1000,}```/g, '```[Code block truncated]```');
            
            // Remove verbose explanations
            compressed = compressed.replace(/For example[^.]*\./g, '');
            compressed = compressed.replace(/In other words[^.]*\./g, '');
            
            return {
                ...msg,
                content: compressed,
                tokens: this.estimateTokens(compressed),
                compressed: true
            };
        });
    }
    
    /**
     * Save checkpoint
     */
    async saveCheckpoint() {
        const checkpointId = `checkpoint-${Date.now()}`;
        const checkpointPath = path.join(this.config.checkpointPath, `${checkpointId}.json`);
        
        const checkpoint = {
            id: checkpointId,
            sessionId: this.contextState.sessionId,
            timestamp: new Date().toISOString(),
            tokens: this.contextState.currentTokens,
            messageCount: this.contextState.messageCount,
            compactionCount: this.contextState.compactionCount,
            state: {
                messages: this.contextState.messages.slice(-100),  // Last 100 messages
                artifacts: Array.from(this.contextState.artifacts.entries()),
                fileReferences: Array.from(this.contextState.fileReferences.entries()),
                decisions: this.contextState.decisions.slice(-20),
                errors: this.contextState.errors.slice(-20)
            }
        };
        
        await fs.writeJson(checkpointPath, checkpoint, { spaces: 2 });
        
        this.contextState.lastSave = new Date().toISOString();
        
        this.logger.debug(`💾 Saved checkpoint: ${checkpointId}`);
        
        // Clean old checkpoints (keep last 5)
        await this.cleanOldCheckpoints();
        
        return checkpointId;
    }
    
    /**
     * Restore previous session
     */
    async restorePreviousSession() {
        try {
            const sessionFile = path.join(this.config.memoryPath, 'last-session.json');
            
            if (!await fs.pathExists(sessionFile)) {
                this.logger.info('No previous session found');
                return false;
            }
            
            const session = await fs.readJson(sessionFile);
            
            // Restore state
            this.contextState = {
                ...this.contextState,
                ...session.state,
                artifacts: new Map(session.state.artifacts),
                fileReferences: new Map(session.state.fileReferences),
                priorityQueue: new Map(session.state.priorityQueue || [])
            };
            
            this.logger.info(`✅ Restored session: ${session.sessionId}`);
            this.logger.info(`📊 Restored ${session.messageCount} messages, ${session.tokens} tokens`);
            
            return true;
            
        } catch (error) {
            this.logger.error('Failed to restore session:', error);
            return false;
        }
    }
    
    /**
     * Get context status
     */
    getStatus() {
        const utilization = (this.contextState.currentTokens / this.config.maxContextTokens) * 100;
        
        return {
            sessionId: this.contextState.sessionId,
            currentTokens: this.contextState.currentTokens,
            maxTokens: this.config.maxContextTokens,
            utilization: utilization.toFixed(1) + '%',
            messageCount: this.contextState.messageCount,
            artifactCount: this.contextState.artifacts.size,
            fileCount: this.contextState.fileReferences.size,
            compactionCount: this.contextState.compactionCount,
            lastSave: this.contextState.lastSave,
            lastCompaction: this.contextState.lastCompaction,
            status: this.getStatusLevel(utilization),
            metrics: this.metrics
        };
    }
    
    /**
     * Get status level based on utilization
     */
    getStatusLevel(utilization) {
        if (utilization < 50) return '🟢 Healthy';
        if (utilization < 75) return '🟡 Normal';
        if (utilization < 90) return '🟠 Warning';
        if (utilization < 95) return '🔴 Critical';
        return '⚠️ Maximum';
    }
    
    /**
     * Start monitoring context usage
     */
    startContextMonitoring() {
        setInterval(() => {
            const utilization = (this.contextState.currentTokens / this.config.maxContextTokens) * 100;
            
            if (utilization > 95) {
                this.logger.error('⚠️ CONTEXT CRITICAL: ' + utilization.toFixed(1) + '% used');
            } else if (utilization > 90) {
                this.logger.warn('🔴 Context high: ' + utilization.toFixed(1) + '% used');
            } else if (utilization > 75) {
                this.logger.info('🟠 Context warning: ' + utilization.toFixed(1) + '% used');
            }
        }, 60000);  // Check every minute
    }
    
    /**
     * Estimate token count (simplified)
     */
    estimateTokens(text) {
        if (!text) return 0;
        const str = typeof text === 'string' ? text : JSON.stringify(text);
        return Math.ceil(str.length * this.config.avgTokensPerChar);
    }
    
    /**
     * Calculate total tokens
     */
    calculateTotalTokens(messages) {
        return messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
    }
    
    /**
     * Generate session ID
     */
    generateSessionId() {
        return `claude-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Extract references from content
     */
    extractReferences(content, messageId) {
        // Extract file references
        const filePattern = /[\w\-./]+\.\w+/g;
        const files = content.match(filePattern) || [];
        
        files.forEach(file => {
            if (!this.contextState.fileReferences.has(file)) {
                this.contextState.fileReferences.set(file, {
                    mentions: [],
                    priority: this.config.priorities.MEDIUM
                });
            }
            this.contextState.fileReferences.get(file).mentions.push(messageId);
        });
    }
    
    /**
     * Group messages by similarity
     */
    groupMessages(messages, maxGroupSize = 10) {
        const groups = [];
        let currentGroup = [];
        
        messages.forEach(msg => {
            currentGroup.push(msg);
            
            if (currentGroup.length >= maxGroupSize) {
                groups.push(currentGroup);
                currentGroup = [];
            }
        });
        
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }
        
        return groups;
    }
    
    /**
     * Clean old checkpoints
     */
    async cleanOldCheckpoints() {
        const files = await fs.readdir(this.config.checkpointPath);
        const checkpoints = files.filter(f => f.startsWith('checkpoint-'));
        
        if (checkpoints.length > 5) {
            // Sort by timestamp and remove old ones
            checkpoints.sort();
            const toRemove = checkpoints.slice(0, checkpoints.length - 5);
            
            for (const checkpoint of toRemove) {
                await fs.remove(path.join(this.config.checkpointPath, checkpoint));
            }
        }
    }
    
    /**
     * Save compaction checkpoint
     */
    async saveCompactionCheckpoint(categorized) {
        const compactionPath = path.join(this.config.memoryPath, 'compactions');
        await fs.ensureDir(compactionPath);
        
        const compactionFile = path.join(compactionPath, `compaction-${Date.now()}.json`);
        
        await fs.writeJson(compactionFile, {
            timestamp: new Date().toISOString(),
            sessionId: this.contextState.sessionId,
            categorized,
            metrics: this.metrics
        }, { spaces: 2 });
    }
    
    /**
     * Aggressive compaction (fallback)
     */
    async aggressiveCompaction() {
        this.logger.warn('⚠️ Performing aggressive compaction...');
        
        // Keep only last 50 messages
        this.contextState.messages = this.contextState.messages.slice(-50);
        this.contextState.currentTokens = this.calculateTotalTokens(this.contextState.messages);
        
        return {
            success: true,
            savedTokens: 0,
            compressionRatio: 0,
            currentTokens: this.contextState.currentTokens,
            aggressive: true
        };
    }
    
    /**
     * Update metrics
     */
    updateMetrics() {
        // Calculate average response time, etc.
        // This would be expanded with real metrics
    }
}

module.exports = { ClaudeContextManager };