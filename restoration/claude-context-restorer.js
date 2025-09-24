/**
 * Claude Context Restorer
 * Restores conversation context after resets or session switches
 * Formats information for optimal Claude understanding
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');

class ClaudeContextRestorer {
    constructor(contextManager, sessionManager, fileTracker, summarizer) {
        this.contextManager = contextManager;
        this.sessionManager = sessionManager;
        this.fileTracker = fileTracker;
        this.summarizer = summarizer;
        this.logger = new Logger('ClaudeContextRestorer');
        
        // Restoration configuration
        this.config = {
            restorationPriority: {
                currentTask: 1000,
                recentErrors: 900,
                decisions: 800,
                artifacts: 700,
                files: 600,
                history: 500
            },
            maxRestorationTokens: 50000,  // Max tokens to restore
            fileRereadLimit: 10,          // Max files to re-read
            historyDepth: 50,              // Messages to include
            templatePath: path.join(process.cwd(), '.nexus', 'claude', 'restoration-templates'),
            checkpointPath: path.join(process.cwd(), '.nexus', 'claude', 'checkpoints')
        };
        
        // Restoration state
        this.lastRestoration = null;
        this.restorationHistory = [];
    }
    
    /**
     * Initialize context restorer
     */
    async initialize() {
        this.logger.info('🔄 Initializing Claude Context Restorer...');
        
        try {
            await fs.ensureDir(this.config.templatePath);
            await fs.ensureDir(this.config.checkpointPath);
            
            // Load restoration templates
            await this.loadRestorationTemplates();
            
            this.logger.info('✅ Context Restorer initialized');
        } catch (error) {
            this.logger.error('Failed to initialize context restorer:', error);
            throw error;
        }
    }
    
    /**
     * Perform full context restoration
     */
    async restoreFullContext(options = {}) {
        const {
            sessionId = this.sessionManager?.currentSession?.id,
            includeHistory = true,
            includeFiles = true,
            includeArtifacts = true,
            includeDecisions = true,
            includeErrors = true
        } = options;
        
        this.logger.info('🔄 Starting full context restoration...');
        
        const startTime = Date.now();
        
        try {
            // Step 1: Load session data
            const session = await this.loadSessionData(sessionId);
            
            // Step 2: Build restoration context
            const restorationContext = {
                metadata: this.createMetadata(session),
                projectContext: await this.restoreProjectContext(),
                taskContext: await this.restoreTaskContext(session),
                history: includeHistory ? await this.restoreHistory(session) : null,
                files: includeFiles ? await this.restoreFiles() : null,
                artifacts: includeArtifacts ? await this.restoreArtifacts(session) : null,
                decisions: includeDecisions ? await this.restoreDecisions(session) : null,
                errors: includeErrors ? await this.restoreErrors(session) : null,
                summary: await this.createRestorationSummary(session)
            };
            
            // Step 3: Format for Claude
            const formattedContext = this.formatForClaude(restorationContext);
            
            // Step 4: Apply to context manager
            await this.applyRestoredContext(formattedContext);
            
            // Step 5: Re-read critical files
            await this.rereadCriticalFiles();
            
            // Track restoration
            this.lastRestoration = {
                timestamp: new Date().toISOString(),
                sessionId,
                duration: Date.now() - startTime,
                tokensRestored: this.estimateTokens(formattedContext)
            };
            
            this.restorationHistory.push(this.lastRestoration);
            
            this.logger.info(`✅ Context restoration complete in ${this.lastRestoration.duration}ms`);
            
            return {
                success: true,
                context: formattedContext,
                metrics: this.lastRestoration
            };
            
        } catch (error) {
            this.logger.error('Context restoration failed:', error);
            
            // Fallback to minimal restoration
            return await this.performMinimalRestoration();
        }
    }
    
    /**
     * Restore project context
     */
    async restoreProjectContext() {
        const context = {
            name: null,
            type: null,
            structure: {},
            technologies: [],
            dependencies: {},
            configuration: {}
        };
        
        // Check package.json
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            const packageJson = await fs.readJson(packageJsonPath);
            
            context.name = packageJson.name;
            context.type = this.detectProjectType(packageJson);
            context.dependencies = {
                production: Object.keys(packageJson.dependencies || {}),
                development: Object.keys(packageJson.devDependencies || {})
            };
            
            // Detect technologies
            context.technologies = this.detectTechnologies(packageJson);
        }
        
        // Analyze project structure
        context.structure = await this.analyzeProjectStructure();
        
        // Load configuration
        context.configuration = await this.loadProjectConfiguration();
        
        return context;
    }
    
    /**
     * Restore task context
     */
    async restoreTaskContext(session) {
        if (!session?.context?.tasks || session.context.tasks.length === 0) {
            return null;
        }
        
        // Get current/recent tasks
        const recentTasks = session.context.tasks.slice(-5);
        const currentTask = recentTasks[recentTasks.length - 1];
        
        return {
            current: currentTask,
            recent: recentTasks,
            completed: session.context.tasks.filter(t => t.completed).length,
            pending: session.context.tasks.filter(t => !t.completed).length
        };
    }
    
    /**
     * Restore conversation history
     */
    async restoreHistory(session) {
        if (!session?.context?.messages) {
            return [];
        }
        
        // Get recent messages
        const recentMessages = session.context.messages.slice(-this.config.historyDepth);
        
        // Summarize older messages if needed
        let summary = null;
        if (session.context.messages.length > this.config.historyDepth) {
            const olderMessages = session.context.messages.slice(0, -this.config.historyDepth);
            summary = await this.summarizer.summarizeConversation(olderMessages, {
                compressionLevel: 'aggressive',
                depth: 'shallow'
            });
        }
        
        return {
            summary,
            recent: recentMessages.map(msg => ({
                role: msg.role,
                preview: msg.content.substring(0, 200),
                timestamp: msg.timestamp
            }))
        };
    }
    
    /**
     * Restore file context
     */
    async restoreFiles() {
        // Get files to restore from tracker
        const filesToRestore = await this.fileTracker.getFilesForRestore();
        const restoredFiles = [];
        
        for (const fileInfo of filesToRestore.slice(0, this.config.fileRereadLimit)) {
            try {
                if (await fs.pathExists(fileInfo.path)) {
                    const content = await fs.readFile(fileInfo.path, 'utf-8');
                    
                    restoredFiles.push({
                        path: fileInfo.path,
                        priority: fileInfo.priority,
                        preview: content.substring(0, 500),
                        size: content.length,
                        lines: content.split('\n').length,
                        claudeGenerated: fileInfo.claudeGenerated
                    });
                    
                    // Track re-read
                    await this.fileTracker.trackRead(fileInfo.path, content);
                }
            } catch (error) {
                this.logger.warn(`Failed to restore file ${fileInfo.path}:`, error.message);
            }
        }
        
        return restoredFiles;
    }
    
    /**
     * Restore artifacts
     */
    async restoreArtifacts(session) {
        if (!session?.context?.artifacts) {
            return [];
        }
        
        const artifacts = Array.from(session.context.artifacts.values());
        
        // Sort by creation time, get recent ones
        const recentArtifacts = artifacts
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10);
        
        return recentArtifacts.map(artifact => ({
            id: artifact.id,
            language: artifact.language,
            purpose: artifact.purpose,
            preview: artifact.content.substring(0, 200),
            size: artifact.content.length,
            createdAt: artifact.createdAt
        }));
    }
    
    /**
     * Restore decisions
     */
    async restoreDecisions(session) {
        if (!session?.context?.decisions) {
            return [];
        }
        
        // Get high-impact decisions
        const importantDecisions = session.context.decisions
            .filter(d => d.impact === 'high' || d.impact === 'critical')
            .slice(-10);
        
        return importantDecisions.map(decision => ({
            summary: decision.decision,
            reasoning: decision.reasoning?.substring(0, 200),
            impact: decision.impact,
            timestamp: decision.timestamp
        }));
    }
    
    /**
     * Restore errors and solutions
     */
    async restoreErrors(session) {
        if (!session?.context?.errors) {
            return {
                resolved: [],
                unresolved: []
            };
        }
        
        const errors = session.context.errors;
        
        return {
            resolved: errors
                .filter(e => e.resolved)
                .slice(-5)
                .map(e => ({
                    error: e.error,
                    solution: e.solution,
                    timestamp: e.timestamp
                })),
            unresolved: errors
                .filter(e => !e.resolved)
                .slice(-5)
                .map(e => ({
                    error: e.error,
                    timestamp: e.timestamp
                }))
        };
    }
    
    /**
     * Create restoration summary
     */
    async createRestorationSummary(session) {
        if (!session) return 'No previous session data available.';
        
        const duration = session.endTime ? 
            new Date(session.endTime) - new Date(session.startTime) :
            Date.now() - new Date(session.startTime);
        
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        
        return `Session ${session.id} - ${session.projectName || 'Unnamed Project'}
Duration: ${hours}h ${minutes}m
Messages: ${session.context?.messages?.length || 0}
Artifacts: ${session.context?.artifacts?.size || 0}
Files: ${session.context?.files?.size || 0}
Status: ${session.status}`;
    }
    
    /**
     * Format context for Claude
     */
    formatForClaude(context) {
        const formatted = [];
        
        // Add header
        formatted.push(this.templates.header);
        
        // Add metadata
        if (context.metadata) {
            formatted.push(this.formatSection('Session Information', context.metadata));
        }
        
        // Add project context
        if (context.projectContext) {
            formatted.push(this.formatProjectContext(context.projectContext));
        }
        
        // Add task context
        if (context.taskContext) {
            formatted.push(this.formatTaskContext(context.taskContext));
        }
        
        // Add history summary
        if (context.history?.summary) {
            formatted.push(this.formatSection('Previous Conversation', context.history.summary.summary));
        }
        
        // Add file context
        if (context.files && context.files.length > 0) {
            formatted.push(this.formatFileContext(context.files));
        }
        
        // Add artifacts
        if (context.artifacts && context.artifacts.length > 0) {
            formatted.push(this.formatArtifactContext(context.artifacts));
        }
        
        // Add decisions
        if (context.decisions && context.decisions.length > 0) {
            formatted.push(this.formatDecisionContext(context.decisions));
        }
        
        // Add errors
        if (context.errors) {
            formatted.push(this.formatErrorContext(context.errors));
        }
        
        // Add footer
        formatted.push(this.templates.footer);
        
        return formatted.join('\n\n');
    }
    
    /**
     * Format project context
     */
    formatProjectContext(project) {
        let formatted = '## Project Context\n\n';
        
        if (project.name) {
            formatted += `**Project**: ${project.name}\n`;
        }
        
        if (project.type) {
            formatted += `**Type**: ${project.type}\n`;
        }
        
        if (project.technologies.length > 0) {
            formatted += `**Technologies**: ${project.technologies.join(', ')}\n`;
        }
        
        if (project.structure) {
            formatted += '\n**Structure**:\n';
            formatted += this.formatStructure(project.structure);
        }
        
        return formatted;
    }
    
    /**
     * Format task context
     */
    formatTaskContext(tasks) {
        let formatted = '## Current Task\n\n';
        
        if (tasks.current) {
            formatted += `**Active**: ${tasks.current.description || tasks.current}\n`;
        }
        
        formatted += `**Progress**: ${tasks.completed} completed, ${tasks.pending} pending\n`;
        
        if (tasks.recent.length > 1) {
            formatted += '\n**Recent Tasks**:\n';
            for (const task of tasks.recent.slice(0, 3)) {
                formatted += `- ${task.description || task}\n`;
            }
        }
        
        return formatted;
    }
    
    /**
     * Format file context
     */
    formatFileContext(files) {
        let formatted = '## Files in Context\n\n';
        
        for (const file of files.slice(0, 5)) {
            formatted += `**${path.basename(file.path)}**`;
            
            if (file.claudeGenerated) {
                formatted += ' (Claude-generated)';
            }
            
            formatted += `\n- Path: ${file.path}\n`;
            formatted += `- Size: ${file.lines} lines\n`;
            
            if (file.preview) {
                formatted += '```\n' + file.preview + '\n```\n';
            }
            
            formatted += '\n';
        }
        
        return formatted;
    }
    
    /**
     * Format artifact context
     */
    formatArtifactContext(artifacts) {
        let formatted = '## Created Artifacts\n\n';
        
        for (const artifact of artifacts.slice(0, 5)) {
            formatted += `**${artifact.id}** (${artifact.language})\n`;
            formatted += `- Purpose: ${artifact.purpose || 'Code implementation'}\n`;
            formatted += `- Created: ${artifact.createdAt}\n`;
            
            if (artifact.preview) {
                formatted += '```' + artifact.language + '\n';
                formatted += artifact.preview + '\n';
                formatted += '```\n';
            }
            
            formatted += '\n';
        }
        
        return formatted;
    }
    
    /**
     * Format decision context
     */
    formatDecisionContext(decisions) {
        let formatted = '## Key Decisions\n\n';
        
        for (const decision of decisions) {
            formatted += `**${decision.summary}**\n`;
            
            if (decision.reasoning) {
                formatted += `- Reasoning: ${decision.reasoning}\n`;
            }
            
            formatted += `- Impact: ${decision.impact}\n\n`;
        }
        
        return formatted;
    }
    
    /**
     * Format error context
     */
    formatErrorContext(errors) {
        let formatted = '## Error History\n\n';
        
        if (errors.resolved.length > 0) {
            formatted += '### Resolved Errors\n';
            for (const error of errors.resolved) {
                formatted += `- **Error**: ${error.error}\n`;
                formatted += `  **Solution**: ${error.solution}\n\n`;
            }
        }
        
        if (errors.unresolved.length > 0) {
            formatted += '### Unresolved Errors\n';
            for (const error of errors.unresolved) {
                formatted += `- ${error.error}\n`;
            }
        }
        
        return formatted;
    }
    
    /**
     * Format section
     */
    formatSection(title, content) {
        return `## ${title}\n\n${content}`;
    }
    
    /**
     * Format project structure
     */
    formatStructure(structure) {
        // Simple tree representation
        let formatted = '```\n';
        
        if (structure.directories) {
            for (const dir of structure.directories.slice(0, 10)) {
                formatted += `📁 ${dir}\n`;
            }
        }
        
        formatted += '```\n';
        return formatted;
    }
    
    /**
     * Apply restored context to context manager
     */
    async applyRestoredContext(formattedContext) {
        // Add as system message
        await this.contextManager.addMessage(formattedContext, {
            role: 'system',
            priority: this.config.restorationPriority.currentTask,
            metadata: {
                type: 'restoration',
                timestamp: new Date().toISOString()
            }
        });
    }
    
    /**
     * Re-read critical files
     */
    async rereadCriticalFiles() {
        const criticalFiles = [
            'package.json',
            'README.md',
            '.env',
            'tsconfig.json',
            'next.config.js',
            'vite.config.js'
        ];
        
        for (const file of criticalFiles) {
            const filePath = path.join(process.cwd(), file);
            
            if (await fs.pathExists(filePath)) {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    await this.fileTracker.trackRead(filePath, content);
                    
                    this.logger.debug(`📖 Re-read critical file: ${file}`);
                } catch (error) {
                    this.logger.warn(`Failed to re-read ${file}:`, error.message);
                }
            }
        }
    }
    
    /**
     * Perform minimal restoration (fallback)
     */
    async performMinimalRestoration() {
        this.logger.warn('⚠️ Performing minimal context restoration...');
        
        const minimal = {
            message: 'Previous session context unavailable. Starting fresh.',
            projectInfo: await this.getMinimalProjectInfo()
        };
        
        const formatted = `## Session Restored (Minimal)
        
${minimal.message}

${minimal.projectInfo}

Please provide task details to continue.`;
        
        await this.applyRestoredContext(formatted);
        
        return {
            success: false,
            context: formatted,
            minimal: true
        };
    }
    
    /**
     * Get minimal project info
     */
    async getMinimalProjectInfo() {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        
        if (await fs.pathExists(packageJsonPath)) {
            const pkg = await fs.readJson(packageJsonPath);
            return `Project: ${pkg.name || 'Unknown'}\nVersion: ${pkg.version || '0.0.0'}`;
        }
        
        return 'Project information unavailable.';
    }
    
    /**
     * Load session data
     */
    async loadSessionData(sessionId) {
        if (!sessionId) {
            // Try to get current session
            return this.sessionManager?.currentSession;
        }
        
        // Load specific session
        return await this.sessionManager?.loadSession(sessionId);
    }
    
    /**
     * Detect project type
     */
    detectProjectType(packageJson) {
        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        };
        
        if (deps['next']) return 'Next.js Application';
        if (deps['react']) return 'React Application';
        if (deps['vue']) return 'Vue Application';
        if (deps['express']) return 'Express Server';
        if (deps['@angular/core']) return 'Angular Application';
        if (deps['svelte']) return 'Svelte Application';
        
        return 'Node.js Project';
    }
    
    /**
     * Detect technologies
     */
    detectTechnologies(packageJson) {
        const technologies = [];
        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        };
        
        // Frontend frameworks
        if (deps['react']) technologies.push('React');
        if (deps['vue']) technologies.push('Vue');
        if (deps['@angular/core']) technologies.push('Angular');
        if (deps['svelte']) technologies.push('Svelte');
        
        // Meta-frameworks
        if (deps['next']) technologies.push('Next.js');
        if (deps['nuxt']) technologies.push('Nuxt');
        if (deps['gatsby']) technologies.push('Gatsby');
        
        // Backend
        if (deps['express']) technologies.push('Express');
        if (deps['fastify']) technologies.push('Fastify');
        if (deps['koa']) technologies.push('Koa');
        
        // Database
        if (deps['mongoose']) technologies.push('MongoDB');
        if (deps['pg']) technologies.push('PostgreSQL');
        if (deps['mysql2']) technologies.push('MySQL');
        
        // Testing
        if (deps['jest']) technologies.push('Jest');
        if (deps['mocha']) technologies.push('Mocha');
        if (deps['vitest']) technologies.push('Vitest');
        
        // Build tools
        if (deps['webpack']) technologies.push('Webpack');
        if (deps['vite']) technologies.push('Vite');
        if (deps['esbuild']) technologies.push('ESBuild');
        
        return technologies;
    }
    
    /**
     * Analyze project structure
     */
    async analyzeProjectStructure() {
        const structure = {
            directories: [],
            hasSource: false,
            hasTests: false,
            hasPublic: false,
            hasConfig: false
        };
        
        const checkDirs = ['src', 'app', 'pages', 'components', 'lib', 'tests', 'public', 'config'];
        
        for (const dir of checkDirs) {
            const dirPath = path.join(process.cwd(), dir);
            if (await fs.pathExists(dirPath)) {
                structure.directories.push(dir);
                
                if (dir === 'src' || dir === 'app') structure.hasSource = true;
                if (dir === 'tests' || dir === 'test') structure.hasTests = true;
                if (dir === 'public') structure.hasPublic = true;
                if (dir === 'config') structure.hasConfig = true;
            }
        }
        
        return structure;
    }
    
    /**
     * Load project configuration
     */
    async loadProjectConfiguration() {
        const config = {};
        
        // Check for various config files
        const configFiles = [
            'tsconfig.json',
            'jsconfig.json',
            '.eslintrc.json',
            '.prettierrc',
            'jest.config.js',
            'webpack.config.js',
            'vite.config.js',
            'next.config.js'
        ];
        
        for (const file of configFiles) {
            const filePath = path.join(process.cwd(), file);
            if (await fs.pathExists(filePath)) {
                config[file] = true;
            }
        }
        
        return config;
    }
    
    /**
     * Create metadata
     */
    createMetadata(session) {
        if (!session) {
            return {
                restored: false,
                timestamp: new Date().toISOString()
            };
        }
        
        return {
            sessionId: session.id,
            projectName: session.projectName,
            startTime: session.startTime,
            lastActivity: session.lastActivity,
            status: session.status,
            restored: true,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Estimate token count
     */
    estimateTokens(content) {
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        return Math.ceil(text.length / 4);
    }
    
    /**
     * Load restoration templates
     */
    async loadRestorationTemplates() {
        this.templates = {
            header: '# 🔄 Context Restored\n\n*This conversation is being continued from a previous session. All previous work has been preserved.*\n',
            footer: '\n---\n*Context restoration complete. You can continue working from where you left off.*'
        };
    }
    
    /**
     * Get restoration statistics
     */
    getStatistics() {
        return {
            lastRestoration: this.lastRestoration,
            totalRestorations: this.restorationHistory.length,
            averageTime: this.calculateAverageTime(),
            averageTokens: this.calculateAverageTokens()
        };
    }
    
    /**
     * Calculate average restoration time
     */
    calculateAverageTime() {
        if (this.restorationHistory.length === 0) return 0;
        
        const total = this.restorationHistory.reduce((sum, r) => sum + r.duration, 0);
        return Math.round(total / this.restorationHistory.length);
    }
    
    /**
     * Calculate average tokens restored
     */
    calculateAverageTokens() {
        if (this.restorationHistory.length === 0) return 0;
        
        const total = this.restorationHistory.reduce((sum, r) => sum + r.tokensRestored, 0);
        return Math.round(total / this.restorationHistory.length);
    }
}

module.exports = ClaudeContextRestorer;