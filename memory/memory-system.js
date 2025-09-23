/**
 * AI-Native Memory System
 * Provides persistent memory and context across sessions using vector databases
 * Supports semantic search, context compression, and intelligent retrieval
 */

const { Logger } = require('../utils/logger');
const { PineconeVectorStore } = require('./vector-db/pinecone-store');
const { LocalVectorStore } = require('./vector-db/local-store');
const { ContextCompressor } = require('./context/context-compressor');
const { EmbeddingGenerator } = require('./embeddings/embedding-generator');

class MemorySystem {
    constructor(config = {}) {
        this.config = {
            provider: config.provider || 'local', // 'pinecone', 'milvus', 'local'
            dimensions: config.dimensions || 1536,
            maxContextSize: config.maxContextSize || 10000,
            compressionRatio: config.compressionRatio || 0.7,
            indexName: config.indexName || 'nexus-memory',
            apiKey: config.apiKey,
            environment: config.environment,
            ...config
        };
        
        this.logger = new Logger('MemorySystem');
        this.vectorStore = null;
        this.compressor = new ContextCompressor();
        this.embeddings = new EmbeddingGenerator();
        
        // Memory components
        this.currentSession = null;
        this.conversationHistory = [];
        this.projectContext = null;
        this.knowledgeBase = new Map();
        
        // Performance tracking
        this.stats = {
            totalMemories: 0,
            totalRetrieval: 0,
            averageRetrievalTime: 0,
            compressionSavings: 0,
            sessionCount: 0
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info('🧠 Initializing AI-Native Memory System...');
        
        try {
            // Initialize vector store based on provider
            await this.initializeVectorStore();
            
            // Initialize embedding generator
            await this.embeddings.initialize();
            
            // Initialize context compressor
            await this.compressor.initialize();
            
            // Load existing session if available
            await this.loadCurrentSession();
            
            this.isInitialized = true;
            this.logger.info('✅ Memory System initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Memory System:', error);
            throw error;
        }
    }

    async initializeVectorStore() {
        switch (this.config.provider) {
            case 'pinecone':
                this.vectorStore = new PineconeVectorStore({
                    apiKey: this.config.apiKey,
                    environment: this.config.environment,
                    indexName: this.config.indexName,
                    dimensions: this.config.dimensions
                });
                break;
                
            case 'local':
            default:
                this.vectorStore = new LocalVectorStore({
                    indexName: this.config.indexName,
                    dimensions: this.config.dimensions,
                    storagePath: '.nexus/memory'
                });
                break;
        }
        
        await this.vectorStore.initialize();
        this.logger.info(`Vector store initialized: ${this.config.provider}`);
    }

    /**
     * Store a memory with semantic embedding
     */
    async storeMemory(content, metadata = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Generate embedding for content
            const embedding = await this.embeddings.generate(content);
            
            // Compress content if too large
            const compressedContent = await this.compressor.compress(content);
            
            // Create memory record
            const memory = {
                id: this.generateMemoryId(),
                content: compressedContent.compressed,
                originalContent: content,
                embedding,
                metadata: {
                    timestamp: new Date().toISOString(),
                    sessionId: this.getCurrentSessionId(),
                    type: metadata.type || 'conversation',
                    importance: metadata.importance || 'medium',
                    compressionRatio: compressedContent.ratio,
                    ...metadata
                },
                vector: embedding
            };
            
            // Store in vector database
            await this.vectorStore.upsert([memory]);
            
            // Update statistics
            this.stats.totalMemories++;
            this.stats.compressionSavings += compressedContent.savings;
            
            this.logger.debug(`Memory stored: ${memory.id}`);
            return memory.id;
            
        } catch (error) {
            this.logger.error('Failed to store memory:', error);
            throw error;
        }
    }

    /**
     * Retrieve memories using semantic search
     */
    async retrieveMemories(query, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        this.stats.totalRetrieval++;

        try {
            const {
                limit = 5,
                threshold = 0.7,
                includeMetadata = true,
                sessionId,
                type,
                timeRange
            } = options;

            // Generate query embedding
            const queryEmbedding = await this.embeddings.generate(query);
            
            // Build filter conditions
            const filter = this.buildFilter({ sessionId, type, timeRange });
            
            // Search vector database
            const searchResults = await this.vectorStore.query({
                vector: queryEmbedding,
                topK: limit,
                filter,
                includeMetadata
            });
            
            // Process and rank results
            const memories = searchResults.matches
                .filter(match => match.score >= threshold)
                .map(match => ({
                    id: match.id,
                    content: match.metadata?.content || '',
                    score: match.score,
                    metadata: match.metadata,
                    relevance: this.calculateRelevance(match, query)
                }))
                .sort((a, b) => b.relevance - a.relevance);

            // Update performance stats
            const retrievalTime = Date.now() - startTime;
            this.stats.averageRetrievalTime = (
                (this.stats.averageRetrievalTime * (this.stats.totalRetrieval - 1) + retrievalTime) / 
                this.stats.totalRetrieval
            );

            this.logger.debug(`Retrieved ${memories.length} memories in ${retrievalTime}ms`);
            return memories;
            
        } catch (error) {
            this.logger.error('Failed to retrieve memories:', error);
            throw error;
        }
    }

    /**
     * Store conversation interaction
     */
    async storeInteraction(interaction) {
        const { request, response, context } = interaction;
        
        // Store request
        await this.storeMemory(
            JSON.stringify(request),
            {
                type: 'request',
                importance: 'high',
                context: context?.projectName || 'general'
            }
        );
        
        // Store response
        await this.storeMemory(
            JSON.stringify(response),
            {
                type: 'response',
                importance: 'high',
                provider: response.provider,
                model: response.model,
                context: context?.projectName || 'general'
            }
        );
        
        // Add to conversation history
        this.conversationHistory.push({
            timestamp: new Date().toISOString(),
            request,
            response
        });
        
        // Maintain conversation history limit
        if (this.conversationHistory.length > 100) {
            this.conversationHistory = this.conversationHistory.slice(-50);
        }
    }

    /**
     * Get conversation history
     */
    getConversationHistory(limit = 10) {
        return this.conversationHistory.slice(-limit);
    }

    /**
     * Store project context
     */
    async storeProjectContext(context) {
        this.projectContext = {
            ...context,
            lastUpdated: new Date().toISOString()
        };
        
        // Store in vector database for semantic search
        await this.storeMemory(
            JSON.stringify(context),
            {
                type: 'project_context',
                importance: 'critical',
                projectName: context.projectName,
                phase: context.currentPhase
            }
        );
        
        // Save to file system for quick access
        await this.saveProjectContextToFile();
    }

    /**
     * Get current project context
     */
    getCurrentContext() {
        return this.projectContext;
    }

    /**
     * Save current state to persistent storage
     */
    async saveState() {
        try {
            const state = {
                sessionId: this.getCurrentSessionId(),
                timestamp: new Date().toISOString(),
                conversationHistory: this.conversationHistory,
                projectContext: this.projectContext,
                stats: this.stats
            };
            
            // Store state as memory
            await this.storeMemory(
                JSON.stringify(state),
                {
                    type: 'system_state',
                    importance: 'critical'
                }
            );
            
            // Save to file
            const fs = require('fs-extra');
            await fs.ensureDir('.nexus/memory');
            await fs.writeJson('.nexus/memory/current-state.json', state, { spaces: 2 });
            
            this.logger.debug('Memory state saved successfully');
            
        } catch (error) {
            this.logger.error('Failed to save memory state:', error);
            throw error;
        }
    }

    /**
     * Load current session from storage
     */
    async loadCurrentSession() {
        try {
            const fs = require('fs-extra');
            const statePath = '.nexus/memory/current-state.json';
            
            if (await fs.pathExists(statePath)) {
                const state = await fs.readJson(statePath);
                
                this.conversationHistory = state.conversationHistory || [];
                this.projectContext = state.projectContext;
                this.stats = { ...this.stats, ...state.stats };
                
                this.logger.info('Previous session state loaded');
            }
            
        } catch (error) {
            this.logger.warn('Failed to load previous session:', error.message);
        }
    }

    /**
     * Create memory checkpoint
     */
    async saveCheckpoint(name, description = '') {
        const checkpoint = {
            name,
            description,
            timestamp: new Date().toISOString(),
            sessionId: this.getCurrentSessionId(),
            conversationHistory: [...this.conversationHistory],
            projectContext: { ...this.projectContext },
            stats: { ...this.stats }
        };
        
        // Store checkpoint as memory
        const checkpointId = await this.storeMemory(
            JSON.stringify(checkpoint),
            {
                type: 'checkpoint',
                importance: 'critical',
                checkpointName: name
            }
        );
        
        // Save to file system
        const fs = require('fs-extra');
        await fs.ensureDir('.nexus/memory/checkpoints');
        await fs.writeJson(
            `.nexus/memory/checkpoints/${name}.json`,
            checkpoint,
            { spaces: 2 }
        );
        
        this.logger.info(`Checkpoint created: ${name}`);
        return checkpointId;
    }

    /**
     * Restore from checkpoint
     */
    async restoreCheckpoint(name) {
        try {
            const fs = require('fs-extra');
            const checkpointPath = `.nexus/memory/checkpoints/${name}.json`;
            
            if (await fs.pathExists(checkpointPath)) {
                const checkpoint = await fs.readJson(checkpointPath);
                
                this.conversationHistory = checkpoint.conversationHistory;
                this.projectContext = checkpoint.projectContext;
                this.stats = checkpoint.stats;
                
                this.logger.info(`Restored from checkpoint: ${name}`);
                return true;
            } else {
                throw new Error(`Checkpoint not found: ${name}`);
            }
            
        } catch (error) {
            this.logger.error('Failed to restore checkpoint:', error);
            throw error;
        }
    }

    /**
     * Search memories by content
     */
    async searchMemories(query, options = {}) {
        return await this.retrieveMemories(query, {
            ...options,
            threshold: options.threshold || 0.6
        });
    }

    /**
     * Get memory statistics
     */
    getStats() {
        return {
            ...this.stats,
            conversationHistorySize: this.conversationHistory.length,
            hasProjectContext: !!this.projectContext,
            currentSessionId: this.getCurrentSessionId(),
            memoryProvider: this.config.provider
        };
    }

    /**
     * Get system status
     */
    async getStatus() {
        const vectorStats = await this.vectorStore.getStats();
        
        return {
            initialized: this.isInitialized,
            provider: this.config.provider,
            totalMemories: this.stats.totalMemories,
            conversationHistory: this.conversationHistory.length,
            hasProjectContext: !!this.projectContext,
            vectorDatabase: vectorStats,
            compressionSavings: this.stats.compressionSavings
        };
    }

    /**
     * Helper methods
     */
    generateMemoryId() {
        return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getCurrentSessionId() {
        if (!this.currentSession) {
            this.currentSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.stats.sessionCount++;
        }
        return this.currentSession;
    }

    buildFilter(options) {
        const filter = {};
        
        if (options.sessionId) {
            filter.sessionId = options.sessionId;
        }
        
        if (options.type) {
            filter.type = options.type;
        }
        
        if (options.timeRange) {
            filter.timestamp = {
                $gte: options.timeRange.start,
                $lte: options.timeRange.end
            };
        }
        
        return filter;
    }

    calculateRelevance(match, query) {
        let relevance = match.score;
        
        // Boost recent memories
        const age = Date.now() - new Date(match.metadata?.timestamp || 0).getTime();
        const ageFactor = Math.exp(-age / (1000 * 60 * 60 * 24 * 7)); // Week decay
        relevance *= (1 + ageFactor * 0.2);
        
        // Boost important memories
        if (match.metadata?.importance === 'critical') {
            relevance *= 1.3;
        } else if (match.metadata?.importance === 'high') {
            relevance *= 1.1;
        }
        
        return relevance;
    }

    async saveProjectContextToFile() {
        if (!this.projectContext) return;
        
        try {
            const fs = require('fs-extra');
            await fs.ensureDir('.nexus/memory');
            await fs.writeJson(
                '.nexus/memory/project-context.json',
                this.projectContext,
                { spaces: 2 }
            );
        } catch (error) {
            this.logger.warn('Failed to save project context to file:', error.message);
        }
    }

    /**
     * Cleanup and optimization
     */
    async cleanup() {
        this.logger.info('Cleaning up Memory System...');
        
        // Save current state
        await this.saveState();
        
        // Cleanup vector store
        if (this.vectorStore) {
            await this.vectorStore.cleanup();
        }
        
        this.logger.info('Memory System cleanup completed');
    }

    /**
     * Optimize memory storage
     */
    async optimizeMemory() {
        this.logger.info('Optimizing memory storage...');
        
        // Remove old, low-importance memories
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
        
        const oldMemories = await this.retrieveMemories('', {
            timeRange: { start: new Date(0), end: cutoffDate },
            limit: 1000
        });
        
        const toDelete = oldMemories
            .filter(memory => memory.metadata?.importance === 'low')
            .map(memory => memory.id);
        
        if (toDelete.length > 0) {
            await this.vectorStore.delete(toDelete);
            this.logger.info(`Deleted ${toDelete.length} old memories`);
        }
        
        // Compress conversation history
        if (this.conversationHistory.length > 50) {
            const compressed = await this.compressor.compressConversation(this.conversationHistory);
            this.conversationHistory = compressed;
        }
        
        this.logger.info('Memory optimization completed');
    }
}

module.exports = { MemorySystem };