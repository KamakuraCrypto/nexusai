/**
 * AI Model Hooks System
 * Manages conversation continuity, context compaction, and memory persistence
 * This is the core system for preventing AI retraining and context loss
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class AIModelHooks {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('AIModelHooks');
        
        // Configuration for context management
        this.config = {
            maxContextTokens: 128000,  // Claude's context limit
            compactionThreshold: 100000,  // Trigger compaction at 100k tokens
            priorityFilePatterns: [
                'nexus.config.js',
                'package.json',
                'README.md',
                '.nexus/memory/session.json',
                '.nexus/memory/critical-context.json'
            ],
            memoryRetentionDays: 30,
            autoCompaction: true,
            smartSummarization: true
        };
        
        // Conversation state
        this.conversationState = {
            currentTokenCount: 0,
            messages: [],
            criticalContext: new Map(),
            fileReferences: new Set(),
            codePatterns: new Map(),
            sessionId: null,
            compactionCount: 0
        };
        
        // Memory persistence paths
        this.memoryPath = path.join(process.cwd(), '.nexus', 'memory');
        this.hooksPath = path.join(this.memoryPath, 'hooks');
        
        // Hook definitions for AI conversation lifecycle
        this.hooks = {
            beforeCompaction: [],
            duringCompaction: [],
            afterCompaction: [],
            onSessionStart: [],
            onSessionEnd: [],
            onContextReset: [],
            onFileAccess: [],
            onCodeGeneration: [],
            onErrorRecovery: []
        };
        
        // Initialize default hooks
        this.registerDefaultHooks();
    }
    
    /**
     * Initialize the AI Model Hooks system
     */
    async initialize() {
        this.logger.info('🧠 Initializing AI Model Hooks System...');
        
        try {
            // Ensure memory directories exist
            await fs.ensureDir(this.memoryPath);
            await fs.ensureDir(this.hooksPath);
            
            // Load previous session if exists
            await this.loadPreviousSession();
            
            // Start new session
            await this.startNewSession();
            
            this.logger.info('✅ AI Model Hooks initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize AI Model Hooks:', error);
            throw error;
        }
    }
    
    /**
     * Register default hooks for conversation management
     */
    registerDefaultHooks() {
        // Before compaction - summarize conversation
        this.registerHook('beforeCompaction', async (context) => {
            this.logger.info('📝 Summarizing conversation before compaction...');
            
            const summary = await this.summarizeConversation(context.messages);
            const criticalInfo = await this.extractCriticalInformation(context.messages);
            
            return {
                summary,
                criticalInfo,
                fileReferences: Array.from(context.fileReferences),
                codePatterns: Array.from(context.codePatterns.entries())
            };
        });
        
        // After compaction - restore critical context
        this.registerHook('afterCompaction', async (context) => {
            this.logger.info('🔄 Restoring critical context after compaction...');
            
            // Re-read priority files
            const priorityFiles = await this.readPriorityFiles();
            
            // Restore critical context
            const restoredContext = {
                summary: context.compactionSummary,
                criticalInfo: context.criticalInfo,
                priorityFiles,
                sessionContinuity: true
            };
            
            // Update conversation state
            this.conversationState.messages = [{
                role: 'system',
                content: this.formatRestoredContext(restoredContext)
            }];
            
            return restoredContext;
        });
        
        // On session start - load context
        this.registerHook('onSessionStart', async () => {
            this.logger.info('🚀 Starting new AI session with context restoration...');
            
            const previousContext = await this.loadPreviousContext();
            if (previousContext) {
                await this.restoreContext(previousContext);
            }
            
            // Read important project files
            await this.readProjectEssentials();
            
            return {
                sessionId: this.conversationState.sessionId,
                contextRestored: !!previousContext
            };
        });
        
        // On session end - save context
        this.registerHook('onSessionEnd', async () => {
            this.logger.info('💾 Saving session context for continuity...');
            
            await this.saveCurrentContext();
            await this.createMemoryCheckpoint();
            
            return {
                sessionId: this.conversationState.sessionId,
                messagesSaved: this.conversationState.messages.length,
                checkpointCreated: true
            };
        });
        
        // On context reset - emergency recovery
        this.registerHook('onContextReset', async () => {
            this.logger.warn('⚠️ Context reset detected! Initiating recovery...');
            
            // Load last checkpoint
            const checkpoint = await this.loadLastCheckpoint();
            
            // Restore critical information
            await this.emergencyRestore(checkpoint);
            
            return {
                recovered: true,
                checkpointUsed: checkpoint?.id
            };
        });
    }
    
    /**
     * Register a custom hook
     */
    registerHook(event, handler) {
        if (!this.hooks[event]) {
            throw new Error(`Unknown hook event: ${event}`);
        }
        
        this.hooks[event].push(handler);
        this.logger.debug(`Registered hook for ${event}`);
    }
    
    /**
     * Trigger hooks for an event
     */
    async triggerHooks(event, context = {}) {
        if (!this.hooks[event]) {
            throw new Error(`Unknown hook event: ${event}`);
        }
        
        const results = [];
        for (const handler of this.hooks[event]) {
            try {
                const result = await handler(context);
                results.push(result);
            } catch (error) {
                this.logger.error(`Hook error in ${event}:`, error);
            }
        }
        
        return results;
    }
    
    /**
     * Handle conversation compaction
     */
    async compactConversation() {
        this.logger.info('🗜️ Starting conversation compaction...');
        
        try {
            // Trigger before compaction hooks
            const beforeResults = await this.triggerHooks('beforeCompaction', {
                messages: this.conversationState.messages,
                fileReferences: this.conversationState.fileReferences,
                codePatterns: this.conversationState.codePatterns
            });
            
            // Perform compaction
            const compactionResult = await this.performCompaction(beforeResults[0]);
            
            // Trigger after compaction hooks
            const afterResults = await this.triggerHooks('afterCompaction', {
                compactionSummary: compactionResult.summary,
                criticalInfo: compactionResult.criticalInfo
            });
            
            // Update token count
            this.conversationState.currentTokenCount = await this.countTokens(
                this.conversationState.messages
            );
            
            this.conversationState.compactionCount++;
            
            this.logger.info('✅ Conversation compaction completed');
            
            return {
                success: true,
                newTokenCount: this.conversationState.currentTokenCount,
                compactionCount: this.conversationState.compactionCount
            };
            
        } catch (error) {
            this.logger.error('Compaction failed:', error);
            throw error;
        }
    }
    
    /**
     * Summarize conversation intelligently
     */
    async summarizeConversation(messages) {
        // Group messages by topic/file
        const topics = new Map();
        
        for (const msg of messages) {
            // Extract file references
            const fileRefs = this.extractFileReferences(msg.content);
            for (const file of fileRefs) {
                if (!topics.has(file)) {
                    topics.set(file, []);
                }
                topics.set(file, [...topics.get(file), msg]);
            }
        }
        
        // Create structured summary
        const summary = {
            overview: this.createOverviewSummary(messages),
            fileChanges: this.summarizeFileChanges(topics),
            decisions: this.extractDecisions(messages),
            codePatterns: this.extractCodePatterns(messages),
            todos: this.extractTodos(messages),
            timestamp: new Date().toISOString()
        };
        
        return summary;
    }
    
    /**
     * Extract critical information that must be preserved
     */
    async extractCriticalInformation(messages) {
        const critical = {
            projectStructure: new Map(),
            functionDefinitions: new Map(),
            apiEndpoints: [],
            configurations: {},
            dependencies: new Set(),
            errors: [],
            solutions: []
        };
        
        for (const msg of messages) {
            // Extract function definitions
            const functions = this.extractFunctionDefinitions(msg.content);
            functions.forEach(fn => critical.functionDefinitions.set(fn.name, fn));
            
            // Extract API endpoints
            const endpoints = this.extractAPIEndpoints(msg.content);
            critical.apiEndpoints.push(...endpoints);
            
            // Extract configurations
            const configs = this.extractConfigurations(msg.content);
            Object.assign(critical.configurations, configs);
            
            // Extract error-solution pairs
            if (msg.content.includes('error') || msg.content.includes('Error')) {
                critical.errors.push(this.extractErrorContext(msg.content));
            }
        }
        
        return critical;
    }
    
    /**
     * Read priority files that should always be in context
     */
    async readPriorityFiles() {
        const files = {};
        
        for (const pattern of this.config.priorityFilePatterns) {
            const filePath = path.join(process.cwd(), pattern);
            if (await fs.pathExists(filePath)) {
                try {
                    files[pattern] = await fs.readFile(filePath, 'utf-8');
                    this.logger.debug(`Read priority file: ${pattern}`);
                } catch (error) {
                    this.logger.warn(`Could not read priority file ${pattern}:`, error.message);
                }
            }
        }
        
        return files;
    }
    
    /**
     * Format restored context for AI
     */
    formatRestoredContext(context) {
        let formatted = '# Restored Session Context\n\n';
        
        if (context.summary) {
            formatted += '## Previous Conversation Summary\n';
            formatted += `${context.summary.overview}\n\n`;
            
            if (context.summary.fileChanges) {
                formatted += '### Files Modified\n';
                for (const [file, changes] of Object.entries(context.summary.fileChanges)) {
                    formatted += `- ${file}: ${changes}\n`;
                }
                formatted += '\n';
            }
            
            if (context.summary.todos?.length > 0) {
                formatted += '### Outstanding TODOs\n';
                context.summary.todos.forEach(todo => {
                    formatted += `- [ ] ${todo}\n`;
                });
                formatted += '\n';
            }
        }
        
        if (context.criticalInfo) {
            formatted += '## Critical Information\n';
            
            if (context.criticalInfo.functionDefinitions?.size > 0) {
                formatted += '### Key Functions\n';
                for (const [name, def] of context.criticalInfo.functionDefinitions) {
                    formatted += `- ${name}: ${def.description || 'Defined'}\n`;
                }
                formatted += '\n';
            }
            
            if (context.criticalInfo.configurations) {
                formatted += '### Configurations\n';
                formatted += '```json\n';
                formatted += JSON.stringify(context.criticalInfo.configurations, null, 2);
                formatted += '\n```\n\n';
            }
        }
        
        if (context.priorityFiles) {
            formatted += '## Priority Files Content\n';
            for (const [file, content] of Object.entries(context.priorityFiles)) {
                formatted += `### ${file}\n`;
                formatted += '```\n';
                formatted += content.substring(0, 500); // First 500 chars
                formatted += '\n```\n\n';
            }
        }
        
        formatted += '## Session Continuity\n';
        formatted += 'This is a continued session. All previous work has been preserved.\n';
        formatted += 'You can reference any previous decisions, code, or discussions.\n';
        
        return formatted;
    }
    
    /**
     * Save current context to disk
     */
    async saveCurrentContext() {
        const contextFile = path.join(this.memoryPath, 'current-context.json');
        
        const context = {
            sessionId: this.conversationState.sessionId,
            timestamp: new Date().toISOString(),
            tokenCount: this.conversationState.currentTokenCount,
            compactionCount: this.conversationState.compactionCount,
            messages: this.conversationState.messages.slice(-50), // Last 50 messages
            criticalContext: Array.from(this.conversationState.criticalContext.entries()),
            fileReferences: Array.from(this.conversationState.fileReferences),
            codePatterns: Array.from(this.conversationState.codePatterns.entries())
        };
        
        await fs.writeJson(contextFile, context, { spaces: 2 });
        this.logger.info('💾 Context saved successfully');
    }
    
    /**
     * Load previous context from disk
     */
    async loadPreviousContext() {
        const contextFile = path.join(this.memoryPath, 'current-context.json');
        
        if (!await fs.pathExists(contextFile)) {
            return null;
        }
        
        try {
            const context = await fs.readJson(contextFile);
            this.logger.info('📂 Previous context loaded');
            return context;
        } catch (error) {
            this.logger.error('Failed to load previous context:', error);
            return null;
        }
    }
    
    /**
     * Create memory checkpoint
     */
    async createMemoryCheckpoint() {
        const checkpointId = crypto.randomBytes(8).toString('hex');
        const checkpointPath = path.join(this.memoryPath, 'checkpoints', `checkpoint-${checkpointId}.json`);
        
        await fs.ensureDir(path.dirname(checkpointPath));
        
        const checkpoint = {
            id: checkpointId,
            timestamp: new Date().toISOString(),
            sessionId: this.conversationState.sessionId,
            state: {
                messages: this.conversationState.messages,
                criticalContext: Array.from(this.conversationState.criticalContext.entries()),
                fileReferences: Array.from(this.conversationState.fileReferences),
                codePatterns: Array.from(this.conversationState.codePatterns.entries()),
                compactionCount: this.conversationState.compactionCount
            }
        };
        
        await fs.writeJson(checkpointPath, checkpoint, { spaces: 2 });
        this.logger.info(`✅ Checkpoint created: ${checkpointId}`);
        
        return checkpointId;
    }
    
    /**
     * Track file access for re-reading on context reset
     */
    trackFileAccess(filePath) {
        this.conversationState.fileReferences.add(filePath);
        
        // Trigger file access hook
        this.triggerHooks('onFileAccess', { filePath });
    }
    
    /**
     * Track code generation for pattern learning
     */
    trackCodeGeneration(code, language, purpose) {
        const pattern = {
            code,
            language,
            purpose,
            timestamp: new Date().toISOString()
        };
        
        this.conversationState.codePatterns.set(
            `${language}-${purpose}`,
            pattern
        );
        
        // Trigger code generation hook
        this.triggerHooks('onCodeGeneration', pattern);
    }
    
    /**
     * Monitor token usage and trigger compaction if needed
     */
    async monitorTokenUsage(newMessage) {
        const messageTokens = await this.countTokens([newMessage]);
        this.conversationState.currentTokenCount += messageTokens;
        
        this.conversationState.messages.push(newMessage);
        
        // Check if compaction is needed
        if (this.config.autoCompaction && 
            this.conversationState.currentTokenCount > this.config.compactionThreshold) {
            this.logger.warn('⚠️ Token threshold reached, initiating compaction...');
            await this.compactConversation();
        }
    }
    
    /**
     * Helper: Extract file references from content
     */
    extractFileReferences(content) {
        const filePattern = /(?:file:?\s*)?([./][\w\-./]+\.\w+)/gi;
        const matches = content.matchAll(filePattern);
        return Array.from(matches, m => m[1]);
    }
    
    /**
     * Helper: Extract function definitions
     */
    extractFunctionDefinitions(content) {
        const functions = [];
        const patterns = [
            /function\s+(\w+)\s*\([^)]*\)/g,
            /const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
            /(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/g
        ];
        
        for (const pattern of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                functions.push({
                    name: match[1],
                    fullMatch: match[0]
                });
            }
        }
        
        return functions;
    }
    
    /**
     * Helper: Extract API endpoints
     */
    extractAPIEndpoints(content) {
        const endpoints = [];
        const patterns = [
            /app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/gi,
            /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/gi,
            /@(Get|Post|Put|Delete|Patch)\(['"]([^'"]+)['"]/gi
        ];
        
        for (const pattern of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                endpoints.push({
                    method: match[1].toUpperCase(),
                    path: match[2]
                });
            }
        }
        
        return endpoints;
    }
    
    /**
     * Helper: Count tokens (simplified - real implementation would use tiktoken)
     */
    async countTokens(messages) {
        // Simplified token counting (roughly 4 chars = 1 token)
        const text = messages.map(m => 
            typeof m === 'string' ? m : m.content
        ).join(' ');
        
        return Math.ceil(text.length / 4);
    }
    
    /**
     * Start a new session
     */
    async startNewSession() {
        this.conversationState.sessionId = crypto.randomBytes(16).toString('hex');
        await this.triggerHooks('onSessionStart');
    }
    
    /**
     * End current session
     */
    async endSession() {
        await this.triggerHooks('onSessionEnd');
    }
    
    /**
     * Emergency restore from checkpoint
     */
    async emergencyRestore(checkpoint) {
        if (!checkpoint) {
            this.logger.error('No checkpoint available for emergency restore');
            return false;
        }
        
        this.conversationState = {
            ...this.conversationState,
            ...checkpoint.state,
            criticalContext: new Map(checkpoint.state.criticalContext),
            fileReferences: new Set(checkpoint.state.fileReferences),
            codePatterns: new Map(checkpoint.state.codePatterns)
        };
        
        this.logger.info('🚨 Emergency restore completed from checkpoint');
        return true;
    }
    
    // Additional helper methods would go here...
}

module.exports = { AIModelHooks };