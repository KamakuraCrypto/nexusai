/**
 * Advanced Prompt Engineering System
 * Implements cutting-edge prompting patterns for optimal AI performance:
 * - Chain-of-Thought (CoT)
 * - Tree-of-Thoughts (ToT)
 * - ReAct (Reasoning + Acting)
 * - Few-shot learning
 * - Context compression
 * - Token optimization
 */

const { Logger } = require('../../utils/logger');
const { TokenCounter } = require('../../utils/token-counter');

class PromptEngineer {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('PromptEngineer');
        this.tokenCounter = new TokenCounter();
        
        // Prompt pattern templates
        this.patterns = {
            chainOfThought: this.createChainOfThoughtPattern(),
            treeOfThoughts: this.createTreeOfThoughtsPattern(),
            react: this.createReActPattern(),
            fewShot: this.createFewShotPattern(),
            rolePlay: this.createRolePlayPattern(),
            stepByStep: this.createStepByStepPattern(),
            contextCompression: this.createContextCompressionPattern(),
            humanLike: this.createHumanLikePattern()
        };
        
        // Performance tracking
        this.stats = {
            patternsUsed: new Map(),
            averageTokens: new Map(),
            successRates: new Map(),
            optimizationSavings: 0
        };
    }

    /**
     * Apply optimal prompting pattern based on task type and complexity
     */
    async optimizePrompt(request) {
        const {
            task,
            taskType,
            complexity = 'medium',
            model,
            context,
            maxTokens,
            requiresReasoning = false,
            requiresActions = false,
            multiStep = false
        } = request;

        try {
            // Analyze task requirements
            const analysis = this.analyzeTask(task, taskType, complexity);
            
            // Select optimal pattern
            const selectedPattern = this.selectPattern(analysis, {
                requiresReasoning,
                requiresActions,
                multiStep,
                model
            });
            
            // Apply the pattern
            const optimizedPrompt = await this.applyPattern(selectedPattern, request);
            
            // Optimize for token efficiency
            const tokenOptimized = await this.optimizeTokens(optimizedPrompt, maxTokens);
            
            // Track usage
            this.trackPatternUsage(selectedPattern.name, tokenOptimized);
            
            return {
                prompt: tokenOptimized.prompt,
                pattern: selectedPattern.name,
                originalTokens: this.tokenCounter.count(task),
                optimizedTokens: tokenOptimized.tokens,
                savings: tokenOptimized.savings,
                metadata: {
                    taskType: analysis.type,
                    complexity: analysis.complexity,
                    reasoning: selectedPattern.reasoning,
                    structure: selectedPattern.structure
                }
            };
            
        } catch (error) {
            this.logger.error('Prompt optimization failed:', error);
            return { prompt: task, pattern: 'none', error: error.message };
        }
    }

    /**
     * Create Chain-of-Thought pattern
     * Encourages step-by-step reasoning
     */
    createChainOfThoughtPattern() {
        return {
            name: 'chain-of-thought',
            description: 'Step-by-step reasoning pattern',
            reasoning: true,
            structure: 'sequential',
            template: (task, context = {}) => {
                return `Think through this step by step:

${context.background ? `Background: ${context.background}\n` : ''}

Task: ${task}

Let me work through this systematically:

1. First, I need to understand what's being asked
2. Then, I'll identify the key components
3. Next, I'll reason through each step
4. Finally, I'll provide a comprehensive answer

Let's begin:`;
            },
            examples: [
                {
                    task: 'Calculate the compound interest',
                    reasoning: '1. Identify the formula: A = P(1 + r/n)^(nt)\n2. Extract given values\n3. Substitute and calculate'
                }
            ]
        };
    }

    /**
     * Create Tree-of-Thoughts pattern
     * Explores multiple reasoning paths
     */
    createTreeOfThoughtsPattern() {
        return {
            name: 'tree-of-thoughts',
            description: 'Multi-path reasoning exploration',
            reasoning: true,
            structure: 'branching',
            template: (task, context = {}) => {
                return `I'll explore multiple approaches to solve this problem:

Task: ${task}

Let me consider different angles:

**Approach 1: [Primary Method]**
- Reasoning path A
- Expected outcome
- Potential challenges

**Approach 2: [Alternative Method]**
- Reasoning path B
- Expected outcome
- Potential challenges

**Approach 3: [Creative Method]**
- Reasoning path C
- Expected outcome
- Potential challenges

Now I'll evaluate each approach and select the best solution:`;
            }
        };
    }

    /**
     * Create ReAct pattern
     * Combines Reasoning and Acting
     */
    createReActPattern() {
        return {
            name: 'react',
            description: 'Reasoning and Acting pattern',
            reasoning: true,
            structure: 'iterative',
            template: (task, context = {}) => {
                return `I'll solve this using a reasoning and action approach:

**Observation:** ${task}

**Thought 1:** Let me analyze what I need to do here.
**Action 1:** [Identify the core requirements]
**Observation 1:** [What I learned from this action]

**Thought 2:** Based on my observation, I should...
**Action 2:** [Take the next logical step]
**Observation 2:** [What I discovered]

**Thought 3:** Now I can see that...
**Action 3:** [Implement the solution]

**Final Answer:** [Complete response based on reasoning and actions]`;
            }
        };
    }

    /**
     * Create Few-Shot Learning pattern
     * Provides examples to guide behavior
     */
    createFewShotPattern() {
        return {
            name: 'few-shot',
            description: 'Example-driven learning pattern',
            reasoning: false,
            structure: 'example-based',
            template: (task, context = {}) => {
                const examples = context.examples || [];
                
                let exampleText = '';
                examples.forEach((example, index) => {
                    exampleText += `**Example ${index + 1}:**\n`;
                    exampleText += `Input: ${example.input}\n`;
                    exampleText += `Output: ${example.output}\n\n`;
                });

                return `${context.instruction || 'Follow the pattern shown in these examples:'}

${exampleText}

**Your Task:**
Input: ${task}
Output:`;
            }
        };
    }

    /**
     * Create Role-Play pattern
     * Adopts specific persona for specialized tasks
     */
    createRolePlayPattern() {
        return {
            name: 'role-play',
            description: 'Persona-based specialized assistance',
            reasoning: true,
            structure: 'persona-driven',
            template: (task, context = {}) => {
                const role = context.role || 'expert';
                const expertise = context.expertise || 'general problem solving';
                const personality = context.personality || 'professional and helpful';
                
                return `You are a ${role} with deep expertise in ${expertise}. Your personality is ${personality}.

Given your background and experience, please help with:

${task}

Approach this from your unique perspective as a ${role}, drawing on your specialized knowledge and experience.`;
            }
        };
    }

    /**
     * Create Step-by-Step pattern
     * Breaks down complex tasks into manageable steps
     */
    createStepByStepPattern() {
        return {
            name: 'step-by-step',
            description: 'Structured breakdown of complex tasks',
            reasoning: true,
            structure: 'sequential',
            template: (task, context = {}) => {
                return `I'll break this down into clear, actionable steps:

**Objective:** ${task}

**Step-by-Step Approach:**

**Step 1: Analysis**
- Understand the requirements
- Identify constraints and goals

**Step 2: Planning**  
- Outline the approach
- Gather necessary information

**Step 3: Execution**
- Implement the solution
- Address each component systematically

**Step 4: Verification**
- Review the solution
- Ensure completeness and accuracy

Let me work through each step:`;
            }
        };
    }

    /**
     * Create Context Compression pattern
     * Optimizes prompts for token efficiency
     */
    createContextCompressionPattern() {
        return {
            name: 'context-compression',
            description: 'Token-optimized context preservation',
            reasoning: false,
            structure: 'compressed',
            template: (task, context = {}) => {
                // Compress context while preserving key information
                const compressed = this.compressContext(context);
                
                return `[CTX: ${compressed}]

Q: ${task}
A:`;
            }
        };
    }

    /**
     * Create Human-Like pattern
     * Makes AI responses more natural and conversational
     */
    createHumanLikePattern() {
        return {
            name: 'human-like',
            description: 'Natural, conversational reasoning',
            reasoning: true,
            structure: 'conversational',
            template: (task, context = {}) => {
                return `Let me think about this...

${task}

You know, this is an interesting question. Let me walk through my thinking:

First off, I should consider... [natural reasoning flow]

Actually, let me step back and think about this differently... [show genuine thought process]

Okay, so here's what I think... [provide thoughtful response]`;
            }
        };
    }

    /**
     * Analyze task to determine optimal pattern
     */
    analyzeTask(task, taskType, complexity) {
        const analysis = {
            type: taskType || 'general',
            complexity: complexity,
            requiresLogic: /reason|analyze|solve|calculate|decide/i.test(task),
            requiresCreativity: /create|generate|brainstorm|invent/i.test(task),
            requiresSteps: /implement|build|develop|design/i.test(task),
            requiresExamples: /show|demonstrate|example/i.test(task),
            isConversational: /explain|discuss|tell|describe/i.test(task),
            isComplex: complexity === 'high' || task.length > 1000,
            isSimple: complexity === 'low' || task.length < 100
        };

        return analysis;
    }

    /**
     * Select optimal pattern based on analysis
     */
    selectPattern(analysis, requirements) {
        // Priority-based pattern selection
        if (requirements.requiresActions && requirements.requiresReasoning) {
            return this.patterns.react;
        }
        
        if (requirements.multiStep || analysis.requiresSteps) {
            return analysis.isComplex ? this.patterns.treeOfThoughts : this.patterns.stepByStep;
        }
        
        if (analysis.requiresLogic || requirements.requiresReasoning) {
            return analysis.isComplex ? this.patterns.treeOfThoughts : this.patterns.chainOfThought;
        }
        
        if (analysis.requiresExamples) {
            return this.patterns.fewShot;
        }
        
        if (analysis.isConversational) {
            return this.patterns.humanLike;
        }
        
        if (analysis.type === 'coding' || analysis.type === 'technical') {
            return this.patterns.rolePlay;
        }
        
        // Default to step-by-step for complex tasks
        return analysis.isComplex ? this.patterns.stepByStep : this.patterns.chainOfThought;
    }

    /**
     * Apply selected pattern to the request
     */
    async applyPattern(pattern, request) {
        const { task, context = {}, taskType, model } = request;
        
        // Enhance context based on task type
        const enhancedContext = await this.enhanceContext(context, taskType);
        
        // Apply pattern template
        const prompt = pattern.template(task, enhancedContext);
        
        // Add model-specific optimizations
        const modelOptimized = this.optimizeForModel(prompt, model, pattern);
        
        return modelOptimized;
    }

    /**
     * Enhance context with relevant information
     */
    async enhanceContext(context, taskType) {
        const enhanced = { ...context };
        
        // Add task-specific context
        switch (taskType) {
            case 'coding':
                enhanced.role = 'senior software engineer';
                enhanced.expertise = 'software development and best practices';
                break;
            case 'reasoning':
                enhanced.role = 'analytical expert';
                enhanced.expertise = 'logical reasoning and problem solving';
                break;
            case 'creative':
                enhanced.role = 'creative professional';
                enhanced.expertise = 'creative thinking and content generation';
                break;
            case 'research':
                enhanced.role = 'research analyst';
                enhanced.expertise = 'information analysis and synthesis';
                break;
        }
        
        return enhanced;
    }

    /**
     * Optimize prompt for specific AI models
     */
    optimizeForModel(prompt, model, pattern) {
        let optimized = prompt;
        
        // Model-specific optimizations
        if (model?.includes('claude')) {
            // Claude prefers clear structure and explicit reasoning
            if (pattern.reasoning) {
                optimized = `<thinking>\nI need to approach this systematically.\n</thinking>\n\n${optimized}`;
            }
        } else if (model?.includes('gpt')) {
            // GPT models benefit from role clarity
            optimized = `You are an expert assistant. ${optimized}`;
        } else if (model?.includes('gemini')) {
            // Gemini works well with structured prompts
            optimized = `## Task\n${optimized}`;
        }
        
        return optimized;
    }

    /**
     * Optimize prompts for token efficiency
     */
    async optimizeTokens(prompt, maxTokens) {
        const originalTokens = this.tokenCounter.count(prompt);
        
        if (!maxTokens || originalTokens <= maxTokens * 0.8) {
            return { prompt, tokens: originalTokens, savings: 0 };
        }
        
        // Apply compression techniques
        let optimized = prompt;
        
        // Remove redundant phrases
        optimized = optimized.replace(/\b(please|kindly|could you|would you)\b/gi, '');
        optimized = optimized.replace(/\b(very|really|quite|pretty)\b/gi, '');
        
        // Compress common patterns
        optimized = optimized.replace(/step by step/gi, 'systematically');
        optimized = optimized.replace(/in other words/gi, 'i.e.');
        optimized = optimized.replace(/for example/gi, 'e.g.');
        
        // Remove extra whitespace
        optimized = optimized.replace(/\n\s*\n/g, '\n');
        optimized = optimized.replace(/\s+/g, ' ').trim();
        
        const optimizedTokens = this.tokenCounter.count(optimized);
        const savings = originalTokens - optimizedTokens;
        
        return {
            prompt: optimized,
            tokens: optimizedTokens,
            savings,
            compressionRatio: (savings / originalTokens * 100).toFixed(1)
        };
    }

    /**
     * Compress context while preserving key information
     */
    compressContext(context) {
        const compressed = [];
        
        Object.entries(context).forEach(([key, value]) => {
            if (typeof value === 'string' && value.length > 50) {
                // Compress long strings
                const summary = value.substring(0, 30) + '...' + value.substring(value.length - 20);
                compressed.push(`${key}=${summary}`);
            } else {
                compressed.push(`${key}=${value}`);
            }
        });
        
        return compressed.join('|');
    }

    /**
     * Track pattern usage for analytics
     */
    trackPatternUsage(patternName, result) {
        // Update usage count
        const currentCount = this.stats.patternsUsed.get(patternName) || 0;
        this.stats.patternsUsed.set(patternName, currentCount + 1);
        
        // Update token averages
        const currentAvg = this.stats.averageTokens.get(patternName) || 0;
        const newAvg = (currentAvg * currentCount + result.tokens) / (currentCount + 1);
        this.stats.averageTokens.set(patternName, newAvg);
        
        // Track savings
        if (result.savings > 0) {
            this.stats.optimizationSavings += result.savings;
        }
    }

    /**
     * Get performance analytics
     */
    getStats() {
        return {
            patternsUsed: Object.fromEntries(this.stats.patternsUsed),
            averageTokens: Object.fromEntries(this.stats.averageTokens),
            totalOptimizationSavings: this.stats.optimizationSavings,
            availablePatterns: Object.keys(this.patterns)
        };
    }

    /**
     * Create custom pattern
     */
    createCustomPattern(name, config) {
        this.patterns[name] = {
            name,
            description: config.description || 'Custom pattern',
            reasoning: config.reasoning || false,
            structure: config.structure || 'custom',
            template: config.template
        };
        
        this.logger.info(`Created custom pattern: ${name}`);
    }
}

module.exports = { PromptEngineer };