/**
 * Claude AI Provider
 * Implementation for Anthropic's Claude models
 * Optimized for coding, reasoning, and technical tasks
 */

const { AIProvider } = require('../ai-provider');
const Anthropic = require('@anthropic-ai/sdk');

class ClaudeProvider extends AIProvider {
    constructor(config = {}) {
        super({
            name: 'Claude',
            type: 'text',
            capabilities: [
                'coding', 'reasoning', 'technical', 'conversation', 'analysis',
                'debugging', 'architecture', 'refactoring', 'security'
            ],
            maxTokens: config.model?.includes('haiku') ? 32000 : 200000,
            costPerToken: config.model?.includes('haiku') ? 0.000001 : 0.000015,
            model: config.model || 'claude-3-5-sonnet-20241022',
            ...config
        });

        this.anthropic = null;
        this.supportedModels = [
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307'
        ];
    }

    async initialize() {
        if (this.isInitialized) return;

        // Initialize Anthropic client
        this.anthropic = new Anthropic({
            apiKey: this.apiKey,
            baseURL: this.endpoint
        });

        await super.initialize();
    }

    async makeRequest(request) {
        const {
            messages = [],
            maxTokens = this.maxTokens,
            temperature = 0.7,
            systemPrompt,
            tools = [],
            toolChoice
        } = request;

        try {
            // Format messages for Claude
            const formattedMessages = this.formatMessagesForClaude(messages);
            
            // Prepare request parameters
            const requestParams = {
                model: this.model,
                max_tokens: Math.min(maxTokens, this.maxTokens),
                temperature,
                messages: formattedMessages
            };

            // Add system prompt if provided
            if (systemPrompt) {
                requestParams.system = systemPrompt;
            }

            // Add tools if provided (for Claude Code integration)
            if (tools && tools.length > 0) {
                requestParams.tools = this.formatToolsForClaude(tools);
                
                if (toolChoice) {
                    requestParams.tool_choice = toolChoice;
                }
            }

            // Make API request
            const response = await this.anthropic.messages.create(requestParams);

            // Handle tool usage
            if (response.content.some(content => content.type === 'tool_use')) {
                return this.handleToolResponse(response);
            }

            // Extract text content
            const textContent = response.content
                .filter(content => content.type === 'text')
                .map(content => content.text)
                .join('\n');

            return {
                content: textContent,
                finishReason: response.stop_reason,
                usage: {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens,
                    totalTokens: response.usage.input_tokens + response.usage.output_tokens
                },
                raw: response
            };

        } catch (error) {
            this.logger.error('Claude API request failed:', error);
            
            // Handle specific Claude API errors
            if (error.status === 429) {
                throw new Error('Claude API rate limit exceeded. Please try again later.');
            } else if (error.status === 401) {
                throw new Error('Claude API authentication failed. Check your API key.');
            } else if (error.status === 400) {
                throw new Error(`Claude API request invalid: ${error.message}`);
            }
            
            throw error;
        }
    }

    /**
     * Format messages for Claude API
     * @private
     */
    formatMessagesForClaude(messages) {
        return messages.map(message => {
            if (typeof message === 'string') {
                return { role: 'user', content: message };
            }
            
            return {
                role: message.role === 'assistant' ? 'assistant' : 'user',
                content: message.content || message.text || ''
            };
        }).filter(message => message.content.trim().length > 0);
    }

    /**
     * Format tools for Claude API (for Claude Code integration)
     * @private
     */
    formatToolsForClaude(tools) {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters || tool.input_schema || {
                type: 'object',
                properties: {},
                required: []
            }
        }));
    }

    /**
     * Handle tool usage response
     * @private
     */
    async handleToolResponse(response) {
        const toolUses = response.content.filter(content => content.type === 'tool_use');
        const textContent = response.content
            .filter(content => content.type === 'text')
            .map(content => content.text)
            .join('\n');

        return {
            content: textContent,
            toolCalls: toolUses.map(toolUse => ({
                id: toolUse.id,
                name: toolUse.name,
                arguments: toolUse.input
            })),
            finishReason: response.stop_reason,
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            },
            raw: response
        };
    }

    /**
     * Specialized method for code generation
     */
    async generateCode(request) {
        const {
            task,
            language = 'javascript',
            framework,
            style = 'clean',
            includeComments = true,
            includeTests = false
        } = request;

        const systemPrompt = `You are an expert software engineer specializing in ${language}${framework ? ` with ${framework}` : ''}. 
        
Generate high-quality, production-ready code that follows best practices:
- Write ${style === 'clean' ? 'clean, readable' : style} code
- Follow ${language} conventions and idioms
- Include proper error handling
- ${includeComments ? 'Add helpful comments' : 'Minimize comments'}
- Focus on performance and maintainability
${includeTests ? '- Include unit tests' : ''}

Respond with just the code, properly formatted.`;

        return this.sendRequest({
            messages: [{ role: 'user', content: task }],
            systemPrompt,
            temperature: 0.3 // Lower temperature for more consistent code
        });
    }

    /**
     * Specialized method for code review
     */
    async reviewCode(code, options = {}) {
        const {
            focus = 'general',
            includeRecommendations = true,
            checkSecurity = true
        } = options;

        const systemPrompt = `You are a senior code reviewer. Analyze the provided code and provide:

1. Overall assessment of code quality
2. Specific issues and bugs
3. Performance considerations
4. Security concerns (if any)
5. Best practices recommendations
${includeRecommendations ? '6. Concrete improvement suggestions' : ''}

Focus areas: ${focus}
${checkSecurity ? 'Pay special attention to security vulnerabilities.' : ''}

Be constructive and specific in your feedback.`;

        return this.sendRequest({
            messages: [{ role: 'user', content: `Please review this code:\n\n\`\`\`\n${code}\n\`\`\`` }],
            systemPrompt,
            temperature: 0.4
        });
    }

    /**
     * Specialized method for architecture design
     */
    async designArchitecture(requirements) {
        const systemPrompt = `You are a senior software architect. Based on the requirements, design a comprehensive system architecture.

Provide:
1. High-level architecture overview
2. Component breakdown and responsibilities
3. Technology stack recommendations
4. Database design considerations
5. API design
6. Security architecture
7. Scalability considerations
8. Deployment strategy

Be specific and practical in your recommendations.`;

        return this.sendRequest({
            messages: [{ role: 'user', content: requirements }],
            systemPrompt,
            temperature: 0.5
        });
    }

    /**
     * Get model-specific capabilities
     */
    getModelCapabilities() {
        const capabilities = super.getCapabilities();
        
        // Add Claude-specific capabilities
        if (this.model.includes('opus')) {
            capabilities.push('complex-reasoning', 'creative-writing', 'advanced-analysis');
        } else if (this.model.includes('sonnet')) {
            capabilities.push('balanced-performance', 'code-optimization');
        } else if (this.model.includes('haiku')) {
            capabilities.push('fast-response', 'cost-effective');
        }

        return capabilities;
    }

    /**
     * Check if model supports specific features
     */
    supportsFeature(feature) {
        const features = {
            'tool-use': this.model.includes('sonnet') || this.model.includes('opus'),
            'long-context': !this.model.includes('haiku'),
            'vision': false, // Claude doesn't support vision yet
            'function-calling': this.model.includes('sonnet') || this.model.includes('opus')
        };

        return features[feature] || false;
    }

    /**
     * Optimize for Claude Code integration
     */
    async optimizeForClaudeCode(request) {
        // Add Claude Code specific optimizations
        const optimizedRequest = { ...request };
        
        // Enable tool use if available
        if (this.supportsFeature('tool-use') && !optimizedRequest.tools) {
            optimizedRequest.tools = this.getClaudeCodeTools();
        }
        
        // Optimize system prompt for development tasks
        if (!optimizedRequest.systemPrompt && this.isDevelopmentTask(request)) {
            optimizedRequest.systemPrompt = this.getOptimizedSystemPrompt(request);
        }
        
        return optimizedRequest;
    }

    /**
     * Get Claude Code specific tools
     * @private
     */
    getClaudeCodeTools() {
        return [
            {
                name: 'write_file',
                description: 'Write content to a file',
                parameters: {
                    type: 'object',
                    properties: {
                        file_path: { type: 'string' },
                        content: { type: 'string' }
                    },
                    required: ['file_path', 'content']
                }
            },
            {
                name: 'read_file',
                description: 'Read content from a file',
                parameters: {
                    type: 'object',
                    properties: {
                        file_path: { type: 'string' }
                    },
                    required: ['file_path']
                }
            },
            {
                name: 'execute_command',
                description: 'Execute a shell command',
                parameters: {
                    type: 'object',
                    properties: {
                        command: { type: 'string' }
                    },
                    required: ['command']
                }
            }
        ];
    }

    /**
     * Check if request is development-related
     * @private
     */
    isDevelopmentTask(request) {
        const content = this.formatMessages(request.messages || []);
        const devKeywords = ['code', 'function', 'class', 'implement', 'debug', 'refactor', 'api', 'database'];
        return devKeywords.some(keyword => content.toLowerCase().includes(keyword));
    }

    /**
     * Get optimized system prompt for development
     * @private
     */
    getOptimizedSystemPrompt(request) {
        return `You are Claude, an AI assistant created by Anthropic. You are integrated with Claude Code, giving you the ability to read, write, and execute code directly.

When working on development tasks:
- Write clean, well-documented code
- Follow best practices and conventions
- Consider security and performance
- Use the available tools to read/write files and execute commands
- Provide clear explanations of your decisions

You have access to the current project context and can maintain state across interactions.`;
    }

    validateConfig() {
        super.validateConfig();
        
        if (!this.supportedModels.includes(this.model)) {
            throw new Error(`Unsupported Claude model: ${this.model}. Supported models: ${this.supportedModels.join(', ')}`);
        }
    }
}

module.exports = { ClaudeProvider };