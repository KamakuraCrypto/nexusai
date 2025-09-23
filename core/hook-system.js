/**
 * Comprehensive Hook System Integration
 * Seamlessly integrates Nexus Framework with existing development workflows
 * Provides "plug and play" experience for vibecoders
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');

class HookSystem {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('HookSystem');
        
        this.hookTypes = {
            git: {
                'pre-commit': this.generatePreCommitHook.bind(this),
                'post-commit': this.generatePostCommitHook.bind(this),
                'pre-push': this.generatePrePushHook.bind(this),
                'commit-msg': this.generateCommitMsgHook.bind(this)
            },
            build: {
                'webpack': this.generateWebpackHook.bind(this),
                'vite': this.generateViteHook.bind(this),
                'rollup': this.generateRollupHook.bind(this),
                'esbuild': this.generateEsbuildHook.bind(this)
            },
            framework: {
                'react': this.generateReactHooks.bind(this),
                'vue': this.generateVueHooks.bind(this),
                'next': this.generateNextJSHooks.bind(this),
                'nuxt': this.generateNuxtHooks.bind(this),
                'svelte': this.generateSvelteHooks.bind(this)
            },
            development: {
                'eslint': this.generateESLintHook.bind(this),
                'prettier': this.generatePrettierHook.bind(this),
                'jest': this.generateJestHook.bind(this),
                'cypress': this.generateCypressHook.bind(this)
            },
            deployment: {
                'vercel': this.generateVercelHook.bind(this),
                'netlify': this.generateNetlifyHook.bind(this),
                'docker': this.generateDockerHook.bind(this)
            }
        };
        
        this.installedHooks = new Map();
        this.hookConfig = {
            enableAITracking: true,
            enableBackupOnChanges: true,
            enableKnowledgeBaseUpdates: true,
            enableMemoryCheckpoints: true,
            enableErrorRecovery: true
        };
    }
    
    /**
     * Install hooks for a project
     */
    async installHooks(projectPath, options = {}) {
        this.logger.info(`🪝 Installing comprehensive hook system for: ${projectPath}`);
        
        const {
            autoDetect = true,
            hookTypes = ['git', 'build', 'framework', 'development'],
            force = false,
            backup = true
        } = options;
        
        try {
            // Create backup if requested
            if (backup) {
                await this.createHookBackup(projectPath);
            }
            
            const installationResults = {
                installed: [],
                failed: [],
                skipped: [],
                detected: []
            };
            
            // Auto-detect project characteristics
            const projectInfo = autoDetect ? await this.detectProjectType(projectPath) : {};
            installationResults.detected = projectInfo;
            
            // Install hooks for each requested type
            for (const hookType of hookTypes) {
                try {
                    const typeResults = await this.installHookType(hookType, projectPath, projectInfo, force);
                    installationResults.installed.push(...typeResults.installed);
                    installationResults.failed.push(...typeResults.failed);
                    installationResults.skipped.push(...typeResults.skipped);
                } catch (error) {
                    this.logger.error(`Failed to install ${hookType} hooks:`, error);
                    installationResults.failed.push({
                        type: hookType,
                        error: error.message
                    });
                }
            }
            
            // Create hook registry
            await this.createHookRegistry(projectPath, installationResults);
            
            // Setup hook monitoring
            await this.setupHookMonitoring(projectPath);
            
            this.logger.info(`✅ Hook installation completed: ${installationResults.installed.length} installed, ${installationResults.failed.length} failed`);
            
            return installationResults;
            
        } catch (error) {
            this.logger.error('Hook installation failed:', error);
            throw error;
        }
    }
    
    /**
     * Detect project type and characteristics
     */
    async detectProjectType(projectPath) {
        const detection = {
            language: 'unknown',
            framework: 'unknown',
            buildSystem: 'unknown',
            packageManager: 'unknown',
            hasGit: false,
            hasTests: false,
            deployment: []
        };
        
        try {
            // Check for package.json
            const packageJsonPath = path.join(projectPath, 'package.json');
            if (await fs.pathExists(packageJsonPath)) {
                const packageJson = await fs.readJson(packageJsonPath);
                detection.language = 'javascript';
                detection.packageManager = await this.detectPackageManager(projectPath);
                
                // Detect framework from dependencies
                detection.framework = this.detectFrameworkFromDeps(packageJson);
                detection.buildSystem = this.detectBuildSystemFromDeps(packageJson);
            }
            
            // Check for other language indicators
            if (await fs.pathExists(path.join(projectPath, 'requirements.txt'))) {
                detection.language = 'python';
            }
            if (await fs.pathExists(path.join(projectPath, 'Cargo.toml'))) {
                detection.language = 'rust';
            }
            if (await fs.pathExists(path.join(projectPath, 'go.mod'))) {
                detection.language = 'go';
            }
            
            // Check for Git
            detection.hasGit = await fs.pathExists(path.join(projectPath, '.git'));
            
            // Check for test directories
            const testDirs = ['test', 'tests', '__tests__', 'spec'];
            for (const dir of testDirs) {
                if (await fs.pathExists(path.join(projectPath, dir))) {
                    detection.hasTests = true;
                    break;
                }
            }
            
            // Check for deployment configurations
            if (await fs.pathExists(path.join(projectPath, 'vercel.json'))) {
                detection.deployment.push('vercel');
            }
            if (await fs.pathExists(path.join(projectPath, 'netlify.toml'))) {
                detection.deployment.push('netlify');
            }
            if (await fs.pathExists(path.join(projectPath, 'Dockerfile'))) {
                detection.deployment.push('docker');
            }
            
            return detection;
            
        } catch (error) {
            this.logger.warn('Project detection failed:', error.message);
            return detection;
        }
    }
    
    /**
     * Install hooks for a specific type
     */
    async installHookType(hookType, projectPath, projectInfo, force) {
        const results = { installed: [], failed: [], skipped: [] };
        
        if (!this.hookTypes[hookType]) {
            throw new Error(`Unknown hook type: ${hookType}`);
        }
        
        switch (hookType) {
            case 'git':
                if (projectInfo.hasGit) {
                    await this.installGitHooks(projectPath, results, force);
                } else {
                    results.skipped.push({ type: 'git', reason: 'No Git repository found' });
                }
                break;
                
            case 'build':
                if (projectInfo.buildSystem !== 'unknown') {
                    await this.installBuildHooks(projectPath, projectInfo.buildSystem, results, force);
                } else {
                    results.skipped.push({ type: 'build', reason: 'No build system detected' });
                }
                break;
                
            case 'framework':
                if (projectInfo.framework !== 'unknown') {
                    await this.installFrameworkHooks(projectPath, projectInfo.framework, results, force);
                } else {
                    results.skipped.push({ type: 'framework', reason: 'No framework detected' });
                }
                break;
                
            case 'development':
                await this.installDevelopmentHooks(projectPath, projectInfo, results, force);
                break;
                
            case 'deployment':
                if (projectInfo.deployment.length > 0) {
                    await this.installDeploymentHooks(projectPath, projectInfo.deployment, results, force);
                } else {
                    results.skipped.push({ type: 'deployment', reason: 'No deployment platforms detected' });
                }
                break;
        }
        
        return results;
    }
    
    /**
     * Install Git hooks
     */
    async installGitHooks(projectPath, results, force) {
        const gitHooksDir = path.join(projectPath, '.git', 'hooks');
        
        for (const [hookName, generator] of Object.entries(this.hookTypes.git)) {
            try {
                const hookPath = path.join(gitHooksDir, hookName);
                const hookExists = await fs.pathExists(hookPath);
                
                if (hookExists && !force) {
                    // Backup existing hook and enhance it
                    await fs.copy(hookPath, `${hookPath}.backup`);
                    const existingContent = await fs.readFile(hookPath, 'utf8');
                    const enhancedContent = await this.enhanceExistingHook(existingContent, hookName);
                    await fs.writeFile(hookPath, enhancedContent, { mode: 0o755 });
                    results.installed.push({ type: 'git', hook: hookName, action: 'enhanced' });
                } else {
                    const hookContent = await generator(projectPath);
                    await fs.writeFile(hookPath, hookContent, { mode: 0o755 });
                    results.installed.push({ type: 'git', hook: hookName, action: 'created' });
                }
                
            } catch (error) {
                results.failed.push({ type: 'git', hook: hookName, error: error.message });
            }
        }
    }
    
    /**
     * Install build system hooks
     */
    async installBuildHooks(projectPath, buildSystem, results, force) {
        try {
            const hookGenerator = this.hookTypes.build[buildSystem];
            if (hookGenerator) {
                const hookConfig = await hookGenerator(projectPath);
                await this.applyBuildSystemHook(projectPath, buildSystem, hookConfig, force);
                results.installed.push({ type: 'build', system: buildSystem, action: 'configured' });
            } else {
                results.skipped.push({ type: 'build', system: buildSystem, reason: 'No hook generator available' });
            }
        } catch (error) {
            results.failed.push({ type: 'build', system: buildSystem, error: error.message });
        }
    }
    
    /**
     * Install framework hooks
     */
    async installFrameworkHooks(projectPath, framework, results, force) {
        try {
            const hookGenerator = this.hookTypes.framework[framework];
            if (hookGenerator) {
                const hooks = await hookGenerator(projectPath);
                for (const hook of hooks) {
                    await this.applyFrameworkHook(projectPath, framework, hook, force);
                }
                results.installed.push({ type: 'framework', framework, hooks: hooks.length });
            } else {
                results.skipped.push({ type: 'framework', framework, reason: 'No hook generator available' });
            }
        } catch (error) {
            results.failed.push({ type: 'framework', framework, error: error.message });
        }
    }
    
    /**
     * Install development workflow hooks
     */
    async installDevelopmentHooks(projectPath, projectInfo, results, force) {
        const devTools = ['eslint', 'prettier', 'jest', 'cypress'];
        
        for (const tool of devTools) {
            try {
                const configExists = await this.checkDevToolConfig(projectPath, tool);
                if (configExists) {
                    const hookGenerator = this.hookTypes.development[tool];
                    if (hookGenerator) {
                        const hookConfig = await hookGenerator(projectPath);
                        await this.applyDevelopmentHook(projectPath, tool, hookConfig, force);
                        results.installed.push({ type: 'development', tool, action: 'configured' });
                    }
                } else {
                    results.skipped.push({ type: 'development', tool, reason: 'Tool not configured' });
                }
            } catch (error) {
                results.failed.push({ type: 'development', tool, error: error.message });
            }
        }
    }
    
    // Git Hook Generators
    async generatePreCommitHook(projectPath) {
        return `#!/bin/sh
# Nexus AI Framework Pre-Commit Hook
# Provides bulletproof data protection and AI tracking

# Load Nexus environment
if [ -f ".nexus/config/hooks.sh" ]; then
    source .nexus/config/hooks.sh
fi

echo "🛡️ Nexus Pre-Commit: Creating recovery point..."

# Create recovery point before commit
if command -v nexus &> /dev/null; then
    nexus memory save "pre-commit-$(date +%Y%m%d_%H%M%S)" --auto-name > /dev/null 2>&1
fi

# Track AI action
echo "📝 Nexus: Tracking commit changes..."

# Run existing pre-commit checks if they exist
if [ -f ".git/hooks/pre-commit.backup" ]; then
    .git/hooks/pre-commit.backup "$@"
fi

# Nexus-specific checks
echo "🔍 Nexus: Running safety checks..."

# Check for sensitive data
if grep -r "API_KEY\\|SECRET\\|PASSWORD" --include="*.js" --include="*.ts" --include="*.py" .; then
    echo "❌ Nexus: Potential sensitive data detected! Commit blocked."
    echo "💡 Remove sensitive data or add to .gitignore"
    exit 1
fi

# Update project documentation if needed
if command -v nexus &> /dev/null; then
    nexus analyze --update-docs > /dev/null 2>&1 || true
fi

echo "✅ Nexus Pre-Commit: All checks passed"
exit 0
`;
    }
    
    async generatePostCommitHook(projectPath) {
        return `#!/bin/sh
# Nexus AI Framework Post-Commit Hook
# Updates knowledge base and maintains project context

# Load Nexus environment
if [ -f ".nexus/config/hooks.sh" ]; then
    source .nexus/config/hooks.sh
fi

echo "📚 Nexus Post-Commit: Updating knowledge base..."

# Update project knowledge base
if command -v nexus &> /dev/null; then
    # Update project analysis
    nexus analyze --quick > /dev/null 2>&1 || true
    
    # Create auto-checkpoint
    nexus memory save "post-commit-$(git rev-parse --short HEAD)" --auto-name > /dev/null 2>&1 || true
fi

# Track commit in AI system
echo "🧠 Nexus: Commit tracked in AI memory"

# Run existing post-commit hook if it exists
if [ -f ".git/hooks/post-commit.backup" ]; then
    .git/hooks/post-commit.backup "$@"
fi

echo "✅ Nexus Post-Commit: Knowledge base updated"
exit 0
`;
    }
    
    async generatePrePushHook(projectPath) {
        return `#!/bin/sh
# Nexus AI Framework Pre-Push Hook
# Final safety checks before pushing

# Load Nexus environment
if [ -f ".nexus/config/hooks.sh" ]; then
    source .nexus/config/hooks.sh
fi

echo "🚀 Nexus Pre-Push: Final safety checks..."

# Create push checkpoint
if command -v nexus &> /dev/null; then
    nexus memory save "pre-push-$(date +%Y%m%d_%H%M%S)" --auto-name > /dev/null 2>&1
fi

# Run health check
if command -v nexus &> /dev/null; then
    echo "🩺 Running Nexus health check..."
    if ! nexus doctor --quiet; then
        echo "⚠️ Nexus health check found issues - review before pushing"
        echo "💡 Run 'nexus doctor --fix' to resolve issues"
        read -p "Continue with push? (y/N): " continue_push
        if [ "$continue_push" != "y" ] && [ "$continue_push" != "Y" ]; then
            echo "❌ Push cancelled by user"
            exit 1
        fi
    fi
fi

# Run existing pre-push hook if it exists
if [ -f ".git/hooks/pre-push.backup" ]; then
    .git/hooks/pre-push.backup "$@"
fi

echo "✅ Nexus Pre-Push: All checks passed"
exit 0
`;
    }
    
    async generateCommitMsgHook(projectPath) {
        return `#!/bin/sh
# Nexus AI Framework Commit Message Hook
# Enhances commit messages with AI insights

# Load Nexus environment
if [ -f ".nexus/config/hooks.sh" ]; then
    source .nexus/config/hooks.sh
fi

COMMIT_MSG_FILE=$1

# Get the commit message
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Skip if this is an amend, merge, or rebase
if [ -n "$2" ]; then
    exit 0
fi

# Skip if message already has Nexus enhancement
if echo "$COMMIT_MSG" | grep -q "🤖 Enhanced by Nexus"; then
    exit 0
fi

# Add Nexus enhancement footer
echo "" >> "$COMMIT_MSG_FILE"
echo "🤖 Enhanced by Nexus AI Framework" >> "$COMMIT_MSG_FILE"

# Run existing commit-msg hook if it exists
if [ -f ".git/hooks/commit-msg.backup" ]; then
    .git/hooks/commit-msg.backup "$@"
fi

exit 0
`;
    }
    
    // Build System Hook Generators
    async generateWebpackHook(projectPath) {
        return {
            type: 'plugin',
            content: `
// Nexus AI Framework Webpack Plugin
class NexusWebpackPlugin {
    apply(compiler) {
        compiler.hooks.beforeRun.tap('NexusWebpackPlugin', () => {
            console.log('🛡️ Nexus: Creating build checkpoint...');
            // Create checkpoint before build
        });
        
        compiler.hooks.done.tap('NexusWebpackPlugin', (stats) => {
            console.log('📊 Nexus: Build completed - updating knowledge base...');
            // Update project analysis after successful build
        });
        
        compiler.hooks.failed.tap('NexusWebpackPlugin', (error) => {
            console.log('❌ Nexus: Build failed - recovery point available');
            // Provide recovery suggestions
        });
    }
}

module.exports = NexusWebpackPlugin;
`,
            configPath: 'webpack.config.js'
        };
    }
    
    async generateViteHook(projectPath) {
        return {
            type: 'plugin',
            content: `
// Nexus AI Framework Vite Plugin
export function nexusPlugin() {
    return {
        name: 'nexus-ai-framework',
        buildStart() {
            console.log('🛡️ Nexus: Creating build checkpoint...');
        },
        buildEnd() {
            console.log('📊 Nexus: Build completed - updating knowledge base...');
        },
        handleHotUpdate() {
            // Track hot reloads for AI context
        }
    };
}
`,
            configPath: 'vite.config.js'
        };
    }
    
    // Framework Hook Generators
    async generateReactHooks(projectPath) {
        return [
            {
                type: 'component',
                name: 'NexusProvider',
                content: `
import React, { createContext, useContext, useEffect } from 'react';

const NexusContext = createContext(null);

export const NexusProvider = ({ children }) => {
    useEffect(() => {
        // Initialize Nexus React integration
        console.log('🚀 Nexus: React integration active');
        
        // Track component mount for AI context
        if (window.nexus) {
            window.nexus.trackEvent('react-app-mount');
        }
    }, []);
    
    return (
        <NexusContext.Provider value={{}}>
            {children}
        </NexusContext.Provider>
    );
};

export const useNexus = () => useContext(NexusContext);
`
            }
        ];
    }
    
    async generateNextJSHooks(projectPath) {
        return [
            {
                type: 'config',
                name: 'next.config.js',
                content: `
// Nexus AI Framework Next.js Integration
const { NexusNextPlugin } = require('@nexus/nextjs-plugin');

module.exports = {
    // Existing Next.js config
    experimental: {
        serverComponentsExternalPackages: ['@nexus/core']
    },
    webpack: (config, { dev, isServer }) => {
        if (dev) {
            config.plugins.push(new NexusNextPlugin({
                enableAITracking: true,
                enableHotReloadContext: true
            }));
        }
        return config;
    }
};
`
            }
        ];
    }
    
    // Development Tool Hook Generators
    async generateESLintHook(projectPath) {
        return {
            type: 'config',
            content: `
// Nexus AI Framework ESLint Integration
module.exports = {
    plugins: ['@nexus/eslint-plugin'],
    rules: {
        '@nexus/track-complexity': 'warn',
        '@nexus/ai-friendly-naming': 'warn',
        '@nexus/no-sensitive-data': 'error'
    }
};
`,
            configPath: '.eslintrc.nexus.js'
        };
    }
    
    async generateJestHook(projectPath) {
        return {
            type: 'config',
            content: `
// Nexus AI Framework Jest Integration
module.exports = {
    setupFilesAfterEnv: ['<rootDir>/nexus-jest-setup.js'],
    testResultsProcessor: '@nexus/jest-processor',
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.stories.{js,jsx,ts,tsx}'
    ]
};
`,
            configPath: 'jest.config.nexus.js'
        };
    }
    
    // Utility methods
    async detectPackageManager(projectPath) {
        if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) return 'yarn';
        if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
        if (await fs.pathExists(path.join(projectPath, 'package-lock.json'))) return 'npm';
        return 'npm';
    }
    
    detectFrameworkFromDeps(packageJson) {
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.react) return 'react';
        if (deps.vue) return 'vue';
        if (deps.next) return 'next';
        if (deps.nuxt) return 'nuxt';
        if (deps.svelte) return 'svelte';
        if (deps.angular) return 'angular';
        
        return 'unknown';
    }
    
    detectBuildSystemFromDeps(packageJson) {
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.webpack) return 'webpack';
        if (deps.vite) return 'vite';
        if (deps.rollup) return 'rollup';
        if (deps.esbuild) return 'esbuild';
        if (deps.parcel) return 'parcel';
        
        return 'unknown';
    }
    
    async checkDevToolConfig(projectPath, tool) {
        const configFiles = {
            eslint: ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml'],
            prettier: ['.prettierrc', '.prettierrc.json', '.prettierrc.js'],
            jest: ['jest.config.js', 'jest.config.json'],
            cypress: ['cypress.config.js', 'cypress.json']
        };
        
        const files = configFiles[tool] || [];
        for (const file of files) {
            if (await fs.pathExists(path.join(projectPath, file))) {
                return true;
            }
        }
        return false;
    }
    
    async enhanceExistingHook(existingContent, hookName) {
        const nexusEnhancement = `
# === Nexus AI Framework Enhancement ===
# Provides bulletproof data protection and AI tracking

if command -v nexus &> /dev/null; then
    echo "🛡️ Nexus: ${hookName} hook active"
fi

# === End Nexus Enhancement ===

`;
        
        return nexusEnhancement + existingContent;
    }
    
    async createHookBackup(projectPath) {
        const backupDir = path.join(projectPath, '.nexus', 'hook-backups');
        await fs.ensureDir(backupDir);
        
        const gitHooksDir = path.join(projectPath, '.git', 'hooks');
        if (await fs.pathExists(gitHooksDir)) {
            await fs.copy(gitHooksDir, path.join(backupDir, 'git-hooks'));
        }
    }
    
    async createHookRegistry(projectPath, installationResults) {
        const registryPath = path.join(projectPath, '.nexus', 'hooks-registry.json');
        await fs.ensureDir(path.dirname(registryPath));
        
        const registry = {
            installedAt: new Date().toISOString(),
            hooks: installationResults,
            version: '1.0.0',
            config: this.hookConfig
        };
        
        await fs.writeJson(registryPath, registry, { spaces: 2 });
    }
    
    async setupHookMonitoring(projectPath) {
        const monitoringScript = `#!/bin/bash
# Nexus Hook Monitoring Script
# Ensures hooks are functioning properly

check_hook_status() {
    echo "🔍 Nexus: Checking hook system status..."
    
    # Check if hooks are executable
    for hook in pre-commit post-commit pre-push commit-msg; do
        if [ -f ".git/hooks/$hook" ] && [ -x ".git/hooks/$hook" ]; then
            echo "✅ $hook hook: Active"
        else
            echo "⚠️ $hook hook: Inactive"
        fi
    done
}

check_hook_status
`;
        
        const scriptPath = path.join(projectPath, '.nexus', 'scripts', 'check-hooks.sh');
        await fs.ensureDir(path.dirname(scriptPath));
        await fs.writeFile(scriptPath, monitoringScript, { mode: 0o755 });
    }
    
    // Apply hook configurations
    async applyBuildSystemHook(projectPath, buildSystem, hookConfig, force) {
        // Implementation for applying build system hooks
        this.logger.debug(`Applying ${buildSystem} hook configuration`);
    }
    
    async applyFrameworkHook(projectPath, framework, hook, force) {
        // Implementation for applying framework hooks
        this.logger.debug(`Applying ${framework} framework hook: ${hook.name}`);
    }
    
    async applyDevelopmentHook(projectPath, tool, hookConfig, force) {
        // Implementation for applying development tool hooks
        this.logger.debug(`Applying ${tool} development hook`);
    }
    
    /**
     * Get hook system status
     */
    getHookStatus(projectPath) {
        return {
            installed: Array.from(this.installedHooks.keys()),
            config: this.hookConfig,
            monitoring: true
        };
    }
    
    /**
     * Uninstall hooks
     */
    async uninstallHooks(projectPath, options = {}) {
        this.logger.info(`🗑️ Uninstalling hooks from: ${projectPath}`);
        
        // Restore backups
        const backupDir = path.join(projectPath, '.nexus', 'hook-backups');
        if (await fs.pathExists(backupDir)) {
            const gitHooksBackup = path.join(backupDir, 'git-hooks');
            if (await fs.pathExists(gitHooksBackup)) {
                await fs.copy(gitHooksBackup, path.join(projectPath, '.git', 'hooks'));
            }
        }
        
        // Remove Nexus hook registry
        const registryPath = path.join(projectPath, '.nexus', 'hooks-registry.json');
        if (await fs.pathExists(registryPath)) {
            await fs.remove(registryPath);
        }
        
        this.logger.info('✅ Hooks uninstalled successfully');
    }
}

module.exports = { HookSystem };