/**
 * Nexus AI Core
 * Central orchestrator for the Universal AI Development Platform
 * Manages multi-model routing, memory persistence, and project creation
 */

const { Logger } = require('../utils/logger');
const { MultiModelRouter } = require('../ai-interface/routers/multi-model-router');
const { ClaudeProvider } = require('../ai-interface/providers/claude-provider');
const { GPTProvider } = require('../ai-interface/providers/gpt-provider');

class NexusAI {
    constructor(options = {}) {
        this.config = options.config;
        this.memory = options.memory;
        this.knowledgeBase = options.knowledgeBase;
        this.git = options.git;
        
        this.logger = new Logger('NexusAI');
        this.router = new MultiModelRouter();
        this.providers = new Map();
        this.isInitialized = false;
        
        // Performance and usage tracking
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            averageLatency: 0,
            providerUsage: new Map(),
            sessionStart: Date.now()
        };
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info('🚀 Initializing Nexus AI Core...');
        
        try {
            // Initialize AI providers
            await this.initializeProviders();
            
            // Load existing memory and context
            await this.loadContext();
            
            // Initialize knowledge bases
            await this.initializeKnowledgeBases();
            
            this.isInitialized = true;
            this.logger.info('✅ Nexus AI Core initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Nexus AI Core:', error);
            throw error;
        }
    }

    async initializeProviders() {
        this.logger.info('Initializing AI providers...');
        
        // Initialize Claude provider
        if (this.config.get('providers.claude.enabled')) {
            const claudeConfig = this.config.get('providers.claude');
            const claude = new ClaudeProvider(claudeConfig);
            await claude.initialize();
            this.router.registerProvider(claude);
            this.providers.set('claude', claude);
            this.logger.info('✅ Claude provider initialized');
        }
        
        // Initialize GPT provider
        if (this.config.get('providers.gpt.enabled')) {
            const gptConfig = this.config.get('providers.gpt');
            const gpt = new GPTProvider(gptConfig);
            await gpt.initialize();
            this.router.registerProvider(gpt);
            this.providers.set('gpt', gpt);
            this.logger.info('✅ GPT provider initialized');
        }
        
        // TODO: Initialize other providers (Gemini, Grok, etc.)
        
        this.logger.info(`Initialized ${this.providers.size} AI providers`);
    }

    async loadContext() {
        if (!this.memory) return;
        
        this.logger.info('Loading persistent context...');
        
        try {
            // Load session context
            const context = await this.memory.getCurrentContext();
            if (context) {
                this.currentContext = context;
                this.logger.info(`Loaded context: ${context.projectName || 'Unknown project'}`);
            }
            
            // Load conversation history
            const history = await this.memory.getConversationHistory();
            this.conversationHistory = history || [];
            
        } catch (error) {
            this.logger.warn('Failed to load context:', error.message);
        }
    }

    async initializeKnowledgeBases() {
        if (!this.knowledgeBase) return;
        
        this.logger.info('Initializing knowledge bases...');
        
        try {
            const ecosystems = this.config.get('knowledgeBase.ecosystems') || [];
            for (const ecosystem of ecosystems) {
                await this.knowledgeBase.loadEcosystem(ecosystem);
            }
            
            this.logger.info(`Initialized ${ecosystems.length} knowledge base ecosystems`);
            
        } catch (error) {
            this.logger.warn('Failed to initialize knowledge bases:', error.message);
        }
    }

    /**
     * Main interface for AI requests with intelligent routing
     */
    async ask(request) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        this.stats.totalRequests++;

        try {
            // Prepare enhanced request with context
            const enhancedRequest = await this.enhanceRequest(request);
            
            // Route to optimal AI provider
            const response = await this.router.route(enhancedRequest);
            
            // Process and enhance response
            const processedResponse = await this.processResponse(response, request);
            
            // Update memory with interaction
            await this.updateMemory(request, processedResponse);
            
            // Update statistics
            this.updateStats(response, Date.now() - startTime);
            
            return processedResponse;
            
        } catch (error) {
            this.logger.error('Request failed:', error);
            throw error;
        }
    }

    /**
     * Enhanced project creation with autonomous research
     */
    async createProject(options) {
        this.logger.info(`Creating new project: ${options.name}`);
        
        try {
            const project = new ProjectCreator(this, options);
            return await project.create();
            
        } catch (error) {
            this.logger.error('Project creation failed:', error);
            throw error;
        }
    }

    /**
     * Continue existing project with full context restoration
     */
    async continueProject(options = {}) {
        this.logger.info('Continuing existing project...');
        
        try {
            // Restore project context
            const context = await this.memory.getCurrentContext();
            if (!context) {
                throw new Error('No existing project context found');
            }
            
            // Load git state
            const gitState = await this.git.getCurrentState();
            
            // Generate suggestions based on current state
            const suggestions = await this.generateContinuationSuggestions(context, gitState);
            
            return {
                projectName: context.projectName,
                lastSession: context.lastSession,
                currentPhase: context.currentPhase,
                suggestions,
                context
            };
            
        } catch (error) {
            this.logger.error('Failed to continue project:', error);
            throw error;
        }
    }

    /**
     * Build project with AI assistance and quality gates
     */
    async buildProject(options) {
        this.logger.info('Building project with AI assistance...');
        
        try {
            const builder = new ProjectBuilder(this, options);
            return await builder.build();
            
        } catch (error) {
            this.logger.error('Build failed:', error);
            throw error;
        }
    }

    /**
     * Enhance request with context and knowledge base information
     * @private
     */
    async enhanceRequest(request) {
        const enhanced = { ...request };
        
        // Add project context if available
        if (this.currentContext && request.includeContext !== false) {
            enhanced.context = {
                projectName: this.currentContext.projectName,
                currentPhase: this.currentContext.currentPhase,
                technologies: this.currentContext.technologies,
                architecture: this.currentContext.architecture
            };
        }
        
        // Add relevant knowledge base information
        if (this.knowledgeBase && request.knowledgeBase) {
            const kbInfo = await this.knowledgeBase.query({
                question: request.question || request.prompt,
                ecosystem: request.knowledgeBase,
                limit: 3
            });
            
            if (kbInfo.length > 0) {
                enhanced.knowledgeBaseContext = kbInfo;
            }
        }
        
        // Add conversation history for continuity
        if (this.conversationHistory.length > 0 && request.includeHistory !== false) {
            enhanced.conversationHistory = this.conversationHistory.slice(-5); // Last 5 interactions
        }
        
        // Optimize for specific task types
        if (request.taskType) {
            enhanced.optimizedFor = request.taskType;
        }
        
        return enhanced;
    }

    /**
     * Process and enhance AI response
     * @private
     */
    async processResponse(response, originalRequest) {
        const processed = { ...response };
        
        // Add metadata
        processed.metadata = {
            timestamp: new Date().toISOString(),
            provider: response.provider,
            model: response.model,
            taskType: response.routing?.taskType,
            confidence: response.routing?.confidence
        };
        
        // Extract and structure information
        if (response.content) {
            processed.structured = await this.structureContent(response.content);
        }
        
        // Add follow-up suggestions
        processed.suggestions = await this.generateSuggestions(response, originalRequest);
        
        return processed;
    }

    /**
     * Update memory with new interaction
     * @private
     */
    async updateMemory(request, response) {
        if (!this.memory) return;
        
        try {
            // Add to conversation history
            this.conversationHistory.push({
                timestamp: new Date().toISOString(),
                request: {
                    question: request.question || request.prompt,
                    type: request.taskType
                },
                response: {
                    content: response.content,
                    provider: response.provider,
                    model: response.model
                }
            });
            
            // Update current context
            if (this.currentContext) {
                this.currentContext.lastInteraction = new Date().toISOString();
                this.currentContext.totalInteractions = (this.currentContext.totalInteractions || 0) + 1;
            }
            
            // Save to persistent memory
            await this.memory.saveInteraction({
                request,
                response,
                context: this.currentContext
            });
            
        } catch (error) {
            this.logger.warn('Failed to update memory:', error.message);
        }
    }

    /**
     * Generate continuation suggestions based on project state
     * @private
     */
    async generateContinuationSuggestions(context, gitState) {
        const suggestions = [];
        
        // Analyze recent changes
        if (gitState.recentChanges.length > 0) {
            suggestions.push(`Review recent changes: ${gitState.recentChanges.length} files modified`);
        }
        
        // Check current phase and suggest next steps
        if (context.currentPhase) {
            switch (context.currentPhase) {
                case 'planning':
                    suggestions.push('Start implementing core features');
                    break;
                case 'implementation':
                    suggestions.push('Add tests and documentation');
                    break;
                case 'testing':
                    suggestions.push('Prepare for deployment');
                    break;
            }
        }
        
        // Suggest based on knowledge base
        if (this.knowledgeBase && context.technologies) {
            const techSuggestions = await this.knowledgeBase.getSuggestions(context.technologies);
            suggestions.push(...techSuggestions.slice(0, 2));
        }
        
        return suggestions;
    }

    /**
     * Generate follow-up suggestions
     * @private
     */
    async generateSuggestions(response, originalRequest) {
        const suggestions = [];
        
        // Analyze response content for potential follow-ups
        if (response.content.includes('implement') || response.content.includes('create')) {
            suggestions.push('Would you like me to implement this solution?');
        }
        
        if (response.content.includes('test') || response.content.includes('verify')) {
            suggestions.push('Should I create tests for this implementation?');
        }
        
        if (response.content.includes('deploy') || response.content.includes('production')) {
            suggestions.push('Need help with deployment configuration?');
        }
        
        return suggestions.slice(0, 3); // Limit to 3 suggestions
    }

    /**
     * Structure content for better usability
     * @private
     */
    async structureContent(content) {
        // Extract code blocks
        const codeBlocks = [];
        const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeRegex.exec(content)) !== null) {
            codeBlocks.push({
                language: match[1] || 'text',
                code: match[2].trim()
            });
        }
        
        // Extract lists
        const lists = [];
        const listRegex = /(?:^|\n)(?:\d+\.|[-*+])\s+(.+)/g;
        while ((match = listRegex.exec(content)) !== null) {
            lists.push(match[1]);
        }
        
        return {
            codeBlocks,
            lists,
            hasCode: codeBlocks.length > 0,
            hasLists: lists.length > 0
        };
    }

    /**
     * Update usage statistics
     * @private
     */
    updateStats(response, latency) {
        this.stats.successfulRequests++;
        this.stats.totalTokens += response.usage?.totalTokens || 0;
        this.stats.totalCost += response.usage?.cost || 0;
        
        // Update average latency
        this.stats.averageLatency = (
            (this.stats.averageLatency * (this.stats.successfulRequests - 1) + latency) / 
            this.stats.successfulRequests
        );
        
        // Update provider usage
        const provider = response.provider;
        const current = this.stats.providerUsage.get(provider) || 0;
        this.stats.providerUsage.set(provider, current + 1);
    }

    /**
     * Get comprehensive status information
     */
    async getProviderStatus() {
        const status = {};
        
        for (const [name, provider] of this.providers) {
            status[name] = provider.getStatus();
        }
        
        return status;
    }

    /**
     * Get usage statistics
     */
    getStats() {
        const sessionDuration = Date.now() - this.stats.sessionStart;
        
        return {
            ...this.stats,
            sessionDuration,
            requestsPerMinute: this.stats.totalRequests / (sessionDuration / 60000),
            successRate: (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2),
            averageCostPerRequest: this.stats.totalCost / this.stats.totalRequests,
            providerUsage: Object.fromEntries(this.stats.providerUsage)
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('Cleaning up Nexus AI Core...');
        
        // Save current state
        if (this.memory) {
            await this.memory.saveState();
        }
        
        // Cleanup providers
        for (const provider of this.providers.values()) {
            await provider.cleanup();
        }
        
        this.logger.info('Nexus AI Core cleanup completed');
    }
}

module.exports = { NexusAI };