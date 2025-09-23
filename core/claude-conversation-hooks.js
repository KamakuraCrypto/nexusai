/**
 * Claude Conversation Hooks
 * Lifecycle hooks specifically designed for Claude Code conversations
 * Tracks artifacts, tool usage, and conversation patterns
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');
const EventEmitter = require('events');

class ClaudeConversationHooks extends EventEmitter {
    constructor(contextManager) {
        super();
        this.contextManager = contextManager;
        this.logger = new Logger('ClaudeHooks');
        
        // Hook registry
        this.hooks = {
            // Context lifecycle hooks
            beforeContextWindow: [],      // About to hit limit
            onContextCompaction: [],      // During compaction
            afterContextRestore: [],      // After restoration
            
            // Conversation hooks
            onConversationStart: [],      // New conversation
            onConversationPause: [],      // User inactive
            onConversationResume: [],     // User returns
            onConversationEnd: [],        // Conversation ends
            
            // Claude-specific hooks
            onArtifactCreation: [],       // Code artifact created
            onToolUse: [],                // Tool/function called
            onFileOperation: [],          // File read/write/edit
            onErrorEncountered: [],       // Error detected
            onSolutionProvided: [],       // Solution given
            onDecisionMade: [],           // Architectural decision
            
            // Memory hooks
            beforeMemorySave: [],         // Before saving
            afterMemoryLoad: [],          // After loading
            onCheckpointCreate: [],       // Checkpoint created
            
            // Context reset hooks
            onContextReset: [],           // Emergency reset
            onContextWarning: [],         // Usage warning
            onContextCritical: []        // Critical state
        };
        
        // Hook execution stats
        this.stats = {
            executionCount: {},
            executionTime: {},
            failures: {}
        };
        
        // Initialize default hooks
        this.registerDefaultHooks();
    }
    
    /**
     * Register default Claude-specific hooks
     */
    registerDefaultHooks() {
        // Track context approaching limit
        this.register('beforeContextWindow', async (context) => {
            const utilization = (context.currentTokens / context.maxTokens) * 100;
            
            this.logger.warn(`⚠️ Context at ${utilization.toFixed(1)}% - preparing for compaction`);
            
            // Identify critical content to preserve
            const critical = await this.identifyCriticalContent(context);
            
            return {
                action: 'prepare_compaction',
                preserve: critical,
                utilization
            };
        });
        
        // Handle artifact creation
        this.register('onArtifactCreation', async (artifact) => {
            this.logger.info(`📝 New artifact created: ${artifact.id}`);
            
            // Track artifact in context
            this.contextManager.trackArtifact(artifact.id, artifact.content, {
                language: artifact.language,
                purpose: artifact.purpose,
                dependencies: this.extractDependencies(artifact.content)
            });
            
            // Check for patterns
            await this.learnFromArtifact(artifact);
            
            return {
                tracked: true,
                artifactId: artifact.id
            };
        });
        
        // Handle tool usage
        this.register('onToolUse', async (tool) => {
            this.logger.debug(`🔧 Tool used: ${tool.name}`);
            
            // Track tool usage patterns
            this.contextManager.trackToolUsage(tool.name, tool.parameters, tool.result);
            
            // Special handling for file operations
            if (['read_file', 'write_file', 'edit_file'].includes(tool.name)) {
                await this.trigger('onFileOperation', {
                    operation: tool.name,
                    path: tool.parameters.path || tool.parameters.file_path,
                    content: tool.parameters.content || tool.result
                });
            }
            
            return {
                tracked: true,
                toolName: tool.name
            };
        });
        
        // Handle file operations specially
        this.register('onFileOperation', async (operation) => {
            const { operation: op, path: filePath, content } = operation;
            
            this.logger.info(`📁 File ${op}: ${filePath}`);
            
            // Track in context manager
            this.contextManager.trackFileOperation(op.replace('_file', ''), filePath, content);
            
            // Determine file importance
            const importance = this.determineFileImportance(filePath);
            
            // If critical file, increase priority
            if (importance === 'critical') {
                this.logger.info(`⭐ Critical file detected: ${filePath}`);
                await this.markForPriorityRetention(filePath);
            }
            
            return {
                tracked: true,
                importance
            };
        });
        
        // Handle conversation pause (inactivity)
        this.register('onConversationPause', async (context) => {
            this.logger.info('⏸️ Conversation paused - saving state');
            
            // Save current state
            const checkpointId = await this.contextManager.saveCheckpoint();
            
            // Create summary of current work
            const summary = await this.createWorkSummary(context);
            
            // Save conversation state
            await this.saveConversationState({
                checkpointId,
                summary,
                lastActivity: new Date().toISOString()
            });
            
            return {
                saved: true,
                checkpointId
            };
        });
        
        // Handle conversation resume
        this.register('onConversationResume', async (context) => {
            this.logger.info('▶️ Conversation resumed - restoring context');
            
            // Load previous state
            const restored = await this.contextManager.restorePreviousSession();
            
            if (restored) {
                // Re-read critical files
                await this.rereadCriticalFiles();
                
                // Provide summary to user
                const summary = await this.generateResumptionSummary();
                
                return {
                    restored: true,
                    summary
                };
            }
            
            return {
                restored: false,
                reason: 'No previous session found'
            };
        });
        
        // Handle errors
        this.register('onErrorEncountered', async (error) => {
            this.logger.error(`❌ Error encountered: ${error.message || error}`);
            
            // Track error in context
            this.contextManager.trackError(error, null, {
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            // Look for similar past errors
            const similarErrors = await this.findSimilarErrors(error);
            
            return {
                tracked: true,
                similarErrors
            };
        });
        
        // Handle solutions
        this.register('onSolutionProvided', async (solution) => {
            this.logger.info(`✅ Solution provided: ${solution.summary}`);
            
            // Link solution to error if applicable
            if (solution.errorId) {
                this.contextManager.trackError(
                    { id: solution.errorId },
                    solution.solution,
                    solution.context
                );
            }
            
            // Learn from solution
            await this.learnFromSolution(solution);
            
            return {
                tracked: true,
                learned: true
            };
        });
        
        // Handle architectural decisions
        this.register('onDecisionMade', async (decision) => {
            this.logger.info(`🎯 Decision made: ${decision.summary}`);
            
            // Track decision
            this.contextManager.trackDecision(
                decision.summary,
                decision.reasoning,
                decision.impact || 'medium'
            );
            
            // Update project understanding
            await this.updateProjectUnderstanding(decision);
            
            return {
                tracked: true,
                impact: decision.impact
            };
        });
        
        // Handle context reset
        this.register('onContextReset', async (context) => {
            this.logger.error('🚨 CONTEXT RESET DETECTED!');
            
            // Emergency save
            const emergencyCheckpoint = await this.createEmergencyCheckpoint(context);
            
            // Attempt recovery
            const recovered = await this.attemptRecovery(emergencyCheckpoint);
            
            if (recovered) {
                this.logger.info('✅ Context recovered successfully');
                
                // Re-read essential files
                await this.rereadEssentialFiles();
                
                return {
                    recovered: true,
                    checkpointId: emergencyCheckpoint
                };
            }
            
            return {
                recovered: false,
                checkpointId: emergencyCheckpoint,
                action: 'manual_restoration_required'
            };
        });
        
        // Handle context warnings
        this.register('onContextWarning', async (context) => {
            const utilization = (context.currentTokens / context.maxTokens) * 100;
            
            this.logger.warn(`⚠️ Context warning: ${utilization.toFixed(1)}% used`);
            
            // Preemptive compaction
            if (utilization > 85) {
                await this.contextManager.compactContext();
            }
            
            return {
                utilization,
                action: utilization > 85 ? 'compacted' : 'monitored'
            };
        });
    }
    
    /**
     * Register a hook handler
     */
    register(event, handler) {
        if (!this.hooks[event]) {
            this.logger.warn(`Unknown hook event: ${event}`);
            this.hooks[event] = [];
        }
        
        this.hooks[event].push(handler);
        
        // Initialize stats
        if (!this.stats.executionCount[event]) {
            this.stats.executionCount[event] = 0;
            this.stats.executionTime[event] = 0;
            this.stats.failures[event] = 0;
        }
        
        this.logger.debug(`Registered hook: ${event}`);
        
        return () => this.unregister(event, handler);
    }
    
    /**
     * Unregister a hook handler
     */
    unregister(event, handler) {
        if (!this.hooks[event]) return;
        
        const index = this.hooks[event].indexOf(handler);
        if (index > -1) {
            this.hooks[event].splice(index, 1);
        }
    }
    
    /**
     * Trigger hooks for an event
     */
    async trigger(event, data = {}) {
        if (!this.hooks[event]) {
            this.logger.warn(`No hooks registered for: ${event}`);
            return [];
        }
        
        const startTime = Date.now();
        const results = [];
        
        this.logger.debug(`Triggering ${event} with ${this.hooks[event].length} handlers`);
        
        // Execute hooks sequentially
        for (const handler of this.hooks[event]) {
            try {
                const result = await handler(data);
                results.push(result);
            } catch (error) {
                this.logger.error(`Hook error in ${event}:`, error);
                this.stats.failures[event]++;
                results.push({ error: error.message });
            }
        }
        
        // Update stats
        this.stats.executionCount[event]++;
        this.stats.executionTime[event] += Date.now() - startTime;
        
        // Emit event
        this.emit(event, data, results);
        
        return results;
    }
    
    /**
     * Identify critical content to preserve
     */
    async identifyCriticalContent(context) {
        const critical = {
            recentMessages: [],
            artifacts: [],
            files: [],
            decisions: [],
            errors: []
        };
        
        // Get recent messages (last 10)
        if (context.messages) {
            critical.recentMessages = context.messages.slice(-10);
        }
        
        // Get all artifacts
        if (context.artifacts) {
            critical.artifacts = Array.from(context.artifacts.keys());
        }
        
        // Get recently accessed files
        if (context.fileReferences) {
            const recentFiles = Array.from(context.fileReferences.entries())
                .filter(([_, ref]) => {
                    const lastAccess = new Date(ref.lastAccess);
                    const hourAgo = new Date(Date.now() - 3600000);
                    return lastAccess > hourAgo;
                })
                .map(([file]) => file);
            
            critical.files = recentFiles;
        }
        
        // Get high-impact decisions
        if (context.decisions) {
            critical.decisions = context.decisions.filter(d => 
                d.impact === 'high' || d.impact === 'critical'
            );
        }
        
        // Get unresolved errors
        if (context.errors) {
            critical.errors = context.errors.filter(e => !e.resolved);
        }
        
        return critical;
    }
    
    /**
     * Learn from artifact patterns
     */
    async learnFromArtifact(artifact) {
        // Extract patterns from code
        const patterns = {
            language: artifact.language,
            structure: this.analyzeCodeStructure(artifact.content),
            style: this.analyzeCodeStyle(artifact.content),
            dependencies: this.extractDependencies(artifact.content)
        };
        
        // Store patterns for future reference
        const patternsPath = path.join(process.cwd(), '.nexus', 'claude', 'patterns');
        await fs.ensureDir(patternsPath);
        
        const patternFile = path.join(patternsPath, `${artifact.id}-patterns.json`);
        await fs.writeJson(patternFile, patterns, { spaces: 2 });
        
        return patterns;
    }
    
    /**
     * Extract dependencies from code
     */
    extractDependencies(content) {
        const dependencies = new Set();
        
        // JavaScript/TypeScript imports
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
        
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.add(match[1]);
        }
        while ((match = requireRegex.exec(content)) !== null) {
            dependencies.add(match[1]);
        }
        
        return Array.from(dependencies);
    }
    
    /**
     * Analyze code structure
     */
    analyzeCodeStructure(content) {
        return {
            lines: content.split('\n').length,
            functions: (content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(/g) || []).length,
            classes: (content.match(/class\s+\w+/g) || []).length,
            exports: (content.match(/export\s+/g) || []).length
        };
    }
    
    /**
     * Analyze code style
     */
    analyzeCodeStyle(content) {
        return {
            indentation: content.includes('\t') ? 'tabs' : 'spaces',
            quotes: content.includes('"') > content.includes("'") ? 'double' : 'single',
            semicolons: content.includes(';'),
            asyncAwait: content.includes('async') && content.includes('await')
        };
    }
    
    /**
     * Determine file importance
     */
    determineFileImportance(filePath) {
        const criticalFiles = [
            'package.json',
            'tsconfig.json',
            '.env',
            'config.js',
            'config.ts',
            'index.js',
            'index.ts',
            'main.js',
            'main.ts',
            'app.js',
            'app.ts'
        ];
        
        const fileName = path.basename(filePath);
        
        if (criticalFiles.includes(fileName)) {
            return 'critical';
        }
        
        if (filePath.includes('test') || filePath.includes('spec')) {
            return 'low';
        }
        
        if (filePath.includes('node_modules') || filePath.includes('dist')) {
            return 'ignore';
        }
        
        return 'medium';
    }
    
    /**
     * Mark file for priority retention
     */
    async markForPriorityRetention(filePath) {
        const priorityPath = path.join(process.cwd(), '.nexus', 'claude', 'priority-files.json');
        
        let priorityFiles = [];
        if (await fs.pathExists(priorityPath)) {
            priorityFiles = await fs.readJson(priorityPath);
        }
        
        if (!priorityFiles.includes(filePath)) {
            priorityFiles.push(filePath);
            await fs.writeJson(priorityPath, priorityFiles, { spaces: 2 });
        }
    }
    
    /**
     * Create work summary
     */
    async createWorkSummary(context) {
        const summary = {
            timestamp: new Date().toISOString(),
            messagesProcessed: context.messageCount || 0,
            artifactsCreated: context.artifacts ? context.artifacts.size : 0,
            filesModified: context.fileReferences ? context.fileReferences.size : 0,
            decisionsM Made: context.decisions ? context.decisions.length : 0,
            errorsResolved: context.errors ? context.errors.filter(e => e.resolved).length : 0,
            currentTask: context.currentTask || 'Unknown'
        };
        
        return summary;
    }
    
    /**
     * Save conversation state
     */
    async saveConversationState(state) {
        const statePath = path.join(process.cwd(), '.nexus', 'claude', 'conversation-state.json');
        await fs.writeJson(statePath, state, { spaces: 2 });
    }
    
    /**
     * Re-read critical files
     */
    async rereadCriticalFiles() {
        const priorityPath = path.join(process.cwd(), '.nexus', 'claude', 'priority-files.json');
        
        if (!await fs.pathExists(priorityPath)) {
            return;
        }
        
        const priorityFiles = await fs.readJson(priorityPath);
        
        this.logger.info(`📖 Re-reading ${priorityFiles.length} critical files`);
        
        for (const file of priorityFiles) {
            if (await fs.pathExists(file)) {
                await this.trigger('onFileOperation', {
                    operation: 'reread',
                    path: file,
                    content: await fs.readFile(file, 'utf-8')
                });
            }
        }
    }
    
    /**
     * Generate resumption summary
     */
    async generateResumptionSummary() {
        const statePath = path.join(process.cwd(), '.nexus', 'claude', 'conversation-state.json');
        
        if (!await fs.pathExists(statePath)) {
            return 'No previous conversation state found';
        }
        
        const state = await fs.readJson(statePath);
        
        return `
📊 Conversation Resumed
Last activity: ${state.lastActivity}
Checkpoint: ${state.checkpointId}
Summary: ${JSON.stringify(state.summary, null, 2)}
        `.trim();
    }
    
    /**
     * Find similar errors
     */
    async findSimilarErrors(error) {
        // Simple similarity check - could be enhanced with better algorithms
        const errorMessage = error.message || String(error);
        const similar = [];
        
        if (this.contextManager.contextState.errors) {
            for (const pastError of this.contextManager.contextState.errors) {
                if (pastError.resolved && this.calculateSimilarity(errorMessage, pastError.error) > 0.7) {
                    similar.push({
                        error: pastError.error,
                        solution: pastError.solution,
                        similarity: this.calculateSimilarity(errorMessage, pastError.error)
                    });
                }
            }
        }
        
        return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
    }
    
    /**
     * Calculate string similarity
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) {
            return 1.0;
        }
        
        const editDistance = this.getEditDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    
    /**
     * Get edit distance between strings
     */
    getEditDistance(s1, s2) {
        const costs = [];
        
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) {
                costs[s2.length] = lastValue;
            }
        }
        
        return costs[s2.length];
    }
    
    /**
     * Learn from solution
     */
    async learnFromSolution(solution) {
        const solutionsPath = path.join(process.cwd(), '.nexus', 'claude', 'solutions');
        await fs.ensureDir(solutionsPath);
        
        const solutionFile = path.join(solutionsPath, `${Date.now()}-solution.json`);
        await fs.writeJson(solutionFile, solution, { spaces: 2 });
    }
    
    /**
     * Update project understanding
     */
    async updateProjectUnderstanding(decision) {
        const understandingPath = path.join(process.cwd(), '.nexus', 'claude', 'project-understanding.json');
        
        let understanding = {};
        if (await fs.pathExists(understandingPath)) {
            understanding = await fs.readJson(understandingPath);
        }
        
        if (!understanding.decisions) {
            understanding.decisions = [];
        }
        
        understanding.decisions.push({
            timestamp: new Date().toISOString(),
            summary: decision.summary,
            reasoning: decision.reasoning,
            impact: decision.impact
        });
        
        await fs.writeJson(understandingPath, understanding, { spaces: 2 });
    }
    
    /**
     * Create emergency checkpoint
     */
    async createEmergencyCheckpoint(context) {
        const emergencyPath = path.join(process.cwd(), '.nexus', 'claude', 'emergency');
        await fs.ensureDir(emergencyPath);
        
        const checkpointId = `emergency-${Date.now()}`;
        const checkpointFile = path.join(emergencyPath, `${checkpointId}.json`);
        
        await fs.writeJson(checkpointFile, {
            id: checkpointId,
            timestamp: new Date().toISOString(),
            context,
            reason: 'context_reset'
        }, { spaces: 2 });
        
        return checkpointId;
    }
    
    /**
     * Attempt recovery from checkpoint
     */
    async attemptRecovery(checkpointId) {
        const checkpointFile = path.join(
            process.cwd(),
            '.nexus',
            'claude',
            'emergency',
            `${checkpointId}.json`
        );
        
        if (!await fs.pathExists(checkpointFile)) {
            return false;
        }
        
        try {
            const checkpoint = await fs.readJson(checkpointFile);
            
            // Restore context
            if (checkpoint.context) {
                await this.contextManager.restorePreviousSession();
            }
            
            return true;
        } catch (error) {
            this.logger.error('Recovery failed:', error);
            return false;
        }
    }
    
    /**
     * Re-read essential files
     */
    async rereadEssentialFiles() {
        const essentialFiles = [
            'package.json',
            'README.md',
            '.env',
            'tsconfig.json',
            'webpack.config.js',
            'vite.config.js'
        ];
        
        for (const file of essentialFiles) {
            const filePath = path.join(process.cwd(), file);
            if (await fs.pathExists(filePath)) {
                this.logger.info(`📖 Re-reading essential file: ${file}`);
                
                await this.trigger('onFileOperation', {
                    operation: 'reread',
                    path: filePath,
                    content: await fs.readFile(filePath, 'utf-8')
                });
            }
        }
    }
    
    /**
     * Get hook statistics
     */
    getStats() {
        const stats = {};
        
        for (const event in this.stats.executionCount) {
            stats[event] = {
                count: this.stats.executionCount[event],
                avgTime: this.stats.executionTime[event] / (this.stats.executionCount[event] || 1),
                failures: this.stats.failures[event]
            };
        }
        
        return stats;
    }
}

module.exports = { ClaudeConversationHooks };