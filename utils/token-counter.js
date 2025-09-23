/**
 * Token Counter Utility
 * Provides accurate token counting for different AI models
 * Supports GPT, Claude, and other tokenization schemes
 */

const { encoding_for_model } = require('tiktoken');

class TokenCounter {
    constructor() {
        this.encoders = new Map();
        this.approximateRatios = {
            // Approximate tokens per character for different models
            'gpt-4': 0.25,
            'gpt-3.5': 0.25,
            'claude': 0.22,
            'gemini': 0.24,
            'general': 0.25
        };
        
        this.initializeEncoders();
    }

    async initializeEncoders() {
        try {
            // Initialize tiktoken encoders for OpenAI models
            this.encoders.set('gpt-4', encoding_for_model('gpt-4'));
            this.encoders.set('gpt-3.5-turbo', encoding_for_model('gpt-3.5-turbo'));
            this.encoders.set('text-davinci-003', encoding_for_model('text-davinci-003'));
        } catch (error) {
            console.warn('Failed to initialize some encoders:', error.message);
        }
    }

    /**
     * Count tokens in text for a specific model
     * @param {string} text - Text to count tokens for
     * @param {string} model - Model name (optional)
     * @returns {number} Token count
     */
    count(text, model = 'general') {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        // Try exact encoding first
        const exactCount = this.getExactTokenCount(text, model);
        if (exactCount !== null) {
            return exactCount;
        }

        // Fall back to approximation
        return this.getApproximateTokenCount(text, model);
    }

    /**
     * Get exact token count using model-specific encoders
     * @private
     */
    getExactTokenCount(text, model) {
        // Map model names to encoder keys
        const modelMap = {
            'gpt-4': 'gpt-4',
            'gpt-4-turbo': 'gpt-4',
            'gpt-4-vision': 'gpt-4',
            'gpt-3.5-turbo': 'gpt-3.5-turbo',
            'gpt-3.5': 'gpt-3.5-turbo',
            'text-davinci-003': 'text-davinci-003'
        };

        const encoderKey = modelMap[model] || modelMap[model.toLowerCase()];
        const encoder = this.encoders.get(encoderKey);

        if (encoder) {
            try {
                return encoder.encode(text).length;
            } catch (error) {
                console.warn(`Failed to encode text for ${model}:`, error.message);
                return null;
            }
        }

        return null;
    }

    /**
     * Get approximate token count using character ratios
     * @private
     */
    getApproximateTokenCount(text, model) {
        const ratio = this.approximateRatios[model] || this.approximateRatios.general;
        
        // More sophisticated approximation
        const words = text.split(/\s+/).length;
        const characters = text.length;
        
        // Average between character-based and word-based estimates
        const charBasedEstimate = characters * ratio;
        const wordBasedEstimate = words * 1.3; // Average ~1.3 tokens per word
        
        return Math.round((charBasedEstimate + wordBasedEstimate) / 2);
    }

    /**
     * Count tokens in an array of messages
     * @param {Array} messages - Array of message objects
     * @param {string} model - Model name
     * @returns {number} Total token count
     */
    countMessages(messages, model = 'general') {
        if (!Array.isArray(messages)) {
            return 0;
        }

        let totalTokens = 0;

        // Add tokens for message structure overhead
        totalTokens += messages.length * 3; // ~3 tokens per message for formatting

        // Count content tokens
        for (const message of messages) {
            if (message.content) {
                totalTokens += this.count(message.content, model);
            }
            if (message.role) {
                totalTokens += this.count(message.role, model);
            }
            if (message.name) {
                totalTokens += this.count(message.name, model);
            }
        }

        return totalTokens;
    }

    /**
     * Estimate cost based on token count and model pricing
     * @param {number} tokens - Token count
     * @param {string} model - Model name
     * @param {string} type - 'input' or 'output'
     * @returns {number} Estimated cost in USD
     */
    estimateCost(tokens, model, type = 'input') {
        const pricing = this.getModelPricing(model);
        const rate = type === 'output' ? pricing.output : pricing.input;
        return (tokens / 1000) * rate;
    }

    /**
     * Get model pricing information
     * @private
     */
    getModelPricing(model) {
        const pricing = {
            'gpt-4': { input: 0.03, output: 0.06 },
            'gpt-4-turbo': { input: 0.01, output: 0.03 },
            'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
            'claude-3-opus': { input: 0.015, output: 0.075 },
            'claude-3-sonnet': { input: 0.003, output: 0.015 },
            'claude-3-haiku': { input: 0.00025, output: 0.00125 },
            'gemini-pro': { input: 0.001, output: 0.002 },
            'general': { input: 0.002, output: 0.004 }
        };

        return pricing[model] || pricing.general;
    }

    /**
     * Truncate text to fit within token limit
     * @param {string} text - Text to truncate
     * @param {number} maxTokens - Maximum token count
     * @param {string} model - Model name
     * @param {string} strategy - 'start', 'end', or 'middle'
     * @returns {string} Truncated text
     */
    truncate(text, maxTokens, model = 'general', strategy = 'end') {
        const currentTokens = this.count(text, model);
        
        if (currentTokens <= maxTokens) {
            return text;
        }

        // Calculate approximate character limit
        const ratio = this.approximateRatios[model] || this.approximateRatios.general;
        const maxChars = Math.floor(maxTokens / ratio);

        switch (strategy) {
            case 'start':
                return text.substring(0, maxChars);
            
            case 'middle':
                const startChars = Math.floor(maxChars * 0.4);
                const endChars = Math.floor(maxChars * 0.4);
                const start = text.substring(0, startChars);
                const end = text.substring(text.length - endChars);
                return `${start}... [truncated] ...${end}`;
            
            case 'end':
            default:
                return text.substring(text.length - maxChars);
        }
    }

    /**
     * Split text into chunks that fit within token limits
     * @param {string} text - Text to split
     * @param {number} maxTokensPerChunk - Maximum tokens per chunk
     * @param {string} model - Model name
     * @param {number} overlap - Overlap between chunks in tokens
     * @returns {Array} Array of text chunks
     */
    splitIntoChunks(text, maxTokensPerChunk, model = 'general', overlap = 0) {
        const chunks = [];
        const ratio = this.approximateRatios[model] || this.approximateRatios.general;
        const maxCharsPerChunk = Math.floor(maxTokensPerChunk / ratio);
        const overlapChars = Math.floor(overlap / ratio);

        let currentPos = 0;
        
        while (currentPos < text.length) {
            const chunkEnd = Math.min(currentPos + maxCharsPerChunk, text.length);
            let chunk = text.substring(currentPos, chunkEnd);
            
            // Try to break at word boundaries
            if (chunkEnd < text.length) {
                const lastSpace = chunk.lastIndexOf(' ');
                if (lastSpace > maxCharsPerChunk * 0.8) {
                    chunk = chunk.substring(0, lastSpace);
                }
            }
            
            chunks.push(chunk);
            
            // Move position forward, accounting for overlap
            currentPos = Math.max(currentPos + chunk.length - overlapChars, currentPos + 1);
        }

        return chunks;
    }

    /**
     * Optimize text for token efficiency
     * @param {string} text - Text to optimize
     * @param {string} model - Model name
     * @returns {Object} Optimization results
     */
    optimize(text, model = 'general') {
        const originalTokens = this.count(text, model);
        let optimized = text;

        // Remove redundant whitespace
        optimized = optimized.replace(/\s+/g, ' ').trim();
        
        // Remove common filler words (carefully)
        const fillerWords = ['really', 'very', 'quite', 'pretty', 'somewhat', 'rather'];
        const fillerRegex = new RegExp(`\\b(${fillerWords.join('|')})\\s+`, 'gi');
        optimized = optimized.replace(fillerRegex, '');
        
        // Compress common phrases
        const compressions = {
            'in other words': 'i.e.',
            'for example': 'e.g.',
            'such as': 'e.g.',
            'and so on': 'etc.',
            'step by step': 'systematically',
            'first of all': 'first',
            'in conclusion': 'finally'
        };
        
        Object.entries(compressions).forEach(([long, short]) => {
            const regex = new RegExp(long, 'gi');
            optimized = optimized.replace(regex, short);
        });

        const optimizedTokens = this.count(optimized, model);
        const savings = originalTokens - optimizedTokens;
        
        return {
            original: text,
            optimized,
            originalTokens,
            optimizedTokens,
            savings,
            compressionRatio: originalTokens > 0 ? (savings / originalTokens * 100).toFixed(1) : 0
        };
    }

    /**
     * Get detailed analysis of text token usage
     * @param {string} text - Text to analyze
     * @param {string} model - Model name
     * @returns {Object} Detailed analysis
     */
    analyze(text, model = 'general') {
        const tokens = this.count(text, model);
        const characters = text.length;
        const words = text.split(/\s+/).length;
        const sentences = text.split(/[.!?]+/).length - 1;
        const paragraphs = text.split(/\n\s*\n/).length;
        
        return {
            tokens,
            characters,
            words,
            sentences,
            paragraphs,
            averageTokensPerWord: words > 0 ? (tokens / words).toFixed(2) : 0,
            averageTokensPerSentence: sentences > 0 ? (tokens / sentences).toFixed(2) : 0,
            tokensPerCharacter: characters > 0 ? (tokens / characters).toFixed(3) : 0,
            estimatedReadingTime: Math.ceil(words / 200), // Minutes at 200 WPM
            model
        };
    }

    /**
     * Compare token counts across different models
     * @param {string} text - Text to compare
     * @returns {Object} Comparison across models
     */
    compareModels(text) {
        const models = ['gpt-4', 'gpt-3.5-turbo', 'claude', 'gemini'];
        const comparison = {};
        
        models.forEach(model => {
            comparison[model] = {
                tokens: this.count(text, model),
                estimatedCost: this.estimateCost(this.count(text, model), model, 'input')
            };
        });
        
        return comparison;
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.encoders.forEach(encoder => {
            try {
                encoder.free();
            } catch (error) {
                // Ignore cleanup errors
            }
        });
        this.encoders.clear();
    }
}

module.exports = { TokenCounter };