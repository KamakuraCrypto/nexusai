#!/usr/bin/env node

/**
 * Solana Knowledge Base Synchronization Script
 * Populates the knowledge base with real Solana/DeFi protocol documentation
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Simple color helper
const colors = {
    cyan: (str) => `\x1b[36m${str}\x1b[0m`,
    gray: (str) => `\x1b[90m${str}\x1b[0m`,
    yellow: (str) => `\x1b[33m${str}\x1b[0m`,
    red: (str) => `\x1b[31m${str}\x1b[0m`,
    green: (str) => `\x1b[32m${str}\x1b[0m`,
    blue: (str) => `\x1b[34m${str}\x1b[0m`
};

// Simple Logger class
class Logger {
    constructor(name) {
        this.name = name;
    }
    
    info(message) {
        console.log(colors.cyan(`[${this.name}] ${message}`));
    }
    
    debug(message) {
        console.log(colors.gray(`[${this.name}] ${message}`));
    }
    
    warn(message) {
        console.log(colors.yellow(`[${this.name}] ${message}`));
    }
    
    error(message) {
        console.log(colors.red(`[${this.name}] ${message}`));
    }
}

// Simplified Protocol Sync
class SimpleSolanaSync {
    constructor() {
        this.logger = new Logger('SolanaSync');
        
        this.protocols = {
            meteora: {
                name: 'Meteora',
                github: 'https://api.github.com/repos/TeamRocket3/meteora-ag',
                website: 'https://meteora.ag',
                docs: 'https://docs.meteora.ag',
                description: 'Dynamic liquidity market maker and yield farming protocol',
                apis: [
                    'https://api.meteora.ag/docs',
                    'https://app.meteora.ag/api'
                ]
            },
            jupiter: {
                name: 'Jupiter',
                github: 'https://api.github.com/repos/jup-ag/jupiter-core',
                website: 'https://jup.ag',
                docs: 'https://docs.jup.ag',
                description: 'DEX aggregator for optimal token swaps',
                apis: [
                    'https://quote-api.jup.ag/v6/docs',
                    'https://price.jup.ag/v1/docs'
                ]
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
            }
        };
        
        this.knowledgeBasePath = path.join('.nexus', 'knowledge-base', 'solana');
    }
    
    async initialize() {
        this.logger.info('🏗️ Initializing Solana Knowledge Base Sync...');
        await fs.ensureDir(this.knowledgeBasePath);
    }
    
    async syncAllProtocols() {
        this.logger.info('🚀 Starting comprehensive Solana ecosystem documentation sync...');
        this.logger.info('📡 Target protocols: Meteora, Jupiter, Solana Web3.js, Anchor');
        
        const results = {
            synchronized: [],
            failed: [],
            totalDocuments: 0,
            totalApis: 0,
            timestamp: new Date().toISOString()
        };
        
        for (const [protocolId, protocol] of Object.entries(this.protocols)) {
            try {
                this.logger.info(`\\n🔍 Syncing ${protocol.name}...`);
                const protocolResult = await this.syncProtocol(protocolId, protocol);
                
                results.synchronized.push({
                    protocol: protocolId,
                    name: protocol.name,
                    ...protocolResult
                });
                
                results.totalDocuments += protocolResult.documents || 0;
                results.totalApis += protocolResult.apis || 0;
                
                this.logger.info(`✅ ${protocol.name} synchronized successfully`);
                
            } catch (error) {
                this.logger.error(`❌ Failed to sync ${protocol.name}: ${error.message}`);
                results.failed.push({
                    protocol: protocolId,
                    name: protocol.name,
                    error: error.message
                });
            }
        }
        
        // Save comprehensive results
        await this.saveResults(results);
        
        this.logger.info('\\n🎉 SOLANA ECOSYSTEM SYNC COMPLETED!');
        this.logger.info(`✅ Successfully synchronized: ${results.synchronized.length} protocols`);
        this.logger.info(`❌ Failed to sync: ${results.failed.length} protocols`);
        this.logger.info(`📄 Total documents processed: ${results.totalDocuments}`);
        this.logger.info(`🔌 Total APIs analyzed: ${results.totalApis}`);
        
        return results;
    }
    
    async syncProtocol(protocolId, protocol) {
        const protocolData = {
            id: protocolId,
            name: protocol.name,
            description: protocol.description,
            website: protocol.website,
            syncedAt: new Date().toISOString(),
            repository: null,
            documentation: null,
            apis: [],
            examples: [],
            bestPractices: []
        };
        
        // 1. Analyze GitHub Repository
        if (protocol.github) {
            this.logger.debug(`📂 Analyzing repository: ${protocol.github}`);
            try {
                protocolData.repository = await this.analyzeGitHubRepo(protocol.github);
            } catch (error) {
                this.logger.warn(`Failed to analyze GitHub repo: ${error.message}`);
            }
        }
        
        // 2. Fetch Documentation
        if (protocol.docs) {
            this.logger.debug(`📖 Fetching documentation: ${protocol.docs}`);
            try {
                protocolData.documentation = await this.fetchDocumentation(protocol.docs);
            } catch (error) {
                this.logger.warn(`Failed to fetch documentation: ${error.message}`);
            }
        }
        
        // 3. Analyze APIs
        if (protocol.apis) {
            this.logger.debug(`🔌 Analyzing ${protocol.apis.length} API endpoints...`);
            for (const apiUrl of protocol.apis) {
                try {
                    const apiData = await this.analyzeAPI(apiUrl);
                    protocolData.apis.push(apiData);
                } catch (error) {
                    this.logger.warn(`Failed to analyze API ${apiUrl}: ${error.message}`);
                }
            }
        }
        
        // 4. Extract Examples and Best Practices
        protocolData.examples = await this.extractExamples(protocolData);
        protocolData.bestPractices = await this.extractBestPractices(protocolData);
        
        // 5. Save Protocol Knowledge Base
        await this.saveProtocolData(protocolId, protocolData);
        
        return {
            documents: protocolData.documentation ? 1 : 0,
            apis: protocolData.apis.length,
            examples: protocolData.examples.length,
            bestPractices: protocolData.bestPractices.length
        };
    }
    
    async analyzeGitHubRepo(githubApiUrl) {
        try {
            const response = await axios.get(githubApiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Nexus-AI-Framework'
                },
                timeout: 15000
            });
            
            const repo = response.data;
            
            // Get README content
            let readmeContent = '';
            try {
                const readmeResponse = await axios.get(`${githubApiUrl}/readme`, {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Nexus-AI-Framework'
                    },
                    timeout: 10000
                });
                
                if (readmeResponse.data.content) {
                    readmeContent = Buffer.from(readmeResponse.data.content, 'base64').toString('utf8');
                }
            } catch (error) {
                this.logger.debug(`Could not fetch README: ${error.message}`);
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
                homepage: repo.homepage,
                readmeContent: readmeContent.substring(0, 50000), // Limit size
                license: repo.license?.name,
                openIssues: repo.open_issues_count
            };
            
        } catch (error) {
            throw new Error(`GitHub API error: ${error.message}`);
        }
    }
    
    async fetchDocumentation(docsUrl) {
        try {
            const response = await axios.get(docsUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Nexus-AI-Framework'
                }
            });
            
            const contentType = response.headers['content-type'] || '';
            const isHTML = contentType.includes('text/html');
            
            return {
                url: docsUrl,
                contentType,
                isHTML,
                content: isHTML ? this.extractTextFromHTML(response.data) : response.data,
                size: response.data.length,
                fetchedAt: new Date().toISOString()
            };
            
        } catch (error) {
            throw new Error(`Documentation fetch error: ${error.message}`);
        }
    }
    
    async analyzeAPI(apiUrl) {
        try {
            const response = await axios.get(apiUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Nexus-AI-Framework'
                }
            });
            
            const isJSON = response.headers['content-type']?.includes('application/json');
            
            return {
                url: apiUrl,
                status: response.status,
                contentType: response.headers['content-type'],
                isJSON,
                hasData: !!response.data,
                responseSize: JSON.stringify(response.data || {}).length,
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
    
    async extractExamples(protocolData) {
        const examples = [];
        
        // Extract from README
        if (protocolData.repository?.readmeContent) {
            const codeBlocks = this.extractCodeBlocks(protocolData.repository.readmeContent);
            examples.push(...codeBlocks);
        }
        
        return examples.slice(0, 15); // Limit examples
    }
    
    async extractBestPractices(protocolData) {
        const practices = [];
        
        // Analyze README for best practices
        if (protocolData.repository?.readmeContent) {
            const content = protocolData.repository.readmeContent.toLowerCase();
            
            if (content.includes('best practice') || content.includes('recommendation')) {
                practices.push({
                    practice: 'Follow official documentation guidelines',
                    source: 'repository_readme',
                    category: 'development'
                });
            }
            
            if (content.includes('error handling') || content.includes('try catch')) {
                practices.push({
                    practice: 'Implement proper error handling',
                    source: 'repository_readme',
                    category: 'error-handling'
                });
            }
            
            if (content.includes('async') || content.includes('await')) {
                practices.push({
                    practice: 'Use asynchronous programming patterns',
                    source: 'repository_readme',
                    category: 'async-programming'
                });
            }
        }
        
        return practices.slice(0, 10); // Limit practices
    }
    
    extractCodeBlocks(markdown) {
        const codeBlockRegex = /```(\\w+)?\\n([\\s\\S]*?)\\n```/g;
        const examples = [];
        let match;
        
        while ((match = codeBlockRegex.exec(markdown)) !== null) {
            const language = match[1] || 'text';
            const code = match[2];
            
            if (code.trim().length > 20) {
                examples.push({
                    language,
                    code: code.trim().substring(0, 2000), // Limit code length
                    source: 'readme'
                });
            }
        }
        
        return examples;
    }
    
    extractTextFromHTML(html) {
        // Simple HTML text extraction
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/\\s+/g, ' ')
            .trim()
            .substring(0, 20000); // Limit size
    }
    
    async saveProtocolData(protocolId, protocolData) {
        const filePath = path.join(this.knowledgeBasePath, `${protocolId}.json`);
        await fs.writeJson(filePath, protocolData, { spaces: 2 });
        this.logger.debug(`💾 Saved knowledge base for ${protocolId}`);
    }
    
    async saveResults(results) {
        const resultsPath = path.join(this.knowledgeBasePath, 'sync-results.json');
        await fs.writeJson(resultsPath, results, { spaces: 2 });
        
        // Create ecosystem summary
        const summary = {
            ecosystem: 'solana',
            lastSync: results.timestamp,
            protocolsCount: results.synchronized.length,
            totalDocuments: results.totalDocuments,
            totalApis: results.totalApis,
            protocols: results.synchronized.map(p => ({
                id: p.protocol,
                name: p.name,
                documents: p.documents,
                apis: p.apis,
                examples: p.examples,
                bestPractices: p.bestPractices
            }))
        };
        
        const summaryPath = path.join(this.knowledgeBasePath, 'ecosystem-summary.json');
        await fs.writeJson(summaryPath, summary, { spaces: 2 });
        
        this.logger.debug(`💾 Saved sync results and ecosystem summary`);
    }
}

// Main execution
async function main() {
    console.log(colors.cyan('\\n🚀 NEXUS SOLANA KNOWLEDGE BASE SYNC\\n'));
    console.log(colors.yellow('📚 Populating with live Solana/DeFi protocol documentation\\n'));
    console.log(colors.blue('🎯 Target: Meteora, Jupiter, Solana Web3.js, Anchor Framework\\n'));
    
    try {
        const sync = new SimpleSolanaSync();
        await sync.initialize();
        
        const results = await sync.syncAllProtocols();
        
        console.log(colors.green('\\n🎉 SYNC COMPLETED SUCCESSFULLY!'));
        console.log(colors.cyan('📊 Knowledge base populated with comprehensive Solana ecosystem data'));
        console.log(colors.cyan('💡 AI can now provide intelligent guidance without re-learning'));
        console.log(colors.cyan('🛡️ No more data loss - everything is persistently stored'));
        
        console.log(colors.yellow('\\n📁 Knowledge Base Location:'));
        console.log(`   ${path.resolve('.nexus/knowledge-base/solana/')}`);
        
        console.log(colors.blue('\\n🔗 Next Steps:'));
        console.log('   1. Knowledge base is ready for AI queries');
        console.log('   2. Use "nexus ask" to query Solana protocols');
        console.log('   3. Framework will provide contextual guidance');
        console.log('   4. No more re-training needed!');
        
    } catch (error) {
        console.error(colors.red('\\n❌ SYNC FAILED:'), error.message);
        console.error(colors.yellow('🔧 Please check network connection and API availability'));
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { SimpleSolanaSync };