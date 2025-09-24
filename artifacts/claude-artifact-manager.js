/**
 * Claude Artifact Manager
 * Manages all code artifacts created by Claude
 * Provides versioning, relationships, and quick retrieval
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class ClaudeArtifactManager {
    constructor(contextManager, sessionManager) {
        this.contextManager = contextManager;
        this.sessionManager = sessionManager;
        this.logger = new Logger('ClaudeArtifactManager');
        
        // Artifact configuration
        this.config = {
            maxArtifacts: 1000,
            maxVersions: 10,
            storagePath: path.join(process.cwd(), '.nexus', 'claude', 'artifacts'),
            indexPath: path.join(process.cwd(), '.nexus', 'claude', 'artifact-index.json'),
            templatePath: path.join(process.cwd(), '.nexus', 'claude', 'artifact-templates'),
            supportedLanguages: [
                'javascript', 'typescript', 'jsx', 'tsx',
                'python', 'java', 'csharp', 'go', 'rust',
                'html', 'css', 'scss', 'json', 'yaml',
                'sql', 'graphql', 'markdown'
            ],
            autoExtractPatterns: true,
            autoVersioning: true,
            autoRelationships: true
        };
        
        // Artifact storage
        this.artifacts = new Map();
        this.artifactIndex = new Map();
        this.templates = new Map();
        this.relationships = new Map();
        
        // Metrics
        this.metrics = {
            totalArtifacts: 0,
            totalVersions: 0,
            languageDistribution: {},
            averageSize: 0
        };
    }
    
    /**
     * Initialize artifact manager
     */
    async initialize() {
        this.logger.info('🎨 Initializing Claude Artifact Manager...');
        
        try {
            await fs.ensureDir(this.config.storagePath);
            await fs.ensureDir(this.config.templatePath);
            
            // Load artifact index
            await this.loadArtifactIndex();
            
            // Load templates
            await this.loadTemplates();
            
            this.logger.info('✅ Artifact Manager initialized');
            this.logger.info(`📊 Managing ${this.artifacts.size} artifacts`);
            
        } catch (error) {
            this.logger.error('Failed to initialize artifact manager:', error);
            throw error;
        }
    }
    
    /**
     * Create new artifact
     */
    async createArtifact(content, options = {}) {
        const {
            id = this.generateArtifactId(),
            language = this.detectLanguage(content),
            purpose = null,
            tags = [],
            metadata = {}
        } = options;
        
        this.logger.info(`🎨 Creating artifact: ${id} (${language})`);
        
        // Create artifact object
        const artifact = {
            id,
            language,
            purpose,
            tags,
            content,
            metadata: {
                ...metadata,
                sessionId: this.sessionManager?.currentSession?.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            versions: [],
            currentVersion: 1,
            size: Buffer.byteLength(content),
            lines: content.split('\n').length,
            hash: this.calculateHash(content),
            relationships: {
                dependencies: [],
                dependents: [],
                related: []
            },
            patterns: this.config.autoExtractPatterns ? 
                await this.extractPatterns(content, language) : {},
            usage: {
                accessCount: 0,
                lastAccessed: null,
                executionCount: 0,
                lastExecuted: null
            }
        };
        
        // Store first version
        if (this.config.autoVersioning) {
            artifact.versions.push({
                version: 1,
                content,
                hash: artifact.hash,
                timestamp: artifact.metadata.createdAt,
                changelog: 'Initial version'
            });
        }
        
        // Store artifact
        this.artifacts.set(id, artifact);
        
        // Update index
        await this.updateArtifactIndex(id, artifact);
        
        // Save to disk
        await this.saveArtifact(id, artifact);
        
        // Track in context manager
        if (this.contextManager) {
            this.contextManager.trackArtifact(id, content, {
                language,
                purpose
            });
        }
        
        // Auto-detect relationships
        if (this.config.autoRelationships) {
            await this.detectRelationships(id, content);
        }
        
        // Extract template if applicable
        await this.extractTemplate(id, artifact);
        
        // Update metrics
        this.updateMetrics('create', artifact);
        
        return {
            id,
            artifact
        };
    }
    
    /**
     * Update existing artifact
     */
    async updateArtifact(id, newContent, options = {}) {
        const artifact = this.artifacts.get(id);
        
        if (!artifact) {
            throw new Error(`Artifact not found: ${id}`);
        }
        
        const {
            changelog = 'Updated',
            metadata = {}
        } = options;
        
        this.logger.info(`📝 Updating artifact: ${id}`);
        
        // Check if content actually changed
        const newHash = this.calculateHash(newContent);
        if (newHash === artifact.hash) {
            this.logger.debug('Content unchanged, skipping update');
            return { id, artifact, changed: false };
        }
        
        // Store previous version
        if (this.config.autoVersioning) {
            // Keep only last N versions
            if (artifact.versions.length >= this.config.maxVersions) {
                artifact.versions.shift();
            }
            
            artifact.versions.push({
                version: artifact.currentVersion,
                content: artifact.content,
                hash: artifact.hash,
                timestamp: artifact.metadata.updatedAt,
                changelog: 'Previous version'
            });
            
            artifact.currentVersion++;
        }
        
        // Update artifact
        artifact.content = newContent;
        artifact.hash = newHash;
        artifact.size = Buffer.byteLength(newContent);
        artifact.lines = newContent.split('\n').length;
        artifact.metadata.updatedAt = new Date().toISOString();
        Object.assign(artifact.metadata, metadata);
        
        // Add new version
        if (this.config.autoVersioning) {
            artifact.versions.push({
                version: artifact.currentVersion,
                content: newContent,
                hash: newHash,
                timestamp: artifact.metadata.updatedAt,
                changelog
            });
        }
        
        // Re-extract patterns
        if (this.config.autoExtractPatterns) {
            artifact.patterns = await this.extractPatterns(newContent, artifact.language);
        }
        
        // Update relationships
        if (this.config.autoRelationships) {
            await this.detectRelationships(id, newContent);
        }
        
        // Save to disk
        await this.saveArtifact(id, artifact);
        
        // Update index
        await this.updateArtifactIndex(id, artifact);
        
        // Update metrics
        this.updateMetrics('update', artifact);
        
        return {
            id,
            artifact,
            changed: true,
            previousVersion: artifact.currentVersion - 1
        };
    }
    
    /**
     * Get artifact by ID
     */
    async getArtifact(id, version = null) {
        let artifact = this.artifacts.get(id);
        
        if (!artifact) {
            // Try to load from disk
            artifact = await this.loadArtifact(id);
            if (!artifact) {
                return null;
            }
        }
        
        // Track access
        artifact.usage.accessCount++;
        artifact.usage.lastAccessed = new Date().toISOString();
        
        // Return specific version if requested
        if (version !== null && artifact.versions) {
            const versionData = artifact.versions.find(v => v.version === version);
            if (versionData) {
                return {
                    ...artifact,
                    content: versionData.content,
                    hash: versionData.hash,
                    requestedVersion: version
                };
            }
        }
        
        return artifact;
    }
    
    /**
     * Search artifacts
     */
    async searchArtifacts(query, options = {}) {
        const {
            language = null,
            tags = [],
            purpose = null,
            sessionId = null,
            limit = 20
        } = options;
        
        const results = [];
        
        for (const [id, artifact] of this.artifacts) {
            let match = true;
            
            // Filter by language
            if (language && artifact.language !== language) {
                match = false;
            }
            
            // Filter by tags
            if (tags.length > 0 && !tags.some(tag => artifact.tags.includes(tag))) {
                match = false;
            }
            
            // Filter by purpose
            if (purpose && !artifact.purpose?.includes(purpose)) {
                match = false;
            }
            
            // Filter by session
            if (sessionId && artifact.metadata.sessionId !== sessionId) {
                match = false;
            }
            
            // Search in content
            if (query && !artifact.content.toLowerCase().includes(query.toLowerCase())) {
                match = false;
            }
            
            if (match) {
                results.push({
                    id,
                    language: artifact.language,
                    purpose: artifact.purpose,
                    preview: artifact.content.substring(0, 200),
                    createdAt: artifact.metadata.createdAt,
                    score: this.calculateSearchScore(artifact, query)
                });
            }
        }
        
        // Sort by score and limit
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    
    /**
     * Get artifact relationships
     */
    getRelationships(id) {
        const artifact = this.artifacts.get(id);
        if (!artifact) return null;
        
        return {
            ...artifact.relationships,
            graph: this.buildRelationshipGraph(id)
        };
    }
    
    /**
     * Extract patterns from templates
     */
    async extractTemplate(id, artifact) {
        if (!artifact.purpose || artifact.purpose === 'general') {
            return;
        }
        
        // Common template patterns
        const templatePatterns = {
            'react-component': /function\s+(\w+)|const\s+(\w+)\s*=.*=>/,
            'express-route': /router\.(get|post|put|delete)\(/,
            'database-model': /class\s+\w+Model|schema\./,
            'test-suite': /describe\(|test\(|it\(/,
            'configuration': /module\.exports|export\s+default/
        };
        
        for (const [templateType, pattern] of Object.entries(templatePatterns)) {
            if (pattern.test(artifact.content)) {
                const template = {
                    id: `template-${templateType}-${Date.now()}`,
                    type: templateType,
                    source: id,
                    pattern: this.extractTemplatePattern(artifact.content, templateType),
                    language: artifact.language,
                    createdAt: new Date().toISOString()
                };
                
                this.templates.set(template.id, template);
                
                // Save template
                await this.saveTemplate(template);
                
                this.logger.debug(`📋 Extracted template: ${templateType}`);
                
                break;
            }
        }
    }
    
    /**
     * Generate artifact from template
     */
    async generateFromTemplate(templateId, variables = {}) {
        const template = this.templates.get(templateId);
        
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        
        // Replace variables in template
        let content = template.pattern;
        
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            content = content.replace(regex, value);
        }
        
        // Create new artifact from template
        return await this.createArtifact(content, {
            language: template.language,
            purpose: `Generated from ${template.type}`,
            tags: ['template-generated'],
            metadata: {
                templateId,
                templateType: template.type
            }
        });
    }
    
    /**
     * Export artifact
     */
    async exportArtifact(id, options = {}) {
        const {
            format = 'file',  // 'file', 'clipboard', 'gist'
            includeVersions = false,
            outputPath = null
        } = options;
        
        const artifact = await this.getArtifact(id);
        if (!artifact) {
            throw new Error(`Artifact not found: ${id}`);
        }
        
        switch (format) {
            case 'file': {
                const extension = this.getFileExtension(artifact.language);
                const fileName = `${id}.${extension}`;
                const filePath = outputPath || path.join(process.cwd(), fileName);
                
                await fs.writeFile(filePath, artifact.content);
                
                if (includeVersions && artifact.versions.length > 0) {
                    const versionsPath = path.join(path.dirname(filePath), `${id}-versions`);
                    await fs.ensureDir(versionsPath);
                    
                    for (const version of artifact.versions) {
                        const versionFile = path.join(versionsPath, `v${version.version}.${extension}`);
                        await fs.writeFile(versionFile, version.content);
                    }
                }
                
                this.logger.info(`📤 Exported artifact to: ${filePath}`);
                return { path: filePath };
            }
            
            case 'clipboard': {
                // Return content for clipboard
                return { content: artifact.content };
            }
            
            case 'gist': {
                // Would integrate with GitHub Gist API
                return { url: 'https://gist.github.com/...' };
            }
            
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    /**
     * Get artifact statistics
     */
    getStatistics() {
        const stats = {
            ...this.metrics,
            artifacts: this.artifacts.size,
            templates: this.templates.size,
            totalSize: 0,
            averageVersions: 0,
            mostUsedLanguage: null,
            recentArtifacts: []
        };
        
        // Calculate totals
        let totalVersions = 0;
        const languageCounts = {};
        
        for (const artifact of this.artifacts.values()) {
            stats.totalSize += artifact.size;
            totalVersions += artifact.versions.length;
            
            languageCounts[artifact.language] = (languageCounts[artifact.language] || 0) + 1;
        }
        
        // Calculate averages
        if (this.artifacts.size > 0) {
            stats.averageSize = Math.round(stats.totalSize / this.artifacts.size);
            stats.averageVersions = (totalVersions / this.artifacts.size).toFixed(1);
        }
        
        // Find most used language
        if (Object.keys(languageCounts).length > 0) {
            stats.mostUsedLanguage = Object.entries(languageCounts)
                .sort((a, b) => b[1] - a[1])[0][0];
        }
        
        // Get recent artifacts
        stats.recentArtifacts = Array.from(this.artifacts.values())
            .sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt))
            .slice(0, 5)
            .map(a => ({
                id: a.id,
                language: a.language,
                createdAt: a.metadata.createdAt
            }));
        
        return stats;
    }
    
    // Private methods
    
    /**
     * Generate artifact ID
     */
    generateArtifactId() {
        return `artifact-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Detect language from content
     */
    detectLanguage(content) {
        // Simple language detection based on patterns
        const patterns = {
            javascript: /(?:function|const|let|var|=>\s|console\.log)/,
            typescript: /(?:interface|type\s+\w+\s*=|:\s*string|:\s*number)/,
            python: /(?:def\s+|import\s+|print\(|if\s+__name__)/,
            java: /(?:public\s+class|private\s+|void\s+|System\.out)/,
            html: /(?:<html|<div|<span|<body|<head)/i,
            css: /(?:\.[\w-]+\s*{|#[\w-]+\s*{|@media|:hover)/,
            sql: /(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\s+/i,
            json: /^\s*{[\s\S]*}\s*$/,
            markdown: /(?:^#{1,6}\s+|^\*\s+|^\d+\.\s+|\[.*\]\(.*\))/m
        };
        
        for (const [language, pattern] of Object.entries(patterns)) {
            if (pattern.test(content)) {
                return language;
            }
        }
        
        return 'plaintext';
    }
    
    /**
     * Calculate hash
     */
    calculateHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    /**
     * Extract patterns from content
     */
    async extractPatterns(content, language) {
        const patterns = {
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            variables: [],
            apis: []
        };
        
        switch (language) {
            case 'javascript':
            case 'typescript': {
                // Extract imports
                const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    patterns.imports.push(match[1]);
                }
                
                // Extract exports
                const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
                while ((match = exportRegex.exec(content)) !== null) {
                    patterns.exports.push(match[1]);
                }
                
                // Extract functions
                const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
                while ((match = functionRegex.exec(content)) !== null) {
                    patterns.functions.push(match[1] || match[2]);
                }
                
                // Extract classes
                const classRegex = /class\s+(\w+)/g;
                while ((match = classRegex.exec(content)) !== null) {
                    patterns.classes.push(match[1]);
                }
                
                break;
            }
            
            case 'python': {
                // Extract imports
                const importRegex = /(?:from\s+(\S+)\s+)?import\s+(\S+)/g;
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    patterns.imports.push(match[1] || match[2]);
                }
                
                // Extract functions
                const functionRegex = /def\s+(\w+)\s*\(/g;
                while ((match = functionRegex.exec(content)) !== null) {
                    patterns.functions.push(match[1]);
                }
                
                // Extract classes
                const classRegex = /class\s+(\w+)/g;
                while ((match = classRegex.exec(content)) !== null) {
                    patterns.classes.push(match[1]);
                }
                
                break;
            }
        }
        
        return patterns;
    }
    
    /**
     * Detect relationships between artifacts
     */
    async detectRelationships(id, content) {
        const artifact = this.artifacts.get(id);
        if (!artifact) return;
        
        // Look for references to other artifacts
        for (const [otherId, otherArtifact] of this.artifacts) {
            if (otherId === id) continue;
            
            // Check if content references other artifact's exports
            if (otherArtifact.patterns?.exports) {
                for (const exportName of otherArtifact.patterns.exports) {
                    if (content.includes(exportName)) {
                        // Add dependency relationship
                        if (!artifact.relationships.dependencies.includes(otherId)) {
                            artifact.relationships.dependencies.push(otherId);
                        }
                        
                        // Add dependent relationship to other artifact
                        if (!otherArtifact.relationships.dependents.includes(id)) {
                            otherArtifact.relationships.dependents.push(id);
                        }
                    }
                }
            }
            
            // Check for similar patterns (related artifacts)
            const similarity = this.calculateSimilarity(artifact, otherArtifact);
            if (similarity > 0.7) {
                if (!artifact.relationships.related.includes(otherId)) {
                    artifact.relationships.related.push(otherId);
                }
            }
        }
    }
    
    /**
     * Calculate similarity between artifacts
     */
    calculateSimilarity(artifact1, artifact2) {
        if (artifact1.language !== artifact2.language) {
            return 0;
        }
        
        // Simple similarity based on shared patterns
        const patterns1 = new Set([
            ...artifact1.patterns.imports || [],
            ...artifact1.patterns.functions || [],
            ...artifact1.patterns.classes || []
        ]);
        
        const patterns2 = new Set([
            ...artifact2.patterns.imports || [],
            ...artifact2.patterns.functions || [],
            ...artifact2.patterns.classes || []
        ]);
        
        const intersection = new Set([...patterns1].filter(x => patterns2.has(x)));
        const union = new Set([...patterns1, ...patterns2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    
    /**
     * Build relationship graph
     */
    buildRelationshipGraph(id, visited = new Set()) {
        if (visited.has(id)) return null;
        visited.add(id);
        
        const artifact = this.artifacts.get(id);
        if (!artifact) return null;
        
        const node = {
            id,
            language: artifact.language,
            dependencies: [],
            dependents: []
        };
        
        // Add dependencies
        for (const depId of artifact.relationships.dependencies) {
            const depNode = this.buildRelationshipGraph(depId, visited);
            if (depNode) {
                node.dependencies.push(depNode);
            }
        }
        
        // Add dependents (limited depth)
        if (visited.size < 10) {
            for (const depId of artifact.relationships.dependents) {
                const depNode = this.buildRelationshipGraph(depId, visited);
                if (depNode) {
                    node.dependents.push(depNode);
                }
            }
        }
        
        return node;
    }
    
    /**
     * Calculate search score
     */
    calculateSearchScore(artifact, query) {
        let score = 0;
        
        if (!query) return score;
        
        const lowerQuery = query.toLowerCase();
        const lowerContent = artifact.content.toLowerCase();
        
        // Exact match in content
        if (lowerContent.includes(lowerQuery)) {
            score += 10;
        }
        
        // Match in purpose
        if (artifact.purpose?.toLowerCase().includes(lowerQuery)) {
            score += 5;
        }
        
        // Match in tags
        if (artifact.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
            score += 3;
        }
        
        // Boost recent artifacts
        const age = Date.now() - new Date(artifact.metadata.createdAt);
        const daysSinceCreation = age / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 1) {
            score += 2;
        } else if (daysSinceCreation < 7) {
            score += 1;
        }
        
        // Boost frequently accessed
        if (artifact.usage.accessCount > 10) {
            score += 1;
        }
        
        return score;
    }
    
    /**
     * Extract template pattern
     */
    extractTemplatePattern(content, type) {
        // Extract reusable pattern from content
        // This is simplified - real implementation would be more sophisticated
        
        switch (type) {
            case 'react-component':
                return content.replace(/\w+Component/g, '{{ComponentName}}');
            
            case 'express-route':
                return content.replace(/['"][^'"]+['"]/g, '{{path}}');
            
            default:
                return content;
        }
    }
    
    /**
     * Get file extension for language
     */
    getFileExtension(language) {
        const extensions = {
            javascript: 'js',
            typescript: 'ts',
            jsx: 'jsx',
            tsx: 'tsx',
            python: 'py',
            java: 'java',
            csharp: 'cs',
            go: 'go',
            rust: 'rs',
            html: 'html',
            css: 'css',
            scss: 'scss',
            json: 'json',
            yaml: 'yaml',
            sql: 'sql',
            graphql: 'graphql',
            markdown: 'md'
        };
        
        return extensions[language] || 'txt';
    }
    
    /**
     * Save artifact to disk
     */
    async saveArtifact(id, artifact) {
        const artifactPath = path.join(this.config.storagePath, `${id}.json`);
        await fs.writeJson(artifactPath, artifact, { spaces: 2 });
    }
    
    /**
     * Load artifact from disk
     */
    async loadArtifact(id) {
        const artifactPath = path.join(this.config.storagePath, `${id}.json`);
        
        if (!await fs.pathExists(artifactPath)) {
            return null;
        }
        
        const artifact = await fs.readJson(artifactPath);
        this.artifacts.set(id, artifact);
        
        return artifact;
    }
    
    /**
     * Update artifact index
     */
    async updateArtifactIndex(id, artifact) {
        this.artifactIndex.set(id, {
            language: artifact.language,
            purpose: artifact.purpose,
            tags: artifact.tags,
            createdAt: artifact.metadata.createdAt,
            updatedAt: artifact.metadata.updatedAt,
            size: artifact.size
        });
        
        await this.saveArtifactIndex();
    }
    
    /**
     * Save artifact index
     */
    async saveArtifactIndex() {
        const indexData = Array.from(this.artifactIndex.entries());
        await fs.writeJson(this.config.indexPath, indexData, { spaces: 2 });
    }
    
    /**
     * Load artifact index
     */
    async loadArtifactIndex() {
        if (!await fs.pathExists(this.config.indexPath)) {
            return;
        }
        
        const indexData = await fs.readJson(this.config.indexPath);
        this.artifactIndex = new Map(indexData);
        
        // Load artifacts referenced in index
        for (const [id] of this.artifactIndex) {
            await this.loadArtifact(id);
        }
    }
    
    /**
     * Save template
     */
    async saveTemplate(template) {
        const templatePath = path.join(this.config.templatePath, `${template.id}.json`);
        await fs.writeJson(templatePath, template, { spaces: 2 });
    }
    
    /**
     * Load templates
     */
    async loadTemplates() {
        if (!await fs.pathExists(this.config.templatePath)) {
            return;
        }
        
        const files = await fs.readdir(this.config.templatePath);
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const templatePath = path.join(this.config.templatePath, file);
                const template = await fs.readJson(templatePath);
                this.templates.set(template.id, template);
            }
        }
    }
    
    /**
     * Update metrics
     */
    updateMetrics(action, artifact) {
        switch (action) {
            case 'create':
                this.metrics.totalArtifacts++;
                break;
            
            case 'update':
                this.metrics.totalVersions++;
                break;
        }
        
        // Update language distribution
        if (!this.metrics.languageDistribution[artifact.language]) {
            this.metrics.languageDistribution[artifact.language] = 0;
        }
        this.metrics.languageDistribution[artifact.language]++;
        
        // Update average size
        const totalSize = Array.from(this.artifacts.values())
            .reduce((sum, a) => sum + a.size, 0);
        this.metrics.averageSize = Math.round(totalSize / this.artifacts.size);
    }
    
    /**
     * Clean old artifacts
     */
    async cleanOldArtifacts(daysToKeep = 30) {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        const toDelete = [];
        
        for (const [id, artifact] of this.artifacts) {
            const createdDate = new Date(artifact.metadata.createdAt);
            const lastAccess = artifact.usage.lastAccessed ? 
                new Date(artifact.usage.lastAccessed) : createdDate;
            
            if (lastAccess < cutoffDate && artifact.usage.accessCount < 5) {
                toDelete.push(id);
            }
        }
        
        for (const id of toDelete) {
            this.artifacts.delete(id);
            this.artifactIndex.delete(id);
            
            const artifactPath = path.join(this.config.storagePath, `${id}.json`);
            await fs.remove(artifactPath);
        }
        
        this.logger.info(`🧹 Cleaned ${toDelete.length} old artifacts`);
        
        return toDelete.length;
    }
}

module.exports = ClaudeArtifactManager;