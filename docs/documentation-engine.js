/**
 * Active Documentation Engine
 * Automatically generates and maintains comprehensive documentation
 * Updates documentation in real-time as code and projects evolve
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');

class DocumentationEngine {
    constructor(nexusAI, config = {}) {
        this.nexusAI = nexusAI;
        this.config = {
            outputPath: config.outputPath || './docs',
            autoUpdate: config.autoUpdate !== false,
            formats: config.formats || ['markdown', 'html'],
            includeCodeExamples: config.includeCodeExamples !== false,
            generateAPI: config.generateAPI !== false,
            trackChanges: config.trackChanges !== false,
            ...config
        };
        
        this.logger = new Logger('DocumentationEngine');
        this.templates = new Map();
        this.generators = new Map();
        this.watchers = new Map();
        
        // Documentation state
        this.projectDocs = new Map();
        this.apiDocs = new Map();
        this.changelog = [];
        
        // Statistics
        this.stats = {
            documentsGenerated: 0,
            autoUpdates: 0,
            lastUpdate: null,
            totalWords: 0
        };
        
        this.setupGenerators();
        this.setupTemplates();
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info('🔧 Initializing Active Documentation Engine...');
        
        try {
            // Ensure output directory exists
            await fs.ensureDir(this.config.outputPath);
            
            // Load existing documentation state
            await this.loadDocumentationState();
            
            // Setup file watchers if auto-update is enabled
            if (this.config.autoUpdate) {
                await this.setupFileWatchers();
            }
            
            this.isInitialized = true;
            this.logger.info('✅ Documentation Engine initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Documentation Engine:', error);
            throw error;
        }
    }

    /**
     * Generate comprehensive project documentation
     */
    async generateProjectDocumentation(projectContext) {
        this.logger.info(`📚 Generating documentation for project: ${projectContext.projectName}`);
        
        try {
            const docs = {
                readme: await this.generateREADME(projectContext),
                architecture: await this.generateArchitectureDoc(projectContext),
                api: await this.generateAPIDocumentation(projectContext),
                setup: await this.generateSetupGuide(projectContext),
                contributing: await this.generateContributingGuide(projectContext),
                changelog: await this.generateChangelog(projectContext),
                deployment: await this.generateDeploymentGuide(projectContext)
            };
            
            // Write documentation files
            await this.writeDocumentationFiles(docs, projectContext.projectName);
            
            // Update project docs state
            this.projectDocs.set(projectContext.projectName, {
                ...docs,
                lastUpdated: new Date().toISOString(),
                context: projectContext
            });
            
            // Save state
            await this.saveDocumentationState();
            
            this.stats.documentsGenerated += Object.keys(docs).length;
            this.stats.lastUpdate = new Date().toISOString();
            
            this.logger.info(`✅ Generated ${Object.keys(docs).length} documentation files`);
            return docs;
            
        } catch (error) {
            this.logger.error('Failed to generate project documentation:', error);
            throw error;
        }
    }

    /**
     * Generate README.md file
     */
    async generateREADME(projectContext) {
        const template = this.templates.get('readme');
        
        const content = await this.nexusAI.ask({
            question: `Generate a comprehensive README.md for this project: ${JSON.stringify(projectContext)}`,
            taskType: 'creative',
            systemPrompt: template
        });
        
        return this.enhanceREADME(content.content, projectContext);
    }

    enhanceREADME(content, projectContext) {
        const enhanced = `# ${projectContext.projectName}

${projectContext.description || 'AI-generated project description'}

## 🚀 Quick Start

\`\`\`bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Start the application
npm start
\`\`\`

${content}

## 📊 Project Status

- **Phase**: ${projectContext.currentPhase || 'Development'}
- **Tech Stack**: ${projectContext.technologies ? projectContext.technologies.join(', ') : 'TBD'}
- **Architecture**: ${projectContext.architecture || 'Modern'}
- **Last Updated**: ${new Date().toISOString().split('T')[0]}

## 🤖 AI-Generated

This project was created and is maintained by the Nexus AI Framework. Documentation is automatically updated as the project evolves.

---

*Built with ❤️ by [Nexus AI Framework](https://nexusai.dev)*
`;

        return enhanced;
    }

    /**
     * Generate architecture documentation
     */
    async generateArchitectureDoc(projectContext) {
        const prompt = `Create detailed architecture documentation for: ${JSON.stringify(projectContext)}

Include:
1. System Overview
2. Component Architecture 
3. Data Flow Diagrams (in mermaid syntax)
4. Technology Stack Details
5. Design Patterns Used
6. Scalability Considerations
7. Security Architecture
8. Performance Considerations

Use proper markdown formatting with diagrams where appropriate.`;
        
        const response = await this.nexusAI.ask({
            question: prompt,
            taskType: 'technical',
            includeContext: true
        });
        
        return response.content;
    }

    /**
     * Generate API documentation
     */
    async generateAPIDocumentation(projectContext) {
        if (!this.config.generateAPI) {
            return '# API Documentation\n\nAPI documentation generation is disabled.';
        }
        
        try {
            // Analyze project files for API endpoints
            const apiEndpoints = await this.discoverAPIEndpoints(projectContext);
            
            if (apiEndpoints.length === 0) {
                return '# API Documentation\n\nNo API endpoints found in this project.';
            }
            
            const prompt = `Generate comprehensive API documentation for these endpoints: ${JSON.stringify(apiEndpoints)}

Include:
1. Overview and Base URL
2. Authentication methods
3. Endpoint documentation with:
   - HTTP method and path
   - Parameters (query, path, body)
   - Response format and examples
   - Error codes and handling
4. Rate limiting information
5. SDK/client examples
6. Postman collection reference

Format as professional API documentation in markdown.`;
            
            const response = await this.nexusAI.ask({
                question: prompt,
                taskType: 'technical'
            });
            
            return response.content;
            
        } catch (error) {
            this.logger.warn('Failed to generate API documentation:', error.message);
            return '# API Documentation\n\nAPI documentation generation failed. Please generate manually.';
        }
    }

    /**
     * Generate setup guide
     */
    async generateSetupGuide(projectContext) {
        const template = this.templates.get('setup');
        
        const prompt = `Create a detailed setup guide for: ${JSON.stringify(projectContext)}

Include:
1. Prerequisites and system requirements
2. Installation steps
3. Configuration options
4. Environment variables
5. Database setup (if applicable)
6. Troubleshooting common issues
7. Verification steps
8. Next steps after setup

Make it beginner-friendly with clear step-by-step instructions.`;
        
        const response = await this.nexusAI.ask({
            question: prompt,
            taskType: 'technical',
            systemPrompt: template
        });
        
        return response.content;
    }

    /**
     * Generate contributing guide
     */
    async generateContributingGuide(projectContext) {
        const template = this.templates.get('contributing');
        
        return `# Contributing to ${projectContext.projectName}

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature/amazing-feature\`
3. Make your changes
4. Run tests: \`npm test\`
5. Commit changes: \`git commit -m 'Add amazing feature'\`
6. Push to branch: \`git push origin feature/amazing-feature\`
7. Open a Pull Request

## 📋 Development Guidelines

### Code Style
- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure all tests pass

### Commit Messages
Use conventional commit format:
- \`feat: add new feature\`
- \`fix: resolve bug\`
- \`docs: update documentation\`
- \`style: formatting changes\`
- \`refactor: code refactoring\`
- \`test: add or update tests\`

### Pull Request Process
1. Update documentation if needed
2. Add tests for new features
3. Ensure CI/CD passes
4. Request review from maintainers
5. Address feedback promptly

## 🐛 Bug Reports

When reporting bugs, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details
- Screenshots (if applicable)

## 💡 Feature Requests

For feature requests, please:
- Check existing issues first
- Provide clear use case
- Explain expected behavior
- Consider implementation approach

## 📞 Getting Help

- Open an issue for bugs or features
- Join our community discussions
- Check existing documentation

Thank you for contributing! 🎉
`;
    }

    /**
     * Generate changelog
     */
    async generateChangelog(projectContext) {
        const existingChangelog = this.changelog.filter(entry => 
            entry.project === projectContext.projectName
        );
        
        if (existingChangelog.length === 0) {
            return `# Changelog

All notable changes to ${projectContext.projectName} will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup
- Core functionality implementation
- Comprehensive documentation

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

*This changelog is automatically maintained by Nexus AI Framework*
`;
        }
        
        // Generate changelog from existing entries
        let changelog = `# Changelog\n\n`;
        
        const groupedEntries = this.groupChangelogEntries(existingChangelog);
        
        for (const [version, entries] of Object.entries(groupedEntries)) {
            changelog += `## [${version}] - ${entries[0].date}\n\n`;
            
            const categorized = this.categorizeChanges(entries);
            
            Object.entries(categorized).forEach(([category, changes]) => {
                if (changes.length > 0) {
                    changelog += `### ${category}\n`;
                    changes.forEach(change => {
                        changelog += `- ${change.description}\n`;
                    });
                    changelog += '\n';
                }
            });
        }
        
        return changelog;
    }

    /**
     * Generate deployment guide
     */
    async generateDeploymentGuide(projectContext) {
        const prompt = `Create a comprehensive deployment guide for: ${JSON.stringify(projectContext)}

Include:
1. Deployment options (cloud, on-premise, containers)
2. Environment setup
3. Configuration for production
4. Security considerations
5. Performance optimization
6. Monitoring and logging
7. Backup and recovery
8. Scaling strategies
9. CI/CD pipeline setup
10. Troubleshooting deployment issues

Make it practical with specific commands and configurations.`;
        
        const response = await this.nexusAI.ask({
            question: prompt,
            taskType: 'technical'
        });
        
        return response.content;
    }

    /**
     * Update documentation when code changes
     */
    async updateDocumentation(filePath, changeType, projectContext) {
        if (!this.config.autoUpdate) return;
        
        this.logger.debug(`Updating documentation for ${filePath} (${changeType})`);
        
        try {
            // Determine what documentation needs updating
            const updatesNeeded = this.determineDocumentationUpdates(filePath, changeType);
            
            for (const update of updatesNeeded) {
                await this.performDocumentationUpdate(update, projectContext);
            }
            
            this.stats.autoUpdates++;
            
        } catch (error) {
            this.logger.error('Failed to update documentation:', error);
        }
    }

    /**
     * Setup document generators
     */
    setupGenerators() {
        this.generators.set('readme', this.generateREADME.bind(this));
        this.generators.set('architecture', this.generateArchitectureDoc.bind(this));
        this.generators.set('api', this.generateAPIDocumentation.bind(this));
        this.generators.set('setup', this.generateSetupGuide.bind(this));
        this.generators.set('contributing', this.generateContributingGuide.bind(this));
        this.generators.set('changelog', this.generateChangelog.bind(this));
        this.generators.set('deployment', this.generateDeploymentGuide.bind(this));
    }

    /**
     * Setup documentation templates
     */
    setupTemplates() {
        this.templates.set('readme', `You are a technical writing expert. Create a comprehensive, engaging README.md that includes:
- Clear project description and purpose
- Installation and setup instructions
- Usage examples with code snippets
- API reference (if applicable)
- Contributing guidelines
- License information
- Acknowledgments

Use proper markdown formatting, badges, and make it visually appealing.`);

        this.templates.set('setup', `You are a DevOps expert. Create detailed setup instructions that assume no prior knowledge:
- System requirements
- Step-by-step installation
- Configuration details
- Environment setup
- Verification steps
- Common troubleshooting

Make instructions clear and error-proof.`);

        this.templates.set('contributing', `You are an open source maintainer. Create welcoming contributing guidelines that encourage participation while maintaining quality standards.`);
    }

    /**
     * Helper methods
     */
    async discoverAPIEndpoints(projectContext) {
        // Placeholder for API endpoint discovery
        // Would analyze project files to find REST endpoints, GraphQL schemas, etc.
        return [];
    }

    determineDocumentationUpdates(filePath, changeType) {
        const updates = [];
        
        // Determine which documents need updating based on file changes
        if (filePath.includes('package.json')) {
            updates.push({ type: 'readme', reason: 'dependencies changed' });
            updates.push({ type: 'setup', reason: 'installation requirements may have changed' });
        }
        
        if (filePath.includes('/api/') || filePath.includes('routes')) {
            updates.push({ type: 'api', reason: 'API endpoints may have changed' });
        }
        
        if (filePath.includes('README')) {
            updates.push({ type: 'readme', reason: 'README file changed' });
        }
        
        return updates;
    }

    async performDocumentationUpdate(update, projectContext) {
        const generator = this.generators.get(update.type);
        if (generator) {
            const content = await generator(projectContext);
            await this.writeDocumentationFile(update.type, content, projectContext.projectName);
            
            this.logger.debug(`Updated ${update.type} documentation: ${update.reason}`);
        }
    }

    async writeDocumentationFiles(docs, projectName) {
        const projectPath = path.join(this.config.outputPath, projectName);
        await fs.ensureDir(projectPath);
        
        for (const [docType, content] of Object.entries(docs)) {
            await this.writeDocumentationFile(docType, content, projectName);
        }
    }

    async writeDocumentationFile(docType, content, projectName) {
        const filename = this.getDocumentationFilename(docType);
        const projectPath = path.join(this.config.outputPath, projectName);
        const filePath = path.join(projectPath, filename);
        
        await fs.writeFile(filePath, content, 'utf8');
        
        // Also generate HTML if configured
        if (this.config.formats.includes('html')) {
            await this.generateHTMLVersion(filePath, content);
        }
    }

    getDocumentationFilename(docType) {
        const filenames = {
            readme: 'README.md',
            architecture: 'ARCHITECTURE.md',
            api: 'API.md',
            setup: 'SETUP.md',
            contributing: 'CONTRIBUTING.md',
            changelog: 'CHANGELOG.md',
            deployment: 'DEPLOYMENT.md'
        };
        
        return filenames[docType] || `${docType.toUpperCase()}.md`;
    }

    async generateHTMLVersion(markdownPath, content) {
        // Placeholder for HTML generation
        // Would use a markdown-to-HTML converter
        this.logger.debug(`HTML generation for ${markdownPath} not implemented`);
    }

    async setupFileWatchers() {
        // Placeholder for file watching setup
        // Would watch for file changes and trigger documentation updates
        this.logger.debug('File watchers setup not implemented');
    }

    groupChangelogEntries(entries) {
        const grouped = {};
        
        entries.forEach(entry => {
            const version = entry.version || 'Unreleased';
            if (!grouped[version]) {
                grouped[version] = [];
            }
            grouped[version].push(entry);
        });
        
        return grouped;
    }

    categorizeChanges(entries) {
        const categories = {
            'Added': [],
            'Changed': [],
            'Deprecated': [],
            'Removed': [],
            'Fixed': [],
            'Security': []
        };
        
        entries.forEach(entry => {
            const category = entry.category || 'Changed';
            if (categories[category]) {
                categories[category].push(entry);
            }
        });
        
        return categories;
    }

    async loadDocumentationState() {
        try {
            const statePath = path.join('.nexus', 'docs-state.json');
            if (await fs.pathExists(statePath)) {
                const state = await fs.readJson(statePath);
                
                this.projectDocs = new Map(Object.entries(state.projectDocs || {}));
                this.apiDocs = new Map(Object.entries(state.apiDocs || {}));
                this.changelog = state.changelog || [];
                this.stats = { ...this.stats, ...state.stats };
                
                this.logger.debug('Documentation state loaded');
            }
        } catch (error) {
            this.logger.warn('Failed to load documentation state:', error.message);
        }
    }

    async saveDocumentationState() {
        try {
            await fs.ensureDir('.nexus');
            const statePath = path.join('.nexus', 'docs-state.json');
            
            const state = {
                projectDocs: Object.fromEntries(this.projectDocs),
                apiDocs: Object.fromEntries(this.apiDocs),
                changelog: this.changelog,
                stats: this.stats,
                lastSaved: new Date().toISOString()
            };
            
            await fs.writeJson(statePath, state, { spaces: 2 });
            
        } catch (error) {
            this.logger.error('Failed to save documentation state:', error);
        }
    }

    /**
     * Add changelog entry
     */
    addChangelogEntry(projectName, entry) {
        this.changelog.push({
            project: projectName,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            ...entry
        });
    }

    /**
     * Get documentation statistics
     */
    getStats() {
        return {
            ...this.stats,
            projectsDocumented: this.projectDocs.size,
            totalChangelogs: this.changelog.length
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('Cleaning up Documentation Engine...');
        
        // Save current state
        await this.saveDocumentationState();
        
        // Clear watchers
        this.watchers.clear();
        
        this.logger.info('Documentation Engine cleanup completed');
    }
}

module.exports = { DocumentationEngine };