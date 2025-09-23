/**
 * Configuration Manager
 * Handles all configuration settings for the Nexus AI Framework
 * Supports environment variables, config files, and runtime updates
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { Logger } = require('../utils/logger');

class ConfigManager {
    constructor(configPath = null) {
        this.logger = new Logger('ConfigManager');
        this.configPath = configPath || this.findConfigFile();
        this.config = {};
        this.defaults = this.getDefaults();
        this.watchers = new Map();
        this.listeners = new Map();
    }

    /**
     * Load configuration from file and environment
     */
    async load() {
        this.logger.info('Loading configuration...');
        
        try {
            // Start with defaults
            this.config = { ...this.defaults };
            
            // Load from config file if exists
            if (this.configPath && await fs.pathExists(this.configPath)) {
                const fileConfig = await this.loadConfigFile(this.configPath);
                this.config = this.mergeConfig(this.config, fileConfig);
                this.logger.info(`Configuration loaded from: ${this.configPath}`);
            }
            
            // Override with environment variables
            this.loadEnvironmentVariables();
            
            // Validate configuration
            this.validateConfig();
            
            this.logger.info('Configuration loaded successfully');
            
        } catch (error) {
            this.logger.error('Failed to load configuration:', error);
            throw error;
        }
    }

    /**
     * Get default configuration
     */
    getDefaults() {
        return {
            // Core framework settings
            framework: {
                name: 'Nexus AI Framework',
                version: '1.0.0-beta',
                logLevel: 'info',
                maxConcurrency: 5,
                timeout: 30000
            },
            
            // AI Provider configurations
            providers: {
                claude: {
                    enabled: true,
                    model: 'claude-3-5-sonnet-20241022',
                    apiKey: process.env.ANTHROPIC_API_KEY,
                    maxTokens: 200000,
                    temperature: 0.7
                },
                gpt: {
                    enabled: true,
                    model: 'gpt-4-turbo',
                    apiKey: process.env.OPENAI_API_KEY,
                    organization: process.env.OPENAI_ORG_ID,
                    maxTokens: 128000,
                    temperature: 0.7
                },
                gemini: {
                    enabled: false,
                    model: 'gemini-pro',
                    apiKey: process.env.GOOGLE_API_KEY,
                    maxTokens: 32000,
                    temperature: 0.7
                },
                grok: {
                    enabled: false,
                    model: 'grok-3',
                    apiKey: process.env.GROK_API_KEY,
                    maxTokens: 16000,
                    temperature: 0.7
                }
            },
            
            // Memory system configuration
            memory: {
                enabled: true,
                provider: 'pinecone', // 'pinecone', 'milvus', 'local'
                apiKey: process.env.PINECONE_API_KEY,
                environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp',
                indexName: 'nexus-memory',
                dimensions: 1536,
                maxContextSize: 10000,
                compressionRatio: 0.7
            },
            
            // Knowledge base configuration
            knowledgeBase: {
                enabled: true,
                ecosystems: ['solana', 'web3', 'ai-frameworks'],
                updateFrequency: 'daily',
                maxDocuments: 10000,
                similarity_threshold: 0.8,
                storage: {
                    provider: 'local', // 'local', 's3', 'gcs'
                    path: '.nexus/knowledge-base'
                }
            },
            
            // Git integration settings
            git: {
                enabled: true,
                autoCommit: true,
                branchPrefix: 'nexus/',
                commitMessageTemplate: '[NEXUS] {action}: {description}',
                maxStateSnapshots: 50,
                stateTrackingEnabled: true
            },
            
            // MCP Server configuration
            mcp: {
                enabled: true,
                port: 3000,
                host: 'localhost',
                maxConnections: 10,
                protocols: ['websocket', 'http'],
                authentication: {
                    enabled: false,
                    type: 'apikey'
                }
            },
            
            // Performance and optimization
            performance: {
                tokenOptimization: true,
                costOptimization: true,
                caching: {
                    enabled: true,
                    provider: 'redis', // 'redis', 'memory', 'file'
                    ttl: 3600,
                    maxSize: '100mb'
                },
                rateLimit: {
                    enabled: true,
                    requestsPerMinute: 60,
                    burstSize: 10
                }
            },
            
            // Security settings
            security: {
                encryption: {
                    enabled: true,
                    algorithm: 'aes-256-gcm'
                },
                secrets: {
                    provider: 'env', // 'env', 'vault', 'aws-secrets'
                    rotation: false
                },
                audit: {
                    enabled: true,
                    logLevel: 'info'
                }
            },
            
            // Workspace settings
            workspace: {
                defaultPath: process.cwd(),
                templatePath: '.nexus/templates',
                backupPath: '.nexus/backups',
                maxBackups: 10
            }
        };
    }

    /**
     * Find configuration file
     */
    findConfigFile() {
        const possiblePaths = [
            '.nexus/config.yaml',
            '.nexus/config.yml',
            '.nexus/config.json',
            'nexus.config.yaml',
            'nexus.config.yml',
            'nexus.config.json'
        ];

        for (const configPath of possiblePaths) {
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }

        return null;
    }

    /**
     * Load configuration from file
     */
    async loadConfigFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const content = await fs.readFile(filePath, 'utf8');

        switch (ext) {
            case '.yaml':
            case '.yml':
                return yaml.load(content);
            case '.json':
                return JSON.parse(content);
            default:
                throw new Error(`Unsupported config file format: ${ext}`);
        }
    }

    /**
     * Load environment variables
     */
    loadEnvironmentVariables() {
        const envMappings = {
            'NEXUS_LOG_LEVEL': 'framework.logLevel',
            'NEXUS_MAX_CONCURRENCY': 'framework.maxConcurrency',
            'NEXUS_TIMEOUT': 'framework.timeout',
            
            'ANTHROPIC_API_KEY': 'providers.claude.apiKey',
            'CLAUDE_MODEL': 'providers.claude.model',
            'OPENAI_API_KEY': 'providers.gpt.apiKey',
            'OPENAI_MODEL': 'providers.gpt.model',
            'OPENAI_ORG_ID': 'providers.gpt.organization',
            
            'PINECONE_API_KEY': 'memory.apiKey',
            'PINECONE_ENVIRONMENT': 'memory.environment',
            'PINECONE_INDEX_NAME': 'memory.indexName',
            
            'NEXUS_MCP_PORT': 'mcp.port',
            'NEXUS_MCP_HOST': 'mcp.host',
            
            'REDIS_URL': 'performance.caching.url',
            'NEXUS_WORKSPACE': 'workspace.defaultPath'
        };

        Object.entries(envMappings).forEach(([envVar, configPath]) => {
            const value = process.env[envVar];
            if (value !== undefined) {
                this.setNestedValue(this.config, configPath, this.parseValue(value));
            }
        });
    }

    /**
     * Parse environment variable value
     */
    parseValue(value) {
        // Try to parse as number
        if (!isNaN(value) && !isNaN(parseFloat(value))) {
            return parseFloat(value);
        }
        
        // Try to parse as boolean
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        
        // Return as string
        return value;
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        const required = [
            'framework.name',
            'framework.version'
        ];

        const errors = [];

        required.forEach(path => {
            if (!this.get(path)) {
                errors.push(`Missing required configuration: ${path}`);
            }
        });

        // Validate provider configurations
        Object.entries(this.config.providers).forEach(([name, provider]) => {
            if (provider.enabled && !provider.apiKey) {
                this.logger.warn(`Provider ${name} is enabled but missing API key`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }

    /**
     * Get configuration value
     */
    get(path, defaultValue = undefined) {
        return this.getNestedValue(this.config, path, defaultValue);
    }

    /**
     * Set configuration value
     */
    set(path, value) {
        this.setNestedValue(this.config, path, value);
        this.notifyListeners(path, value);
    }

    /**
     * Get nested value using dot notation
     */
    getNestedValue(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }

        return current;
    }

    /**
     * Set nested value using dot notation
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;

        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[lastKey] = value;
    }

    /**
     * Merge configuration objects
     */
    mergeConfig(target, source) {
        const result = { ...target };

        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.mergeConfig(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        });

        return result;
    }

    /**
     * Save configuration to file
     */
    async save(filePath = null) {
        const targetPath = filePath || this.configPath || '.nexus/config.yaml';
        
        try {
            await fs.ensureDir(path.dirname(targetPath));
            
            const ext = path.extname(targetPath).toLowerCase();
            let content;

            switch (ext) {
                case '.yaml':
                case '.yml':
                    content = yaml.dump(this.config, { indent: 2 });
                    break;
                case '.json':
                    content = JSON.stringify(this.config, null, 2);
                    break;
                default:
                    throw new Error(`Unsupported config file format: ${ext}`);
            }

            await fs.writeFile(targetPath, content, 'utf8');
            this.logger.info(`Configuration saved to: ${targetPath}`);
            
        } catch (error) {
            this.logger.error('Failed to save configuration:', error);
            throw error;
        }
    }

    /**
     * Watch for configuration changes
     */
    watch(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        this.listeners.get(path).add(callback);
    }

    /**
     * Stop watching configuration changes
     */
    unwatch(path, callback) {
        if (this.listeners.has(path)) {
            this.listeners.get(path).delete(callback);
        }
    }

    /**
     * Notify listeners of configuration changes
     */
    notifyListeners(path, value) {
        if (this.listeners.has(path)) {
            this.listeners.get(path).forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    this.logger.error(`Configuration listener error for ${path}:`, error);
                }
            });
        }
    }

    /**
     * Get all configuration
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.config = { ...this.defaults };
        this.logger.info('Configuration reset to defaults');
    }

    /**
     * Get configuration schema
     */
    getSchema() {
        return {
            framework: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    version: { type: 'string' },
                    logLevel: { type: 'string', enum: ['error', 'warn', 'info', 'debug', 'verbose', 'trace'] },
                    maxConcurrency: { type: 'number', minimum: 1 },
                    timeout: { type: 'number', minimum: 1000 }
                }
            },
            providers: {
                type: 'object',
                additionalProperties: {
                    type: 'object',
                    properties: {
                        enabled: { type: 'boolean' },
                        model: { type: 'string' },
                        apiKey: { type: 'string' },
                        maxTokens: { type: 'number', minimum: 1 },
                        temperature: { type: 'number', minimum: 0, maximum: 2 }
                    }
                }
            }
        };
    }

    /**
     * Export configuration for backup
     */
    export() {
        return {
            timestamp: new Date().toISOString(),
            version: this.config.framework.version,
            config: this.config
        };
    }

    /**
     * Import configuration from backup
     */
    import(backup) {
        if (backup.config) {
            this.config = this.mergeConfig(this.defaults, backup.config);
            this.validateConfig();
            this.logger.info(`Configuration imported from backup (${backup.timestamp})`);
        }
    }
}

module.exports = { ConfigManager };