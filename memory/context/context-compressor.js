/**
 * Context Compressor
 * Compresses conversation history and context to optimize memory usage
 * Uses intelligent summarization and key information extraction
 */

const { Logger } = require('../../utils/logger');
const { TokenCounter } = require('../../utils/token-counter');

class ContextCompressor {
    constructor(config = {}) {
        this.config = {
            maxTokens: config.maxTokens || 8000,
            compressionRatio: config.compressionRatio || 0.7,
            preserveImportant: config.preserveImportant !== false,
            keywordExtraction: config.keywordExtraction !== false,
            summaryLength: config.summaryLength || 200,
            ...config
        };
        
        this.logger = new Logger('ContextCompressor');
        this.tokenCounter = new TokenCounter();
        
        // Compression strategies
        this.strategies = {
            'extractive': this.extractiveCompression.bind(this),
            'abstractive': this.abstractiveCompression.bind(this),
            'keyword': this.keywordCompression.bind(this),
            'hierarchical': this.hierarchicalCompression.bind(this),
            'rolling': this.rollingCompression.bind(this)
        };
        
        // Important patterns to preserve
        this.importantPatterns = [
            /error|exception|failed|bug/i,
            /important|critical|urgent/i,
            /decision|conclusion|result/i,
            /api|endpoint|url/i,
            /code|function|class|method/i,
            /project|task|goal|objective/i
        ];
        
        this.stats = {
            totalCompressions: 0,
            totalOriginalTokens: 0,
            totalCompressedTokens: 0,
            averageCompressionRatio: 0
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info('Initializing Context Compressor...');
        
        // Initialize tokenizer
        await this.tokenCounter.initializeEncoders();
        
        this.isInitialized = true;
        this.logger.info('✅ Context Compressor initialized');
    }

    /**
     * Compress text content using optimal strategy
     */
    async compress(content, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!content || typeof content !== 'string') {
            return { compressed: content, ratio: 1, savings: 0 };
        }

        const originalTokens = this.tokenCounter.count(content);
        const targetTokens = options.maxTokens || Math.floor(originalTokens * this.config.compressionRatio);
        
        if (originalTokens <= targetTokens) {
            return { compressed: content, ratio: 1, savings: 0 };
        }

        try {
            // Select optimal compression strategy
            const strategy = this.selectStrategy(content, originalTokens, targetTokens);
            
            // Apply compression
            const compressed = await this.strategies[strategy](content, targetTokens);
            
            const compressedTokens = this.tokenCounter.count(compressed);
            const ratio = compressedTokens / originalTokens;
            const savings = originalTokens - compressedTokens;
            
            // Update statistics
            this.updateStats(originalTokens, compressedTokens);
            
            this.logger.debug(`Compressed ${originalTokens} → ${compressedTokens} tokens (${(ratio * 100).toFixed(1)}%)`);
            
            return {
                compressed,
                ratio,
                savings,
                strategy,
                originalTokens,
                compressedTokens
            };
            
        } catch (error) {
            this.logger.error('Compression failed:', error);
            return { compressed: content, ratio: 1, savings: 0, error: error.message };
        }
    }

    /**
     * Compress conversation history
     */
    async compressConversation(history, maxTokens = null) {
        if (!Array.isArray(history) || history.length === 0) {
            return history;
        }

        const targetTokens = maxTokens || this.config.maxTokens;
        const totalTokens = this.calculateConversationTokens(history);
        
        if (totalTokens <= targetTokens) {
            return history;
        }

        // Identify important messages
        const importantIndices = this.identifyImportantMessages(history);
        
        // Apply rolling window compression
        const compressed = await this.compressConversationRolling(history, targetTokens, importantIndices);
        
        this.logger.debug(`Compressed conversation: ${history.length} → ${compressed.length} messages`);
        return compressed;
    }

    /**
     * Select optimal compression strategy
     */
    selectStrategy(content, originalTokens, targetTokens) {
        const compressionNeeded = 1 - (targetTokens / originalTokens);
        
        if (compressionNeeded < 0.3) {
            return 'extractive'; // Light compression
        } else if (compressionNeeded < 0.6) {
            return 'keyword'; // Medium compression
        } else if (compressionNeeded < 0.8) {
            return 'abstractive'; // Heavy compression
        } else {
            return 'hierarchical'; // Maximum compression
        }
    }

    /**
     * Extractive compression - preserve important sentences
     */
    async extractiveCompression(content, targetTokens) {
        const sentences = this.splitIntoSentences(content);
        const sentenceScores = this.scoresentences(sentences);
        
        // Sort by importance
        const sortedSentences = sentences
            .map((sentence, index) => ({
                sentence,
                score: sentenceScores[index],
                index
            }))
            .sort((a, b) => b.score - a.score);

        // Select sentences until target tokens reached
        const selected = [];
        let currentTokens = 0;
        
        for (const item of sortedSentences) {
            const tokens = this.tokenCounter.count(item.sentence);
            if (currentTokens + tokens <= targetTokens) {
                selected.push(item);
                currentTokens += tokens;
            }
        }
        
        // Sort by original order
        selected.sort((a, b) => a.index - b.index);
        
        return selected.map(item => item.sentence).join(' ');
    }

    /**
     * Abstractive compression - create summary
     */
    async abstractiveCompression(content, targetTokens) {
        // Extract key information
        const keyInfo = this.extractKeyInformation(content);
        
        // Create structured summary
        const summary = this.createStructuredSummary(keyInfo, targetTokens);
        
        return summary;
    }

    /**
     * Keyword compression - extract key phrases and concepts
     */
    async keywordCompression(content, targetTokens) {
        const keywords = this.extractKeywords(content);
        const importantSentences = this.findSentencesWithKeywords(content, keywords);
        
        // Combine keywords and important sentences
        let compressed = keywords.join(', ') + '. ';
        
        for (const sentence of importantSentences) {
            const tokens = this.tokenCounter.count(compressed + sentence);
            if (tokens <= targetTokens) {
                compressed += sentence + ' ';
            } else {
                break;
            }
        }
        
        return compressed.trim();
    }

    /**
     * Hierarchical compression - structured information preservation
     */
    async hierarchicalCompression(content, targetTokens) {
        const structure = this.analyzeContentStructure(content);
        
        // Preserve hierarchy: headers > important > normal > filler
        const prioritized = [
            ...structure.headers,
            ...structure.important,
            ...structure.normal.slice(0, Math.floor(structure.normal.length * 0.3))
        ];
        
        let compressed = '';
        for (const item of prioritized) {
            const tokens = this.tokenCounter.count(compressed + item);
            if (tokens <= targetTokens) {
                compressed += item + ' ';
            } else {
                break;
            }
        }
        
        return compressed.trim();
    }

    /**
     * Rolling compression - maintain recent context
     */
    async rollingCompression(content, targetTokens) {
        const parts = this.splitContent(content, 1000); // Split into chunks
        
        let compressed = '';
        let recentParts = [];
        
        // Always include the most recent parts
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            const tokens = this.tokenCounter.count(compressed + part);
            
            if (tokens <= targetTokens) {
                recentParts.unshift(part);
                compressed = recentParts.join(' ');
            } else {
                break;
            }
        }
        
        return compressed;
    }

    /**
     * Compress conversation using rolling window
     */
    async compressConversationRolling(history, targetTokens, importantIndices = new Set()) {
        const compressed = [];
        let currentTokens = 0;
        
        // Always preserve recent messages
        for (let i = history.length - 1; i >= 0; i--) {
            const message = history[i];
            const messageText = this.formatMessage(message);
            const tokens = this.tokenCounter.count(messageText);
            
            if (currentTokens + tokens <= targetTokens || importantIndices.has(i)) {
                compressed.unshift(message);
                currentTokens += tokens;
            } else if (compressed.length >= 5) {
                // Have enough recent context
                break;
            } else {
                // Compress this message to fit
                const availableTokens = targetTokens - currentTokens;
                const compressedMessage = await this.compressMessage(message, availableTokens);
                
                if (compressedMessage) {
                    compressed.unshift(compressedMessage);
                    currentTokens += this.tokenCounter.count(this.formatMessage(compressedMessage));
                }
                break;
            }
        }
        
        return compressed;
    }

    /**
     * Helper methods
     */
    splitIntoSentences(content) {
        return content
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10);
    }

    scoresentences(sentences) {
        return sentences.map(sentence => {
            let score = 0;
            
            // Length score (prefer medium-length sentences)
            const length = sentence.length;
            if (length > 20 && length < 200) score += 1;
            
            // Keyword score
            for (const pattern of this.importantPatterns) {
                if (pattern.test(sentence)) score += 2;
            }
            
            // Position score (beginning and end are more important)
            const position = sentences.indexOf(sentence);
            if (position < 3 || position >= sentences.length - 3) score += 1;
            
            // Code/technical content score
            if (/```|function|class|const|let|var|import|export/.test(sentence)) {
                score += 3;
            }
            
            return score;
        });
    }

    extractKeyInformation(content) {
        const info = {
            keywords: this.extractKeywords(content),
            entities: this.extractEntities(content),
            actions: this.extractActions(content),
            results: this.extractResults(content)
        };
        
        return info;
    }

    extractKeywords(content) {
        // Simple keyword extraction
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(entry => entry[0]);
    }

    extractEntities(content) {
        const entities = [];
        
        // Simple entity extraction patterns
        const patterns = [
            /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Proper nouns
            /\b\w+\.\w+\b/g, // Domain names
            /\b\d+\.\d+\.\d+\b/g, // Version numbers
            /@\w+/g // Mentions
        ];
        
        patterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            entities.push(...matches);
        });
        
        return [...new Set(entities)];
    }

    extractActions(content) {
        const actionVerbs = [
            'create', 'build', 'implement', 'design', 'develop',
            'fix', 'solve', 'resolve', 'update', 'modify',
            'analyze', 'test', 'deploy', 'configure'
        ];
        
        const actions = [];
        const sentences = this.splitIntoSentences(content);
        
        sentences.forEach(sentence => {
            actionVerbs.forEach(verb => {
                if (sentence.toLowerCase().includes(verb)) {
                    actions.push(sentence);
                }
            });
        });
        
        return [...new Set(actions)];
    }

    extractResults(content) {
        const resultPatterns = [
            /result:|conclusion:|outcome:/i,
            /successfully|completed|finished/i,
            /error:|failed:|issue:/i
        ];
        
        const results = [];
        const sentences = this.splitIntoSentences(content);
        
        sentences.forEach(sentence => {
            resultPatterns.forEach(pattern => {
                if (pattern.test(sentence)) {
                    results.push(sentence);
                }
            });
        });
        
        return results;
    }

    createStructuredSummary(keyInfo, targetTokens) {
        let summary = '';
        
        // Add keywords
        if (keyInfo.keywords.length > 0) {
            summary += `Key topics: ${keyInfo.keywords.slice(0, 5).join(', ')}. `;
        }
        
        // Add main actions
        if (keyInfo.actions.length > 0) {
            summary += `Actions: ${keyInfo.actions.slice(0, 2).join('; ')}. `;
        }
        
        // Add results
        if (keyInfo.results.length > 0) {
            summary += `Results: ${keyInfo.results.slice(0, 2).join('; ')}. `;
        }
        
        // Trim to target tokens
        return this.tokenCounter.truncate(summary, targetTokens);
    }

    analyzeContentStructure(content) {
        const lines = content.split('\n');
        const structure = {
            headers: [],
            important: [],
            normal: [],
            filler: []
        };
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            if (/^#{1,6}\s/.test(line) || /^[A-Z][^.]*:$/.test(line)) {
                structure.headers.push(line);
            } else if (this.importantPatterns.some(pattern => pattern.test(line))) {
                structure.important.push(line);
            } else if (line.length > 20) {
                structure.normal.push(line);
            } else {
                structure.filler.push(line);
            }
        });
        
        return structure;
    }

    splitContent(content, maxLength) {
        const parts = [];
        let current = '';
        
        const sentences = this.splitIntoSentences(content);
        
        for (const sentence of sentences) {
            if (current.length + sentence.length > maxLength && current) {
                parts.push(current.trim());
                current = sentence;
            } else {
                current += ' ' + sentence;
            }
        }
        
        if (current) {
            parts.push(current.trim());
        }
        
        return parts;
    }

    calculateConversationTokens(history) {
        return history.reduce((total, message) => {
            return total + this.tokenCounter.count(this.formatMessage(message));
        }, 0);
    }

    formatMessage(message) {
        if (typeof message === 'string') return message;
        
        const parts = [];
        if (message.role) parts.push(`${message.role}:`);
        if (message.content) parts.push(message.content);
        if (message.request) parts.push(JSON.stringify(message.request));
        if (message.response) parts.push(JSON.stringify(message.response));
        
        return parts.join(' ');
    }

    identifyImportantMessages(history) {
        const important = new Set();
        
        history.forEach((message, index) => {
            const text = this.formatMessage(message);
            
            // Check for important patterns
            if (this.importantPatterns.some(pattern => pattern.test(text))) {
                important.add(index);
            }
            
            // Mark system messages as important
            if (message.role === 'system') {
                important.add(index);
            }
            
            // Mark error messages as important
            if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
                important.add(index);
            }
        });
        
        return important;
    }

    async compressMessage(message, maxTokens) {
        const text = this.formatMessage(message);
        const compressed = await this.compress(text, { maxTokens });
        
        if (compressed.compressed && compressed.compressed !== text) {
            return {
                ...message,
                content: compressed.compressed,
                _compressed: true
            };
        }
        
        return null;
    }

    findSentencesWithKeywords(content, keywords) {
        const sentences = this.splitIntoSentences(content);
        const relevant = [];
        
        sentences.forEach(sentence => {
            const lowerSentence = sentence.toLowerCase();
            const keywordCount = keywords.reduce((count, keyword) => {
                return count + (lowerSentence.includes(keyword.toLowerCase()) ? 1 : 0);
            }, 0);
            
            if (keywordCount > 0) {
                relevant.push({ sentence, score: keywordCount });
            }
        });
        
        return relevant
            .sort((a, b) => b.score - a.score)
            .map(item => item.sentence);
    }

    updateStats(originalTokens, compressedTokens) {
        this.stats.totalCompressions++;
        this.stats.totalOriginalTokens += originalTokens;
        this.stats.totalCompressedTokens += compressedTokens;
        
        this.stats.averageCompressionRatio = this.stats.totalCompressedTokens / this.stats.totalOriginalTokens;
    }

    getStats() {
        return {
            ...this.stats,
            totalSavings: this.stats.totalOriginalTokens - this.stats.totalCompressedTokens,
            averageCompressionRatio: (this.stats.averageCompressionRatio * 100).toFixed(1) + '%'
        };
    }

    async cleanup() {
        this.logger.info('Context Compressor cleanup completed');
    }
}

module.exports = { ContextCompressor };