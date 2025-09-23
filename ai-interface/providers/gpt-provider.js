/**
 * GPT AI Provider
 * Implementation for OpenAI's GPT models
 * Optimized for reasoning, planning, and general intelligence tasks
 */

const { AIProvider } = require('../ai-provider');
const OpenAI = require('openai');

class GPTProvider extends AIProvider {
    constructor(config = {}) {
        super({
            name: 'GPT',
            type: 'text',
            capabilities: [
                'reasoning', 'planning', 'conversation', 'creative', 'analysis',
                'research', 'writing', 'problem-solving', 'strategy'
            ],
            maxTokens: config.model?.includes('gpt-4') ? 128000 : 4096,
            costPerToken: config.model?.includes('gpt-4') ? 0.00003 : 0.000002,
            model: config.model || 'gpt-4-turbo',
            ...config
        });

        this.openai = null;
        this.supportedModels = [
            'gpt-4-turbo',
            'gpt-4-turbo-preview',
            'gpt-4',
            'gpt-4-32k',
            'gpt-4-vision-preview',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k',
            'o1-preview',
            'o1-mini'
        ];

        // Model-specific configurations
        this.modelConfig = {
            'gpt-4-turbo': { maxTokens: 128000, supportsVision: false, supportsFunctions: true },
            'gpt-4': { maxTokens: 8192, supportsVision: false, supportsFunctions: true },
            'gpt-4-vision-preview': { maxTokens: 4096, supportsVision: true, supportsFunctions: true },
            'gpt-3.5-turbo': { maxTokens: 4096, supportsVision: false, supportsFunctions: true },
            'o1-preview': { maxTokens: 128000, supportsVision: false, supportsFunctions: false, reasoning: true },
            'o1-mini': { maxTokens: 65536, supportsVision: false, supportsFunctions: false, reasoning: true }
        };
    }

    async initialize() {
        if (this.isInitialized) return;

        // Initialize OpenAI client
        this.openai = new OpenAI({
            apiKey: this.apiKey,
            baseURL: this.endpoint,
            organization: this.config.organization,
            project: this.config.project
        });

        await super.initialize();
    }

    async makeRequest(request) {
        const {
            messages = [],
            maxTokens = this.maxTokens,
            temperature = 0.7,
            topP = 1.0,
            frequencyPenalty = 0,
            presencePenalty = 0,
            functions = [],
            functionCall,
            tools = [],
            toolChoice,
            responseFormat,
            seed,
            user
        } = request;

        try {
            // Format messages for OpenAI
            const formattedMessages = this.formatMessagesForOpenAI(messages);
            
            // Prepare request parameters
            const requestParams = {
                model: this.model,
                messages: formattedMessages,
                max_tokens: Math.min(maxTokens, this.maxTokens),
                temperature,
                top_p: topP,
                frequency_penalty: frequencyPenalty,
                presence_penalty: presencePenalty
            };

            // Add reasoning models specific settings
            if (this.isReasoningModel()) {
                // o1 models have specific requirements
                requestParams.temperature = undefined; // Not supported
                requestParams.top_p = undefined;
                requestParams.frequency_penalty = undefined;
                requestParams.presence_penalty = undefined;
            } else {
                // Add functions/tools for non-reasoning models
                if (functions && functions.length > 0) {
                    requestParams.functions = this.formatFunctionsForOpenAI(functions);
                    if (functionCall) {
                        requestParams.function_call = functionCall;
                    }
                }

                if (tools && tools.length > 0) {
                    requestParams.tools = this.formatToolsForOpenAI(tools);
                    if (toolChoice) {
                        requestParams.tool_choice = toolChoice;
                    }
                }

                // Add optional parameters
                if (responseFormat) {
                    requestParams.response_format = responseFormat;
                }

                if (seed !== undefined) {
                    requestParams.seed = seed;
                }

                if (user) {
                    requestParams.user = user;
                }
            }

            // Make API request
            const response = await this.openai.chat.completions.create(requestParams);
            
            const choice = response.choices[0];
            
            // Handle function/tool calls
            if (choice.message.function_call || choice.message.tool_calls) {
                return this.handleFunctionResponse(response);
            }

            return {
                content: choice.message.content,
                finishReason: choice.finish_reason,
                usage: response.usage,
                raw: response
            };

        } catch (error) {
            this.logger.error('OpenAI API request failed:', error);
            
            // Handle specific OpenAI API errors
            if (error.status === 429) {
                throw new Error('OpenAI API rate limit exceeded. Please try again later.');
            } else if (error.status === 401) {
                throw new Error('OpenAI API authentication failed. Check your API key.');
            } else if (error.status === 400) {
                throw new Error(`OpenAI API request invalid: ${error.message}`);
            } else if (error.code === 'context_length_exceeded') {
                throw new Error('Input too long for this model. Try reducing the context or using a model with larger context window.');
            }
            
            throw error;
        }
    }

    /**
     * Format messages for OpenAI API
     * @private
     */
    formatMessagesForOpenAI(messages) {
        return messages.map(message => {
            if (typeof message === 'string') {
                return { role: 'user', content: message };
            }
            
            // Handle vision content
            if (message.images && this.supportsVision()) {
                return {
                    role: message.role || 'user',
                    content: [
                        { type: 'text', text: message.content || message.text || '' },
                        ...message.images.map(image => ({
                            type: 'image_url',
                            image_url: { url: image }
                        }))
                    ]
                };
            }
            
            return {
                role: message.role || 'user',
                content: message.content || message.text || ''
            };
        }).filter(message => 
            (typeof message.content === 'string' && message.content.trim().length > 0) ||
            Array.isArray(message.content)
        );
    }

    /**
     * Format functions for OpenAI API
     * @private
     */
    formatFunctionsForOpenAI(functions) {
        return functions.map(func => ({
            name: func.name,
            description: func.description,
            parameters: func.parameters || {
                type: 'object',
                properties: {},
                required: []
            }
        }));
    }

    /**
     * Format tools for OpenAI API
     * @private
     */
    formatToolsForOpenAI(tools) {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        }));
    }

    /**
     * Handle function/tool call response
     * @private
     */
    async handleFunctionResponse(response) {
        const choice = response.choices[0];
        const message = choice.message;

        const result = {
            content: message.content,
            finishReason: choice.finish_reason,
            usage: response.usage,
            raw: response
        };

        // Handle legacy function calls
        if (message.function_call) {
            result.functionCall = {
                name: message.function_call.name,
                arguments: JSON.parse(message.function_call.arguments || '{}')
            };
        }

        // Handle modern tool calls
        if (message.tool_calls) {
            result.toolCalls = message.tool_calls.map(toolCall => ({
                id: toolCall.id,
                type: toolCall.type,
                function: {
                    name: toolCall.function.name,
                    arguments: JSON.parse(toolCall.function.arguments || '{}')
                }
            }));
        }

        return result;
    }

    /**
     * Specialized method for reasoning tasks
     */
    async performReasoning(problem, options = {}) {
        const {
            steps = true,
            confidence = false,
            alternatives = false
        } = options;

        // Use reasoning models if available
        const model = this.isReasoningModel() ? this.model : 'gpt-4-turbo';
        
        const systemPrompt = `You are an expert reasoning assistant. Approach this problem systematically:

${steps ? '1. Break down the problem into clear steps' : ''}
${confidence ? '2. Express your confidence level in your reasoning' : ''}
${alternatives ? '3. Consider alternative approaches or solutions' : ''}

Think through this carefully and provide a well-reasoned response.`;

        return this.sendRequest({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: problem }
            ],
            model,
            temperature: 0.3
        });
    }

    /**
     * Specialized method for strategic planning
     */
    async createPlan(objective, constraints = [], timeframe = null) {
        const systemPrompt = `You are a strategic planning expert. Create a comprehensive plan for the given objective.

Structure your plan with:
1. Executive Summary
2. Key Objectives & Success Metrics
3. Phase breakdown with timelines
4. Resource requirements
5. Risk assessment and mitigation
6. Implementation roadmap
7. Monitoring and evaluation criteria

Be specific, actionable, and realistic.`;

        const constraintsText = constraints.length > 0 
            ? `\n\nConstraints to consider:\n${constraints.map(c => `- ${c}`).join('\n')}`
            : '';

        const timeframeText = timeframe 
            ? `\n\nTimeframe: ${timeframe}`
            : '';

        return this.sendRequest({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `${objective}${constraintsText}${timeframeText}` }
            ],
            temperature: 0.4
        });
    }

    /**
     * Specialized method for research and analysis
     */
    async conductResearch(topic, depth = 'comprehensive') {
        const systemPrompt = `You are a research analyst. Conduct ${depth} research on the given topic.

Provide:
1. Overview and context
2. Key findings and insights
3. Current trends and developments
4. Different perspectives and viewpoints
5. Implications and recommendations
6. Areas for further investigation
7. Sources and references (when applicable)

Be thorough, objective, and well-structured in your analysis.`;

        return this.sendRequest({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: topic }
            ],
            temperature: 0.5
        });
    }

    /**
     * Specialized method for creative tasks
     */
    async generateCreativeContent(prompt, contentType = 'general', tone = 'professional') {
        const systemPrompt = `You are a creative content expert specializing in ${contentType} content.

Create engaging, original content with a ${tone} tone. Focus on:
- Clarity and readability
- Audience engagement
- Brand consistency
- Call-to-action (where appropriate)
- SEO considerations (for web content)

Adapt your style to the specific content type and requirements.`;

        return this.sendRequest({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.8 // Higher creativity
        });
    }

    /**
     * Check if current model is a reasoning model (o1 series)
     */
    isReasoningModel() {
        return this.model.startsWith('o1-');
    }

    /**
     * Check if current model supports vision
     */
    supportsVision() {
        const config = this.modelConfig[this.model];
        return config?.supportsVision || false;
    }

    /**
     * Check if current model supports functions
     */
    supportsFunctions() {
        const config = this.modelConfig[this.model];
        return config?.supportsFunctions || false;
    }

    /**
     * Get model-specific capabilities
     */
    getModelCapabilities() {
        const capabilities = super.getCapabilities();
        
        // Add GPT-specific capabilities
        if (this.isReasoningModel()) {
            capabilities.push('advanced-reasoning', 'step-by-step-thinking', 'complex-problem-solving');
        }
        
        if (this.supportsVision()) {
            capabilities.push('image-analysis', 'visual-reasoning', 'multimodal');
        }
        
        if (this.supportsFunctions()) {
            capabilities.push('function-calling', 'tool-use', 'structured-output');
        }
        
        if (this.model.includes('gpt-4')) {
            capabilities.push('advanced-reasoning', 'complex-tasks', 'nuanced-understanding');
        }

        return capabilities;
    }

    /**
     * Optimize request for specific GPT models
     */
    async optimizeRequest(request) {
        const optimized = { ...request };
        
        // Optimize for reasoning models
        if (this.isReasoningModel()) {
            // Remove parameters not supported by o1 models
            delete optimized.temperature;
            delete optimized.topP;
            delete optimized.frequencyPenalty;
            delete optimized.presencePenalty;
            delete optimized.functions;
            delete optimized.tools;
            
            // Add reasoning-specific prompt optimization
            if (optimized.messages && optimized.messages.length > 0) {
                const lastMessage = optimized.messages[optimized.messages.length - 1];
                if (lastMessage.role === 'user') {
                    lastMessage.content = `Think through this step by step:\n\n${lastMessage.content}`;
                }
            }
        }
        
        return optimized;
    }

    validateConfig() {
        super.validateConfig();
        
        if (!this.supportedModels.includes(this.model)) {
            throw new Error(`Unsupported GPT model: ${this.model}. Supported models: ${this.supportedModels.join(', ')}`);
        }
    }
}

module.exports = { GPTProvider };