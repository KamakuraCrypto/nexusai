/**
 * Universal AI Provider Interface
 * Abstract base class for all AI model providers
 */

const { Logger } = require('../utils/logger');
const { TokenCounter } = require('../utils/token-counter');

class AIProvider {
    constructor(config = {}) {
        this.name = config.name || 'Unknown Provider';
        this.type = config.type || 'text';
        this.capabilities = config.capabilities || [];
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint;
        this.maxTokens = config.maxTokens || 4096;
        this.model = config.model;
        this.costPerToken = config.costPerToken || 0;
        
        this.logger = new Logger(`AIProvider:${this.name}`);
        this.tokenCounter = new TokenCounter();
        this.isInitialized = false;
        this.stats = {
            requestCount: 0,
            totalTokens: 0,
            totalCost: 0,
            averageLatency: 0,
            successRate: 0,
            errors: []
        };
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info(`Initializing ${this.name} provider...`);
        
        // Validate configuration
        this.validateConfig();
        
        // Test connection
        await this.testConnection();
        
        this.isInitialized = true;
        this.logger.info(`${this.name} provider initialized successfully`);
    }

    validateConfig() {
        if (!this.apiKey && this.requiresApiKey !== false) {
            throw new Error(`API key required for ${this.name} provider`);
        }
        
        if (!this.model) {
            throw new Error(`Model configuration required for ${this.name} provider`);
        }
    }

    async testConnection() {
        try {
            const testResponse = await this.sendRequest({
                messages: [{ role: 'user', content: 'test' }],
                maxTokens: 10
            });
            
            if (!testResponse || !testResponse.content) {
                throw new Error('Invalid response format');
            }
            
            this.logger.info(`Connection test successful for ${this.name}`);
        } catch (error) {
            this.logger.error(`Connection test failed for ${this.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Send request to AI provider
     * @param {Object} request - Request configuration
     * @returns {Promise<Object>} Response from AI provider
     */
    async sendRequest(request) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        this.stats.requestCount++;

        try {
            // Count input tokens
            const inputTokens = this.tokenCounter.count(this.formatMessages(request.messages));
            
            // Make the actual API request
            const response = await this.makeRequest(request);
            
            // Count output tokens
            const outputTokens = this.tokenCounter.count(response.content);
            const totalTokens = inputTokens + outputTokens;
            
            // Update statistics
            this.updateStats(totalTokens, Date.now() - startTime, true);
            
            // Return standardized response
            return {
                content: response.content,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    cost: totalTokens * this.costPerToken
                },
                model: this.model,
                provider: this.name,
                latency: Date.now() - startTime,
                ...response
            };
            
        } catch (error) {
            this.updateStats(0, Date.now() - startTime, false, error);
            this.logger.error(`Request failed for ${this.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Make the actual API request - to be implemented by subclasses
     * @param {Object} request - Request configuration
     * @returns {Promise<Object>} Raw response from provider
     */
    async makeRequest(request) {
        throw new Error('makeRequest method must be implemented by provider subclass');
    }

    /**
     * Format messages for this provider - to be implemented by subclasses
     * @param {Array} messages - Array of messages
     * @returns {string} Formatted messages
     */
    formatMessages(messages) {
        return messages.map(m => `${m.role}: ${m.content}`).join('\n');
    }

    /**
     * Get provider capabilities
     * @returns {Array} Array of capability strings
     */
    getCapabilities() {
        return this.capabilities;
    }

    /**
     * Check if provider supports a specific capability
     * @param {string} capability - Capability to check
     * @returns {boolean} True if supported
     */
    hasCapability(capability) {
        return this.capabilities.includes(capability);
    }

    /**
     * Get provider statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.requestCount > 0 
                ? ((this.stats.requestCount - this.stats.errors.length) / this.stats.requestCount * 100).toFixed(2)
                : 0,
            averageCost: this.stats.requestCount > 0 
                ? (this.stats.totalCost / this.stats.requestCount).toFixed(6)
                : 0
        };
    }

    /**
     * Get provider status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            name: this.name,
            type: this.type,
            model: this.model,
            initialized: this.isInitialized,
            available: this.isAvailable(),
            capabilities: this.capabilities,
            stats: this.getStats()
        };
    }

    /**
     * Check if provider is available
     * @returns {boolean} True if available
     */
    isAvailable() {
        return this.isInitialized && this.apiKey && this.stats.errors.length < 5;
    }

    /**
     * Update provider statistics
     * @private
     */
    updateStats(tokens, latency, success, error = null) {
        this.stats.totalTokens += tokens;
        this.stats.totalCost += tokens * this.costPerToken;
        
        // Update average latency
        this.stats.averageLatency = (
            (this.stats.averageLatency * (this.stats.requestCount - 1) + latency) / 
            this.stats.requestCount
        );
        
        if (!success && error) {
            this.stats.errors.push({
                timestamp: new Date().toISOString(),
                message: error.message,
                type: error.constructor.name
            });
            
            // Keep only last 10 errors
            if (this.stats.errors.length > 10) {
                this.stats.errors = this.stats.errors.slice(-10);
            }
        }
    }

    /**
     * Reset provider statistics
     */
    resetStats() {
        this.stats = {
            requestCount: 0,
            totalTokens: 0,
            totalCost: 0,
            averageLatency: 0,
            successRate: 0,
            errors: []
        };
    }

    /**
     * Estimate cost for a request
     * @param {Array} messages - Messages to process
     * @returns {number} Estimated cost
     */
    estimateCost(messages) {
        const tokenCount = this.tokenCounter.count(this.formatMessages(messages));
        return tokenCount * this.costPerToken;
    }

    /**
     * Create a copy of this provider with different configuration
     * @param {Object} newConfig - New configuration
     * @returns {AIProvider} New provider instance
     */
    clone(newConfig = {}) {
        const config = {
            name: this.name,
            type: this.type,
            capabilities: [...this.capabilities],
            apiKey: this.apiKey,
            endpoint: this.endpoint,
            maxTokens: this.maxTokens,
            model: this.model,
            costPerToken: this.costPerToken,
            ...newConfig
        };
        
        return new this.constructor(config);
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info(`Cleaning up ${this.name} provider...`);
        // Override in subclasses if needed
    }
}

module.exports = { AIProvider };