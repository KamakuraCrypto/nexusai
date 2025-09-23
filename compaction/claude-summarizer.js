/**
 * Claude Summarizer
 * Intelligent conversation summarization for context compaction
 * Preserves critical information while reducing token usage
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');

class ClaudeSummarizer {
    constructor(contextManager, sessionManager) {
        this.contextManager = contextManager;
        this.sessionManager = sessionManager;
        this.logger = new Logger('ClaudeSummarizer');
        
        // Summarization configuration
        this.config = {
            compressionTargets: {
                aggressive: 0.2,   // 80% reduction
                normal: 0.4,        // 60% reduction
                light: 0.7          // 30% reduction
            },
            preservationRules: {
                recentMessages: 20,      // Keep last N messages intact
                errorSolutions: true,     // Always keep error-solution pairs
                decisions: true,          // Keep architectural decisions
                artifacts: true,          // Keep artifact references
                currentTask: true        // Keep current task context
            },
            summaryDepth: {
                shallow: 1,   // Basic summary
                normal: 2,    // Standard summary with key points
                deep: 3       // Detailed summary with examples
            },
            templatePath: path.join(process.cwd(), '.nexus', 'claude', 'templates'),
            summaryPath: path.join(process.cwd(), '.nexus', 'claude', 'summaries')
        };
        
        // Summary cache
        this.summaryCache = new Map();
        this.summaryHistory = [];
    }
    
    /**
     * Initialize summarizer
     */
    async initialize() {
        this.logger.info('📝 Initializing Claude Summarizer...');
        
        try {
            await fs.ensureDir(this.config.templatePath);
            await fs.ensureDir(this.config.summaryPath);
            
            // Load summary templates
            await this.loadTemplates();
            
            this.logger.info('✅ Summarizer initialized');
        } catch (error) {
            this.logger.error('Failed to initialize summarizer:', error);
            throw error;
        }
    }
    
    /**
     * Summarize conversation with intelligent compression
     */
    async summarizeConversation(messages, options = {}) {
        const {
            compressionLevel = 'normal',
            depth = 'normal',
            preserveCode = true,
            preserveErrors = true,
            groupByTopic = true
        } = options;
        
        this.logger.info(`🗜️ Summarizing ${messages.length} messages...`);
        
        // Step 1: Categorize messages
        const categorized = this.categorizeMessages(messages);
        
        // Step 2: Group by topic if requested
        const grouped = groupByTopic ? 
            this.groupByTopic(categorized) : 
            { default: categorized };
        
        // Step 3: Create summaries for each group
        const summaries = [];
        
        for (const [topic, msgs] of Object.entries(grouped)) {
            const summary = await this.createTopicSummary(topic, msgs, {
                depth,
                preserveCode,
                preserveErrors
            });
            summaries.push(summary);
        }
        
        // Step 4: Compress to target level
        const compressed = await this.compressToTarget(
            summaries,
            this.config.compressionTargets[compressionLevel]
        );
        
        // Step 5: Format final summary
        const finalSummary = this.formatFinalSummary(compressed);
        
        // Cache summary
        const summaryId = `summary-${Date.now()}`;
        this.summaryCache.set(summaryId, finalSummary);
        
        // Save summary
        await this.saveSummary(summaryId, finalSummary);
        
        // Track metrics
        const originalTokens = this.estimateTokens(messages);
        const summaryTokens = this.estimateTokens([finalSummary]);
        const compressionRatio = 1 - (summaryTokens / originalTokens);
        
        this.logger.info(`✅ Summarization complete: ${compressionRatio.toFixed(1)}% reduction`);
        
        return {
            summary: finalSummary,
            summaryId,
            originalTokens,
            summaryTokens,
            compressionRatio,
            topics: Object.keys(grouped)
        };
    }
    
    /**
     * Summarize code patterns
     */
    async summarizeCodePatterns(artifacts, options = {}) {
        const patterns = {
            languages: new Map(),
            frameworks: new Set(),
            commonPatterns: [],
            dependencies: new Set(),
            styleGuide: {}
        };
        
        for (const [id, artifact] of artifacts) {
            // Track languages
            if (artifact.language) {
                if (!patterns.languages.has(artifact.language)) {
                    patterns.languages.set(artifact.language, {
                        count: 0,
                        examples: []
                    });
                }
                
                const lang = patterns.languages.get(artifact.language);
                lang.count++;
                
                if (lang.examples.length < 3) {
                    lang.examples.push({
                        id,
                        preview: artifact.content.substring(0, 200)
                    });
                }
            }
            
            // Extract patterns
            const extracted = this.extractCodePatterns(artifact.content);
            patterns.commonPatterns.push(...extracted.patterns);
            extracted.dependencies.forEach(dep => patterns.dependencies.add(dep));
            
            // Detect frameworks
            if (extracted.framework) {
                patterns.frameworks.add(extracted.framework);
            }
            
            // Learn style
            Object.assign(patterns.styleGuide, extracted.style);
        }
        
        // Create summary
        const summary = `
## Code Patterns Summary

### Languages Used
${Array.from(patterns.languages.entries())
    .map(([lang, data]) => `- **${lang}**: ${data.count} artifacts`)
    .join('\n')}

### Frameworks Detected
${Array.from(patterns.frameworks).join(', ') || 'None detected'}

### Common Patterns
${this.summarizePatterns(patterns.commonPatterns)}

### Dependencies
${Array.from(patterns.dependencies).slice(0, 10).join(', ')}${patterns.dependencies.size > 10 ? '...' : ''}

### Code Style
${this.formatStyleGuide(patterns.styleGuide)}
        `.trim();
        
        return summary;
    }
    
    /**
     * Summarize decisions and reasoning
     */
    async summarizeDecisions(decisions, options = {}) {
        const {
            includeReasoning = true,
            groupByImpact = true
        } = options;
        
        // Group by impact if requested
        const grouped = groupByImpact ? {
            critical: decisions.filter(d => d.impact === 'critical'),
            high: decisions.filter(d => d.impact === 'high'),
            medium: decisions.filter(d => d.impact === 'medium'),
            low: decisions.filter(d => d.impact === 'low')
        } : { all: decisions };
        
        let summary = '## Decisions Made\n\n';
        
        for (const [impact, decisionList] of Object.entries(grouped)) {
            if (decisionList.length === 0) continue;
            
            if (groupByImpact) {
                summary += `### ${impact.charAt(0).toUpperCase() + impact.slice(1)} Impact\n\n`;
            }
            
            for (const decision of decisionList.slice(0, 5)) {
                summary += `**${decision.decision}**\n`;
                
                if (includeReasoning && decision.reasoning) {
                    summary += `- Reasoning: ${decision.reasoning.substring(0, 200)}\n`;
                }
                
                summary += `- Timestamp: ${decision.timestamp}\n\n`;
            }
        }
        
        return summary;
    }
    
    /**
     * Summarize errors and solutions
     */
    async summarizeErrorsAndSolutions(errors, options = {}) {
        const resolved = errors.filter(e => e.resolved);
        const unresolved = errors.filter(e => !e.resolved);
        
        let summary = '## Errors and Solutions\n\n';
        
        if (resolved.length > 0) {
            summary += `### Resolved (${resolved.length})\n\n`;
            
            for (const error of resolved.slice(0, 5)) {
                summary += `**Error**: ${error.error}\n`;
                summary += `**Solution**: ${error.solution}\n\n`;
            }
        }
        
        if (unresolved.length > 0) {
            summary += `### Unresolved (${unresolved.length})\n\n`;
            
            for (const error of unresolved.slice(0, 5)) {
                summary += `- ${error.error}\n`;
            }
        }
        
        return summary;
    }
    
    /**
     * Create hierarchical summary
     */
    async createHierarchicalSummary(content, depth = 2) {
        const levels = [];
        
        // Level 1: Ultra-compressed (one paragraph)
        levels[0] = this.createOneParagraphSummary(content);
        
        // Level 2: Key points (bullet list)
        if (depth >= 2) {
            levels[1] = this.createKeyPointsSummary(content);
        }
        
        // Level 3: Detailed with examples
        if (depth >= 3) {
            levels[2] = this.createDetailedSummary(content);
        }
        
        return {
            levels,
            depth,
            expand: (level) => levels[Math.min(level - 1, levels.length - 1)]
        };
    }
    
    // Private summarization methods
    
    /**
     * Categorize messages by type
     */
    categorizeMessages(messages) {
        const categorized = {
            conversation: [],
            code: [],
            errors: [],
            decisions: [],
            files: [],
            tasks: []
        };
        
        for (const msg of messages) {
            const content = msg.content || '';
            
            // Detect message type
            if (content.includes('```') || content.includes('function') || content.includes('class')) {
                categorized.code.push(msg);
            } else if (content.toLowerCase().includes('error') || content.toLowerCase().includes('fix')) {
                categorized.errors.push(msg);
            } else if (content.includes('decided') || content.includes('should') || content.includes('will')) {
                categorized.decisions.push(msg);
            } else if (content.match(/\.(js|ts|jsx|tsx|css|html|json)/)) {
                categorized.files.push(msg);
            } else if (content.includes('task') || content.includes('TODO')) {
                categorized.tasks.push(msg);
            } else {
                categorized.conversation.push(msg);
            }
        }
        
        return categorized;
    }
    
    /**
     * Group messages by topic
     */
    groupByTopic(categorized) {
        const topics = {};
        
        // Process each category
        for (const [category, messages] of Object.entries(categorized)) {
            if (messages.length === 0) continue;
            
            // Simple topic extraction based on common words
            const topicMap = new Map();
            
            for (const msg of messages) {
                const topic = this.extractTopic(msg.content) || category;
                
                if (!topicMap.has(topic)) {
                    topicMap.set(topic, []);
                }
                
                topicMap.get(topic).push(msg);
            }
            
            // Merge into main topics
            for (const [topic, msgs] of topicMap) {
                const topicKey = `${category}_${topic}`;
                topics[topicKey] = msgs;
            }
        }
        
        return topics;
    }
    
    /**
     * Extract topic from content
     */
    extractTopic(content) {
        // Common topic keywords
        const topicPatterns = {
            'authentication': /auth|login|user|session/i,
            'database': /database|db|sql|query|schema/i,
            'api': /api|endpoint|route|request|response/i,
            'frontend': /component|react|vue|ui|style/i,
            'backend': /server|express|node|middleware/i,
            'testing': /test|spec|jest|mocha|expect/i,
            'deployment': /deploy|build|docker|ci|cd/i,
            'configuration': /config|env|setup|install/i
        };
        
        for (const [topic, pattern] of Object.entries(topicPatterns)) {
            if (pattern.test(content)) {
                return topic;
            }
        }
        
        return null;
    }
    
    /**
     * Create topic summary
     */
    async createTopicSummary(topic, messages, options) {
        const { depth, preserveCode, preserveErrors } = options;
        
        let summary = `### ${this.formatTopicName(topic)}\n\n`;
        
        // Extract key information
        const keyInfo = this.extractKeyInformation(messages);
        
        // Add overview
        if (keyInfo.overview) {
            summary += `${keyInfo.overview}\n\n`;
        }
        
        // Add key points
        if (keyInfo.keyPoints.length > 0) {
            summary += '**Key Points:**\n';
            for (const point of keyInfo.keyPoints.slice(0, 5)) {
                summary += `- ${point}\n`;
            }
            summary += '\n';
        }
        
        // Add code if preserving
        if (preserveCode && keyInfo.codeSnippets.length > 0) {
            summary += '**Code References:**\n';
            for (const snippet of keyInfo.codeSnippets.slice(0, 2)) {
                summary += `\`\`\`${snippet.language || ''}\n${snippet.code}\n\`\`\`\n`;
            }
        }
        
        // Add errors if preserving
        if (preserveErrors && keyInfo.errors.length > 0) {
            summary += '**Errors Encountered:**\n';
            for (const error of keyInfo.errors.slice(0, 3)) {
                summary += `- ${error}\n`;
            }
            summary += '\n';
        }
        
        return summary;
    }
    
    /**
     * Extract key information from messages
     */
    extractKeyInformation(messages) {
        const info = {
            overview: '',
            keyPoints: [],
            codeSnippets: [],
            errors: [],
            files: new Set(),
            decisions: []
        };
        
        // Build overview from first few messages
        const overviewMsgs = messages.slice(0, 3).map(m => 
            m.content.substring(0, 100)
        );
        info.overview = this.createOverviewFromMessages(overviewMsgs);
        
        // Extract key points
        for (const msg of messages) {
            const points = this.extractKeyPoints(msg.content);
            info.keyPoints.push(...points);
            
            // Extract code
            const code = this.extractCodeSnippets(msg.content);
            info.codeSnippets.push(...code);
            
            // Extract errors
            const errors = this.extractErrors(msg.content);
            info.errors.push(...errors);
            
            // Extract file references
            const files = this.extractFileReferences(msg.content);
            files.forEach(f => info.files.add(f));
        }
        
        // Deduplicate key points
        info.keyPoints = [...new Set(info.keyPoints)];
        
        return info;
    }
    
    /**
     * Create overview from messages
     */
    createOverviewFromMessages(messages) {
        if (messages.length === 0) return '';
        
        // Simple concatenation with ellipsis
        return messages.join('... ').substring(0, 200) + '...';
    }
    
    /**
     * Extract key points from content
     */
    extractKeyPoints(content) {
        const points = [];
        
        // Look for bullet points
        const bulletRegex = /^[\-\*]\s+(.+)$/gm;
        let match;
        
        while ((match = bulletRegex.exec(content)) !== null) {
            points.push(match[1].trim());
        }
        
        // Look for numbered lists
        const numberedRegex = /^\d+\.\s+(.+)$/gm;
        
        while ((match = numberedRegex.exec(content)) !== null) {
            points.push(match[1].trim());
        }
        
        return points;
    }
    
    /**
     * Extract code snippets
     */
    extractCodeSnippets(content) {
        const snippets = [];
        const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        
        while ((match = codeRegex.exec(content)) !== null) {
            snippets.push({
                language: match[1] || 'javascript',
                code: match[2].trim().substring(0, 500) // Limit size
            });
        }
        
        return snippets;
    }
    
    /**
     * Extract errors from content
     */
    extractErrors(content) {
        const errors = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (line.toLowerCase().includes('error') || 
                line.toLowerCase().includes('exception') ||
                line.toLowerCase().includes('failed')) {
                errors.push(line.trim().substring(0, 200));
            }
        }
        
        return errors;
    }
    
    /**
     * Extract file references
     */
    extractFileReferences(content) {
        const files = [];
        const fileRegex = /[\w\-\/]+\.\w+/g;
        let match;
        
        while ((match = fileRegex.exec(content)) !== null) {
            if (!match[0].includes('http') && !match[0].includes('www')) {
                files.push(match[0]);
            }
        }
        
        return files;
    }
    
    /**
     * Compress summaries to target ratio
     */
    async compressToTarget(summaries, targetRatio) {
        const currentSize = this.estimateTokens(summaries);
        const targetSize = currentSize * targetRatio;
        
        // Iteratively compress
        let compressed = [...summaries];
        let iteration = 0;
        
        while (this.estimateTokens(compressed) > targetSize && iteration < 5) {
            compressed = this.performCompression(compressed);
            iteration++;
        }
        
        return compressed;
    }
    
    /**
     * Perform one iteration of compression
     */
    performCompression(summaries) {
        return summaries.map(summary => {
            // Remove redundant words
            let compressed = summary.replace(/\b(the|a|an|is|are|was|were|been|be|have|has|had|do|does|did)\b/gi, '');
            
            // Shorten sentences
            compressed = compressed.replace(/\. [A-Z]/g, match => match.toLowerCase());
            
            // Remove extra whitespace
            compressed = compressed.replace(/\s+/g, ' ').trim();
            
            return compressed;
        });
    }
    
    /**
     * Format final summary
     */
    formatFinalSummary(summaries) {
        const timestamp = new Date().toISOString();
        
        let formatted = `# Conversation Summary\n`;
        formatted += `*Generated: ${timestamp}*\n\n`;
        
        for (const summary of summaries) {
            formatted += summary + '\n\n';
        }
        
        formatted += '---\n';
        formatted += '*This is an AI-generated summary for context preservation*\n';
        
        return formatted;
    }
    
    /**
     * Extract code patterns
     */
    extractCodePatterns(content) {
        const patterns = {
            patterns: [],
            dependencies: [],
            framework: null,
            style: {}
        };
        
        // Detect async/await
        if (content.includes('async') && content.includes('await')) {
            patterns.patterns.push('async/await');
        }
        
        // Detect arrow functions
        if (content.includes('=>')) {
            patterns.patterns.push('arrow-functions');
            patterns.style.functions = 'arrow';
        }
        
        // Detect React
        if (content.includes('React') || content.includes('useState')) {
            patterns.framework = 'react';
        }
        
        // Extract imports
        const importRegex = /import .+ from ['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
            patterns.dependencies.push(match[1]);
        }
        
        return patterns;
    }
    
    /**
     * Summarize patterns
     */
    summarizePatterns(patterns) {
        const frequency = {};
        
        for (const pattern of patterns) {
            frequency[pattern] = (frequency[pattern] || 0) + 1;
        }
        
        const sorted = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        return sorted.map(([pattern, count]) => 
            `- ${pattern} (${count} occurrences)`
        ).join('\n');
    }
    
    /**
     * Format style guide
     */
    formatStyleGuide(style) {
        if (Object.keys(style).length === 0) {
            return 'No specific style detected';
        }
        
        return Object.entries(style)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join('\n');
    }
    
    /**
     * Format topic name
     */
    formatTopicName(topic) {
        return topic
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' - ');
    }
    
    /**
     * Create one paragraph summary
     */
    createOneParagraphSummary(content) {
        const sentences = [];
        
        // Extract first sentence from each section
        const sections = content.split('\n\n');
        for (const section of sections.slice(0, 3)) {
            const firstSentence = section.match(/^[^.!?]+[.!?]/);
            if (firstSentence) {
                sentences.push(firstSentence[0]);
            }
        }
        
        return sentences.join(' ');
    }
    
    /**
     * Create key points summary
     */
    createKeyPointsSummary(content) {
        const points = this.extractKeyPoints(content);
        
        if (points.length === 0) {
            // Generate points from content
            const lines = content.split('\n').filter(line => line.trim());
            return lines.slice(0, 5).map(line => `• ${line.substring(0, 100)}`).join('\n');
        }
        
        return points.slice(0, 10).map(point => `• ${point}`).join('\n');
    }
    
    /**
     * Create detailed summary
     */
    createDetailedSummary(content) {
        // Keep more of the original content with light editing
        return content
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.substring(0, 200))
            .join('\n');
    }
    
    /**
     * Estimate token count
     */
    estimateTokens(content) {
        if (Array.isArray(content)) {
            content = content.join(' ');
        }
        
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        return Math.ceil(text.length / 4); // Rough estimate
    }
    
    /**
     * Save summary to disk
     */
    async saveSummary(summaryId, summary) {
        const summaryFile = path.join(this.config.summaryPath, `${summaryId}.md`);
        await fs.writeFile(summaryFile, summary);
        
        // Update history
        this.summaryHistory.push({
            id: summaryId,
            timestamp: new Date().toISOString(),
            size: summary.length
        });
        
        // Keep only last 100 summaries
        if (this.summaryHistory.length > 100) {
            const toRemove = this.summaryHistory.shift();
            await fs.remove(path.join(this.config.summaryPath, `${toRemove.id}.md`));
        }
    }
    
    /**
     * Load summary templates
     */
    async loadTemplates() {
        // Could load custom templates from disk
        // For now, use built-in templates
        this.templates = {
            conversation: '# Conversation Summary\n\n{{content}}\n',
            code: '# Code Summary\n\n{{content}}\n',
            errors: '# Error Summary\n\n{{content}}\n',
            decisions: '# Decision Summary\n\n{{content}}\n'
        };
    }
}

module.exports = { ClaudeSummarizer };