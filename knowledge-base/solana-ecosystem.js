/**
 * Solana Ecosystem Knowledge Base
 * Automatically fetches, analyzes, and maintains knowledge bases for Solana/DeFi protocols
 * Supports Meteora, Jupiter, Solana Wallet Kit, and other major protocols
 */

// Use axios if available, otherwise use stub
let axios;
try {
    axios = require('axios');
} catch (e) {
    axios = require('../utils/axios-stub');
}
const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');
const { EmbeddingGenerator } = require('../memory/embeddings/embedding-generator');
const { LocalVectorStore } = require('../memory/vector-db/local-store');
const { DocumentationAnalyzer } = require('../research/documentation-analyzer');

class SolanaEcosystemKnowledge {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('SolanaKnowledge');
        this.embeddingGenerator = new EmbeddingGenerator();
        this.docAnalyzer = new DocumentationAnalyzer(nexusCore);
        
        // Protocol configurations
        this.protocols = {
            meteora: {
                name: 'Meteora',
                github: 'https://api.github.com/repos/TeamRocket3/meteora-ag',
                website: 'https://meteora.ag',
                docs: 'https://docs.meteora.ag',
                apis: [
                    'https://api.meteora.ag',
                    'https://app.meteora.ag/api'
                ],
                description: 'Dynamic liquidity market maker and yield farming protocol'
            },
            jupiter: {
                name: 'Jupiter',
                github: 'https://api.github.com/repos/jup-ag/jupiter-core',
                website: 'https://jup.ag',
                docs: 'https://docs.jup.ag',
                apis: [
                    'https://quote-api.jup.ag',
                    'https://price.jup.ag'
                ],
                description: 'DEX aggregator for optimal token swaps'
            },
            'jupiter-wallet': {
                name: 'Jupiter Unified Wallet Kit',
                github: 'https://api.github.com/repos/jup-ag/wallet-kit',
                website: 'https://jup.ag/docs/wallet-kit',
                docs: 'https://github.com/jup-ag/wallet-kit#readme',
                description: 'Universal wallet connection library for Solana'
            },
            'solana-wallet-kit': {
                name: 'Solana Wallet Kit',
                github: 'https://api.github.com/repos/solana-labs/wallet-kit',
                website: 'https://solanacookbook.com/guides/wallets.html',
                docs: 'https://docs.solana.com/wallet-guide',
                description: 'Official Solana wallet integration library'
            },
            'solana-web3': {
                name: 'Solana Web3.js',
                github: 'https://api.github.com/repos/solana-labs/solana-web3.js',
                website: 'https://solana-labs.github.io/solana-web3.js',
                docs: 'https://solana-labs.github.io/solana-web3.js',
                description: 'Official Solana JavaScript SDK'
            },
            anchor: {
                name: 'Anchor Framework',
                github: 'https://api.github.com/repos/coral-xyz/anchor',
                website: 'https://www.anchor-lang.com',
                docs: 'https://www.anchor-lang.com/docs',
                description: 'Solana smart contract development framework'
            },
            metaplex: {
                name: 'Metaplex',
                github: 'https://api.github.com/repos/metaplex-foundation/metaplex',
                website: 'https://www.metaplex.com',
                docs: 'https://docs.metaplex.com',
                description: 'NFT standard and marketplace protocol'
            },
            serum: {
                name: 'Serum DEX',
                github: 'https://api.github.com/repos/project-serum/serum-dex',
                website: 'https://www.projectserum.com',
                docs: 'https://docs.projectserum.com',
                description: 'Decentralized exchange built on Solana'
            },
            'raydium': {
                name: 'Raydium',
                github: 'https://api.github.com/repos/raydium-io/raydium-sdk',
                website: 'https://raydium.io',
                docs: 'https://docs.raydium.io',
                description: 'Automated market maker and liquidity provider'
            },
            'orca': {
                name: 'Orca',
                github: 'https://api.github.com/repos/orca-so/typescript-sdk',
                website: 'https://www.orca.so',
                docs: 'https://orca-so.gitbook.io/orca-developer-portal',
                description: 'User-friendly decentralized exchange'
            }
        };
        
        this.vectorStores = new Map();
        this.knowledgeBases = new Map();
        
        this.stats = {
            protocolsIndexed: 0,
            repositoriesAnalyzed: 0,
            documentsProcessed: 0,
            apisDiscovered: 0,
            lastSync: null
        };
    }

    /**
     * Initialize knowledge base system
     */
    async initialize() {
        this.logger.info('🏗️ Initializing Solana Ecosystem Knowledge Base...');
        
        try {
            await this.embeddingGenerator.initialize();
            
            // Initialize vector stores for each protocol
            for (const [protocolId, protocol] of Object.entries(this.protocols)) {
                const vectorStore = new LocalVectorStore({
                    indexName: `solana-${protocolId}`,
                    storagePath: `.nexus/knowledge-base/solana/${protocolId}`
                });
                
                await vectorStore.initialize();
                this.vectorStores.set(protocolId, vectorStore);
            }
            
            // Load existing knowledge bases
            await this.loadExistingKnowledgeBases();
            
            this.logger.info('✅ Solana Ecosystem Knowledge Base initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize Solana knowledge base:', error);
            throw error;
        }
    }

    /**
     * Synchronize all protocols in the ecosystem
     */
    async syncAllProtocols(options = {}) {
        this.logger.info('🔄 Synchronizing Solana ecosystem protocols...');
        
        const {
            force = false,
            protocols = Object.keys(this.protocols),
            includeApis = true,
            analyzeDependencies = true
        } = options;
        
        const results = {
            synchronized: [],
            failed: [],
            totalRepositories: 0,
            totalDocuments: 0,
            totalApis: 0
        };
        
        try {
            for (const protocolId of protocols) {
                if (!this.protocols[protocolId]) {
                    this.logger.warn(`Unknown protocol: ${protocolId}`);
                    continue;
                }
                
                try {
                    this.logger.info(`🔍 Syncing ${this.protocols[protocolId].name}...`);
                    
                    const protocolResult = await this.syncProtocol(protocolId, {
                        force,
                        includeApis,
                        analyzeDependencies
                    });
                    
                    results.synchronized.push({
                        protocol: protocolId,
                        ...protocolResult
                    });
                    
                    results.totalRepositories += protocolResult.repositories || 0;
                    results.totalDocuments += protocolResult.documents || 0;
                    results.totalApis += protocolResult.apis || 0;
                    
                } catch (error) {
                    this.logger.error(`Failed to sync ${protocolId}:`, error);
                    results.failed.push({ protocol: protocolId, error: error.message });
                }
            }
            
            // Update statistics
            this.stats.protocolsIndexed = results.synchronized.length;
            this.stats.repositoriesAnalyzed += results.totalRepositories;
            this.stats.documentsProcessed += results.totalDocuments;
            this.stats.apisDiscovered += results.totalApis;
            this.stats.lastSync = new Date().toISOString();
            
            // Save consolidated knowledge base
            await this.saveConsolidatedKnowledgeBase(results);
            
            this.logger.info(`✅ Ecosystem sync completed: ${results.synchronized.length} protocols`);
            return results;
            
        } catch (error) {
            this.logger.error('Ecosystem synchronization failed:', error);
            throw error;
        }
    }

    /**
     * Synchronize individual protocol
     */
    async syncProtocol(protocolId, options = {}) {
        const protocol = this.protocols[protocolId];
        if (!protocol) {
            throw new Error(`Unknown protocol: ${protocolId}`);
        }
        
        const { force = false, includeApis = true, analyzeDependencies = true } = options;
        
        this.logger.info(`📡 Synchronizing ${protocol.name}...`);
        
        const protocolData = {
            id: protocolId,
            name: protocol.name,
            description: protocol.description,
            syncedAt: new Date().toISOString(),
            repositories: [],
            documentation: [],
            apis: [],
            dependencies: [],
            examples: [],
            bestPractices: []
        };
        
        try {
            // 1. Analyze GitHub repository
            if (protocol.github) {
                const repoData = await this.analyzeGitHubRepository(protocol.github);
                protocolData.repositories.push(repoData);
                
                // Analyze dependencies if requested
                if (analyzeDependencies && repoData.packageJson) {
                    protocolData.dependencies = await this.analyzeDependencies(repoData.packageJson);
                }
            }
            
            // 2. Fetch and analyze documentation
            if (protocol.docs) {
                const docData = await this.fetchAndAnalyzeDocumentation(protocol.docs);
                protocolData.documentation.push(docData);
            }
            
            // 3. Discover and analyze APIs
            if (includeApis && protocol.apis) {
                for (const apiUrl of protocol.apis) {
                    try {
                        const apiData = await this.analyzeApiEndpoint(apiUrl);
                        protocolData.apis.push(apiData);
                    } catch (error) {
                        this.logger.warn(`Failed to analyze API ${apiUrl}:`, error.message);
                    }
                }
            }
            
            // 4. Extract code examples
            protocolData.examples = await this.extractCodeExamples(protocolData);
            
            // 5. Identify best practices
            protocolData.bestPractices = await this.identifyBestPractices(protocolData);
            
            // 6. Generate embeddings and store in vector database
            await this.indexProtocolKnowledge(protocolId, protocolData);
            
            // 7. Save protocol knowledge base
            this.knowledgeBases.set(protocolId, protocolData);
            await this.saveProtocolKnowledgeBase(protocolId, protocolData);
            
            this.logger.info(`✅ ${protocol.name} synchronized successfully`);
            
            return {
                repositories: protocolData.repositories.length,
                documents: protocolData.documentation.length,
                apis: protocolData.apis.length,
                examples: protocolData.examples.length,
                bestPractices: protocolData.bestPractices.length
            };
            
        } catch (error) {
            this.logger.error(`Failed to sync ${protocol.name}:`, error);
            throw error;
        }
    }

    /**
     * Analyze GitHub repository for protocol information
     */
    async analyzeGitHubRepository(githubApiUrl) {
        this.logger.debug(`📂 Analyzing repository: ${githubApiUrl}`);
        
        try {
            // Get repository information
            const repoResponse = await axios.get(githubApiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Nexus-AI-Framework'
                }
            });
            
            const repo = repoResponse.data;
            
            // Get repository contents
            const contentsResponse = await axios.get(`${githubApiUrl}/contents`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Nexus-AI-Framework'
                }
            });
            
            const contents = contentsResponse.data;
            
            // Find important files
            const importantFiles = contents.filter(file => 
                ['README.md', 'package.json', 'Cargo.toml', 'docs', 'examples'].some(important =>
                    file.name.toLowerCase().includes(important.toLowerCase())
                )
            );
            
            // Analyze package.json if available
            let packageJson = null;
            const packageFile = contents.find(file => file.name === 'package.json');
            if (packageFile) {
                try {
                    const packageResponse = await axios.get(packageFile.download_url);
                    packageJson = packageResponse.data;
                } catch (error) {
                    this.logger.warn('Failed to fetch package.json:', error.message);
                }
            }
            
            // Get README content
            let readmeContent = '';
            const readmeFile = contents.find(file => file.name.toLowerCase().includes('readme'));
            if (readmeFile) {
                try {
                    const readmeResponse = await axios.get(readmeFile.download_url);
                    readmeContent = readmeResponse.data;
                } catch (error) {
                    this.logger.warn('Failed to fetch README:', error.message);
                }
            }
            
            return {
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                language: repo.language,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                updatedAt: repo.updated_at,
                topics: repo.topics || [],
                packageJson,
                readmeContent,
                importantFiles: importantFiles.map(file => ({
                    name: file.name,
                    path: file.path,
                    type: file.type,
                    downloadUrl: file.download_url
                })),
                homepage: repo.homepage,
                cloneUrl: repo.clone_url
            };
            
        } catch (error) {
            this.logger.error('GitHub repository analysis failed:', error);
            throw error;
        }
    }

    /**
     * Fetch and analyze documentation
     */
    async fetchAndAnalyzeDocumentation(docsUrl) {
        this.logger.debug(`📖 Analyzing documentation: ${docsUrl}`);
        
        try {
            const analysis = await this.docAnalyzer.analyzeDocument({
                url: docsUrl,
                title: 'Protocol Documentation'
            });
            
            return {
                url: docsUrl,
                title: analysis?.title || 'Protocol Documentation',
                analysis: analysis?.analysis || {},
                extractedAt: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.warn('Documentation analysis failed:', error.message);
            return {
                url: docsUrl,
                title: 'Protocol Documentation',
                analysis: {},
                error: error.message,
                extractedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Analyze API endpoint for structure and capabilities
     */
    async analyzeApiEndpoint(apiUrl) {
        this.logger.debug(`🔌 Analyzing API: ${apiUrl}`);
        
        try {
            // Try to get API information
            const response = await axios.get(apiUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Nexus-AI-Framework'
                }
            });
            
            // Check if it's a JSON API
            const isJson = response.headers['content-type']?.includes('application/json');
            
            let endpoints = [];
            let schema = null;
            
            if (isJson) {
                // Try to discover endpoints
                if (response.data && typeof response.data === 'object') {
                    // Look for common API patterns
                    if (response.data.paths) {
                        // OpenAPI/Swagger format
                        endpoints = Object.keys(response.data.paths);
                        schema = 'openapi';
                    } else if (response.data.routes) {
                        // Custom routes format
                        endpoints = response.data.routes;
                        schema = 'custom';
                    } else {
                        // Analyze response structure
                        endpoints = Object.keys(response.data);
                        schema = 'inferred';
                    }
                }
            }
            
            return {
                url: apiUrl,
                status: response.status,
                contentType: response.headers['content-type'],
                isJson,
                endpoints,
                schema,
                responseStructure: isJson ? this.analyzeJsonStructure(response.data) : null,
                analyzedAt: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                url: apiUrl,
                status: error.response?.status || 'error',
                error: error.message,
                analyzedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Analyze JSON structure for API responses
     */
    analyzeJsonStructure(data, depth = 0, maxDepth = 3) {
        if (depth > maxDepth || !data || typeof data !== 'object') {
            return typeof data;
        }
        
        if (Array.isArray(data)) {
            return {
                type: 'array',
                items: data.length > 0 ? this.analyzeJsonStructure(data[0], depth + 1, maxDepth) : 'unknown'
            };
        }
        
        const structure = {};
        for (const [key, value] of Object.entries(data)) {
            structure[key] = this.analyzeJsonStructure(value, depth + 1, maxDepth);
        }
        
        return { type: 'object', properties: structure };
    }

    /**
     * Analyze dependencies from package.json
     */
    async analyzeDependencies(packageJson) {
        if (!packageJson || typeof packageJson !== 'object') {
            return [];
        }
        
        const dependencies = [
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {}),
            ...Object.keys(packageJson.peerDependencies || {})
        ];
        
        // Filter for Solana-related dependencies
        const solanaRelated = dependencies.filter(dep => 
            dep.includes('solana') || 
            dep.includes('@solana') ||
            dep.includes('anchor') ||
            dep.includes('metaplex') ||
            ['web3.js', '@project-serum/anchor', '@coral-xyz/anchor'].includes(dep)
        );
        
        return {
            total: dependencies.length,
            solanaRelated,
            frameworks: dependencies.filter(dep => 
                ['react', 'vue', 'angular', 'next', 'nuxt'].some(framework => dep.includes(framework))
            ),
            testing: dependencies.filter(dep =>
                ['jest', 'mocha', 'chai', 'cypress', 'playwright'].some(test => dep.includes(test))
            )
        };
    }

    /**
     * Extract code examples from protocol data
     */
    async extractCodeExamples(protocolData) {
        const examples = [];
        
        // Extract from README
        if (protocolData.repositories?.[0]?.readmeContent) {
            const readmeExamples = this.extractCodeFromMarkdown(protocolData.repositories[0].readmeContent);
            examples.push(...readmeExamples);
        }
        
        // Extract from documentation
        for (const doc of protocolData.documentation || []) {
            if (doc.analysis?.codeExamples) {
                examples.push(...doc.analysis.codeExamples);
            }
        }
        
        return examples.slice(0, 20); // Limit to 20 examples
    }

    /**
     * Extract code blocks from markdown content
     */
    extractCodeFromMarkdown(markdown) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
        const examples = [];
        let match;
        
        while ((match = codeBlockRegex.exec(markdown)) !== null) {
            const language = match[1] || 'text';
            const code = match[2];
            
            if (code.trim().length > 10) {
                examples.push({
                    language,
                    code: code.trim(),
                    source: 'readme'
                });
            }
        }
        
        return examples;
    }

    /**
     * Identify best practices from protocol data
     */
    async identifyBestPractices(protocolData) {
        const bestPractices = [];
        
        // Analyze from documentation
        for (const doc of protocolData.documentation || []) {
            if (doc.analysis?.bestPractices) {
                bestPractices.push(...doc.analysis.bestPractices);
            }
        }
        
        // Infer from code patterns
        const codePatterns = this.analyzeCodePatterns(protocolData.examples || []);
        bestPractices.push(...codePatterns);
        
        return bestPractices.slice(0, 15); // Limit to 15 best practices
    }

    /**
     * Analyze code patterns to infer best practices
     */
    analyzeCodePatterns(examples) {
        const patterns = [];
        
        for (const example of examples) {
            const code = example.code.toLowerCase();
            
            // Check for error handling patterns
            if (code.includes('try') && code.includes('catch')) {
                patterns.push({
                    practice: 'Error handling with try-catch blocks',
                    category: 'error-handling',
                    evidence: 'Found in code examples'
                });
            }
            
            // Check for async/await patterns
            if (code.includes('async') && code.includes('await')) {
                patterns.push({
                    practice: 'Asynchronous programming with async/await',
                    category: 'async-programming',
                    evidence: 'Found in code examples'
                });
            }
            
            // Check for Solana-specific patterns
            if (code.includes('connection') && code.includes('solana')) {
                patterns.push({
                    practice: 'Proper Solana connection management',
                    category: 'solana-integration',
                    evidence: 'Found in Solana connection code'
                });
            }
        }
        
        // Remove duplicates
        return patterns.filter((pattern, index, self) => 
            index === self.findIndex(p => p.practice === pattern.practice)
        );
    }

    /**
     * Index protocol knowledge in vector database
     */
    async indexProtocolKnowledge(protocolId, protocolData) {
        this.logger.debug(`🗂️ Indexing knowledge for ${protocolId}...`);
        
        const vectorStore = this.vectorStores.get(protocolId);
        if (!vectorStore) {
            throw new Error(`Vector store not found for protocol: ${protocolId}`);
        }
        
        const documents = [];
        
        // Index documentation
        for (const doc of protocolData.documentation || []) {
            if (doc.analysis?.mainConcepts) {
                documents.push({
                    id: `${protocolId}-doc-${Date.now()}`,
                    text: JSON.stringify(doc.analysis.mainConcepts),
                    metadata: {
                        type: 'documentation',
                        protocol: protocolId,
                        source: doc.url
                    }
                });
            }
        }
        
        // Index best practices
        for (const practice of protocolData.bestPractices || []) {
            documents.push({
                id: `${protocolId}-practice-${Date.now()}-${Math.random()}`,
                text: practice.practice || JSON.stringify(practice),
                metadata: {
                    type: 'best-practice',
                    protocol: protocolId,
                    category: practice.category
                }
            });
        }
        
        // Index code examples
        for (const example of protocolData.examples || []) {
            documents.push({
                id: `${protocolId}-example-${Date.now()}-${Math.random()}`,
                text: `${example.language}: ${example.code}`,
                metadata: {
                    type: 'code-example',
                    protocol: protocolId,
                    language: example.language
                }
            });
        }
        
        // Generate embeddings and store
        if (documents.length > 0) {
            const vectors = [];
            
            for (const doc of documents) {
                try {
                    const embedding = await this.embeddingGenerator.generate(doc.text);
                    vectors.push({
                        id: doc.id,
                        vector: embedding,
                        metadata: doc.metadata
                    });
                } catch (error) {
                    this.logger.warn(`Failed to generate embedding for ${doc.id}:`, error.message);
                }
            }
            
            if (vectors.length > 0) {
                await vectorStore.upsert(vectors);
                this.logger.debug(`Indexed ${vectors.length} documents for ${protocolId}`);
            }
        }
    }

    /**
     * Query the knowledge base
     */
    async query(question, options = {}) {
        const {
            protocols = Object.keys(this.protocols),
            limit = 10,
            threshold = 0.7
        } = options;
        
        this.logger.debug(`🔍 Querying knowledge base: "${question}"`);
        
        try {
            // Generate query embedding
            const queryEmbedding = await this.embeddingGenerator.generate(question);
            
            const allResults = [];
            
            // Search across all specified protocols
            for (const protocolId of protocols) {
                const vectorStore = this.vectorStores.get(protocolId);
                if (!vectorStore) continue;
                
                try {
                    const results = await vectorStore.query({
                        vector: queryEmbedding,
                        topK: limit,
                        includeMetadata: true
                    });
                    
                    // Add protocol info and filter by threshold
                    for (const result of results.matches || []) {
                        if (result.score >= threshold) {
                            allResults.push({
                                ...result,
                                protocol: protocolId,
                                protocolName: this.protocols[protocolId].name
                            });
                        }
                    }
                } catch (error) {
                    this.logger.warn(`Query failed for ${protocolId}:`, error.message);
                }
            }
            
            // Sort by relevance score
            allResults.sort((a, b) => b.score - a.score);
            
            return allResults.slice(0, limit);
            
        } catch (error) {
            this.logger.error('Knowledge base query failed:', error);
            throw error;
        }
    }

    /**
     * Save protocol knowledge base to disk
     */
    async saveProtocolKnowledgeBase(protocolId, protocolData) {
        const filePath = path.join('.nexus', 'knowledge-base', 'solana', `${protocolId}.json`);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeJson(filePath, protocolData, { spaces: 2 });
    }

    /**
     * Save consolidated knowledge base
     */
    async saveConsolidatedKnowledgeBase(syncResults) {
        const consolidated = {
            ecosystem: 'solana',
            lastSync: new Date().toISOString(),
            stats: this.stats,
            protocols: Object.keys(this.protocols),
            syncResults
        };
        
        const filePath = path.join('.nexus', 'knowledge-base', 'solana', 'ecosystem.json');
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeJson(filePath, consolidated, { spaces: 2 });
    }

    /**
     * Load existing knowledge bases
     */
    async loadExistingKnowledgeBases() {
        const kbPath = path.join('.nexus', 'knowledge-base', 'solana');
        
        if (await fs.pathExists(kbPath)) {
            const files = await fs.readdir(kbPath);
            
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'ecosystem.json') {
                    const protocolId = file.replace('.json', '');
                    try {
                        const data = await fs.readJson(path.join(kbPath, file));
                        this.knowledgeBases.set(protocolId, data);
                        this.logger.debug(`Loaded knowledge base for ${protocolId}`);
                    } catch (error) {
                        this.logger.warn(`Failed to load knowledge base for ${protocolId}:`, error.message);
                    }
                }
            }
        }
    }

    /**
     * Get ecosystem statistics
     */
    getStats() {
        return {
            ...this.stats,
            availableProtocols: Object.keys(this.protocols).length,
            loadedKnowledgeBases: this.knowledgeBases.size,
            vectorStores: this.vectorStores.size
        };
    }

    /**
     * List available protocols
     */
    listProtocols() {
        return Object.entries(this.protocols).map(([id, protocol]) => ({
            id,
            name: protocol.name,
            description: protocol.description,
            hasKnowledgeBase: this.knowledgeBases.has(id),
            hasVectorStore: this.vectorStores.has(id)
        }));
    }

    /**
     * Get protocol information
     */
    getProtocolInfo(protocolId) {
        const protocol = this.protocols[protocolId];
        const knowledgeBase = this.knowledgeBases.get(protocolId);
        
        if (!protocol) {
            throw new Error(`Unknown protocol: ${protocolId}`);
        }
        
        return {
            ...protocol,
            knowledgeBase: knowledgeBase ? {
                syncedAt: knowledgeBase.syncedAt,
                repositories: knowledgeBase.repositories?.length || 0,
                documentation: knowledgeBase.documentation?.length || 0,
                apis: knowledgeBase.apis?.length || 0,
                examples: knowledgeBase.examples?.length || 0,
                bestPractices: knowledgeBase.bestPractices?.length || 0
            } : null
        };
    }
}

module.exports = { SolanaEcosystemKnowledge };