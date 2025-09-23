/**
 * Embedding Generator
 * Generates vector embeddings for text content using various models
 * Supports OpenAI, local models, and other embedding providers
 */

const OpenAI = require('openai');
const { Logger } = require('../../utils/logger');

class EmbeddingGenerator {
    constructor(config = {}) {
        this.config = {
            provider: config.provider || 'openai', // 'openai', 'local', 'huggingface'
            model: config.model || 'text-embedding-3-small',
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            dimensions: config.dimensions || 1536,
            maxBatchSize: config.maxBatchSize || 100,
            cacheEnabled: config.cacheEnabled !== false,
            ...config
        };
        
        this.logger = new Logger('EmbeddingGenerator');
        this.client = null;
        this.cache = new Map();
        
        // Performance tracking
        this.stats = {
            totalEmbeddings: 0,
            totalTokens: 0,
            cacheHits: 0,
            averageLatency: 0,
            errors: 0
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info('Initializing Embedding Generator...');
        
        try {
            await this.initializeProvider();
            
            // Load cache if enabled
            if (this.config.cacheEnabled) {
                await this.loadCache();
            }
            
            this.isInitialized = true;
            this.logger.info(`✅ Embedding Generator initialized (${this.config.provider}/${this.config.model})`);
            
        } catch (error) {
            this.logger.error('Failed to initialize Embedding Generator:', error);
            throw error;
        }
    }

    async initializeProvider() {
        switch (this.config.provider) {
            case 'openai':
                this.client = new OpenAI({
                    apiKey: this.config.apiKey
                });
                break;
                
            case 'local':
                // Initialize local embedding model
                await this.initializeLocalModel();
                break;
                
            case 'huggingface':
                // Initialize Hugging Face client
                await this.initializeHuggingFace();
                break;
                
            default:
                throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
        }
    }

    /**
     * Generate embedding for a single text
     */
    async generate(text) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!text || typeof text !== 'string') {
            throw new Error('Text input is required and must be a string');
        }

        const startTime = Date.now();

        try {
            // Check cache first
            if (this.config.cacheEnabled) {
                const cached = this.getCachedEmbedding(text);
                if (cached) {
                    this.stats.cacheHits++;
                    return cached;
                }
            }

            // Generate new embedding
            const embedding = await this.generateEmbedding(text);
            
            // Cache the result
            if (this.config.cacheEnabled) {
                this.setCachedEmbedding(text, embedding);
            }
            
            // Update statistics
            this.updateStats(Date.now() - startTime);
            
            return embedding;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Failed to generate embedding:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple texts
     */
    async generateBatch(texts) {
        if (!Array.isArray(texts)) {
            throw new Error('Texts must be an array');
        }

        if (texts.length === 0) {
            return [];
        }

        // Process in batches
        const results = [];
        for (let i = 0; i < texts.length; i += this.config.maxBatchSize) {
            const batch = texts.slice(i, i + this.config.maxBatchSize);
            const batchResults = await this.processBatch(batch);
            results.push(...batchResults);
        }

        return results;
    }

    async processBatch(texts) {
        const startTime = Date.now();
        
        try {
            // Check cache for each text
            const uncachedTexts = [];
            const results = [];
            
            for (const text of texts) {
                if (this.config.cacheEnabled) {
                    const cached = this.getCachedEmbedding(text);
                    if (cached) {
                        results.push(cached);
                        this.stats.cacheHits++;
                        continue;
                    }
                }
                uncachedTexts.push(text);
            }
            
            // Generate embeddings for uncached texts
            if (uncachedTexts.length > 0) {
                const newEmbeddings = await this.generateBatchEmbeddings(uncachedTexts);
                
                // Cache new embeddings
                if (this.config.cacheEnabled) {
                    for (let i = 0; i < uncachedTexts.length; i++) {
                        this.setCachedEmbedding(uncachedTexts[i], newEmbeddings[i]);
                    }
                }
                
                results.push(...newEmbeddings);
            }
            
            // Update statistics
            this.updateStats(Date.now() - startTime, uncachedTexts.length);
            
            return results;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Failed to generate batch embeddings:', error);
            throw error;
        }
    }

    async generateEmbedding(text) {
        switch (this.config.provider) {
            case 'openai':
                return await this.generateOpenAIEmbedding(text);
            case 'local':
                return await this.generateLocalEmbedding(text);
            case 'huggingface':
                return await this.generateHuggingFaceEmbedding(text);
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    async generateBatchEmbeddings(texts) {
        switch (this.config.provider) {
            case 'openai':
                return await this.generateOpenAIBatchEmbeddings(texts);
            case 'local':
                return await this.generateLocalBatchEmbeddings(texts);
            case 'huggingface':
                return await this.generateHuggingFaceBatchEmbeddings(texts);
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    async generateOpenAIEmbedding(text) {
        const response = await this.client.embeddings.create({
            model: this.config.model,
            input: text,
            dimensions: this.config.dimensions
        });

        this.stats.totalTokens += response.usage.total_tokens;
        return response.data[0].embedding;
    }

    async generateOpenAIBatchEmbeddings(texts) {
        const response = await this.client.embeddings.create({
            model: this.config.model,
            input: texts,
            dimensions: this.config.dimensions
        });

        this.stats.totalTokens += response.usage.total_tokens;
        return response.data.map(item => item.embedding);
    }

    async generateLocalEmbedding(text) {
        // Placeholder for local embedding model
        // This would integrate with a local model like sentence-transformers
        throw new Error('Local embedding generation not implemented yet');
    }

    async generateLocalBatchEmbeddings(texts) {
        // Placeholder for local batch embedding
        throw new Error('Local batch embedding generation not implemented yet');
    }

    async generateHuggingFaceEmbedding(text) {
        // Placeholder for Hugging Face embedding
        throw new Error('Hugging Face embedding generation not implemented yet');
    }

    async generateHuggingFaceBatchEmbeddings(texts) {
        // Placeholder for Hugging Face batch embedding
        throw new Error('Hugging Face batch embedding generation not implemented yet');
    }

    async initializeLocalModel() {
        // Initialize local embedding model
        this.logger.info('Local embedding model initialization not implemented');
    }

    async initializeHuggingFace() {
        // Initialize Hugging Face client
        this.logger.info('Hugging Face client initialization not implemented');
    }

    /**
     * Cache management
     */
    getCachedEmbedding(text) {
        const hash = this.hashText(text);
        return this.cache.get(hash);
    }

    setCachedEmbedding(text, embedding) {
        const hash = this.hashText(text);
        this.cache.set(hash, embedding);
        
        // Limit cache size
        if (this.cache.size > 10000) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    hashText(text) {
        // Simple hash function for caching
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    async loadCache() {
        try {
            const fs = require('fs-extra');
            const cachePath = '.nexus/memory/embedding-cache.json';
            
            if (await fs.pathExists(cachePath)) {
                const cacheData = await fs.readJson(cachePath);
                this.cache = new Map(Object.entries(cacheData));
                this.logger.debug(`Loaded ${this.cache.size} cached embeddings`);
            }
        } catch (error) {
            this.logger.warn('Failed to load embedding cache:', error.message);
        }
    }

    async saveCache() {
        if (!this.config.cacheEnabled || this.cache.size === 0) {
            return;
        }

        try {
            const fs = require('fs-extra');
            await fs.ensureDir('.nexus/memory');
            const cachePath = '.nexus/memory/embedding-cache.json';
            
            const cacheData = Object.fromEntries(this.cache);
            await fs.writeJson(cachePath, cacheData);
            
            this.logger.debug(`Saved ${this.cache.size} cached embeddings`);
        } catch (error) {
            this.logger.warn('Failed to save embedding cache:', error.message);
        }
    }

    /**
     * Utility methods
     */
    updateStats(latency, count = 1) {
        this.stats.totalEmbeddings += count;
        
        // Update average latency
        this.stats.averageLatency = (
            (this.stats.averageLatency * (this.stats.totalEmbeddings - count) + latency) / 
            this.stats.totalEmbeddings
        );
    }

    /**
     * Get embedding statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            cacheHitRate: this.stats.totalEmbeddings > 0 
                ? (this.stats.cacheHits / this.stats.totalEmbeddings * 100).toFixed(2)
                : 0,
            provider: this.config.provider,
            model: this.config.model
        };
    }

    /**
     * Calculate text similarity using cosine similarity
     */
    async calculateSimilarity(text1, text2) {
        const [embedding1, embedding2] = await this.generateBatch([text1, text2]);
        return this.cosineSimilarity(embedding1, embedding2);
    }

    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const norm = Math.sqrt(normA) * Math.sqrt(normB);
        return norm === 0 ? 0 : dotProduct / norm;
    }

    /**
     * Find similar texts from a collection
     */
    async findSimilar(queryText, textCollection, threshold = 0.7, limit = 5) {
        const queryEmbedding = await this.generate(queryText);
        const collectionEmbeddings = await this.generateBatch(textCollection);
        
        const similarities = collectionEmbeddings.map((embedding, index) => ({
            index,
            text: textCollection[index],
            similarity: this.cosineSimilarity(queryEmbedding, embedding)
        }));
        
        return similarities
            .filter(item => item.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Cluster texts by similarity
     */
    async clusterTexts(texts, threshold = 0.8) {
        const embeddings = await this.generateBatch(texts);
        const clusters = [];
        const assigned = new Set();
        
        for (let i = 0; i < texts.length; i++) {
            if (assigned.has(i)) continue;
            
            const cluster = [{ index: i, text: texts[i] }];
            assigned.add(i);
            
            for (let j = i + 1; j < texts.length; j++) {
                if (assigned.has(j)) continue;
                
                const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
                if (similarity >= threshold) {
                    cluster.push({ index: j, text: texts[j] });
                    assigned.add(j);
                }
            }
            
            clusters.push(cluster);
        }
        
        return clusters;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.stats.cacheHits = 0;
        this.logger.info('Embedding cache cleared');
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('Cleaning up Embedding Generator...');
        
        // Save cache
        if (this.config.cacheEnabled) {
            await this.saveCache();
        }
        
        // Clear memory
        this.cache.clear();
        
        this.logger.info('Embedding Generator cleanup completed');
    }
}

module.exports = { EmbeddingGenerator };