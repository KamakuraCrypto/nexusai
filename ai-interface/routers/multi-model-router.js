/**
 * Multi-Model Router
 * Intelligently routes tasks to the optimal AI model based on:
 * - Task type and complexity
 * - Model capabilities and performance
 * - Cost considerations
 * - Availability and latency
 */

const { Logger } = require('../../utils/logger');

class MultiModelRouter {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('MultiModelRouter');
        
        // Available providers
        this.providers = new Map();
        
        // Task classification patterns
        this.taskPatterns = {
            coding: [
                /write.*code/i, /implement.*function/i, /debug/i, /refactor/i,
                /create.*class/i, /fix.*bug/i, /optimize/i, /algorithm/i,
                /javascript/i, /python/i, /rust/i, /typescript/i, /solana/i
            ],
            reasoning: [
                /analyze/i, /explain/i, /reason/i, /logic/i, /problem.*solving/i,
                /compare/i, /evaluate/i, /strategy/i, /plan/i, /architecture/i
            ],
            research: [
                /research/i, /find.*information/i, /latest/i, /current/i,
                /trends/i, /news/i, /market/i, /documentation/i, /best.*practices/i
            ],
            creative: [
                /generate.*content/i, /write.*story/i, /creative/i, /brainstorm/i,
                /marketing/i, /copy/i, /blog/i, /article/i
            ],
            multimodal: [
                /image/i, /diagram/i, /chart/i, /visual/i, /picture/i,
                /screenshot/i, /pdf/i, /document/i
            ],
            conversation: [
                /chat/i, /talk/i, /discuss/i, /conversation/i, /interactive/i
            ],
            technical: [
                /api/i, /database/i, /infrastructure/i, /deployment/i,
                /security/i, /performance/i, /optimization/i, /system/i
            ]
        };
        
        // Model preferences by task type
        this.modelPreferences = {
            coding: ['claude', 'codex', 'gpt4'],
            reasoning: ['gpt4', 'claude', 'gemini'],
            research: ['perplexity', 'grok', 'gemini'],
            creative: ['gpt4', 'claude', 'gemini'],
            multimodal: ['gemini', 'gpt4-vision', 'claude'],
            conversation: ['gpt4', 'claude', 'gemini'],
            technical: ['claude', 'gpt4', 'gemini']
        };
        
        // Performance tracking
        this.routingStats = {
            totalRequests: 0,
            routingDecisions: new Map(),
            modelPerformance: new Map(),
            lastOptimization: Date.now()
        };
    }

    /**
     * Register an AI provider
     * @param {AIProvider} provider - Provider instance
     */
    registerProvider(provider) {
        const name = provider.name.toLowerCase();
        this.providers.set(name, provider);
        this.logger.info(`Registered AI provider: ${provider.name}`);
        
        // Initialize performance tracking
        if (!this.routingStats.modelPerformance.has(name)) {
            this.routingStats.modelPerformance.set(name, {
                successCount: 0,
                failureCount: 0,
                averageLatency: 0,
                totalCost: 0,
                taskTypes: new Map()
            });
        }
    }

    /**
     * Route a request to the optimal AI provider
     * @param {Object} request - Request configuration
     * @returns {Promise<Object>} Response from selected provider
     */
    async route(request) {
        this.routingStats.totalRequests++;
        
        try {
            // Analyze the task
            const taskAnalysis = this.analyzeTask(request);
            
            // Select optimal provider
            const selectedProvider = await this.selectProvider(taskAnalysis, request);
            
            // Log routing decision
            this.logRoutingDecision(taskAnalysis.type, selectedProvider.name);
            
            // Execute request
            const startTime = Date.now();
            const response = await selectedProvider.sendRequest(request);
            const latency = Date.now() - startTime;
            
            // Update performance metrics
            this.updatePerformanceMetrics(selectedProvider.name, taskAnalysis.type, latency, response.usage.cost, true);
            
            // Add routing metadata to response
            response.routing = {
                taskType: taskAnalysis.type,
                confidence: taskAnalysis.confidence,
                selectedProvider: selectedProvider.name,
                alternativeProviders: taskAnalysis.alternatives,
                routingLatency: Date.now() - startTime
            };
            
            return response;
            
        } catch (error) {
            this.logger.error('Routing failed:', error);
            throw error;
        }
    }

    /**
     * Analyze the incoming task to determine type and requirements
     * @param {Object} request - Request to analyze
     * @returns {Object} Task analysis
     */
    analyzeTask(request) {
        const content = this.extractContent(request);
        const taskTypes = [];
        
        // Check against each pattern category
        for (const [type, patterns] of Object.entries(this.taskPatterns)) {
            let matches = 0;
            for (const pattern of patterns) {
                if (pattern.test(content)) {
                    matches++;
                }
            }
            
            if (matches > 0) {
                taskTypes.push({
                    type,
                    confidence: matches / patterns.length,
                    matches
                });
            }
        }
        
        // Sort by confidence
        taskTypes.sort((a, b) => b.confidence - a.confidence);
        
        // Determine primary task type
        const primaryTask = taskTypes[0] || { type: 'general', confidence: 0.5 };
        
        // Get alternative providers
        const alternatives = this.getAlternativeProviders(primaryTask.type);
        
        return {
            type: primaryTask.type,
            confidence: primaryTask.confidence,
            alternatives,
            complexity: this.estimateComplexity(content),
            urgency: request.urgency || 'normal',
            costSensitivity: request.costSensitive || false
        };
    }

    /**
     * Select the optimal provider based on task analysis
     * @param {Object} taskAnalysis - Analysis of the task
     * @param {Object} request - Original request
     * @returns {Promise<AIProvider>} Selected provider
     */
    async selectProvider(taskAnalysis, request) {
        const { type, complexity, urgency, costSensitivity } = taskAnalysis;
        
        // Get preferred models for this task type
        const preferredModels = this.modelPreferences[type] || this.modelPreferences.general || [];
        
        // Score available providers
        const providerScores = new Map();
        
        for (const modelName of preferredModels) {
            const provider = this.providers.get(modelName);
            if (!provider || !provider.isAvailable()) continue;
            
            let score = 100; // Base score
            
            // Capability match
            if (provider.hasCapability(type)) {
                score += 20;
            }
            
            // Performance history
            const performance = this.routingStats.modelPerformance.get(modelName);
            if (performance) {
                const successRate = performance.successCount / (performance.successCount + performance.failureCount);
                score += successRate * 30;
                
                // Penalize high latency for urgent tasks
                if (urgency === 'high' && performance.averageLatency > 5000) {
                    score -= 20;
                }
            }
            
            // Cost considerations
            if (costSensitivity) {
                const estimatedCost = provider.estimateCost(request.messages || []);
                if (estimatedCost < 0.01) score += 15;
                else if (estimatedCost > 0.1) score -= 15;
            }
            
            // Complexity handling
            if (complexity === 'high' && provider.maxTokens > 8000) {
                score += 10;
            }
            
            // Load balancing - prefer less busy providers
            const providerStats = provider.getStats();
            if (providerStats.requestCount < 10) {
                score += 5;
            }
            
            providerScores.set(provider, score);
        }
        
        // Select provider with highest score
        let bestProvider = null;
        let bestScore = 0;
        
        for (const [provider, score] of providerScores) {
            if (score > bestScore) {
                bestScore = score;
                bestProvider = provider;
            }
        }
        
        // Fallback to any available provider
        if (!bestProvider) {
            for (const provider of this.providers.values()) {
                if (provider.isAvailable()) {
                    bestProvider = provider;
                    break;
                }
            }
        }
        
        if (!bestProvider) {
            throw new Error('No available AI providers');
        }
        
        this.logger.debug(`Selected provider: ${bestProvider.name} (score: ${bestScore}) for task type: ${type}`);
        return bestProvider;
    }

    /**
     * Extract content from request for analysis
     * @private
     */
    extractContent(request) {
        if (request.prompt) return request.prompt;
        if (request.messages) {
            return request.messages.map(m => m.content).join(' ');
        }
        if (request.content) return request.content;
        return '';
    }

    /**
     * Estimate task complexity
     * @private
     */
    estimateComplexity(content) {
        const length = content.length;
        const words = content.split(' ').length;
        
        if (length > 5000 || words > 1000) return 'high';
        if (length > 1000 || words > 200) return 'medium';
        return 'low';
    }

    /**
     * Get alternative providers for a task type
     * @private
     */
    getAlternativeProviders(taskType) {
        const preferred = this.modelPreferences[taskType] || [];
        return preferred.slice(1, 3); // Return 2 alternatives
    }

    /**
     * Log routing decision for analytics
     * @private
     */
    logRoutingDecision(taskType, providerName) {
        const key = `${taskType}->${providerName}`;
        const current = this.routingStats.routingDecisions.get(key) || 0;
        this.routingStats.routingDecisions.set(key, current + 1);
    }

    /**
     * Update performance metrics for a provider
     * @private
     */
    updatePerformanceMetrics(providerName, taskType, latency, cost, success) {
        const performance = this.routingStats.modelPerformance.get(providerName);
        
        if (success) {
            performance.successCount++;
        } else {
            performance.failureCount++;
        }
        
        // Update average latency
        const totalRequests = performance.successCount + performance.failureCount;
        performance.averageLatency = (
            (performance.averageLatency * (totalRequests - 1) + latency) / totalRequests
        );
        
        performance.totalCost += cost;
        
        // Track task type performance
        const taskTypePerf = performance.taskTypes.get(taskType) || { count: 0, averageLatency: 0 };
        taskTypePerf.count++;
        taskTypePerf.averageLatency = (
            (taskTypePerf.averageLatency * (taskTypePerf.count - 1) + latency) / taskTypePerf.count
        );
        performance.taskTypes.set(taskType, taskTypePerf);
    }

    /**
     * Get routing statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            totalRequests: this.routingStats.totalRequests,
            routingDecisions: Object.fromEntries(this.routingStats.routingDecisions),
            modelPerformance: Object.fromEntries(
                Array.from(this.routingStats.modelPerformance.entries()).map(([name, perf]) => [
                    name,
                    {
                        ...perf,
                        successRate: perf.successCount / (perf.successCount + perf.failureCount) * 100,
                        taskTypes: Object.fromEntries(perf.taskTypes)
                    }
                ])
            ),
            lastOptimization: this.routingStats.lastOptimization
        };
    }

    /**
     * Optimize routing based on historical performance
     */
    async optimizeRouting() {
        this.logger.info('Optimizing routing based on performance metrics...');
        
        // Analyze performance data
        for (const [providerName, performance] of this.routingStats.modelPerformance) {
            const successRate = performance.successCount / (performance.successCount + performance.failureCount);
            
            // Adjust preferences based on success rate
            if (successRate < 0.8) {
                this.logger.warn(`Provider ${providerName} has low success rate: ${successRate}`);
                // Consider demoting in preferences
            }
        }
        
        this.routingStats.lastOptimization = Date.now();
        this.logger.info('Routing optimization completed');
    }

    /**
     * Get available providers
     * @returns {Array} Available providers
     */
    getAvailableProviders() {
        return Array.from(this.providers.values())
            .filter(provider => provider.isAvailable())
            .map(provider => provider.getStatus());
    }
}

module.exports = { MultiModelRouter };