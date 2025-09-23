/**
 * Local Vector Store
 * File-based vector database for development and small-scale deployments
 * Provides semantic search capabilities without external dependencies
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../../utils/logger');

class LocalVectorStore {
    constructor(config = {}) {
        this.config = {
            indexName: config.indexName || 'nexus-local',
            dimensions: config.dimensions || 1536,
            storagePath: config.storagePath || '.nexus/memory',
            maxVectors: config.maxVectors || 100000,
            ...config
        };
        
        this.logger = new Logger('LocalVectorStore');
        this.vectors = new Map();
        this.metadata = new Map();
        this.indexPath = path.join(this.config.storagePath, `${this.config.indexName}.json`);
        this.metadataPath = path.join(this.config.storagePath, `${this.config.indexName}-metadata.json`);
        
        this.stats = {
            totalVectors: 0,
            totalQueries: 0,
            averageQueryTime: 0,
            lastSaved: null
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info('Initializing Local Vector Store...');
        
        try {
            // Ensure storage directory exists
            await fs.ensureDir(this.config.storagePath);
            
            // Load existing vectors if available
            await this.loadFromDisk();
            
            this.isInitialized = true;
            this.logger.info(`✅ Local Vector Store initialized with ${this.vectors.size} vectors`);
            
        } catch (error) {
            this.logger.error('Failed to initialize Local Vector Store:', error);
            throw error;
        }
    }

    /**
     * Store vectors in the database
     */
    async upsert(vectors) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            for (const vector of vectors) {
                if (!vector.id || !vector.vector || !Array.isArray(vector.vector)) {
                    throw new Error('Invalid vector format: missing id or vector array');
                }
                
                if (vector.vector.length !== this.config.dimensions) {
                    throw new Error(`Vector dimension mismatch: expected ${this.config.dimensions}, got ${vector.vector.length}`);
                }
                
                // Store vector and metadata
                this.vectors.set(vector.id, {
                    vector: vector.vector,
                    timestamp: new Date().toISOString()
                });
                
                if (vector.metadata) {
                    this.metadata.set(vector.id, vector.metadata);
                }
            }
            
            this.stats.totalVectors = this.vectors.size;
            
            // Save to disk periodically
            if (this.vectors.size % 100 === 0) {
                await this.saveToDisk();
            }
            
            this.logger.debug(`Upserted ${vectors.length} vectors`);
            
        } catch (error) {
            this.logger.error('Failed to upsert vectors:', error);
            throw error;
        }
    }

    /**
     * Query vectors using cosine similarity
     */
    async query(options) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        this.stats.totalQueries++;

        try {
            const {
                vector,
                topK = 5,
                filter = {},
                includeMetadata = true
            } = options;

            if (!vector || !Array.isArray(vector)) {
                throw new Error('Query vector is required and must be an array');
            }

            if (vector.length !== this.config.dimensions) {
                throw new Error(`Query vector dimension mismatch: expected ${this.config.dimensions}, got ${vector.length}`);
            }

            // Calculate similarities
            const similarities = [];
            
            for (const [id, storedVector] of this.vectors) {
                // Apply filters
                if (!this.matchesFilter(id, filter)) {
                    continue;
                }
                
                const similarity = this.cosineSimilarity(vector, storedVector.vector);
                similarities.push({
                    id,
                    score: similarity,
                    metadata: includeMetadata ? this.metadata.get(id) : undefined
                });
            }

            // Sort by similarity and get top K
            similarities.sort((a, b) => b.score - a.score);
            const matches = similarities.slice(0, topK);

            // Update performance stats
            const queryTime = Date.now() - startTime;
            this.stats.averageQueryTime = (
                (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + queryTime) / 
                this.stats.totalQueries
            );

            this.logger.debug(`Query completed in ${queryTime}ms, found ${matches.length} matches`);

            return { matches };
            
        } catch (error) {
            this.logger.error('Query failed:', error);
            throw error;
        }
    }

    /**
     * Delete vectors by IDs
     */
    async delete(ids) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        let deletedCount = 0;
        
        for (const id of ids) {
            if (this.vectors.has(id)) {
                this.vectors.delete(id);
                this.metadata.delete(id);
                deletedCount++;
            }
        }

        this.stats.totalVectors = this.vectors.size;
        
        if (deletedCount > 0) {
            await this.saveToDisk();
            this.logger.debug(`Deleted ${deletedCount} vectors`);
        }

        return { deletedCount };
    }

    /**
     * Get vector by ID
     */
    async get(id) {
        const vector = this.vectors.get(id);
        const metadata = this.metadata.get(id);
        
        if (vector) {
            return {
                id,
                vector: vector.vector,
                metadata
            };
        }
        
        return null;
    }

    /**
     * List all vector IDs
     */
    async list(options = {}) {
        const { limit, filter = {} } = options;
        const ids = [];
        
        for (const id of this.vectors.keys()) {
            if (this.matchesFilter(id, filter)) {
                ids.push(id);
                
                if (limit && ids.length >= limit) {
                    break;
                }
            }
        }
        
        return { ids };
    }

    /**
     * Calculate cosine similarity between two vectors
     */
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
        
        if (norm === 0) {
            return 0;
        }

        return dotProduct / norm;
    }

    /**
     * Check if metadata matches filter
     */
    matchesFilter(id, filter) {
        if (Object.keys(filter).length === 0) {
            return true;
        }

        const metadata = this.metadata.get(id);
        if (!metadata) {
            return false;
        }

        for (const [key, value] of Object.entries(filter)) {
            if (typeof value === 'object' && value !== null) {
                // Handle range queries
                if (value.$gte !== undefined && metadata[key] < value.$gte) {
                    return false;
                }
                if (value.$lte !== undefined && metadata[key] > value.$lte) {
                    return false;
                }
                if (value.$gt !== undefined && metadata[key] <= value.$gt) {
                    return false;
                }
                if (value.$lt !== undefined && metadata[key] >= value.$lt) {
                    return false;
                }
            } else {
                // Exact match
                if (metadata[key] !== value) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Save vectors to disk
     */
    async saveToDisk() {
        try {
            // Convert Maps to objects for JSON serialization
            const vectorsData = Object.fromEntries(this.vectors);
            const metadataData = Object.fromEntries(this.metadata);

            // Save vectors
            await fs.writeJson(this.indexPath, {
                config: this.config,
                stats: this.stats,
                vectors: vectorsData,
                savedAt: new Date().toISOString()
            }, { spaces: 0 }); // Compact JSON for vectors

            // Save metadata separately for better performance
            await fs.writeJson(this.metadataPath, {
                metadata: metadataData,
                savedAt: new Date().toISOString()
            }, { spaces: 2 });

            this.stats.lastSaved = new Date().toISOString();
            this.logger.debug(`Saved ${this.vectors.size} vectors to disk`);
            
        } catch (error) {
            this.logger.error('Failed to save vectors to disk:', error);
            throw error;
        }
    }

    /**
     * Load vectors from disk
     */
    async loadFromDisk() {
        try {
            // Load vectors
            if (await fs.pathExists(this.indexPath)) {
                const data = await fs.readJson(this.indexPath);
                
                // Convert objects back to Maps
                this.vectors = new Map(Object.entries(data.vectors || {}));
                this.stats = { ...this.stats, ...data.stats };
                
                this.logger.debug(`Loaded ${this.vectors.size} vectors from disk`);
            }

            // Load metadata
            if (await fs.pathExists(this.metadataPath)) {
                const metadataFile = await fs.readJson(this.metadataPath);
                this.metadata = new Map(Object.entries(metadataFile.metadata || {}));
                
                this.logger.debug(`Loaded metadata for ${this.metadata.size} vectors`);
            }
            
        } catch (error) {
            this.logger.warn('Failed to load vectors from disk, starting fresh:', error.message);
            this.vectors = new Map();
            this.metadata = new Map();
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        return {
            ...this.stats,
            totalVectors: this.vectors.size,
            totalMetadata: this.metadata.size,
            storageSize: await this.getStorageSize(),
            indexPath: this.indexPath
        };
    }

    /**
     * Get storage size in bytes
     */
    async getStorageSize() {
        try {
            let totalSize = 0;
            
            if (await fs.pathExists(this.indexPath)) {
                const indexStats = await fs.stat(this.indexPath);
                totalSize += indexStats.size;
            }
            
            if (await fs.pathExists(this.metadataPath)) {
                const metadataStats = await fs.stat(this.metadataPath);
                totalSize += metadataStats.size;
            }
            
            return totalSize;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Optimize the database
     */
    async optimize() {
        this.logger.info('Optimizing Local Vector Store...');
        
        // Remove orphaned metadata
        const vectorIds = new Set(this.vectors.keys());
        const metadataIds = new Set(this.metadata.keys());
        
        let removedMetadata = 0;
        for (const id of metadataIds) {
            if (!vectorIds.has(id)) {
                this.metadata.delete(id);
                removedMetadata++;
            }
        }
        
        if (removedMetadata > 0) {
            this.logger.info(`Removed ${removedMetadata} orphaned metadata entries`);
        }
        
        // Save optimized data
        await this.saveToDisk();
        
        this.logger.info('Local Vector Store optimization completed');
    }

    /**
     * Clear all vectors
     */
    async clear() {
        this.vectors.clear();
        this.metadata.clear();
        this.stats.totalVectors = 0;
        
        // Remove files
        try {
            if (await fs.pathExists(this.indexPath)) {
                await fs.remove(this.indexPath);
            }
            if (await fs.pathExists(this.metadataPath)) {
                await fs.remove(this.metadataPath);
            }
        } catch (error) {
            this.logger.warn('Failed to remove index files:', error.message);
        }
        
        this.logger.info('Local Vector Store cleared');
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('Cleaning up Local Vector Store...');
        
        // Save current state
        await this.saveToDisk();
        
        // Clear memory
        this.vectors.clear();
        this.metadata.clear();
        
        this.logger.info('Local Vector Store cleanup completed');
    }

    /**
     * Export vectors for backup
     */
    async export() {
        return {
            config: this.config,
            stats: this.stats,
            vectors: Object.fromEntries(this.vectors),
            metadata: Object.fromEntries(this.metadata),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import vectors from backup
     */
    async import(backup) {
        this.vectors = new Map(Object.entries(backup.vectors || {}));
        this.metadata = new Map(Object.entries(backup.metadata || {}));
        this.stats = { ...this.stats, ...backup.stats };
        
        await this.saveToDisk();
        
        this.logger.info(`Imported ${this.vectors.size} vectors from backup`);
    }
}

module.exports = { LocalVectorStore };