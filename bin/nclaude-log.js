#!/usr/bin/env node
/**
 * Manual Conversation Logger
 * Allows manual logging of prompts and responses when hooks don't capture them
 */

const path = require('path');
const fs = require('fs-extra');
const chalk = require('../utils/colors');
const { default: ora } = require('ora');
const ConversationTracker = require('../tracking/conversation-tracker');
const ResponseCapture = require('../tracking/response-capture');
const EditTracker = require('../tracking/edit-tracker');

const NEXUS_PATH = path.join(process.cwd(), '.nexus');
const CONVERSATION_PATH = path.join(NEXUS_PATH, 'conversations');
const RESPONSE_PATH = path.join(NEXUS_PATH, 'responses');
const EDIT_PATH = path.join(NEXUS_PATH, 'edits');

class ManualLogger {
    constructor() {
        this.conversationTracker = new ConversationTracker({ storagePath: CONVERSATION_PATH });
        this.responseCapture = new ResponseCapture({ storagePath: RESPONSE_PATH });
        this.editTracker = new EditTracker({ storagePath: EDIT_PATH });
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        await this.conversationTracker.initialize();
        await this.responseCapture.initialize();
        await this.editTracker.initialize();
        
        this.initialized = true;
    }
    
    /**
     * Log a user prompt
     */
    async logPrompt(content, metadata = {}) {
        const spinner = ora('Logging prompt...').start();
        
        try {
            await this.initialize();
            
            // Track in conversation
            await this.conversationTracker.trackPrompt(content);
            
            // Create prompt file
            const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const promptData = {
                id: promptId,
                timestamp: new Date().toISOString(),
                content: content,
                metadata: metadata,
                conversationTurn: this.conversationTracker.conversation?.currentTurn || 0
            };
            
            const promptFile = path.join(CONVERSATION_PATH, 'prompts', `${promptId}.json`);
            await fs.ensureDir(path.dirname(promptFile));
            await fs.writeJson(promptFile, promptData, { spaces: 2 });
            
            // Save conversation state
            await this.conversationTracker.saveConversation();
            
            spinner.succeed(chalk.green(`Logged prompt (Turn ${promptData.conversationTurn})`));
            
            return promptId;
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to log prompt'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Log an AI response
     */
    async logResponse(content, metadata = {}) {
        const spinner = ora('Logging response...').start();
        
        try {
            await this.initialize();
            
            // Start response capture
            const responseId = this.responseCapture.startResponse({
                turn: this.conversationTracker.conversation?.currentTurn || 0,
                ...metadata
            });
            
            // Add content
            this.responseCapture.appendContent(content);
            
            // Add thinking if provided
            if (metadata.thinking) {
                this.responseCapture.addThinking(metadata.thinking);
            }
            
            // End response capture
            await this.responseCapture.endResponse();
            await this.responseCapture.saveResponseHistory();
            
            // Track in conversation
            await this.conversationTracker.trackResponseEnd(content);
            await this.conversationTracker.saveConversation();
            
            spinner.succeed(chalk.green(`Logged response (${responseId})`));
            
            return responseId;
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to log response'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Log a tool use
     */
    async logTool(toolName, params, result = null) {
        const spinner = ora(`Logging tool use: ${toolName}...`).start();
        
        try {
            await this.initialize();
            
            // Track tool invocation
            await this.conversationTracker.trackToolInvocation(toolName, params);
            
            // Add to current response if active
            if (this.responseCapture.currentResponse) {
                this.responseCapture.addToolCall(toolName, params, result);
            }
            
            // Save tool data
            const toolId = `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const toolData = {
                id: toolId,
                timestamp: new Date().toISOString(),
                tool: toolName,
                params: params,
                result: result,
                conversationTurn: this.conversationTracker.conversation?.currentTurn || 0
            };
            
            const toolFile = path.join(CONVERSATION_PATH, 'tools', `${toolId}.json`);
            await fs.writeJson(toolFile, toolData, { spaces: 2 });
            
            spinner.succeed(chalk.green(`Logged tool: ${toolName}`));
            
            return toolId;
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to log tool'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Log an edit operation
     */
    async logEdit(filePath, oldContent, newContent, operation = 'edit') {
        const spinner = ora(`Logging edit: ${path.basename(filePath)}...`).start();
        
        try {
            await this.initialize();
            
            // Start edit session if not active
            if (!this.editTracker.currentEditSession) {
                this.editTracker.startEditSession({
                    turn: this.conversationTracker.conversation?.currentTurn || 0
                });
            }
            
            // Track edit
            const editId = await this.editTracker.trackEdit(
                filePath,
                oldContent,
                newContent,
                operation
            );
            
            await this.editTracker.saveEditHistory();
            
            spinner.succeed(chalk.green(`Logged edit: ${editId}`));
            
            return editId;
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to log edit'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Log thinking/reasoning
     */
    async logThinking(content) {
        const spinner = ora('Logging thinking process...').start();
        
        try {
            await this.initialize();
            
            // Add to current response if active
            if (this.responseCapture.currentResponse) {
                this.responseCapture.addThinking(content);
            }
            
            // Save thinking separately
            const thinkingId = `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const thinkingData = {
                id: thinkingId,
                timestamp: new Date().toISOString(),
                content: content,
                conversationTurn: this.conversationTracker.conversation?.currentTurn || 0
            };
            
            const thinkingFile = path.join(RESPONSE_PATH, 'thinking', `${thinkingId}.json`);
            await fs.ensureDir(path.dirname(thinkingFile));
            await fs.writeJson(thinkingFile, thinkingData, { spaces: 2 });
            
            spinner.succeed(chalk.green('Logged thinking process'));
            
            return thinkingId;
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to log thinking'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Increment conversation turn
     */
    async incrementTurn() {
        await this.initialize();
        this.conversationTracker.incrementTurn();
        await this.conversationTracker.saveConversation();
        
        console.log(chalk.green(`📝 Advanced to turn ${this.conversationTracker.conversation.currentTurn}`));
    }
    
    /**
     * Create checkpoint
     */
    async createCheckpoint(name) {
        const spinner = ora('Creating checkpoint...').start();
        
        try {
            await this.initialize();
            
            const checkpointId = await this.conversationTracker.createCheckpoint(name);
            
            spinner.succeed(chalk.green(`Created checkpoint: ${checkpointId}`));
            
            return checkpointId;
            
        } catch (error) {
            spinner.fail(chalk.red('Failed to create checkpoint'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Show current status
     */
    async showStatus() {
        await this.initialize();
        
        const conversation = this.conversationTracker.conversation;
        const responseHistory = this.responseCapture.responseHistory;
        const editHistory = this.editTracker.editHistory;
        
        console.log(chalk.cyan('\n═══ Manual Logger Status ═══\n'));
        
        console.log('Conversation:');
        console.log(`  ID: ${conversation?.id || 'N/A'}`);
        console.log(`  Current turn: ${conversation?.currentTurn || 0}`);
        console.log(`  Total turns: ${conversation?.turns?.length || 0}`);
        
        console.log('\nResponses:');
        console.log(`  Total captured: ${responseHistory.length}`);
        console.log(`  With thinking: ${responseHistory.filter(r => r.hasThinking).length}`);
        
        console.log('\nEdits:');
        console.log(`  Total tracked: ${editHistory.length}`);
        console.log(`  Files changed: ${this.editTracker.fileEditMap.size}`);
        
        console.log('\nLast activity:');
        if (conversation?.turns?.length > 0) {
            const lastTurn = conversation.turns[conversation.turns.length - 1];
            console.log(`  ${lastTurn.type}: ${new Date(lastTurn.timestamp).toLocaleString()}`);
        }
    }
}

// CLI Interface
const program = require('commander');

program
    .version('1.0.0')
    .description('Manual conversation logger for capturing AI interactions');

program
    .command('prompt <content>')
    .description('Log a user prompt')
    .option('-m, --metadata <json>', 'Additional metadata as JSON')
    .action(async (content, options) => {
        const logger = new ManualLogger();
        const metadata = options.metadata ? JSON.parse(options.metadata) : {};
        await logger.logPrompt(content, metadata);
    });

program
    .command('response <content>')
    .description('Log an AI response')
    .option('-t, --thinking <text>', 'Include thinking/reasoning')
    .option('-m, --metadata <json>', 'Additional metadata as JSON')
    .action(async (content, options) => {
        const logger = new ManualLogger();
        const metadata = options.metadata ? JSON.parse(options.metadata) : {};
        if (options.thinking) {
            metadata.thinking = options.thinking;
        }
        await logger.logResponse(content, metadata);
    });

program
    .command('tool <name> [params]')
    .description('Log a tool use')
    .option('-r, --result <json>', 'Tool result as JSON')
    .action(async (name, params, options) => {
        const logger = new ManualLogger();
        const parsedParams = params ? JSON.parse(params) : {};
        const result = options.result ? JSON.parse(options.result) : null;
        await logger.logTool(name, parsedParams, result);
    });

program
    .command('edit <file>')
    .description('Log an edit operation')
    .option('-o, --old <content>', 'Old content or file path')
    .option('-n, --new <content>', 'New content or file path')
    .option('-t, --type <type>', 'Operation type (create/edit/delete)', 'edit')
    .action(async (file, options) => {
        const logger = new ManualLogger();
        
        // Read content from files if paths provided
        let oldContent = options.old || '';
        let newContent = options.new || '';
        
        if (options.old && await fs.pathExists(options.old)) {
            oldContent = await fs.readFile(options.old, 'utf8');
        }
        
        if (options.new && await fs.pathExists(options.new)) {
            newContent = await fs.readFile(options.new, 'utf8');
        }
        
        await logger.logEdit(file, oldContent, newContent, options.type);
    });

program
    .command('thinking <content>')
    .description('Log thinking/reasoning process')
    .action(async (content) => {
        const logger = new ManualLogger();
        await logger.logThinking(content);
    });

program
    .command('turn')
    .description('Increment conversation turn')
    .action(async () => {
        const logger = new ManualLogger();
        await logger.incrementTurn();
    });

program
    .command('checkpoint <name>')
    .description('Create a checkpoint')
    .action(async (name) => {
        const logger = new ManualLogger();
        await logger.createCheckpoint(name);
    });

program
    .command('status')
    .description('Show current logging status')
    .action(async () => {
        const logger = new ManualLogger();
        await logger.showStatus();
    });

// Handle from stdin for piping
program
    .command('pipe <type>')
    .description('Log from stdin (prompt|response|thinking)')
    .action(async (type) => {
        const logger = new ManualLogger();
        
        let content = '';
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', (chunk) => {
            content += chunk;
        });
        
        process.stdin.on('end', async () => {
            switch(type) {
                case 'prompt':
                    await logger.logPrompt(content);
                    break;
                case 'response':
                    await logger.logResponse(content);
                    break;
                case 'thinking':
                    await logger.logThinking(content);
                    break;
                default:
                    console.error(chalk.red(`Unknown type: ${type}`));
            }
        });
    });

program.parse(process.argv);

// Export for use as module
module.exports = ManualLogger;