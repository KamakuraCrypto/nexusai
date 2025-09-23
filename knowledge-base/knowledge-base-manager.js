/**
 * Knowledge Base Manager
 * Central management system for all ecosystem knowledge bases
 * Supports Solana, Ethereum, AI/ML, and custom ecosystems
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');
const { SolanaEcosystemKnowledge } = require('./solana-ecosystem');

class KnowledgeBaseManager {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('KnowledgeBaseManager');
        
        // Ecosystem handlers
        this.ecosystems = new Map();
        
        // Initialize built-in ecosystems
        this.initializeEcosystems();
        
        this.stats = {
            totalEcosystems: 0,
            totalProtocols: 0,
            totalDocuments: 0,
            lastGlobalSync: null
        };
    }

    /**
     * Initialize built-in ecosystem handlers
     */
    initializeEcosystems() {
        // Solana/DeFi ecosystem
        this.ecosystems.set('solana', {
            name: 'Solana Ecosystem',
            description: 'Solana blockchain and DeFi protocols',
            handler: new SolanaEcosystemKnowledge(this.nexusCore),
            protocols: [
                'meteora', 'jupiter', 'jupiter-wallet', 'solana-wallet-kit',
                'solana-web3', 'anchor', 'metaplex', 'serum', 'raydium', 'orca'
            ],
            initialized: false
        });
        
        // Ethereum ecosystem (placeholder for future implementation)
        this.ecosystems.set('ethereum', {
            name: 'Ethereum Ecosystem',
            description: 'Ethereum blockchain and DeFi protocols',
            handler: null, // TODO: Implement EthereumEcosystemKnowledge
            protocols: ['uniswap', 'aave', 'compound', 'opensea', 'ens'],
            initialized: false
        });
        
        // AI/ML ecosystem (placeholder for future implementation)
        this.ecosystems.set('ai-ml', {
            name: 'AI/ML Ecosystem',
            description: 'AI and Machine Learning frameworks and tools',
            handler: null, // TODO: Implement AIMLEcosystemKnowledge
            protocols: ['openai', 'anthropic', 'huggingface', 'tensorflow', 'pytorch'],
            initialized: false
        });
        
        // Web development ecosystem (placeholder for future implementation)
        this.ecosystems.set('web-dev', {
            name: 'Web Development',
            description: 'Web development frameworks and tools',
            handler: null, // TODO: Implement WebDevEcosystemKnowledge
            protocols: ['react', 'vue', 'angular', 'nextjs', 'nuxtjs', 'svelte'],
            initialized: false
        });
    }

    /**
     * Initialize knowledge base manager
     */
    async initialize() {
        this.logger.info('📚 Initializing Knowledge Base Manager...');
        
        try {
            // Initialize available ecosystem handlers
            for (const [ecosystemId, ecosystem] of this.ecosystems) {
                if (ecosystem.handler) {
                    this.logger.info(`🔄 Initializing ${ecosystem.name}...`);
                    await ecosystem.handler.initialize();
                    ecosystem.initialized = true;
                    this.logger.info(`✅ ${ecosystem.name} initialized`);
                }
            }
            
            // Load existing knowledge bases
            await this.loadExistingKnowledgeBases();
            
            // Update statistics
            await this.updateStats();
            
            this.logger.info('✅ Knowledge Base Manager initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize Knowledge Base Manager:', error);
            throw error;
        }
    }

    /**
     * Synchronize ecosystem knowledge bases
     */
    async syncEcosystems(options = {}) {
        const {
            ecosystems = Array.from(this.ecosystems.keys()),
            force = false,
            protocols = null
        } = options;
        
        this.logger.info(`🔄 Synchronizing ${ecosystems.length} ecosystem(s)...`);
        
        const results = {
            synchronized: [],
            failed: [],
            totalProtocols: 0,
            totalDocuments: 0
        };
        
        try {
            for (const ecosystemId of ecosystems) {
                const ecosystem = this.ecosystems.get(ecosystemId);
                
                if (!ecosystem) {
                    this.logger.warn(`Unknown ecosystem: ${ecosystemId}`);
                    results.failed.push({
                        ecosystem: ecosystemId,
                        error: 'Unknown ecosystem'
                    });
                    continue;
                }
                
                if (!ecosystem.handler || !ecosystem.initialized) {
                    this.logger.warn(`Ecosystem ${ecosystemId} not available`);
                    results.failed.push({
                        ecosystem: ecosystemId,
                        error: 'Handler not available or not initialized'
                    });
                    continue;
                }
                
                try {
                    this.logger.info(`🔍 Syncing ${ecosystem.name}...`);
                    
                    // Determine which protocols to sync
                    const protocolsToSync = protocols 
                        ? protocols.filter(p => ecosystem.protocols.includes(p))
                        : ecosystem.protocols;
                    
                    const ecosystemResult = await ecosystem.handler.syncAllProtocols({
                        force,
                        protocols: protocolsToSync
                    });
                    
                    results.synchronized.push({
                        ecosystem: ecosystemId,
                        name: ecosystem.name,
                        ...ecosystemResult
                    });
                    
                    results.totalProtocols += ecosystemResult.totalRepositories || 0;
                    results.totalDocuments += ecosystemResult.totalDocuments || 0;
                    
                    this.logger.info(`✅ ${ecosystem.name} synchronized`);
                    
                } catch (error) {
                    this.logger.error(`Failed to sync ${ecosystem.name}:`, error);
                    results.failed.push({
                        ecosystem: ecosystemId,
                        name: ecosystem.name,
                        error: error.message
                    });
                }
            }
            
            // Update global statistics
            this.stats.lastGlobalSync = new Date().toISOString();
            await this.updateStats();
            
            // Save sync results
            await this.saveSyncResults(results);
            
            this.logger.info(`✅ Ecosystem synchronization completed: ${results.synchronized.length}/${ecosystems.length} successful`);
            return results;
            
        } catch (error) {
            this.logger.error('Ecosystem synchronization failed:', error);
            throw error;
        }
    }

    /**
     * Query across all knowledge bases
     */
    async query(question, options = {}) {
        const {
            ecosystems = Array.from(this.ecosystems.keys()),
            protocols = null,
            limit = 20,
            threshold = 0.7
        } = options;
        
        this.logger.debug(`🔍 Querying knowledge bases: "${question}"`);
        
        const allResults = [];
        
        try {
            // Query each ecosystem
            for (const ecosystemId of ecosystems) {
                const ecosystem = this.ecosystems.get(ecosystemId);
                
                if (!ecosystem || !ecosystem.handler || !ecosystem.initialized) {
                    continue;
                }
                
                try {
                    const ecosystemResults = await ecosystem.handler.query(question, {
                        protocols: protocols ? protocols.filter(p => ecosystem.protocols.includes(p)) : undefined,
                        limit: Math.ceil(limit / ecosystems.length),
                        threshold
                    });
                    
                    // Add ecosystem metadata
                    for (const result of ecosystemResults) {
                        allResults.push({
                            ...result,
                            ecosystem: ecosystemId,
                            ecosystemName: ecosystem.name
                        });
                    }
                    
                } catch (error) {
                    this.logger.warn(`Query failed for ${ecosystem.name}:`, error.message);
                }
            }
            
            // Sort by relevance and limit results
            allResults.sort((a, b) => b.score - a.score);
            const limitedResults = allResults.slice(0, limit);
            
            this.logger.debug(`Found ${limitedResults.length} relevant results across ${ecosystems.length} ecosystems`);
            
            return limitedResults.map(result => ({
                id: result.id,
                content: this.extractContentFromResult(result),
                score: result.score,
                protocol: result.protocol,
                protocolName: result.protocolName,
                ecosystem: result.ecosystem,
                ecosystemName: result.ecosystemName,
                type: result.metadata?.type,
                source: result.metadata?.source,
                language: result.metadata?.language,
                category: result.metadata?.category
            }));
            
        } catch (error) {
            this.logger.error('Knowledge base query failed:', error);
            throw error;
        }
    }

    /**
     * Extract readable content from search result
     */
    extractContentFromResult(result) {
        // This would be more sophisticated in a real implementation
        if (result.metadata?.type === 'code-example') {
            return `Code example in ${result.metadata.language}`;
        } else if (result.metadata?.type === 'best-practice') {
            return `Best practice: ${result.metadata.category}`;
        } else if (result.metadata?.type === 'documentation') {
            return 'Documentation content';
        }
        
        return 'Knowledge base content';
    }

    /**
     * Get ecosystem information
     */
    getEcosystemInfo(ecosystemId) {
        const ecosystem = this.ecosystems.get(ecosystemId);
        
        if (!ecosystem) {
            throw new Error(`Unknown ecosystem: ${ecosystemId}`);
        }
        
        const info = {
            id: ecosystemId,
            name: ecosystem.name,
            description: ecosystem.description,
            protocols: ecosystem.protocols,
            initialized: ecosystem.initialized,
            available: !!ecosystem.handler
        };
        
        // Add handler-specific stats if available
        if (ecosystem.handler && ecosystem.initialized) {
            try {
                info.stats = ecosystem.handler.getStats();
            } catch (error) {
                this.logger.warn(`Failed to get stats for ${ecosystemId}:`, error.message);
            }
        }
        
        return info;
    }

    /**
     * List all available ecosystems
     */
    listEcosystems(options = {}) {
        const { includeStats = false, availableOnly = false } = options;
        
        const ecosystems = [];
        
        for (const [ecosystemId, ecosystem] of this.ecosystems) {
            if (availableOnly && (!ecosystem.handler || !ecosystem.initialized)) {
                continue;
            }
            
            const ecosystemInfo = {
                id: ecosystemId,
                name: ecosystem.name,
                description: ecosystem.description,
                protocols: ecosystem.protocols.length,
                initialized: ecosystem.initialized,
                available: !!ecosystem.handler
            };
            
            if (includeStats && ecosystem.handler && ecosystem.initialized) {
                try {
                    ecosystemInfo.stats = ecosystem.handler.getStats();
                } catch (error) {
                    this.logger.warn(`Failed to get stats for ${ecosystemId}:`, error.message);
                }
            }
            
            ecosystems.push(ecosystemInfo);
        }
        
        return ecosystems;
    }

    /**
     * List protocols across all ecosystems
     */
    listProtocols(ecosystemId = null) {
        const protocols = [];
        
        if (ecosystemId) {
            const ecosystem = this.ecosystems.get(ecosystemId);
            if (!ecosystem) {
                throw new Error(`Unknown ecosystem: ${ecosystemId}`);
            }
            
            if (ecosystem.handler && ecosystem.initialized) {
                try {
                    return ecosystem.handler.listProtocols();
                } catch (error) {
                    this.logger.warn(`Failed to list protocols for ${ecosystemId}:`, error.message);
                    return ecosystem.protocols.map(id => ({ id, name: id, ecosystem: ecosystemId }));
                }
            } else {
                return ecosystem.protocols.map(id => ({ id, name: id, ecosystem: ecosystemId }));
            }
        }
        
        // List all protocols across all ecosystems
        for (const [ecosystemId, ecosystem] of this.ecosystems) {
            if (ecosystem.handler && ecosystem.initialized) {
                try {
                    const ecosystemProtocols = ecosystem.handler.listProtocols();
                    protocols.push(...ecosystemProtocols.map(p => ({ ...p, ecosystem: ecosystemId })));
                } catch (error) {
                    this.logger.warn(`Failed to list protocols for ${ecosystemId}:`, error.message);
                    protocols.push(...ecosystem.protocols.map(id => ({ 
                        id, 
                        name: id, 
                        ecosystem: ecosystemId,
                        hasKnowledgeBase: false
                    })));
                }
            } else {
                protocols.push(...ecosystem.protocols.map(id => ({ 
                    id, 
                    name: id, 
                    ecosystem: ecosystemId,
                    hasKnowledgeBase: false
                })));
            }
        }
        
        return protocols;
    }

    /**
     * Add custom ecosystem
     */
    addCustomEcosystem(ecosystemId, config) {
        const { name, description, protocols = [], handler = null } = config;
        
        if (this.ecosystems.has(ecosystemId)) {
            throw new Error(`Ecosystem ${ecosystemId} already exists`);
        }
        
        this.ecosystems.set(ecosystemId, {
            name,
            description,
            protocols,
            handler,
            initialized: false,
            custom: true
        });
        
        this.logger.info(`Added custom ecosystem: ${name}`);
    }

    /**
     * Load existing knowledge bases from disk
     */
    async loadExistingKnowledgeBases() {
        const kbPath = path.join('.nexus', 'knowledge-base');
        
        if (await fs.pathExists(kbPath)) {
            const ecosystemDirs = await fs.readdir(kbPath);
            
            for (const dir of ecosystemDirs) {
                const dirPath = path.join(kbPath, dir);
                const stat = await fs.stat(dirPath);
                
                if (stat.isDirectory()) {
                    const ecosystem = this.ecosystems.get(dir);
                    if (ecosystem && ecosystem.handler) {
                        // Handler will load its own knowledge bases
                        this.logger.debug(`Knowledge base directory found for ${dir}`);
                    }
                }
            }
        }
    }

    /**
     * Update global statistics
     */
    async updateStats() {
        let totalProtocols = 0;
        let totalDocuments = 0;
        
        for (const [ecosystemId, ecosystem] of this.ecosystems) {
            totalProtocols += ecosystem.protocols.length;
            
            if (ecosystem.handler && ecosystem.initialized) {
                try {
                    const stats = ecosystem.handler.getStats();
                    totalDocuments += stats.documentsProcessed || 0;
                } catch (error) {
                    this.logger.warn(`Failed to get stats for ${ecosystemId}:`, error.message);
                }
            }
        }
        
        this.stats.totalEcosystems = this.ecosystems.size;
        this.stats.totalProtocols = totalProtocols;
        this.stats.totalDocuments = totalDocuments;
    }

    /**
     * Save synchronization results
     */
    async saveSyncResults(results) {
        const filePath = path.join('.nexus', 'knowledge-base', 'sync-results.json');
        await fs.ensureDir(path.dirname(filePath));
        
        const syncData = {
            timestamp: new Date().toISOString(),
            results,
            stats: this.stats
        };
        
        await fs.writeJson(filePath, syncData, { spaces: 2 });
    }

    /**
     * Get manager statistics
     */
    getStats() {
        return {
            ...this.stats,
            availableEcosystems: Array.from(this.ecosystems.keys()).filter(id => {
                const ecosystem = this.ecosystems.get(id);
                return ecosystem.handler && ecosystem.initialized;
            }).length,
            totalEcosystems: this.ecosystems.size
        };
    }

    /**
     * Export knowledge base for backup
     */
    async exportKnowledgeBase(ecosystemId = null) {
        const exportData = {
            exportedAt: new Date().toISOString(),
            ecosystems: [],
            stats: this.stats
        };
        
        if (ecosystemId) {
            const ecosystem = this.ecosystems.get(ecosystemId);
            if (!ecosystem) {
                throw new Error(`Unknown ecosystem: ${ecosystemId}`);
            }
            
            if (ecosystem.handler && ecosystem.initialized) {
                exportData.ecosystems.push({
                    id: ecosystemId,
                    name: ecosystem.name,
                    data: await ecosystem.handler.export()
                });
            }
        } else {
            // Export all ecosystems
            for (const [ecosystemId, ecosystem] of this.ecosystems) {
                if (ecosystem.handler && ecosystem.initialized) {
                    try {
                        exportData.ecosystems.push({
                            id: ecosystemId,
                            name: ecosystem.name,
                            data: await ecosystem.handler.export()
                        });
                    } catch (error) {
                        this.logger.warn(`Failed to export ${ecosystemId}:`, error.message);
                    }
                }
            }
        }
        
        return exportData;
    }

    /**
     * Import knowledge base from backup
     */
    async importKnowledgeBase(backupData) {
        for (const ecosystemBackup of backupData.ecosystems) {
            const ecosystem = this.ecosystems.get(ecosystemBackup.id);
            
            if (ecosystem && ecosystem.handler && ecosystem.initialized) {
                try {
                    await ecosystem.handler.import(ecosystemBackup.data);
                    this.logger.info(`Imported knowledge base for ${ecosystem.name}`);
                } catch (error) {
                    this.logger.error(`Failed to import ${ecosystem.name}:`, error);
                }
            }
        }
        
        await this.updateStats();
    }
}

module.exports = { KnowledgeBaseManager };