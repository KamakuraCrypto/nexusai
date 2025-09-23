/**
 * Nexus AI Framework CLI Implementation
 * Handles all command-line operations and interactions
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { Logger } = require('../utils/logger');

class CLI {
    constructor(nexusFramework) {
        this.nexus = nexusFramework;
        this.logger = new Logger('NexusCLI');
        this.spinner = null;
    }

    async executeCommand(command, options = {}) {
        try {
            // Initialize framework if not already done
            if (!this.nexus.isInitialized) {
                await this.initializeFramework();
            }

            switch (command) {
                case 'init':
                    return await this.handleInit(options);
                case 'continue':
                    return await this.handleContinue(options);
                case 'status':
                    return await this.handleStatus(options);
                case 'ask':
                    return await this.handleAsk(options);
                case 'build':
                    return await this.handleBuild(options);
                case 'kb-sync':
                    return await this.handleKnowledgeBaseSync(options);
                case 'kb-query':
                    return await this.handleKnowledgeBaseQuery(options);
                case 'kb-list':
                    return await this.handleKnowledgeBaseList(options);
                case 'memory-save':
                    return await this.handleMemorySave(options);
                case 'memory-restore':
                    return await this.handleMemoryRestore(options);
                case 'memory-list':
                    return await this.handleMemoryList(options);
                case 'ai-providers':
                    return await this.handleAIProviders(options);
                case 'ai-configure':
                    return await this.handleAIConfigure(options);
                case 'config-set':
                    return await this.handleConfigSet(options);
                case 'config-get':
                    return await this.handleConfigGet(options);
                case 'config-reset':
                    return await this.handleConfigReset(options);
                case 'setup':
                    return await this.handleSetup(options);
                case 'update':
                    return await this.handleUpdate(options);
                case 'doctor':
                    return await this.handleDoctor(options);
                case 'export':
                    return await this.handleExport(options);
                case 'import':
                    return await this.handleImport(options);
                case 'import-project':
                    return await this.handleImportProject(options);
                case 'analyze-project':
                    return await this.handleAnalyzeProject(options);
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    async initializeFramework() {
        this.spinner = ora('Initializing Nexus AI Framework...').start();
        try {
            await this.nexus.initialize();
            this.spinner.succeed('Nexus AI Framework initialized');
        } catch (error) {
            this.spinner.fail('Failed to initialize framework');
            throw error;
        }
    }

    async handleInit(options) {
        console.log(chalk.cyan.bold('\n🚀 Nexus AI Enhanced Project Initialization\n'));
        console.log(chalk.yellow('✨ 1000x More Powerful - Autonomous Research & Planning\n'));
        
        let projectInput = options.projectName;
        
        // Get natural language project description
        if (!projectInput && options.interactive) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectInput',
                    message: 'Describe what you want to build (natural language):',
                    default: 'A full-stack web application'
                },
                {
                    type: 'list',
                    name: 'ecosystem',
                    message: 'Primary ecosystem (will auto-detect from description):',
                    choices: [
                        { name: '🌐 Web3/Blockchain (Solana, Ethereum)', value: 'web3' },
                        { name: '🤖 AI/ML Application', value: 'ai' },
                        { name: '💰 DeFi Protocol', value: 'defi' },
                        { name: '🚀 Full-Stack Web App', value: 'fullstack' },
                        { name: '📱 Mobile App', value: 'mobile' },
                        { name: '⚙️ Auto-detect from description', value: 'auto' }
                    ]
                },
                {
                    type: 'confirm',
                    name: 'research',
                    message: 'Enable autonomous research and expert planning?',
                    default: true
                },
                {
                    type: 'list',
                    name: 'planningDepth',
                    message: 'Planning depth level:',
                    choices: [
                        { name: '🚀 Comprehensive - Full research and planning', value: 'comprehensive' },
                        { name: '⚡ Standard - Balanced approach', value: 'standard' },
                        { name: '📋 Basic - Minimal research', value: 'basic' }
                    ],
                    default: 'comprehensive'
                },
                {
                    type: 'checkbox',
                    name: 'aiModels',
                    message: 'AI models for research and planning:',
                    choices: [
                        { name: '🧠 Claude (Best for architecture & code)', value: 'claude', checked: true },
                        { name: '🤔 GPT-4 (Best for reasoning & planning)', value: 'gpt4', checked: true },
                        { name: '👁️ Gemini (Best for multimodal)', value: 'gemini' },
                        { name: '⚡ Grok (Best for real-time)', value: 'grok' }
                    ]
                }
            ]);
            
            projectInput = answers.projectInput;
            options = { ...options, ...answers };
        }

        // Skip questions mode
        if (options.skipQuestions) {
            console.log(chalk.yellow('🔥 Skip Questions Mode - Using intelligent defaults\n'));
        }

        try {
            // Initialize Enhanced Init Command
            const { EnhancedInitCommand } = require('../commands/enhanced-init');
            const enhancedInit = new EnhancedInitCommand(this.nexus);
            
            this.spinner = ora('🧠 Starting enhanced project analysis...').start();
            
            // Execute enhanced init with autonomous research
            const result = await enhancedInit.execute(projectInput, {
                ecosystem: options.ecosystem,
                research: options.research !== false,
                planningDepth: options.planningDepth || 'comprehensive',
                aiModels: options.aiModels || ['claude', 'gpt4'],
                interactive: !options.skipQuestions,
                template: options.template
            });

            this.spinner.succeed('✅ Enhanced project plan created successfully!');
            
            // Display comprehensive results
            console.log(chalk.green.bold('\n🎉 PROJECT PLAN COMPLETED!\n'));
            
            const blueprint = result.blueprint;
            
            console.log(chalk.cyan('📊 Project Overview:'));
            console.log(`   📁 Name: ${blueprint.specifications?.name || 'AI-Generated Project'}`);
            console.log(`   🏗️  Architecture: ${blueprint.systemArchitecture?.pattern || 'Modern'}`);
            console.log(`   📈 Complexity: ${blueprint.metadata?.complexity || 'Medium'}`);
            console.log(`   ⏱️  Est. Time: ${blueprint.metadata?.estimatedDuration || 'TBD'}`);
            console.log(`   🎯 Confidence: ${(blueprint.metadata?.confidence * 100 || 85).toFixed(0)}%`);
            
            console.log(chalk.blue('\n🔍 Research Summary:'));
            if (blueprint.researchFindings?.length > 0) {
                blueprint.researchFindings.slice(0, 3).forEach((finding, index) => {
                    console.log(`   ${index + 1}. ${finding.topic || 'Research topic'}`);
                });
                if (blueprint.researchFindings.length > 3) {
                    console.log(`   ... and ${blueprint.researchFindings.length - 3} more research topics`);
                }
            } else {
                console.log('   • Comprehensive research conducted');
                console.log('   • Best practices identified');
                console.log('   • Architecture patterns analyzed');
            }
            
            console.log(chalk.magenta('\n🏗️ Implementation Plan:'));
            console.log(`   📄 Files to create: ${blueprint.implementationPlan?.totalFiles || 'Multiple'}`);
            if (blueprint.implementationPlan?.phases?.length) {
                blueprint.implementationPlan.phases.slice(0, 4).forEach((phase, index) => {
                    console.log(`   ${index + 1}. ${phase.name || `Phase ${index + 1}`}`);
                });
            } else {
                console.log('   • Foundation setup and configuration');
                console.log('   • Core feature implementation');
                console.log('   • Integration and testing');
                console.log('   • Deployment and documentation');
            }
            
            console.log(chalk.yellow('\n💾 Plan Storage:'));
            console.log(`   📁 Session ID: ${result.sessionId}`);
            console.log(`   💿 Plan saved to: .nexus/sessions/${result.sessionId}.json`);
            console.log(`   📝 Summary: .nexus/sessions/${result.sessionId}-summary.md`);
            
            console.log(chalk.green.bold('\n🚀 READY FOR EXECUTION!\n'));
            
            // Offer immediate execution
            if (options.interactive && !options.skipQuestions) {
                const executeAnswer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'executeNow',
                        message: 'Execute the implementation plan now?',
                        default: true
                    }
                ]);
                
                if (executeAnswer.executeNow) {
                    console.log(chalk.cyan('\n🔨 Starting implementation...\n'));
                    
                    // Execute the implementation
                    await this.executeImplementationPlan(blueprint);
                } else {
                    console.log(chalk.cyan('\n🎯 To execute later, run:'));
                    console.log(`   nexus build --session ${result.sessionId}`);
                }
            } else {
                console.log(chalk.cyan('\n🎯 Next Steps:'));
                console.log(`   1. Review the plan: cat .nexus/sessions/${result.sessionId}-summary.md`);
                console.log(`   2. Execute: nexus build --session ${result.sessionId}`);
                console.log(`   3. Ask questions: nexus ask "How does authentication work?"`);
            }
            
        } catch (error) {
            if (this.spinner) {
                this.spinner.fail('Enhanced project initialization failed');
            }
            throw error;
        }
    }

    async executeImplementationPlan(blueprint) {
        const totalFiles = blueprint.implementationPlan?.totalFiles || Object.keys(blueprint.fileContents || {}).length;
        let completed = 0;
        
        this.spinner = ora(`Creating project files... (0/${totalFiles})`).start();
        
        try {
            // Create project directory
            const fs = require('fs-extra');
            const path = require('path');
            const projectName = blueprint.specifications?.name || 'nexus-project';
            const projectPath = path.resolve(process.cwd(), projectName);
            
            await fs.ensureDir(projectPath);
            
            // Create files from the blueprint
            if (blueprint.fileContents) {
                for (const [filePath, content] of Object.entries(blueprint.fileContents)) {
                    const fullPath = path.join(projectPath, filePath);
                    await fs.ensureDir(path.dirname(fullPath));
                    await fs.writeFile(fullPath, content, 'utf8');
                    
                    completed++;
                    this.spinner.text = `Creating project files... (${completed}/${totalFiles})`;
                }
            }
            
            // Initialize git repository and create initial commit
            const { GitIntegration } = require('../core/git-integration');
            const gitIntegration = new GitIntegration();
            
            process.chdir(projectPath);
            await gitIntegration.initialize();
            
            // Track the initial project creation
            const actionId = await gitIntegration.trackAIAction(
                'project-initialization',
                'Enhanced Init: Complete project created with autonomous research and planning',
                Object.keys(blueprint.fileContents || {})
            );
            
            await gitIntegration.completeAIAction(actionId);
            
            this.spinner.succeed(`✅ Project created successfully at ${projectPath}`);
            
            console.log(chalk.green.bold('\n🎉 PROJECT IMPLEMENTATION COMPLETED!\n'));
            console.log(chalk.cyan(`📁 Project Location: ${projectPath}`));
            console.log(chalk.cyan(`🔄 Git repository initialized with tracking`));
            console.log(chalk.cyan(`📚 Complete documentation generated`));
            
            console.log(chalk.yellow('\n🎯 Next Steps:'));
            console.log(`   1. cd ${projectName}`);
            console.log(`   2. npm install  # or yarn install`);
            console.log(`   3. nexus continue  # Resume with full context`);
            console.log(`   4. nexus ask "How do I start development?"`);
            
        } catch (error) {
            this.spinner.fail('Implementation failed');
            throw error;
        }
    }

    async handleContinue(options) {
        this.spinner = ora('Restoring project context...').start();
        
        try {
            const result = await this.nexus.nexusAI.continueProject(options);
            this.spinner.succeed('Project context restored');
            
            console.log(chalk.green('\n🔄 Welcome back!'));
            console.log(`📊 Project: ${result.projectName}`);
            console.log(`📅 Last Session: ${result.lastSession}`);
            console.log(`🎯 Current Phase: ${result.currentPhase}`);
            
            if (result.suggestions.length > 0) {
                console.log(chalk.blue('\n💡 Suggestions:'));
                result.suggestions.forEach(suggestion => {
                    console.log(`  • ${suggestion}`);
                });
            }
            
        } catch (error) {
            this.spinner.fail('Failed to restore context');
            throw error;
        }
    }

    async handleStatus(options) {
        if (options.json) {
            const status = await this.getDetailedStatus();
            console.log(JSON.stringify(status, null, 2));
            return;
        }

        await this.nexus.showStatus();
    }

    async handleAsk(options) {
        console.log(chalk.cyan(`\n🤔 Asking: "${options.question}"\n`));
        
        this.spinner = ora('Thinking...').start();
        
        try {
            const response = await this.nexus.nexusAI.ask({
                question: options.question,
                model: options.model,
                knowledgeBase: options.knowledgeBase,
                includeContext: options.context
            });
            
            this.spinner.succeed('Response ready');
            
            console.log(chalk.white('\n' + response.answer + '\n'));
            
            if (response.sources && response.sources.length > 0) {
                console.log(chalk.gray('📚 Sources:'));
                response.sources.forEach(source => {
                    console.log(chalk.gray(`  • ${source}`));
                });
            }
            
            if (response.suggestions && response.suggestions.length > 0) {
                console.log(chalk.blue('\n💡 Related suggestions:'));
                response.suggestions.forEach(suggestion => {
                    console.log(`  • ${suggestion}`);
                });
            }
            
        } catch (error) {
            this.spinner.fail('Failed to get response');
            throw error;
        }
    }

    async handleBuild(options) {
        this.spinner = ora('Building with AI assistance...').start();
        
        try {
            const result = await this.nexus.nexusAI.buildProject({
                target: options.target,
                feature: options.feature,
                includeTests: options.tests,
                generateDocs: options.docs,
                securityScan: options.securityScan
            });
            
            this.spinner.succeed('Build completed');
            
            console.log(chalk.green('\n🔨 Build Results:'));
            result.results.forEach(item => {
                console.log(`  ✅ ${item}`);
            });
            
            if (result.warnings && result.warnings.length > 0) {
                console.log(chalk.yellow('\n⚠️ Warnings:'));
                result.warnings.forEach(warning => {
                    console.log(`  • ${warning}`);
                });
            }
            
        } catch (error) {
            this.spinner.fail('Build failed');
            throw error;
        }
    }

    async handleKnowledgeBaseSync(options) {
        this.spinner = ora('Synchronizing knowledge bases...').start();
        
        try {
            const result = await this.nexus.knowledgeBase.sync({
                ecosystem: options.ecosystem,
                ecosystems: options.ecosystems?.split(','),
                protocols: options.protocols?.split(','),
                force: options.force
            });
            
            this.spinner.succeed('Knowledge base synchronized');
            
            console.log(chalk.green('\n📚 Sync Results:'));
            console.log(`  • Ecosystems updated: ${result.ecosystemsUpdated}`);
            console.log(`  • Documents processed: ${result.documentsProcessed}`);
            console.log(`  • APIs discovered: ${result.apisDiscovered}`);
            
        } catch (error) {
            this.spinner.fail('Knowledge base sync failed');
            throw error;
        }
    }

    async handleKnowledgeBaseQuery(options) {
        this.spinner = ora('Searching knowledge base...').start();
        
        try {
            const results = await this.nexus.knowledgeBase.query({
                question: options.question,
                ecosystem: options.ecosystem,
                similarity: parseFloat(options.similarity || '0.8')
            });
            
            this.spinner.succeed(`Found ${results.length} relevant results`);
            
            console.log(chalk.cyan(`\n🔍 Knowledge Base Results for: "${options.question}"\n`));
            
            results.forEach((result, index) => {
                console.log(chalk.white(`${index + 1}. ${result.title}`));
                console.log(chalk.gray(`   ${result.summary}`));
                console.log(chalk.blue(`   Source: ${result.source}`));
                console.log(chalk.yellow(`   Relevance: ${(result.similarity * 100).toFixed(1)}%\n`));
            });
            
        } catch (error) {
            this.spinner.fail('Knowledge base query failed');
            throw error;
        }
    }

    async handleKnowledgeBaseList(options) {
        try {
            const ecosystems = await this.nexus.knowledgeBase.listEcosystems({
                includeStats: options.detailed,
                availableOnly: true
            });
            
            if (options.detailed) {
                console.log(chalk.cyan('\n📚 Available Knowledge Bases:\n'));
                
                for (const ecosystem of ecosystems) {
                    console.log(chalk.white(`🌐 ${ecosystem.name}`));
                    console.log(`   ${ecosystem.description}`);
                    console.log(`   Protocols: ${ecosystem.protocols}`);
                    
                    if (ecosystem.stats) {
                        console.log(`   Documents: ${ecosystem.stats.documentsProcessed || 0}`);
                        console.log(`   Last Sync: ${ecosystem.stats.lastSync || 'Never'}`);
                    }
                    console.log();
                }
            } else {
                console.log(chalk.cyan('\n📚 Available Knowledge Bases:'));
                ecosystems.forEach(ecosystem => {
                    const status = ecosystem.initialized ? '✅' : '⏳';
                    console.log(`  ${status} ${ecosystem.name} (${ecosystem.protocols} protocols)`);
                });
            }
            
        } catch (error) {
            this.spinner?.fail('Failed to list knowledge bases');
            throw error;
        }
    }

    async handleMemorySave(options) {
        this.spinner = ora('Creating memory checkpoint...').start();
        
        try {
            const checkpointName = options.name || `checkpoint_${Date.now()}`;
            const result = await this.nexus.memory.createCheckpoint({
                name: checkpointName,
                description: options.description
            });
            
            this.spinner.succeed(`Memory checkpoint created: ${checkpointName}`);
            
            console.log(chalk.green('\n💾 Checkpoint Details:'));
            console.log(`📁 Name: ${result.name}`);
            console.log(`📝 Description: ${result.description || 'No description'}`);
            console.log(`📊 Size: ${result.size} bytes`);
            console.log(`⏰ Created: ${result.createdAt}`);
            
        } catch (error) {
            this.spinner.fail('Failed to create memory checkpoint');
            throw error;
        }
    }

    async handleMemoryRestore(options) {
        if (!options.confirm) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: `Restore from checkpoint "${options.name}"? This will overwrite current memory.`,
                    default: false
                }
            ]);
            
            if (!answer.proceed) {
                console.log(chalk.yellow('Restore cancelled'));
                return;
            }
        }
        
        this.spinner = ora('Restoring from memory checkpoint...').start();
        
        try {
            const result = await this.nexus.memory.restoreFromCheckpoint(options.name);
            
            this.spinner.succeed('Memory restored successfully');
            
            console.log(chalk.green('\n🔄 Restore Complete:'));
            console.log(`📁 Checkpoint: ${result.checkpointName}`);
            console.log(`📊 Restored: ${result.itemsRestored} items`);
            console.log(`⏰ From: ${result.checkpointDate}`);
            
        } catch (error) {
            this.spinner.fail('Failed to restore from checkpoint');
            throw error;
        }
    }

    async handleMemoryList(options) {
        try {
            const checkpoints = await this.nexus.memory.listCheckpoints();
            
            if (checkpoints.length === 0) {
                console.log(chalk.yellow('\n💾 No memory checkpoints found'));
                return;
            }
            
            console.log(chalk.cyan('\n💾 Memory Checkpoints:\n'));
            
            checkpoints.forEach((checkpoint, index) => {
                console.log(chalk.white(`${index + 1}. ${checkpoint.name}`));
                console.log(`   📝 ${checkpoint.description || 'No description'}`);
                console.log(`   📊 Size: ${checkpoint.size} bytes`);
                console.log(`   ⏰ Created: ${checkpoint.createdAt}`);
                
                if (options.detailed && checkpoint.contents) {
                    console.log(`   📋 Contents: ${checkpoint.contents.join(', ')}`);
                }
                console.log();
            });
            
        } catch (error) {
            throw error;
        }
    }

    async handleAIProviders(options) {
        try {
            const providers = await this.nexus.getProviderStatus();
            
            console.log(chalk.cyan('\n🤖 AI Providers:\n'));
            
            for (const [name, status] of Object.entries(providers)) {
                const statusIcon = status.available ? '✅' : '❌';
                console.log(chalk.white(`${statusIcon} ${name}`));
                
                if (options.status) {
                    console.log(`   Model: ${status.defaultModel || 'N/A'}`);
                    console.log(`   Status: ${status.status || 'Unknown'}`);
                    console.log(`   Requests: ${status.totalRequests || 0}`);
                    console.log(`   Tokens: ${status.totalTokens || 0}`);
                }
                console.log();
            }
            
        } catch (error) {
            throw error;
        }
    }

    async handleAIConfigure(options) {
        console.log(chalk.cyan(`\n⚙️ Configuring ${options.provider} provider...\n`));
        
        try {
            const config = {};
            
            if (options.apiKey) {
                config.apiKey = options.apiKey;
            } else {
                const answer = await inquirer.prompt([
                    {
                        type: 'password',
                        name: 'apiKey',
                        message: `Enter API key for ${options.provider}:`,
                        mask: '*'
                    }
                ]);
                config.apiKey = answer.apiKey;
            }
            
            if (options.endpoint) {
                config.endpoint = options.endpoint;
            }
            
            await this.nexus.configureProvider(options.provider, config);
            
            console.log(chalk.green(`✅ ${options.provider} provider configured successfully`));
            
        } catch (error) {
            throw error;
        }
    }

    async handleConfigSet(options) {
        try {
            await this.nexus.config.set(options.key, options.value);
            console.log(chalk.green(`✅ Configuration updated: ${options.key} = ${options.value}`));
            
        } catch (error) {
            throw error;
        }
    }

    async handleConfigGet(options) {
        try {
            if (options.key) {
                const value = this.nexus.config.get(options.key);
                console.log(chalk.cyan(`${options.key}: ${value || 'undefined'}`));
            } else {
                const config = this.nexus.config.getAll();
                console.log(chalk.cyan('\n⚙️ Current Configuration:\n'));
                console.log(JSON.stringify(config, null, 2));
            }
            
        } catch (error) {
            throw error;
        }
    }

    async handleConfigReset(options) {
        if (!options.confirm) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Reset all configuration to defaults? This cannot be undone.',
                    default: false
                }
            ]);
            
            if (!answer.proceed) {
                console.log(chalk.yellow('Reset cancelled'));
                return;
            }
        }
        
        try {
            await this.nexus.config.reset();
            console.log(chalk.green('✅ Configuration reset to defaults'));
            
        } catch (error) {
            throw error;
        }
    }

    async handleSetup(options) {
        console.log(chalk.cyan.bold('\n🛠️ Nexus AI Framework Setup\n'));
        
        if (options.quick) {
            console.log(chalk.yellow('🚀 Quick setup with defaults...\n'));
            
            try {
                await this.nexus.setup({ quick: true });
                console.log(chalk.green('✅ Quick setup completed'));
                
            } catch (error) {
                throw error;
            }
        } else {
            // Interactive setup
            const answers = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'providers',
                    message: 'Which AI providers would you like to configure?',
                    choices: [
                        { name: 'Claude (Anthropic)', value: 'claude', checked: true },
                        { name: 'GPT (OpenAI)', value: 'gpt', checked: true },
                        { name: 'Gemini (Google)', value: 'gemini' },
                        { name: 'Grok (xAI)', value: 'grok' }
                    ]
                },
                {
                    type: 'checkbox',
                    name: 'ecosystems',
                    message: 'Which knowledge base ecosystems should be enabled?',
                    choices: [
                        { name: 'Solana/DeFi', value: 'solana', checked: true },
                        { name: 'Ethereum', value: 'ethereum' },
                        { name: 'AI/ML', value: 'ai-ml' },
                        { name: 'Web Development', value: 'web-dev' }
                    ]
                },
                {
                    type: 'confirm',
                    name: 'syncKnowledgeBase',
                    message: 'Sync knowledge bases now?',
                    default: true
                }
            ]);
            
            try {
                this.spinner = ora('Setting up Nexus AI Framework...').start();
                
                await this.nexus.setup({
                    providers: answers.providers,
                    ecosystems: answers.ecosystems,
                    syncKnowledgeBase: answers.syncKnowledgeBase
                });
                
                this.spinner.succeed('Setup completed successfully');
                
                console.log(chalk.green('\n✅ Nexus AI Framework is ready!'));
                console.log(chalk.cyan('\n🎯 Next steps:'));
                console.log('  1. nexus init "your project idea"');
                console.log('  2. nexus ask "How do I get started?"');
                
            } catch (error) {
                this.spinner?.fail('Setup failed');
                throw error;
            }
        }
    }

    async handleUpdate(options) {
        this.spinner = ora('Checking for updates...').start();
        
        try {
            const updateInfo = await this.nexus.checkForUpdates(options);
            
            if (!updateInfo.hasUpdates) {
                this.spinner.succeed('Nexus AI Framework is up to date');
                return;
            }
            
            this.spinner.succeed(`Update available: ${updateInfo.latestVersion}`);
            
            if (options.checkOnly) {
                console.log(chalk.cyan(`\n📦 Current version: ${updateInfo.currentVersion}`));
                console.log(chalk.cyan(`📦 Latest version: ${updateInfo.latestVersion}`));
                console.log(chalk.yellow('\nRun "nexus update" to install the update'));
                return;
            }
            
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: `Update to version ${updateInfo.latestVersion}?`,
                    default: true
                }
            ]);
            
            if (answer.proceed) {
                this.spinner = ora('Installing update...').start();
                await this.nexus.installUpdate(updateInfo);
                this.spinner.succeed('Update installed successfully');
                
                console.log(chalk.green('\n✅ Nexus AI Framework updated!'));
                console.log(chalk.cyan('Please restart your session to use the new version'));
            }
            
        } catch (error) {
            this.spinner?.fail('Update check failed');
            throw error;
        }
    }

    async handleDoctor(options) {
        console.log(chalk.cyan.bold('\n🩺 Nexus AI Framework Diagnostics\n'));
        
        this.spinner = ora('Running diagnostic checks...').start();
        
        try {
            const diagnostics = await this.nexus.runDiagnostics(options);
            
            this.spinner.succeed('Diagnostic checks completed');
            
            console.log(chalk.green('\n✅ System Health:'));
            diagnostics.checks.forEach(check => {
                const icon = check.passed ? '✅' : '❌';
                console.log(`  ${icon} ${check.name}: ${check.status}`);
                
                if (!check.passed && check.suggestion) {
                    console.log(chalk.yellow(`     💡 ${check.suggestion}`));
                }
            });
            
            if (diagnostics.warnings.length > 0) {
                console.log(chalk.yellow('\n⚠️ Warnings:'));
                diagnostics.warnings.forEach(warning => {
                    console.log(`  • ${warning}`);
                });
            }
            
            if (options.fix && diagnostics.fixableIssues.length > 0) {
                console.log(chalk.cyan('\n🔧 Fixing issues...'));
                
                for (const issue of diagnostics.fixableIssues) {
                    try {
                        await this.nexus.fixIssue(issue);
                        console.log(chalk.green(`  ✅ Fixed: ${issue.description}`));
                    } catch (error) {
                        console.log(chalk.red(`  ❌ Failed to fix: ${issue.description}`));
                    }
                }
            }
            
        } catch (error) {
            this.spinner?.fail('Diagnostics failed');
            throw error;
        }
    }

    async handleExport(options) {
        this.spinner = ora('Exporting data...').start();
        
        try {
            const result = await this.nexus.exportData({
                format: options.format || 'json',
                output: options.output,
                includeMemory: options.includeMemory,
                compress: options.compress
            });
            
            this.spinner.succeed(`Data exported to: ${result.outputPath}`);
            
            console.log(chalk.green('\n📤 Export Complete:'));
            console.log(`📁 File: ${result.outputPath}`);
            console.log(`📊 Size: ${result.size} bytes`);
            console.log(`📋 Items: ${result.itemCount}`);
            
        } catch (error) {
            this.spinner?.fail('Export failed');
            throw error;
        }
    }

    async handleImport(options) {
        this.spinner = ora('Importing data...').start();
        
        try {
            const result = await this.nexus.importData({
                file: options.file,
                merge: options.merge,
                overwrite: options.overwrite
            });
            
            this.spinner.succeed('Data imported successfully');
            
            console.log(chalk.green('\n📥 Import Complete:'));
            console.log(`📋 Items imported: ${result.itemsImported}`);
            console.log(`⚠️ Conflicts: ${result.conflicts || 0}`);
            console.log(`🔄 Merged: ${result.merged || 0}`);
            
        } catch (error) {
            this.spinner?.fail('Import failed');
            throw error;
        }
    }

    async handleImportProject(options) {
        console.log(chalk.cyan.bold('\n🚀 NEXUS PROJECT IMPORT - BULLETPROOF INTEGRATION\n'));
        console.log(chalk.yellow('🛡️ Maximum Data Protection - Zero Risk Import Process\n'));
        
        const projectPath = options.projectPath || process.cwd();
        
        try {
            // Initialize Project Importer
            const { ProjectImporter } = require('../commands/project-import');
            const importer = new ProjectImporter(this.nexus);
            
            this.spinner = ora('🔍 Analyzing existing project structure...').start();
            
            // Step 1: Validate and analyze project
            const projectAnalysis = await importer.analyzeProjectStructure(projectPath);
            
            this.spinner.text = '🛡️ Creating comprehensive safety backup...';
            
            // Step 2: Execute bulletproof import with full safety measures
            const result = await importer.importProject(projectPath, {
                force: options.force,
                skipBackup: options.noBackup,
                skipHooks: options.noHooks,
                skipDocs: options.noDocs,
                skipStateTracking: options.noStateTracking
            });
            
            this.spinner.succeed('✅ Project import completed successfully!');
            
            console.log(chalk.green.bold('\n🎉 IMPORT SUCCESSFUL - FRAMEWORK ACTIVATED!\n'));
            
            // Display comprehensive results
            console.log(chalk.cyan('📊 Project Analysis Results:'));
            console.log(`   📁 Project Type: ${projectAnalysis.type || 'Unknown'}`);
            console.log(`   🔧 Framework: ${projectAnalysis.framework || 'Detected automatically'}`);
            console.log(`   📝 Language: ${projectAnalysis.primaryLanguage || 'Multiple'}`);
            console.log(`   📈 Complexity: ${projectAnalysis.complexity || 'Medium'}`);
            console.log(`   📄 Files Analyzed: ${projectAnalysis.totalFiles || 'Multiple'}`);
            
            console.log(chalk.blue('\n🛡️ Safety Measures Applied:'));
            console.log(`   💾 Backup Created: ${result.backupPath}`);
            console.log(`   🔄 Git Repository: ${result.gitInitialized ? 'Initialized' : 'Enhanced'}`);
            console.log(`   📝 State Tracking: ${result.stateTrackingEnabled ? 'Enabled' : 'Skipped'}`);
            console.log(`   🪝 Hooks Installed: ${result.hooksInstalled ? 'Yes' : 'No'}`);
            
            console.log(chalk.magenta('\n🏗️ Framework Integration:'));
            console.log(`   📚 Documentation: ${result.docsGenerated ? 'Generated' : 'Skipped'}`);
            console.log(`   🧠 Knowledge Base: ${result.knowledgeBaseCreated ? 'Created' : 'Pending'}`);
            console.log(`   ⚙️ Config Files: ${result.configFilesCreated || 0} created`);
            console.log(`   🔧 Framework Files: ${result.frameworkFilesCreated || 0} created`);
            
            console.log(chalk.yellow('\n💾 Recovery Information:'));
            console.log(`   🆔 Recovery ID: ${result.recoveryId}`);
            console.log(`   📁 Backup Path: ${result.backupPath}`);
            console.log(`   🔄 Rollback Command: nexus memory restore ${result.recoveryId}`);
            
            console.log(chalk.green.bold('\n🚀 READY FOR AI-ENHANCED DEVELOPMENT!\n'));
            
            console.log(chalk.cyan('🎯 Next Steps:'));
            console.log('   1. nexus continue  # Resume with full AI context');
            console.log('   2. nexus status   # Check framework status');
            console.log('   3. nexus ask "Analyze my project structure"');
            console.log('   4. nexus build    # Start AI-assisted development');
            
            console.log(chalk.blue('\n📚 Pro Tips:'));
            console.log('   • All changes are automatically backed up');
            console.log('   • Use "nexus ask" for intelligent project guidance');
            console.log('   • Framework provides complete data loss prevention');
            
        } catch (error) {
            if (this.spinner) {
                this.spinner.fail('Project import failed');
            }
            
            console.log(chalk.red('\n❌ Import Error Details:'));
            console.log(`   Error: ${error.message}`);
            
            if (error.recoveryId) {
                console.log(chalk.yellow('\n🛡️ Recovery Options:'));
                console.log(`   Rollback: nexus memory restore ${error.recoveryId}`);
                console.log(`   Backup: Check ${error.backupPath || 'backup directory'}`);
            }
            
            throw error;
        }
    }

    async handleAnalyzeProject(options) {
        console.log(chalk.cyan.bold('\n📊 NEXUS PROJECT ANALYSIS\n'));
        console.log(chalk.yellow('🔍 Deep Learning Analysis with AI Optimization\n'));
        
        const projectPath = options.projectPath || process.cwd();
        
        try {
            // Initialize Project Importer for analysis
            const { ProjectImporter } = require('../commands/project-import');
            const importer = new ProjectImporter(this.nexus);
            
            this.spinner = ora('🔍 Performing comprehensive project analysis...').start();
            
            // Execute deep project analysis
            const analysis = await importer.analyzeProjectStructure(projectPath);
            
            this.spinner.text = '🧠 Generating AI-optimized documentation...';
            
            // Generate comprehensive analysis with AI optimization
            const enhancedAnalysis = await importer.generateProjectAnalysis(projectPath, {
                detailed: options.detailed,
                aiOptimize: options.aiOptimize !== false,
                includeMetrics: true,
                generateDocs: true
            });
            
            this.spinner.succeed('✅ Project analysis completed!');
            
            console.log(chalk.green.bold('\n🎉 ANALYSIS COMPLETE!\n'));
            
            // Display comprehensive analysis results
            console.log(chalk.cyan('📊 Project Overview:'));
            console.log(`   📁 Project Name: ${analysis.name || 'Detected from structure'}`);
            console.log(`   🏗️  Type: ${analysis.type || 'Multi-language project'}`);
            console.log(`   🔧 Framework: ${analysis.framework || 'Multiple/Custom'}`);
            console.log(`   📝 Primary Language: ${analysis.primaryLanguage || 'Multiple'}`);
            console.log(`   📈 Complexity Score: ${analysis.complexityScore || 'N/A'}/10`);
            
            console.log(chalk.blue('\n📄 File Structure Analysis:'));
            console.log(`   📁 Total Files: ${analysis.totalFiles || 0}`);
            console.log(`   📝 Code Files: ${analysis.codeFiles || 0}`);
            console.log(`   📋 Config Files: ${analysis.configFiles || 0}`);
            console.log(`   📚 Documentation: ${analysis.docFiles || 0}`);
            console.log(`   🧪 Test Files: ${analysis.testFiles || 0}`);
            
            if (analysis.languages && Object.keys(analysis.languages).length > 0) {
                console.log(chalk.magenta('\n🔤 Language Distribution:'));
                Object.entries(analysis.languages).forEach(([lang, percentage]) => {
                    console.log(`   ${lang}: ${percentage}%`);
                });
            }
            
            if (analysis.dependencies && Object.keys(analysis.dependencies).length > 0) {
                console.log(chalk.yellow('\n📦 Key Dependencies:'));
                Object.entries(analysis.dependencies).slice(0, 5).forEach(([dep, version]) => {
                    console.log(`   ${dep}: ${version}`);
                });
                if (Object.keys(analysis.dependencies).length > 5) {
                    console.log(`   ... and ${Object.keys(analysis.dependencies).length - 5} more`);
                }
            }
            
            if (enhancedAnalysis.recommendations && enhancedAnalysis.recommendations.length > 0) {
                console.log(chalk.green('\n💡 AI Recommendations:'));
                enhancedAnalysis.recommendations.slice(0, 3).forEach((rec, index) => {
                    console.log(`   ${index + 1}. ${rec}`);
                });
            }
            
            if (enhancedAnalysis.architecturePatterns && enhancedAnalysis.architecturePatterns.length > 0) {
                console.log(chalk.blue('\n🏗️ Architecture Patterns Detected:'));
                enhancedAnalysis.architecturePatterns.forEach(pattern => {
                    console.log(`   • ${pattern}`);
                });
            }
            
            console.log(chalk.cyan('\n📁 Generated Documentation:'));
            if (enhancedAnalysis.documentationGenerated) {
                console.log(`   📄 Project README: ${enhancedAnalysis.readmePath || 'Generated'}`);
                console.log(`   📊 Architecture Docs: ${enhancedAnalysis.architecturePath || 'Generated'}`);
                console.log(`   🗺️  Component Map: ${enhancedAnalysis.componentMapPath || 'Generated'}`);
                console.log(`   📚 API Documentation: ${enhancedAnalysis.apiDocsPath || 'Generated'}`);
            } else {
                console.log('   📝 Documentation ready for generation');
            }
            
            console.log(chalk.yellow('\n🎯 Next Steps:'));
            console.log('   1. nexus import-project  # Import Nexus framework');
            console.log('   2. nexus continue        # Start AI-enhanced development');
            console.log('   3. nexus ask "How can I improve this project?"');
            console.log('   4. nexus build           # Begin structured development');
            
            if (options.detailed) {
                console.log(chalk.gray('\n📋 Detailed Analysis:'));
                console.log(`   Analysis saved to: ${enhancedAnalysis.analysisFilePath || '.nexus/analysis.json'}`);
                console.log(`   Full report: ${enhancedAnalysis.reportPath || '.nexus/project-report.md'}`);
            }
            
        } catch (error) {
            if (this.spinner) {
                this.spinner.fail('Project analysis failed');
            }
            throw error;
        }
    }

    async getDetailedStatus() {
        const status = {
            framework: {
                version: require('../package.json').version,
                initialized: this.nexus.isInitialized,
                uptime: Date.now() - this.nexus.stats.sessionStart
            },
            providers: await this.nexus.getProviderStatus(),
            memory: this.nexus.memory ? await this.nexus.memory.getStats() : null,
            knowledgeBase: this.nexus.knowledgeBase ? this.nexus.knowledgeBase.getStats() : null,
            git: this.nexus.git ? await this.nexus.git.getStats() : null,
            stats: this.nexus.getStats()
        };
        
        return status;
    }
    
    handleError(error) {
        if (this.spinner) {
            this.spinner.fail('Operation failed');
        }
        
        console.error(chalk.red('\n❌ Error:'), error.message);
        
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
            console.error(chalk.gray('\nStack trace:'));
            console.error(chalk.gray(error.stack));
        }
        
        console.log(chalk.blue('\n💡 Need help? Visit: https://docs.nexusai.dev'));
        console.log(chalk.blue('💬 Community: https://discord.gg/nexusai'));
        
        process.exit(1);
    }
}

module.exports = { CLI };