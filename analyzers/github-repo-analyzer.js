/**
 * GitHub Repository Analyzer
 * Analyzes any GitHub repository to understand code structure, patterns, and generate AI-readable documentation
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const { Logger } = require('../utils/logger');

class GitHubRepoAnalyzer {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('GitHubRepoAnalyzer');
        
        this.config = {
            maxFileSize: 1024 * 1024, // 1MB max per file
            ignoredExtensions: ['.bin', '.exe', '.dll', '.so', '.dylib', '.jpg', '.png', '.gif', '.mp4'],
            ignoredDirs: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'],
            supportedLanguages: {
                javascript: ['.js', '.jsx', '.mjs'],
                typescript: ['.ts', '.tsx'],
                python: ['.py'],
                java: ['.java'],
                csharp: ['.cs'],
                go: ['.go'],
                rust: ['.rs'],
                cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
                ruby: ['.rb'],
                php: ['.php'],
                swift: ['.swift'],
                kotlin: ['.kt'],
                scala: ['.scala'],
                vue: ['.vue'],
                react: ['.jsx', '.tsx'],
                html: ['.html', '.htm'],
                css: ['.css', '.scss', '.sass', '.less'],
                markdown: ['.md', '.mdx'],
                json: ['.json'],
                yaml: ['.yml', '.yaml'],
                xml: ['.xml'],
                sql: ['.sql']
            }
        };
        
        this.analysisCache = new Map();
    }
    
    /**
     * Analyze a GitHub repository
     */
    async analyzeRepository(repoUrl, options = {}) {
        this.logger.info(`🔍 Analyzing GitHub repository: ${repoUrl}`);
        
        const {
            branch = 'main',
            depth = 'full',  // 'shallow' or 'full'
            generateDocs = true,
            extractPatterns = true,
            mapRelationships = true,
            outputPath = null
        } = options;
        
        try {
            // Parse repository URL
            const repoInfo = this.parseGitHubUrl(repoUrl);
            
            // Check cache
            const cacheKey = `${repoInfo.owner}/${repoInfo.repo}@${branch}`;
            if (this.analysisCache.has(cacheKey)) {
                this.logger.info('📦 Using cached analysis');
                return this.analysisCache.get(cacheKey);
            }
            
            // Clone or download repository
            const repoPath = await this.cloneRepository(repoInfo, branch, depth);
            
            // Perform comprehensive analysis
            const analysis = {
                repository: {
                    url: repoUrl,
                    owner: repoInfo.owner,
                    name: repoInfo.repo,
                    branch,
                    analyzedAt: new Date().toISOString()
                },
                structure: await this.analyzeStructure(repoPath),
                languages: await this.detectLanguages(repoPath),
                dependencies: await this.analyzeDependencies(repoPath),
                architecture: extractPatterns ? await this.extractArchitecture(repoPath) : null,
                patterns: extractPatterns ? await this.extractPatterns(repoPath) : null,
                relationships: mapRelationships ? await this.mapRelationships(repoPath) : null,
                documentation: generateDocs ? await this.generateDocumentation(repoPath) : null,
                statistics: await this.gatherStatistics(repoPath),
                entryPoints: await this.findEntryPoints(repoPath),
                apiEndpoints: await this.extractAPIEndpoints(repoPath),
                configurations: await this.extractConfigurations(repoPath),
                tests: await this.analyzeTests(repoPath),
                aiReadableSummary: await this.generateAISummary(repoPath)
            };
            
            // Cache the analysis
            this.analysisCache.set(cacheKey, analysis);
            
            // Save analysis if output path provided
            if (outputPath) {
                await this.saveAnalysis(analysis, outputPath);
            }
            
            // Clean up cloned repository
            await this.cleanup(repoPath);
            
            this.logger.info('✅ Repository analysis completed');
            
            return analysis;
            
        } catch (error) {
            this.logger.error('Repository analysis failed:', error);
            throw error;
        }
    }
    
    /**
     * Parse GitHub URL to extract owner and repo
     */
    parseGitHubUrl(url) {
        const patterns = [
            /github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/,
            /^([\w-]+)\/([\w.-]+)$/  // Short format: owner/repo
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    owner: match[1],
                    repo: match[2].replace(/\.git$/, '')
                };
            }
        }
        
        throw new Error(`Invalid GitHub URL: ${url}`);
    }
    
    /**
     * Clone repository locally
     */
    async cloneRepository(repoInfo, branch, depth) {
        const tempDir = path.join(process.cwd(), '.nexus', 'temp', `${repoInfo.owner}-${repoInfo.repo}`);
        await fs.ensureDir(path.dirname(tempDir));
        
        // Remove existing clone if present
        await fs.remove(tempDir);
        
        const cloneUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`;
        const depthFlag = depth === 'shallow' ? '--depth 1' : '';
        
        try {
            this.logger.info('📥 Cloning repository...');
            execSync(`git clone ${depthFlag} -b ${branch} ${cloneUrl} ${tempDir}`, {
                stdio: 'pipe'
            });
            
            return tempDir;
        } catch (error) {
            // Try with default branch if specified branch fails
            if (branch !== 'main') {
                try {
                    execSync(`git clone ${depthFlag} ${cloneUrl} ${tempDir}`, {
                        stdio: 'pipe'
                    });
                    return tempDir;
                } catch (retryError) {
                    throw new Error(`Failed to clone repository: ${retryError.message}`);
                }
            }
            throw error;
        }
    }
    
    /**
     * Analyze repository structure
     */
    async analyzeStructure(repoPath) {
        const structure = {
            directories: [],
            files: [],
            tree: {},
            totalFiles: 0,
            totalDirectories: 0
        };
        
        const walk = async (dir, relativePath = '') => {
            const items = await fs.readdir(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relPath = path.join(relativePath, item);
                const stats = await fs.stat(fullPath);
                
                if (stats.isDirectory()) {
                    if (!this.config.ignoredDirs.includes(item)) {
                        structure.directories.push(relPath);
                        structure.totalDirectories++;
                        await walk(fullPath, relPath);
                    }
                } else {
                    const ext = path.extname(item);
                    if (!this.config.ignoredExtensions.includes(ext)) {
                        structure.files.push({
                            path: relPath,
                            size: stats.size,
                            extension: ext
                        });
                        structure.totalFiles++;
                    }
                }
            }
        };
        
        await walk(repoPath);
        
        // Build tree structure
        structure.tree = this.buildFileTree(structure.files);
        
        return structure;
    }
    
    /**
     * Detect languages used in repository
     */
    async detectLanguages(repoPath) {
        const languages = {
            primary: null,
            detected: {},
            frameworks: [],
            stats: {
                totalLines: 0,
                fileCount: {}
            }
        };
        
        // Count files by extension
        const files = await this.getAllFiles(repoPath);
        
        for (const file of files) {
            const ext = path.extname(file);
            
            // Find language for extension
            for (const [lang, extensions] of Object.entries(this.config.supportedLanguages)) {
                if (extensions.includes(ext)) {
                    if (!languages.detected[lang]) {
                        languages.detected[lang] = {
                            files: [],
                            lineCount: 0,
                            percentage: 0
                        };
                    }
                    
                    const content = await fs.readFile(file, 'utf-8').catch(() => '');
                    const lines = content.split('\n').length;
                    
                    languages.detected[lang].files.push(path.relative(repoPath, file));
                    languages.detected[lang].lineCount += lines;
                    languages.stats.totalLines += lines;
                }
            }
        }
        
        // Calculate percentages and determine primary language
        let maxLines = 0;
        for (const [lang, data] of Object.entries(languages.detected)) {
            data.percentage = (data.lineCount / languages.stats.totalLines) * 100;
            if (data.lineCount > maxLines) {
                maxLines = data.lineCount;
                languages.primary = lang;
            }
        }
        
        // Detect frameworks
        languages.frameworks = await this.detectFrameworks(repoPath, languages.detected);
        
        return languages;
    }
    
    /**
     * Analyze dependencies
     */
    async analyzeDependencies(repoPath) {
        const dependencies = {
            npm: null,
            pip: null,
            maven: null,
            gradle: null,
            cargo: null,
            go: null,
            composer: null,
            gems: null
        };
        
        // NPM/Yarn dependencies
        const packageJsonPath = path.join(repoPath, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            const packageJson = await fs.readJson(packageJsonPath);
            dependencies.npm = {
                dependencies: packageJson.dependencies || {},
                devDependencies: packageJson.devDependencies || {},
                scripts: packageJson.scripts || {}
            };
        }
        
        // Python dependencies
        const requirementsPath = path.join(repoPath, 'requirements.txt');
        if (await fs.pathExists(requirementsPath)) {
            const requirements = await fs.readFile(requirementsPath, 'utf-8');
            dependencies.pip = requirements.split('\n').filter(line => 
                line.trim() && !line.startsWith('#')
            );
        }
        
        // Add more dependency analysis for other languages...
        
        return dependencies;
    }
    
    /**
     * Extract architecture patterns
     */
    async extractArchitecture(repoPath) {
        const architecture = {
            pattern: null,  // MVC, MVVM, Microservices, etc.
            layers: [],
            components: [],
            services: [],
            models: [],
            controllers: [],
            views: [],
            utilities: []
        };
        
        // Analyze directory structure for patterns
        const structure = await this.analyzeStructure(repoPath);
        
        // Check for common architectural patterns
        const patterns = {
            mvc: ['models', 'views', 'controllers'],
            mvvm: ['models', 'views', 'viewmodels'],
            microservices: ['services', 'api-gateway', 'service-discovery'],
            layered: ['presentation', 'business', 'data', 'infrastructure'],
            hexagonal: ['domain', 'application', 'infrastructure', 'adapters']
        };
        
        for (const [pattern, markers] of Object.entries(patterns)) {
            const foundMarkers = markers.filter(marker => 
                structure.directories.some(dir => 
                    dir.toLowerCase().includes(marker)
                )
            );
            
            if (foundMarkers.length >= markers.length * 0.6) {
                architecture.pattern = pattern;
                break;
            }
        }
        
        // Extract components based on common patterns
        const files = await this.getAllFiles(repoPath);
        
        for (const file of files) {
            const relPath = path.relative(repoPath, file);
            const fileName = path.basename(file);
            
            // Categorize files
            if (relPath.includes('model') || fileName.includes('Model')) {
                architecture.models.push(relPath);
            }
            if (relPath.includes('controller') || fileName.includes('Controller')) {
                architecture.controllers.push(relPath);
            }
            if (relPath.includes('view') || fileName.includes('View')) {
                architecture.views.push(relPath);
            }
            if (relPath.includes('service') || fileName.includes('Service')) {
                architecture.services.push(relPath);
            }
            if (relPath.includes('component') || fileName.includes('Component')) {
                architecture.components.push(relPath);
            }
            if (relPath.includes('util') || relPath.includes('helper')) {
                architecture.utilities.push(relPath);
            }
        }
        
        return architecture;
    }
    
    /**
     * Extract coding patterns
     */
    async extractPatterns(repoPath) {
        const patterns = {
            designPatterns: [],
            codingStyle: {},
            commonPatterns: [],
            antiPatterns: []
        };
        
        const files = await this.getAllFiles(repoPath, ['.js', '.ts', '.py', '.java']);
        
        // Sample files for pattern analysis
        const sampleSize = Math.min(files.length, 50);
        const sampleFiles = files.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
        
        for (const file of sampleFiles) {
            const content = await fs.readFile(file, 'utf-8').catch(() => '');
            
            // Check for design patterns
            if (content.includes('Singleton') || content.match(/getInstance\s*\(/)) {
                patterns.designPatterns.push('Singleton');
            }
            if (content.includes('Factory') || content.match(/create\w+\s*\(/)) {
                patterns.designPatterns.push('Factory');
            }
            if (content.includes('Observer') || content.includes('addEventListener')) {
                patterns.designPatterns.push('Observer');
            }
            
            // Analyze coding style
            if (content.includes('async') && content.includes('await')) {
                patterns.codingStyle.asyncAwait = true;
            }
            if (content.match(/=>/)) {
                patterns.codingStyle.arrowFunctions = true;
            }
            if (content.match(/class\s+\w+/)) {
                patterns.codingStyle.classes = true;
            }
        }
        
        // Remove duplicates
        patterns.designPatterns = [...new Set(patterns.designPatterns)];
        
        return patterns;
    }
    
    /**
     * Map component relationships
     */
    async mapRelationships(repoPath) {
        const relationships = {
            imports: new Map(),
            exports: new Map(),
            dependencies: new Map(),
            callGraph: new Map()
        };
        
        const files = await this.getAllFiles(repoPath, ['.js', '.ts', '.jsx', '.tsx']);
        
        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8').catch(() => '');
            const relPath = path.relative(repoPath, file);
            
            // Extract imports
            const imports = this.extractImports(content);
            if (imports.length > 0) {
                relationships.imports.set(relPath, imports);
            }
            
            // Extract exports
            const exports = this.extractExports(content);
            if (exports.length > 0) {
                relationships.exports.set(relPath, exports);
            }
        }
        
        // Build dependency graph
        for (const [file, imports] of relationships.imports) {
            const deps = imports.map(imp => this.resolveImportPath(imp, file));
            relationships.dependencies.set(file, deps);
        }
        
        return {
            imports: Array.from(relationships.imports.entries()),
            exports: Array.from(relationships.exports.entries()),
            dependencies: Array.from(relationships.dependencies.entries())
        };
    }
    
    /**
     * Generate AI-readable documentation
     */
    async generateDocumentation(repoPath) {
        const docs = {
            overview: '',
            setup: '',
            architecture: '',
            apiReference: '',
            codeExamples: [],
            bestPractices: []
        };
        
        // Read README if exists
        const readmePath = path.join(repoPath, 'README.md');
        if (await fs.pathExists(readmePath)) {
            docs.overview = await fs.readFile(readmePath, 'utf-8');
        }
        
        // Extract setup instructions
        const packageJsonPath = path.join(repoPath, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            const packageJson = await fs.readJson(packageJsonPath);
            docs.setup = this.generateSetupInstructions(packageJson);
        }
        
        // Generate architecture documentation
        const architecture = await this.extractArchitecture(repoPath);
        docs.architecture = this.generateArchitectureDoc(architecture);
        
        // Extract code examples
        docs.codeExamples = await this.extractCodeExamples(repoPath);
        
        return docs;
    }
    
    /**
     * Generate AI-optimized summary
     */
    async generateAISummary(repoPath) {
        const structure = await this.analyzeStructure(repoPath);
        const languages = await this.detectLanguages(repoPath);
        const dependencies = await this.analyzeDependencies(repoPath);
        
        const summary = `
# Repository Analysis Summary

## Project Overview
- **Primary Language**: ${languages.primary}
- **Total Files**: ${structure.totalFiles}
- **Total Directories**: ${structure.totalDirectories}

## Technology Stack
${Object.keys(languages.detected).map(lang => `- ${lang}: ${languages.detected[lang].percentage.toFixed(1)}%`).join('\n')}

## Frameworks Detected
${languages.frameworks.join(', ') || 'None detected'}

## Key Dependencies
${this.formatDependencies(dependencies)}

## Project Structure
The repository follows a ${this.detectProjectType(structure)} structure.

## Entry Points
${(await this.findEntryPoints(repoPath)).join('\n')}

## How to Use This Repository
1. Clone the repository
2. Install dependencies: ${this.getInstallCommand(dependencies)}
3. Run the project: ${this.getRunCommand(dependencies)}

## AI Development Guide
This codebase can be understood by focusing on:
1. Main entry points for understanding flow
2. Core business logic in the primary directories
3. Configuration files for understanding setup
4. Test files for understanding expected behavior
`;
        
        return summary;
    }
    
    /**
     * Helper: Extract imports from code
     */
    extractImports(content) {
        const imports = [];
        const patterns = [
            /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            /require\s*\(['"]([^'"]+)['"]\)/g
        ];
        
        for (const pattern of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                imports.push(match[1]);
            }
        }
        
        return imports;
    }
    
    /**
     * Helper: Extract exports from code
     */
    extractExports(content) {
        const exports = [];
        const patterns = [
            /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
            /export\s+\{([^}]+)\}/g,
            /module\.exports\s*=\s*\{([^}]+)\}/g
        ];
        
        for (const pattern of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                exports.push(match[1]);
            }
        }
        
        return exports;
    }
    
    /**
     * Helper: Get all files in directory
     */
    async getAllFiles(dir, extensions = null) {
        const files = [];
        
        const walk = async (currentDir) => {
            const items = await fs.readdir(currentDir);
            
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stats = await fs.stat(fullPath);
                
                if (stats.isDirectory()) {
                    if (!this.config.ignoredDirs.includes(item)) {
                        await walk(fullPath);
                    }
                } else {
                    const ext = path.extname(item);
                    if (!extensions || extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        };
        
        await walk(dir);
        return files;
    }
    
    /**
     * Find entry points
     */
    async findEntryPoints(repoPath) {
        const entryPoints = [];
        const commonEntryFiles = [
            'index.js', 'index.ts', 'main.js', 'main.ts', 
            'app.js', 'app.ts', 'server.js', 'server.ts',
            'index.html', 'main.py', 'app.py', 'Main.java'
        ];
        
        for (const file of commonEntryFiles) {
            const filePath = path.join(repoPath, file);
            if (await fs.pathExists(filePath)) {
                entryPoints.push(file);
            }
        }
        
        // Check package.json for main entry
        const packageJsonPath = path.join(repoPath, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            const packageJson = await fs.readJson(packageJsonPath);
            if (packageJson.main) {
                entryPoints.push(`package.json:main -> ${packageJson.main}`);
            }
        }
        
        return entryPoints;
    }
    
    /**
     * Extract API endpoints
     */
    async extractAPIEndpoints(repoPath) {
        const endpoints = [];
        const files = await this.getAllFiles(repoPath, ['.js', '.ts', '.py', '.java']);
        
        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8').catch(() => '');
            
            // Express/Node.js endpoints
            const expressPatterns = [
                /app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/gi,
                /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/gi
            ];
            
            for (const pattern of expressPatterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    endpoints.push({
                        method: match[1].toUpperCase(),
                        path: match[2],
                        file: path.relative(repoPath, file)
                    });
                }
            }
        }
        
        return endpoints;
    }
    
    /**
     * Clean up temporary files
     */
    async cleanup(repoPath) {
        try {
            await fs.remove(repoPath);
            this.logger.debug('Cleaned up temporary files');
        } catch (error) {
            this.logger.warn('Failed to cleanup:', error.message);
        }
    }
    
    // Additional helper methods...
}

module.exports = { GitHubRepoAnalyzer };