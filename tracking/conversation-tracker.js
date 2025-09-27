#!/usr/bin/env node

/**
 * Nexus Conversation Tracker
 * Captures and stores complete conversation history including prompts, responses, and tool usage
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class ConversationTracker {
    constructor(options = {}) {
        this.logger = new Logger('ConversationTracker');
        
        this.config = {
            storagePath: options.storagePath || path.join(process.cwd(), '.nexus', 'conversations'),
            currentConversationId: options.conversationId || this.generateConversationId(),
            maxPromptLength: options.maxPromptLength || 50000,
            maxResponseLength: options.maxResponseLength || 100000
        };
        
        // Current conversation state
        this.conversation = {
            id: this.config.currentConversationId,
            startTime: new Date().toISOString(),
            turns: [],
            currentTurn: 0,
            metadata: {
                project: process.cwd(),
                user: process.env.USER || 'unknown'
            },
            toolUsage: new Map(),
            fileOperations: [],
            checkpoints: []
        };
        
        // Tool tracking
        this.pendingTools = new Map();
    }
    
    /**
     * Initialize tracker
     */
    async initialize() {
        this.logger.info('🎙️ Initializing conversation tracker');
        
        // Ensure storage directories
        await fs.ensureDir(this.config.storagePath);
        await fs.ensureDir(path.join(this.config.storagePath, 'turns'));
        await fs.ensureDir(path.join(this.config.storagePath, 'tools'));
        await fs.ensureDir(path.join(this.config.storagePath, 'responses'));
        
        // Load existing conversation if exists
        await this.loadConversation();
        
        this.logger.info(`📝 Tracking conversation: ${this.config.currentConversationId}`);
    }
    
    /**
     * Track user prompt
     */
    async trackPrompt(prompt, metadata = {}) {
        this.conversation.currentTurn++;
        
        const turn = {
            number: this.conversation.currentTurn,
            timestamp: new Date().toISOString(),
            type: 'user',
            content: prompt.substring(0, this.config.maxPromptLength),
            metadata: {
                ...metadata,
                length: prompt.length,
                truncated: prompt.length > this.config.maxPromptLength
            }
        };
        
        this.conversation.turns.push(turn);
        
        // Save turn to disk
        await this.saveTurn(turn);
        
        this.logger.info(`👤 Turn ${this.conversation.currentTurn}: User prompt (${prompt.length} chars)`);
        
        // Create checkpoint for this turn
        await this.createTurnCheckpoint();
        
        return turn;
    }
    
    /**
     * Track AI response start
     */
    async trackResponseStart(metadata = {}) {
        const response = {
            turnNumber: this.conversation.currentTurn,
            startTime: new Date().toISOString(),
            endTime: null,
            content: '',
            tools: [],
            metadata
        };
        
        // Store as pending response
        this.pendingResponse = response;
        
        this.logger.info(`🤖 Starting response for turn ${this.conversation.currentTurn}`);
        
        return response;
    }
    
    /**
     * Track tool invocation
     */
    async trackToolInvocation(toolName, parameters, metadata = {}) {
        const toolId = crypto.randomBytes(8).toString('hex');
        
        const tool = {
            id: toolId,
            turnNumber: this.conversation.currentTurn,
            name: toolName,
            parameters,
            startTime: new Date().toISOString(),
            endTime: null,
            result: null,
            success: null,
            metadata
        };
        
        // Store as pending
        this.pendingTools.set(toolId, tool);
        
        // Add to current response if exists
        if (this.pendingResponse) {
            this.pendingResponse.tools.push(toolId);
        }
        
        // Track specific file operations
        if (['Write', 'Edit', 'Read'].includes(toolName)) {
            const filePath = parameters.file_path || parameters.path;
            if (filePath) {
                this.conversation.fileOperations.push({
                    turnNumber: this.conversation.currentTurn,
                    toolId,
                    operation: toolName,
                    path: filePath,
                    timestamp: tool.startTime
                });
            }
        }
        
        this.logger.debug(`🔧 Tool invoked: ${toolName} (${toolId})`);
        
        return toolId;
    }
    
    /**
     * Track tool result
     */
    async trackToolResult(toolId, result, success = true) {
        const tool = this.pendingTools.get(toolId);
        
        if (tool) {
            tool.endTime = new Date().toISOString();
            tool.result = typeof result === 'string' ? result : JSON.stringify(result);
            tool.success = success;
            
            // Save tool usage
            await this.saveToolUsage(tool);
            
            // Move from pending to completed
            this.pendingTools.delete(toolId);
            
            // Update tool usage stats
            if (!this.conversation.toolUsage.has(tool.name)) {
                this.conversation.toolUsage.set(tool.name, {
                    count: 0,
                    successes: 0,
                    failures: 0
                });
            }
            
            const stats = this.conversation.toolUsage.get(tool.name);
            stats.count++;
            if (success) {
                stats.successes++;
            } else {
                stats.failures++;
            }
            
            this.logger.debug(`✅ Tool completed: ${tool.name} (${toolId})`);
        }
        
        return tool;
    }
    
    /**
     * Track response completion
     */
    async trackResponseEnd(content, metadata = {}) {
        if (this.pendingResponse) {
            this.pendingResponse.endTime = new Date().toISOString();
            this.pendingResponse.content = content.substring(0, this.config.maxResponseLength);
            this.pendingResponse.metadata = {
                ...this.pendingResponse.metadata,
                ...metadata,
                length: content.length,
                truncated: content.length > this.config.maxResponseLength
            };
            
            // Create turn entry
            const turn = {
                number: this.conversation.currentTurn,
                timestamp: this.pendingResponse.startTime,
                type: 'assistant',
                content: this.pendingResponse.content,
                tools: this.pendingResponse.tools,
                metadata: this.pendingResponse.metadata
            };
            
            this.conversation.turns.push(turn);
            
            // Save turn and response
            await this.saveTurn(turn);
            await this.saveResponse(this.pendingResponse);
            
            this.logger.info(`🤖 Turn ${this.conversation.currentTurn}: AI response (${content.length} chars, ${this.pendingResponse.tools.length} tools)`);
            
            // Clear pending response
            this.pendingResponse = null;
        }
        
        // Save conversation state
        await this.saveConversation();
    }
    
    /**
     * Create checkpoint for current turn
     */
    async createTurnCheckpoint() {
        const checkpointId = `turn-${this.conversation.currentTurn}-${Date.now()}`;
        
        const checkpoint = {
            id: checkpointId,
            turnNumber: this.conversation.currentTurn,
            timestamp: new Date().toISOString(),
            conversationState: {
                turns: this.conversation.turns.length,
                toolsUsed: Array.from(this.conversation.toolUsage.entries()),
                filesModified: this.conversation.fileOperations.length
            }
        };
        
        this.conversation.checkpoints.push(checkpoint);
        
        // Save checkpoint
        const checkpointPath = path.join(
            this.config.storagePath,
            'checkpoints',
            `${checkpointId}.json`
        );
        
        await fs.ensureDir(path.dirname(checkpointPath));
        await fs.writeJson(checkpointPath, checkpoint, { spaces: 2 });
        
        return checkpointId;
    }
    
    /**
     * Save turn to disk
     */
    async saveTurn(turn) {
        const turnPath = path.join(
            this.config.storagePath,
            'turns',
            `turn-${String(turn.number).padStart(4, '0')}.json`
        );
        
        await fs.writeJson(turnPath, turn, { spaces: 2 });
    }
    
    /**
     * Save tool usage to disk
     */
    async saveToolUsage(tool) {
        const toolPath = path.join(
            this.config.storagePath,
            'tools',
            `${tool.id}.json`
        );
        
        await fs.writeJson(toolPath, tool, { spaces: 2 });
    }
    
    /**
     * Save response to disk
     */
    async saveResponse(response) {
        const responsePath = path.join(
            this.config.storagePath,
            'responses',
            `response-${String(response.turnNumber).padStart(4, '0')}.json`
        );
        
        await fs.writeJson(responsePath, response, { spaces: 2 });
    }
    
    /**
     * Save conversation state
     */
    async saveConversation() {
        const conversationPath = path.join(
            this.config.storagePath,
            'conversation.json'
        );
        
        const data = {
            ...this.conversation,
            toolUsage: Array.from(this.conversation.toolUsage.entries())
        };
        
        await fs.writeJson(conversationPath, data, { spaces: 2 });
    }
    
    /**
     * Load existing conversation
     */
    async loadConversation() {
        const conversationPath = path.join(
            this.config.storagePath,
            'conversation.json'
        );
        
        if (await fs.pathExists(conversationPath)) {
            const data = await fs.readJson(conversationPath);
            
            this.conversation = {
                ...data,
                toolUsage: new Map(data.toolUsage || [])
            };
            
            this.logger.info(`📂 Loaded conversation with ${this.conversation.turns.length} turns`);
        }
    }
    
    /**
     * Get conversation summary
     */
    getSummary() {
        const duration = this.conversation.turns.length > 0
            ? new Date() - new Date(this.conversation.startTime)
            : 0;
        
        return {
            id: this.conversation.id,
            turns: this.conversation.currentTurn,
            messages: this.conversation.turns.length,
            toolsUsed: Array.from(this.conversation.toolUsage.entries()).map(([name, stats]) => ({
                name,
                ...stats
            })),
            filesModified: [...new Set(this.conversation.fileOperations.map(op => op.path))].length,
            duration: Math.round(duration / 1000), // seconds
            checkpoints: this.conversation.checkpoints.length
        };
    }
    
    /**
     * Generate conversation ID
     */
    generateConversationId() {
        return `conversation-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Export conversation for analysis
     */
    async exportConversation(format = 'json') {
        const exportPath = path.join(
            this.config.storagePath,
            `export-${Date.now()}.${format}`
        );
        
        if (format === 'json') {
            const data = {
                ...this.conversation,
                toolUsage: Array.from(this.conversation.toolUsage.entries()),
                summary: this.getSummary()
            };
            
            await fs.writeJson(exportPath, data, { spaces: 2 });
        } else if (format === 'markdown') {
            // Generate markdown report
            let markdown = `# Conversation Report\n\n`;
            markdown += `**ID:** ${this.conversation.id}\n`;
            markdown += `**Started:** ${this.conversation.startTime}\n`;
            markdown += `**Turns:** ${this.conversation.currentTurn}\n\n`;
            
            markdown += `## Summary\n`;
            markdown += `- Total messages: ${this.conversation.turns.length}\n`;
            markdown += `- Files modified: ${[...new Set(this.conversation.fileOperations.map(op => op.path))].length}\n`;
            markdown += `- Tools used: ${this.conversation.toolUsage.size}\n\n`;
            
            markdown += `## Conversation Flow\n\n`;
            
            for (const turn of this.conversation.turns) {
                if (turn.type === 'user') {
                    markdown += `### Turn ${turn.number} - User\n`;
                    markdown += `> ${turn.content.substring(0, 200)}${turn.content.length > 200 ? '...' : ''}\n\n`;
                } else {
                    markdown += `### Turn ${turn.number} - Assistant\n`;
                    markdown += `${turn.content.substring(0, 500)}${turn.content.length > 500 ? '...' : ''}\n`;
                    
                    if (turn.tools && turn.tools.length > 0) {
                        markdown += `\n**Tools used:** ${turn.tools.length}\n`;
                    }
                    markdown += '\n';
                }
            }
            
            await fs.writeFile(exportPath, markdown);
        }
        
        this.logger.info(`📤 Exported conversation to ${exportPath}`);
        
        return exportPath;
    }
}

module.exports = ConversationTracker;

// Run standalone if executed directly
if (require.main === module) {
    const tracker = new ConversationTracker();
    
    tracker.initialize().then(() => {
        console.log('Conversation tracker initialized');
        
        // Example usage
        tracker.trackPrompt('Create a hello world application').then(() => {
            tracker.trackResponseStart();
            tracker.trackToolInvocation('Write', { file_path: 'hello.js' });
            // ... simulate tool completion
            tracker.trackToolResult('toolId', 'File created successfully');
            tracker.trackResponseEnd('I created a hello world application in hello.js');
        });
    }).catch(error => {
        console.error('Failed to initialize tracker:', error);
        process.exit(1);
    });
}