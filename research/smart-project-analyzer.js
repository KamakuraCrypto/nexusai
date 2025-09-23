/**
 * Smart Project Analyzer
 * AI-powered project analysis that creates comprehensive documentation
 * Prevents AI "retraining" by building persistent knowledge about codebases
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');

class SmartProjectAnalyzer {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('SmartProjectAnalyzer');
        
        this.config = {
            maxFileSize: 1000000, // 1MB max per file
            excludePatterns: [
                'node_modules', '.git', 'dist', 'build', '.next', 
                'coverage', '.nyc_output', 'logs', '.DS_Store'
            ],
            includeExtensions: [
                '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', 
                '.rs', '.cpp', '.c', '.cs', '.php', '.rb', '.swift',
                '.json', '.yaml', '.yml', '.md', '.txt', '.config.js'
            ],
            analysisDepth: 'comprehensive'
        };
        
        this.analysisCache = new Map();
        this.projectKnowledge = new Map();
        
        this.stats = {
            projectsAnalyzed: 0,
            filesAnalyzed: 0,
            documentationGenerated: 0,
            patternsIdentified: 0,
            dependenciesMappe: 0
        };
    }
    
    /**
     * Analyze entire project and generate comprehensive documentation
     */
    async analyzeProject(projectPath, options = {}) {
        const {
            generateDocs = true,
            aiOptimize = true,
            includeMetrics = true,
            createComponentMap = true,
            maxDepth = 10
        } = options;
        
        this.logger.info(`🔍 Starting comprehensive project analysis: ${projectPath}`);
        
        try {
            const startTime = Date.now();
            
            // Phase 1: Project Structure Analysis
            this.logger.info('📊 Phase 1: Analyzing project structure...');
            const structureAnalysis = await this.analyzeProjectStructure(projectPath, maxDepth);
            
            // Phase 2: Code Analysis
            this.logger.info('🔍 Phase 2: Analyzing code patterns and architecture...');
            const codeAnalysis = await this.analyzeCodePatterns(structureAnalysis.files);
            
            // Phase 3: Dependency Analysis
            this.logger.info('📦 Phase 3: Mapping dependencies and relationships...');
            const dependencyAnalysis = await this.analyzeDependencies(structureAnalysis.files);
            
            // Phase 4: AI-Powered Pattern Recognition
            this.logger.info('🧠 Phase 4: AI pattern recognition and insights...');
            const aiInsights = await this.generateAIInsights(structureAnalysis, codeAnalysis, dependencyAnalysis);
            
            // Phase 5: Component Relationship Mapping
            if (createComponentMap) {
                this.logger.info('🗺️ Phase 5: Creating component relationship map...');
                aiInsights.componentMap = await this.createComponentMap(structureAnalysis.files, dependencyAnalysis);
            }
            
            // Phase 6: Comprehensive Documentation Generation
            if (generateDocs) {
                this.logger.info('📚 Phase 6: Generating comprehensive AI-readable documentation...');
                aiInsights.documentation = await this.generateComprehensiveDocumentation(
                    projectPath, structureAnalysis, codeAnalysis, dependencyAnalysis, aiInsights
                );
            }
            
            const analysisTime = Date.now() - startTime;
            
            // Create final comprehensive analysis
            const comprehensiveAnalysis = {
                projectPath,
                analyzedAt: new Date().toISOString(),
                analysisTime,
                structure: structureAnalysis,
                codePatterns: codeAnalysis,
                dependencies: dependencyAnalysis,
                aiInsights,
                metrics: includeMetrics ? await this.calculateProjectMetrics(structureAnalysis, codeAnalysis) : null,
                summary: await this.generateProjectSummary(structureAnalysis, codeAnalysis, dependencyAnalysis, aiInsights)
            };
            
            // Cache the analysis for future reference
            this.projectKnowledge.set(projectPath, comprehensiveAnalysis);
            
            // Save to persistent storage
            await this.saveProjectAnalysis(projectPath, comprehensiveAnalysis);
            
            this.stats.projectsAnalyzed++;
            this.stats.filesAnalyzed += structureAnalysis.totalFiles;
            this.stats.documentationGenerated += generateDocs ? 1 : 0;
            
            this.logger.info(`✅ Project analysis completed in ${(analysisTime / 1000).toFixed(2)}s`);
            this.logger.info(`📊 Analyzed ${structureAnalysis.totalFiles} files, ${codeAnalysis.patterns.length} patterns identified`);
            
            return comprehensiveAnalysis;
            
        } catch (error) {
            this.logger.error('Project analysis failed:', error);
            throw error;
        }
    }
    
    /**
     * Analyze project structure and file organization
     */
    async analyzeProjectStructure(projectPath, maxDepth = 10) {
        const structure = {
            root: projectPath,
            directories: [],
            files: [],
            totalFiles: 0,
            totalDirectories: 0,
            filesByType: {},
            deepestPath: 0,
            largestFile: null,
            configFiles: [],
            mainEntryPoints: []
        };
        
        await this._scanDirectory(projectPath, projectPath, structure, 0, maxDepth);
        
        // Identify main entry points
        structure.mainEntryPoints = await this.identifyEntryPoints(structure.files);
        
        // Categorize files by type
        structure.filesByType = this.categorizeFilesByType(structure.files);
        
        // Find configuration files
        structure.configFiles = this.findConfigurationFiles(structure.files);
        
        return structure;
    }
    
    /**
     * Scan directory recursively
     */
    async _scanDirectory(currentPath, rootPath, structure, depth, maxDepth) {
        if (depth > maxDepth) return;
        
        try {
            const items = await fs.readdir(currentPath);
            
            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const relativePath = path.relative(rootPath, itemPath);
                
                // Skip excluded patterns
                if (this.shouldExclude(relativePath)) {
                    continue;
                }
                
                const stat = await fs.stat(itemPath);
                
                if (stat.isDirectory()) {
                    structure.directories.push({
                        name: item,
                        path: itemPath,
                        relativePath,
                        depth
                    });
                    structure.totalDirectories++;
                    
                    await this._scanDirectory(itemPath, rootPath, structure, depth + 1, maxDepth);
                    
                } else if (stat.isFile()) {
                    const fileInfo = await this.analyzeFile(itemPath, relativePath, stat);
                    if (fileInfo) {
                        structure.files.push(fileInfo);
                        structure.totalFiles++;
                        
                        if (depth > structure.deepestPath) {
                            structure.deepestPath = depth;
                        }
                        
                        if (!structure.largestFile || stat.size > structure.largestFile.size) {
                            structure.largestFile = { path: relativePath, size: stat.size };
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to scan directory ${currentPath}:`, error.message);
        }
    }
    
    /**
     * Analyze individual file
     */
    async analyzeFile(filePath, relativePath, stat) {
        const ext = path.extname(filePath);
        
        // Skip files that are too large or have excluded extensions
        if (stat.size > this.config.maxFileSize || 
            !this.config.includeExtensions.includes(ext)) {
            return null;
        }
        
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            return {
                name: path.basename(filePath),
                path: filePath,
                relativePath,
                extension: ext,
                size: stat.size,
                lines: content.split('\\n').length,
                content: content.length < 10000 ? content : content.substring(0, 10000) + '...',
                modifiedAt: stat.mtime.toISOString(),
                imports: this.extractImports(content, ext),
                exports: this.extractExports(content, ext),
                functions: this.extractFunctions(content, ext),
                classes: this.extractClasses(content, ext),
                complexity: this.calculateComplexity(content, ext)
            };
            
        } catch (error) {
            this.logger.warn(`Failed to analyze file ${filePath}:`, error.message);
            return {
                name: path.basename(filePath),
                path: filePath,
                relativePath,
                extension: ext,
                size: stat.size,
                error: error.message
            };
        }
    }
    
    /**
     * Analyze code patterns across the project
     */
    async analyzeCodePatterns(files) {
        const patterns = {
            architecturalPatterns: [],
            designPatterns: [],
            namingConventions: [],
            codeOrganization: [],
            testingPatterns: [],
            errorHandling: [],
            asyncPatterns: [],
            stateManagement: []
        };
        
        // Extract code samples for AI analysis
        const codeSamples = files
            .filter(file => !file.error && this.isCodeFile(file.extension))
            .slice(0, 50) // Limit for performance
            .map(file => ({
                path: file.relativePath,
                extension: file.extension,
                content: file.content,
                functions: file.functions || [],
                classes: file.classes || []
            }));
        
        if (codeSamples.length === 0) {
            return patterns;
        }
        
        // Use AI to identify patterns
        const patternAnalysisPrompt = `
Analyze these code samples and identify patterns:

CODE_SAMPLES: ${JSON.stringify(codeSamples, null, 2)}

Identify and categorize patterns in:

1. ARCHITECTURAL PATTERNS:
   - MVC, MVP, MVVM, Component-based, Layered, etc.
   - How the code is structured at a high level

2. DESIGN PATTERNS:
   - Singleton, Factory, Observer, Strategy, etc.
   - Specific coding patterns used

3. NAMING CONVENTIONS:
   - camelCase, snake_case, PascalCase usage
   - Consistency across the codebase

4. CODE ORGANIZATION:
   - How files are structured
   - How imports/exports are organized
   - Module organization patterns

5. TESTING PATTERNS:
   - Testing frameworks used
   - Test organization and naming
   - Mock and stub patterns

6. ERROR HANDLING:
   - try/catch usage
   - Error propagation patterns
   - Logging patterns

7. ASYNC PATTERNS:
   - Promise, async/await usage
   - Callback patterns
   - Event handling

8. STATE MANAGEMENT:
   - How application state is managed
   - Data flow patterns

Return structured JSON with:
- Pattern name and description
- Frequency/prevalence
- Quality assessment
- Recommendations for improvement

{
    "architecturalPatterns": [
        {
            "pattern": "Component-based Architecture",
            "description": "React components with clear separation",
            "frequency": "high",
            "quality": "good",
            "examples": ["path/to/example"],
            "recommendations": ["suggestion"]
        }
    ],
    "designPatterns": [...],
    "namingConventions": [...],
    "codeOrganization": [...],
    "testingPatterns": [...],
    "errorHandling": [...],
    "asyncPatterns": [...],
    "stateManagement": [...]
}`;

        try {
            const aiResponse = await this.nexusCore.aiInterface.generateResponse(patternAnalysisPrompt, {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                responseFormat: 'json'
            });
            
            const analyzedPatterns = JSON.parse(aiResponse);
            
            // Merge with our basic pattern detection
            return {
                ...patterns,
                ...analyzedPatterns,
                analysisMetadata: {
                    samplesAnalyzed: codeSamples.length,
                    totalFiles: files.length,
                    analyzedAt: new Date().toISOString()
                }
            };
            
        } catch (error) {
            this.logger.error('Failed to analyze code patterns with AI:', error);
            return patterns;
        }
    }
    
    /**
     * Analyze dependencies and relationships
     */
    async analyzeDependencies(files) {
        const dependencies = {
            external: new Set(),
            internal: new Map(),
            packageManagers: [],
            frameworks: [],
            relationships: [],
            dependencyGraph: {}
        };
        
        // Find package files
        const packageFiles = files.filter(file => 
            ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml'].includes(file.name)
        );
        
        // Analyze package dependencies
        for (const packageFile of packageFiles) {
            try {
                if (packageFile.name === 'package.json') {
                    const packageData = JSON.parse(packageFile.content);
                    dependencies.packageManagers.push('npm');
                    
                    // Add external dependencies
                    Object.keys(packageData.dependencies || {}).forEach(dep => 
                        dependencies.external.add(dep)
                    );
                    Object.keys(packageData.devDependencies || {}).forEach(dep => 
                        dependencies.external.add(dep)
                    );
                    
                    // Identify frameworks
                    dependencies.frameworks.push(...this.identifyFrameworks(packageData));
                }
                // Add other package manager support as needed
            } catch (error) {
                this.logger.warn(`Failed to parse ${packageFile.name}:`, error.message);
            }
        }
        
        // Build internal dependency graph
        for (const file of files) {
            if (file.imports && file.imports.length > 0) {
                dependencies.dependencyGraph[file.relativePath] = file.imports;
                
                for (const importPath of file.imports) {
                    if (this.isInternalImport(importPath, files)) {
                        if (!dependencies.internal.has(file.relativePath)) {
                            dependencies.internal.set(file.relativePath, []);
                        }
                        dependencies.internal.get(file.relativePath).push(importPath);
                    }
                }
            }
        }
        
        return {
            external: Array.from(dependencies.external),
            internal: Object.fromEntries(dependencies.internal),
            packageManagers: dependencies.packageManagers,
            frameworks: dependencies.frameworks,
            dependencyGraph: dependencies.dependencyGraph,
            summary: {
                totalExternal: dependencies.external.size,
                totalInternal: dependencies.internal.size,
                mostConnectedFiles: this.findMostConnectedFiles(dependencies.internal)
            }
        };
    }
    
    /**
     * Generate AI-powered insights about the project
     */
    async generateAIInsights(structureAnalysis, codeAnalysis, dependencyAnalysis) {
        const insightsPrompt = `
Analyze this comprehensive project data and generate intelligent insights:

PROJECT_STRUCTURE: ${JSON.stringify(structureAnalysis, null, 2)}
CODE_PATTERNS: ${JSON.stringify(codeAnalysis, null, 2)}
DEPENDENCIES: ${JSON.stringify(dependencyAnalysis, null, 2)}

Generate insights about:

1. PROJECT TYPE & PURPOSE:
   - What type of application/library this is
   - Its primary purpose and domain
   - Target audience and use cases

2. ARCHITECTURE ASSESSMENT:
   - Overall architecture quality
   - Strengths and weaknesses
   - Scalability considerations

3. CODE QUALITY:
   - Code organization quality
   - Consistency and maintainability
   - Technical debt indicators

4. TECHNOLOGY STACK:
   - Primary technologies used
   - Modern vs legacy approaches
   - Alignment with best practices

5. DEVELOPMENT MATURITY:
   - Project maturity level
   - Testing coverage assessment
   - Documentation quality

6. IMPROVEMENT OPPORTUNITIES:
   - Specific areas for improvement
   - Refactoring suggestions
   - Performance optimization opportunities

7. SECURITY CONSIDERATIONS:
   - Potential security concerns
   - Best practice adherence
   - Dependency security assessment

8. DEVELOPER EXPERIENCE:
   - How easy it is to understand and contribute
   - Onboarding complexity
   - Development workflow quality

Return comprehensive JSON analysis with specific, actionable insights.`;

        try {
            const aiInsights = await this.nexusCore.aiInterface.generateResponse(insightsPrompt, {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                responseFormat: 'json'
            });
            
            return JSON.parse(aiInsights);
            
        } catch (error) {
            this.logger.error('Failed to generate AI insights:', error);
            return {
                projectType: 'Unknown',
                architectureAssessment: 'Analysis failed',
                codeQuality: 'Unable to assess',
                technologyStack: [],
                developmentMaturity: 'Unknown',
                improvementOpportunities: [],
                securityConsiderations: [],
                developerExperience: 'Unable to assess'
            };
        }
    }
    
    /**
     * Create component relationship map
     */
    async createComponentMap(files, dependencyAnalysis) {
        const componentMap = {
            nodes: [],
            edges: [],
            clusters: [],
            entryPoints: [],
            utilities: [],
            components: []
        };
        
        // Create nodes for each file
        for (const file of files) {
            if (this.isCodeFile(file.extension)) {
                componentMap.nodes.push({
                    id: file.relativePath,
                    name: file.name,
                    type: this.classifyFileType(file),
                    size: file.size,
                    complexity: file.complexity || 1,
                    functions: file.functions?.length || 0,
                    classes: file.classes?.length || 0
                });
            }
        }
        
        // Create edges based on dependencies
        for (const [source, targets] of Object.entries(dependencyAnalysis.internal)) {
            for (const target of targets) {
                componentMap.edges.push({
                    source,
                    target,
                    type: 'dependency'
                });
            }
        }
        
        // Use AI to identify logical clusters
        const clusterPrompt = `
Based on this component map data, identify logical clusters of related components:

NODES: ${JSON.stringify(componentMap.nodes.slice(0, 50), null, 2)}
EDGES: ${JSON.stringify(componentMap.edges.slice(0, 100), null, 2)}

Identify:
1. Logical groupings of components (features, layers, modules)
2. Entry points and main flows
3. Utility/helper components
4. Core vs peripheral components
5. Recommended component organization

Return structured clusters with descriptions.`;

        try {
            const clusterAnalysis = await this.nexusCore.aiInterface.generateResponse(clusterPrompt, {
                provider: 'gpt',
                model: 'gpt-4o',
                responseFormat: 'json'
            });
            
            const clusters = JSON.parse(clusterAnalysis);
            componentMap.clusters = clusters.clusters || [];
            componentMap.entryPoints = clusters.entryPoints || [];
            componentMap.utilities = clusters.utilities || [];
            
        } catch (error) {
            this.logger.warn('Failed to generate component clusters:', error.message);
        }
        
        return componentMap;
    }
    
    /**
     * Generate comprehensive AI-readable documentation
     */
    async generateComprehensiveDocumentation(projectPath, structure, codePatterns, dependencies, insights) {
        this.logger.info('📝 Generating comprehensive AI-readable documentation...');
        
        const documentation = {
            overview: await this.generateProjectOverview(projectPath, structure, insights),
            architecture: await this.generateArchitectureDocumentation(structure, codePatterns, insights),
            components: await this.generateComponentDocumentation(structure.files),
            apis: await this.generateAPIDocumentation(structure.files),
            setup: await this.generateSetupDocumentation(dependencies),
            development: await this.generateDevelopmentGuide(structure, codePatterns),
            testing: await this.generateTestingGuide(structure, codePatterns),
            deployment: await this.generateDeploymentGuide(structure, dependencies),
            troubleshooting: await this.generateTroubleshootingGuide(insights),
            contributing: await this.generateContributingGuide(structure, codePatterns)
        };
        
        // Save documentation files
        const docsPath = path.join(projectPath, '.nexus', 'documentation');
        await fs.ensureDir(docsPath);
        
        for (const [section, content] of Object.entries(documentation)) {
            const filePath = path.join(docsPath, `${section}.md`);
            await fs.writeFile(filePath, content, 'utf8');
        }
        
        // Create master README
        const masterReadme = await this.generateMasterReadme(documentation);
        await fs.writeFile(path.join(docsPath, 'README.md'), masterReadme, 'utf8');
        
        this.logger.info(`✅ Documentation generated in: ${docsPath}`);
        
        return {
            documentationPath: docsPath,
            sections: Object.keys(documentation),
            totalFiles: Object.keys(documentation).length + 1, // +1 for master README
            generatedAt: new Date().toISOString()
        };
    }
    
    // Helper methods for pattern extraction
    extractImports(content, extension) {
        const imports = [];
        const patterns = {
            '.js': [/import\s+.*?from\s+['"]([^'"]+)['"]/g, /require\(['"]([^'"]+)['"]\)/g],
            '.ts': [/import\s+.*?from\s+['"]([^'"]+)['"]/g, /require\(['"]([^'"]+)['"]\)/g],
            '.py': [/from\s+([\w.]+)\s+import|import\s+([\w.]+)/g],
            '.java': [/import\s+([\w.]+);/g]
        };
        
        const filePatterns = patterns[extension] || patterns['.js'];
        for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                imports.push(match[1] || match[2]);
            }
        }
        
        return imports;
    }
    
    extractExports(content, extension) {
        const exports = [];
        const patterns = {
            '.js': [/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g],
            '.ts': [/export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g]
        };
        
        const filePatterns = patterns[extension] || patterns['.js'];
        for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                exports.push(match[1]);
            }
        }
        
        return exports;
    }
    
    extractFunctions(content, extension) {
        const functions = [];
        const patterns = {
            '.js': [/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>)/g],
            '.ts': [/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>)/g],
            '.py': [/def\s+(\w+)\s*\(/g],
            '.java': [/(?:public|private|protected)?\s*(?:static\s+)?\w+\s+(\w+)\s*\(/g]
        };
        
        const filePatterns = patterns[extension] || [];
        for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                functions.push(match[1] || match[2]);
            }
        }
        
        return functions;
    }
    
    extractClasses(content, extension) {
        const classes = [];
        const patterns = {
            '.js': [/class\s+(\w+)/g],
            '.ts': [/class\s+(\w+)/g],
            '.py': [/class\s+(\w+)/g],
            '.java': [/(?:public\s+)?class\s+(\w+)/g]
        };
        
        const filePatterns = patterns[extension] || [];
        for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                classes.push(match[1]);
            }
        }
        
        return classes;
    }
    
    calculateComplexity(content, extension) {
        // Simple complexity calculation based on keywords
        const complexityKeywords = ['if', 'for', 'while', 'switch', 'try', 'catch', 'async', 'await'];
        let complexity = 1; // Base complexity
        
        for (const keyword of complexityKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }
    
    // Utility methods
    shouldExclude(relativePath) {
        return this.config.excludePatterns.some(pattern => 
            relativePath.includes(pattern)
        );
    }
    
    isCodeFile(extension) {
        return ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs'].includes(extension);
    }
    
    categorizeFilesByType(files) {
        const categories = {
            source: [],
            tests: [],
            configs: [],
            documentation: [],
            assets: [],
            other: []
        };
        
        for (const file of files) {
            if (file.relativePath.includes('test') || file.relativePath.includes('spec')) {
                categories.tests.push(file);
            } else if (['.json', '.yaml', '.yml', '.config.js'].includes(file.extension)) {
                categories.configs.push(file);
            } else if (['.md', '.txt', '.rst'].includes(file.extension)) {
                categories.documentation.push(file);
            } else if (this.isCodeFile(file.extension)) {
                categories.source.push(file);
            } else {
                categories.other.push(file);
            }
        }
        
        return categories;
    }
    
    findConfigurationFiles(files) {
        return files.filter(file => 
            ['package.json', 'tsconfig.json', 'webpack.config.js', '.env', 'Dockerfile', 'docker-compose.yml']
                .some(config => file.name.includes(config))
        );
    }
    
    identifyEntryPoints(files) {
        const entryPointNames = ['index.js', 'main.js', 'app.js', 'server.js', 'index.ts', 'main.ts'];
        return files.filter(file => 
            entryPointNames.includes(file.name) || 
            file.relativePath === file.name
        );
    }
    
    identifyFrameworks(packageData) {
        const frameworks = [];
        const deps = { ...packageData.dependencies, ...packageData.devDependencies };
        
        const frameworkMap = {
            'react': 'React',
            'vue': 'Vue.js',
            'angular': 'Angular',
            'express': 'Express.js',
            'next': 'Next.js',
            'nuxt': 'Nuxt.js',
            'gatsby': 'Gatsby',
            'svelte': 'Svelte'
        };
        
        for (const [dep, framework] of Object.entries(frameworkMap)) {
            if (deps[dep]) {
                frameworks.push(framework);
            }
        }
        
        return frameworks;
    }
    
    isInternalImport(importPath, files) {
        // Check if import path refers to a file in the project
        return importPath.startsWith('./') || 
               importPath.startsWith('../') ||
               files.some(file => file.relativePath.includes(importPath));
    }
    
    findMostConnectedFiles(internalDeps) {
        const connections = {};
        
        for (const [file, deps] of Object.entries(internalDeps)) {
            connections[file] = deps.length;
        }
        
        return Object.entries(connections)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([file, count]) => ({ file, connections: count }));
    }
    
    classifyFileType(file) {
        if (file.relativePath.includes('component')) return 'component';
        if (file.relativePath.includes('service')) return 'service';
        if (file.relativePath.includes('util')) return 'utility';
        if (file.relativePath.includes('test')) return 'test';
        if (file.relativePath.includes('config')) return 'config';
        if (file.functions && file.functions.length > 0) return 'module';
        return 'file';
    }
    
    // Documentation generation methods (simplified for space)
    async generateProjectOverview(projectPath, structure, insights) {
        return `# Project Overview

## Project Information
- **Path**: ${projectPath}
- **Type**: ${insights.projectType || 'Unknown'}
- **Total Files**: ${structure.totalFiles}
- **Total Directories**: ${structure.totalDirectories}

## Purpose
${insights.purpose || 'AI-analyzed project purpose not available'}

## Technology Stack
${insights.technologyStack ? insights.technologyStack.map(tech => `- ${tech}`).join('\\n') : 'Technology stack analysis not available'}

## Architecture
${insights.architectureAssessment || 'Architecture assessment not available'}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateArchitectureDocumentation(structure, codePatterns, insights) {
        return `# Architecture Documentation

## Overall Architecture
${insights.architectureAssessment || 'Architecture assessment not available'}

## Code Patterns
${codePatterns.architecturalPatterns ? 
    codePatterns.architecturalPatterns.map(pattern => 
        `### ${pattern.pattern}\\n${pattern.description}\\n`
    ).join('\\n') : 'No architectural patterns identified'}

## File Organization
- Source Files: ${structure.filesByType?.source?.length || 0}
- Test Files: ${structure.filesByType?.tests?.length || 0}
- Configuration Files: ${structure.filesByType?.configs?.length || 0}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateComponentDocumentation(files) {
        const components = files.filter(file => this.isCodeFile(file.extension)).slice(0, 20);
        
        return `# Component Documentation

${components.map(component => `
## ${component.name}
- **Path**: ${component.relativePath}
- **Lines**: ${component.lines}
- **Functions**: ${component.functions?.length || 0}
- **Classes**: ${component.classes?.length || 0}
- **Complexity**: ${component.complexity || 1}
`).join('\\n')}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateAPIDocumentation(files) {
        return `# API Documentation

## Endpoints
*API endpoints will be automatically documented based on code analysis*

## Interfaces
*Interfaces and types will be documented based on TypeScript/code analysis*

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateSetupDocumentation(dependencies) {
        return `# Setup Documentation

## Dependencies
### External Dependencies (${dependencies.external.length})
${dependencies.external.slice(0, 20).map(dep => `- ${dep}`).join('\\n')}

## Package Managers
${dependencies.packageManagers.map(pm => `- ${pm}`).join('\\n')}

## Frameworks
${dependencies.frameworks.map(fw => `- ${fw}`).join('\\n')}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateDevelopmentGuide(structure, codePatterns) {
        return `# Development Guide

## Getting Started
1. Clone the repository
2. Install dependencies
3. Review architecture documentation
4. Start development

## Code Patterns
${codePatterns.namingConventions ? 
    codePatterns.namingConventions.map(convention => 
        `- ${convention.pattern}: ${convention.description}`
    ).join('\\n') : 'No naming conventions identified'}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateTestingGuide(structure, codePatterns) {
        return `# Testing Guide

## Test Files
- Total test files: ${structure.filesByType?.tests?.length || 0}

## Testing Patterns
${codePatterns.testingPatterns ? 
    codePatterns.testingPatterns.map(pattern => 
        `- ${pattern.pattern}: ${pattern.description}`
    ).join('\\n') : 'No testing patterns identified'}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateDeploymentGuide(structure, dependencies) {
        return `# Deployment Guide

## Deployment Configuration
*Deployment configuration will be analyzed based on Docker, CI/CD files*

## Dependencies
- External: ${dependencies.external.length}
- Package Managers: ${dependencies.packageManagers.join(', ')}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateTroubleshootingGuide(insights) {
        return `# Troubleshooting Guide

## Common Issues
${insights.improvementOpportunities ? 
    insights.improvementOpportunities.map(issue => 
        `- ${issue.issue}: ${issue.solution}`
    ).join('\\n') : 'No common issues identified'}

## Security Considerations
${insights.securityConsiderations ? 
    insights.securityConsiderations.map(concern => `- ${concern}`).join('\\n') : 
    'No security considerations identified'}

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateContributingGuide(structure, codePatterns) {
        return `# Contributing Guide

## Code Organization
${codePatterns.codeOrganization ? 
    codePatterns.codeOrganization.map(org => 
        `- ${org.pattern}: ${org.description}`
    ).join('\\n') : 'No code organization patterns identified'}

## Development Workflow
1. Follow existing patterns
2. Maintain code quality
3. Add tests for new functionality
4. Update documentation

*This documentation was automatically generated by Nexus AI Framework*`;
    }
    
    async generateMasterReadme(documentation) {
        return `# Project Documentation

This comprehensive documentation was automatically generated by Nexus AI Framework to provide persistent, AI-readable project knowledge.

## Documentation Sections

1. **[Overview](./overview.md)** - Project overview and basic information
2. **[Architecture](./architecture.md)** - Technical architecture and patterns
3. **[Components](./components.md)** - Individual component documentation
4. **[APIs](./apis.md)** - API endpoints and interfaces
5. **[Setup](./setup.md)** - Project setup and dependencies
6. **[Development](./development.md)** - Development guidelines and patterns
7. **[Testing](./testing.md)** - Testing strategy and patterns
8. **[Deployment](./deployment.md)** - Deployment configuration
9. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
10. **[Contributing](./contributing.md)** - Contribution guidelines

## Purpose

This documentation prevents AI "retraining" by providing comprehensive, persistent knowledge about the project structure, patterns, and implementation details. Instead of re-reading source files repeatedly, AI assistants can reference this documentation for context and guidance.

## Maintenance

This documentation is automatically updated when the project structure changes significantly. For manual updates, run:

\`\`\`bash
nexus analyze-project --update-docs
\`\`\`

---
*Generated by Nexus AI Framework - Universal AI Development Platform*`;
    }
    
    /**
     * Calculate project metrics
     */
    async calculateProjectMetrics(structureAnalysis, codeAnalysis) {
        return {
            complexity: {
                average: structureAnalysis.files.reduce((sum, file) => sum + (file.complexity || 1), 0) / structureAnalysis.files.length,
                total: structureAnalysis.files.reduce((sum, file) => sum + (file.complexity || 1), 0)
            },
            size: {
                totalLines: structureAnalysis.files.reduce((sum, file) => sum + (file.lines || 0), 0),
                totalBytes: structureAnalysis.files.reduce((sum, file) => sum + (file.size || 0), 0)
            },
            quality: {
                patternsIdentified: Object.values(codeAnalysis).flat().length,
                consistency: 'AI-assessed', // Placeholder for AI assessment
                maintainability: 'AI-assessed' // Placeholder for AI assessment
            }
        };
    }
    
    /**
     * Generate project summary
     */
    async generateProjectSummary(structureAnalysis, codeAnalysis, dependencyAnalysis, aiInsights) {
        return `
## Project Summary

**${aiInsights.projectType || 'Unknown Project Type'}**

This project contains ${structureAnalysis.totalFiles} files across ${structureAnalysis.totalDirectories} directories. The codebase uses ${dependencyAnalysis.frameworks.join(', ')} and follows ${codeAnalysis.architecturalPatterns?.length || 0} identified architectural patterns.

**Key Technologies**: ${dependencyAnalysis.frameworks.join(', ')}
**Architecture Quality**: ${aiInsights.architectureAssessment?.split('.')[0] || 'Not assessed'}
**Development Maturity**: ${aiInsights.developmentMaturity || 'Not assessed'}

**AI Assessment**: ${aiInsights.codeQuality || 'Quality assessment not available'}

This summary provides immediate context for AI assistants without requiring full project re-analysis.
`;
    }
    
    /**
     * Save project analysis to persistent storage
     */
    async saveProjectAnalysis(projectPath, analysis) {
        const analysisPath = path.join(projectPath, '.nexus', 'analysis');
        await fs.ensureDir(analysisPath);
        
        // Save comprehensive analysis
        await fs.writeJson(path.join(analysisPath, 'project-analysis.json'), analysis, { spaces: 2 });
        
        // Save summary for quick reference
        const summary = {
            projectPath: analysis.projectPath,
            analyzedAt: analysis.analyzedAt,
            analysisTime: analysis.analysisTime,
            totalFiles: analysis.structure.totalFiles,
            projectType: analysis.aiInsights.projectType,
            architectureQuality: analysis.aiInsights.architectureAssessment,
            technologyStack: analysis.dependencies.frameworks,
            metrics: analysis.metrics
        };
        
        await fs.writeJson(path.join(analysisPath, 'project-summary.json'), summary, { spaces: 2 });
        
        this.logger.info(`💾 Project analysis saved to: ${analysisPath}`);
    }
    
    /**
     * Get analyzer statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.analysisCache.size,
            knowledgeSize: this.projectKnowledge.size
        };
    }
}

module.exports = { SmartProjectAnalyzer };