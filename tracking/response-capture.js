#!/usr/bin/env node
/**
 * Response Capture System
 * Captures and stores all AI responses with full content
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class ResponseCapture {
    constructor(options = {}) {
        this.logger = new Logger('ResponseCapture');
        
        this.config = {
            storagePath: options.storagePath || path.join(process.cwd(), '.nexus', 'responses'),
            maxResponseSize: options.maxResponseSize || 10 * 1024 * 1024, // 10MB max
            captureThinking: options.captureThinking !== false,
            captureCode: options.captureCode !== false,
            captureMetadata: options.captureMetadata !== false
        };
        
        this.currentResponse = null;
        this.responseHistory = [];
    }
    
    /**
     * Initialize response capture system
     */
    async initialize() {
        this.logger.info('🎙️ Initializing response capture system');
        
        // Ensure storage directories exist
        await fs.ensureDir(this.config.storagePath);
        await fs.ensureDir(path.join(this.config.storagePath, 'by-turn'));
        await fs.ensureDir(path.join(this.config.storagePath, 'by-date'));
        await fs.ensureDir(path.join(this.config.storagePath, 'thinking'));
        
        // Load response history
        await this.loadResponseHistory();
        
        this.logger.info(`✅ Response capture initialized with ${this.responseHistory.length} historical responses`);
    }
    
    /**
     * Start capturing a new response
     */
    startResponse(metadata = {}) {
        const responseId = this.generateResponseId();
        
        this.currentResponse = {
            id: responseId,
            startTime: new Date().toISOString(),
            conversationTurn: metadata.turn || 0,
            promptId: metadata.promptId || null,
            content: '',
            codeBlocks: [],
            toolCalls: [],
            thinking: [],
            metadata: metadata
        };
        
        this.logger.info(`📝 Started capturing response ${responseId}`);
        return responseId;
    }
    
    /**
     * Append content to current response
     */
    appendContent(content) {
        if (!this.currentResponse) {
            this.logger.warn('No active response to append to');
            return;
        }
        
        this.currentResponse.content += content;
        
        // Extract code blocks if present
        this.extractCodeBlocks(content);
        
        // Extract tool calls if present
        this.extractToolCalls(content);
    }
    
    /**
     * Add thinking/reasoning content
     */
    addThinking(thinking) {
        if (!this.currentResponse || !this.config.captureThinking) {
            return;
        }
        
        this.currentResponse.thinking.push({
            timestamp: new Date().toISOString(),
            content: thinking
        });
    }
    
    /**
     * Add tool call to response
     */
    addToolCall(toolName, params, result) {
        if (!this.currentResponse) {
            return;
        }
        
        this.currentResponse.toolCalls.push({
            timestamp: new Date().toISOString(),
            tool: toolName,
            params: params,
            result: result || null
        });
    }
    
    /**
     * End response capture and save
     */
    async endResponse() {
        if (!this.currentResponse) {
            this.logger.warn('No active response to end');
            return null;
        }
        
        this.currentResponse.endTime = new Date().toISOString();
        this.currentResponse.duration = 
            new Date(this.currentResponse.endTime) - new Date(this.currentResponse.startTime);
        
        // Calculate response metrics
        this.currentResponse.metrics = {
            length: this.currentResponse.content.length,
            codeBlocks: this.currentResponse.codeBlocks.length,
            toolCalls: this.currentResponse.toolCalls.length,
            hasThinking: this.currentResponse.thinking.length > 0
        };
        
        // Save response
        await this.saveResponse(this.currentResponse);
        
        // Add to history
        this.responseHistory.push({
            id: this.currentResponse.id,
            timestamp: this.currentResponse.startTime,
            turn: this.currentResponse.conversationTurn,
            length: this.currentResponse.content.length
        });
        
        const responseId = this.currentResponse.id;
        this.currentResponse = null;
        
        this.logger.info(`✅ Response ${responseId} captured and saved`);
        return responseId;
    }
    
    /**
     * Save response to disk
     */
    async saveResponse(response) {
        // Save by ID
        const responseFile = path.join(
            this.config.storagePath,
            `${response.id}.json`
        );
        await fs.writeJson(responseFile, response, { spaces: 2 });
        
        // Save by turn
        if (response.conversationTurn) {
            const turnFile = path.join(
                this.config.storagePath,
                'by-turn',
                `turn-${String(response.conversationTurn).padStart(4, '0')}.json`
            );
            await fs.writeJson(turnFile, response, { spaces: 2 });
        }
        
        // Save by date
        const date = new Date(response.startTime);
        const dateDir = path.join(
            this.config.storagePath,
            'by-date',
            date.getFullYear().toString(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        );
        await fs.ensureDir(dateDir);
        
        const dateFile = path.join(
            dateDir,
            `${date.getHours()}-${date.getMinutes()}-${response.id}.json`
        );
        await fs.writeJson(dateFile, response, { spaces: 2 });
        
        // Save thinking separately if exists
        if (response.thinking.length > 0) {
            const thinkingFile = path.join(
                this.config.storagePath,
                'thinking',
                `${response.id}-thinking.json`
            );
            await fs.writeJson(thinkingFile, {
                responseId: response.id,
                timestamp: response.startTime,
                thinking: response.thinking
            }, { spaces: 2 });
        }
    }
    
    /**
     * Extract code blocks from content
     */
    extractCodeBlocks(content) {
        if (!this.config.captureCode) {
            return;
        }
        
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        
        while ((match = codeBlockRegex.exec(content)) !== null) {
            this.currentResponse.codeBlocks.push({
                language: match[1] || 'plain',
                code: match[2],
                position: match.index,
                hash: crypto.createHash('sha256').update(match[2]).digest('hex').substring(0, 8)
            });
        }
    }
    
    /**
     * Extract tool calls from content
     */
    extractToolCalls(content) {
        // Look for tool call patterns in content
        // This would need to be customized based on actual format
        const toolCallRegex = /<tool>(\w+)<\/tool>/g;
        let match;
        
        while ((match = toolCallRegex.exec(content)) !== null) {
            // Record tool mention (actual calls are added via addToolCall)
            this.logger.debug(`Tool mentioned: ${match[1]}`);
        }
    }
    
    /**
     * Load response history
     */
    async loadResponseHistory() {
        const historyFile = path.join(this.config.storagePath, 'history.json');
        
        if (await fs.pathExists(historyFile)) {
            this.responseHistory = await fs.readJson(historyFile);
        }
    }
    
    /**
     * Save response history
     */
    async saveResponseHistory() {
        const historyFile = path.join(this.config.storagePath, 'history.json');
        await fs.writeJson(historyFile, this.responseHistory, { spaces: 2 });
    }
    
    /**
     * Get response by ID
     */
    async getResponse(responseId) {
        const responseFile = path.join(this.config.storagePath, `${responseId}.json`);
        
        if (await fs.pathExists(responseFile)) {
            return await fs.readJson(responseFile);
        }
        
        return null;
    }
    
    /**
     * Get responses for turn
     */
    async getResponsesForTurn(turn) {
        const turnFile = path.join(
            this.config.storagePath,
            'by-turn',
            `turn-${String(turn).padStart(4, '0')}.json`
        );
        
        if (await fs.pathExists(turnFile)) {
            return await fs.readJson(turnFile);
        }
        
        return null;
    }
    
    /**
     * Search responses
     */
    async searchResponses(query) {
        const results = [];
        
        for (const item of this.responseHistory) {
            const response = await this.getResponse(item.id);
            if (response && response.content.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    id: response.id,
                    timestamp: response.startTime,
                    turn: response.conversationTurn,
                    excerpt: response.content.substring(0, 200)
                });
            }
        }
        
        return results;
    }
    
    /**
     * Generate response ID
     */
    generateResponseId() {
        return `response-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Export all responses
     */
    async exportResponses(outputPath) {
        const exportData = {
            exportTime: new Date().toISOString(),
            totalResponses: this.responseHistory.length,
            responses: []
        };
        
        for (const item of this.responseHistory) {
            const response = await this.getResponse(item.id);
            if (response) {
                exportData.responses.push(response);
            }
        }
        
        await fs.writeJson(outputPath, exportData, { spaces: 2 });
        this.logger.info(`📦 Exported ${exportData.responses.length} responses to ${outputPath}`);
        
        return exportData;
    }
}

module.exports = ResponseCapture;

// CLI usage
if (require.main === module) {
    const program = require('commander');
    
    program
        .version('1.0.0')
        .description('Response capture system for AI conversations');
    
    program
        .command('capture')
        .description('Start capturing a response')
        .option('-t, --turn <number>', 'Conversation turn number', parseInt)
        .option('-p, --prompt <id>', 'Associated prompt ID')
        .action(async (options) => {
            const capture = new ResponseCapture();
            await capture.initialize();
            
            const responseId = capture.startResponse({
                turn: options.turn,
                promptId: options.prompt
            });
            
            console.log(`Started capturing response: ${responseId}`);
            
            // In real use, content would be streamed in
            // For testing, read from stdin
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', (chunk) => {
                capture.appendContent(chunk);
            });
            
            process.stdin.on('end', async () => {
                await capture.endResponse();
                await capture.saveResponseHistory();
                console.log('Response captured successfully');
            });
        });
    
    program
        .command('search <query>')
        .description('Search through captured responses')
        .action(async (query) => {
            const capture = new ResponseCapture();
            await capture.initialize();
            
            const results = await capture.searchResponses(query);
            console.log(`Found ${results.length} matching responses:`);
            
            results.forEach(result => {
                console.log(`\n[${result.timestamp}] Turn ${result.turn}`);
                console.log(result.excerpt + '...');
            });
        });
    
    program
        .command('export <output>')
        .description('Export all responses')
        .action(async (output) => {
            const capture = new ResponseCapture();
            await capture.initialize();
            
            await capture.exportResponses(output);
        });
    
    program.parse(process.argv);
}