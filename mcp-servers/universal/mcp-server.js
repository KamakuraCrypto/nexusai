/**
 * Universal MCP (Model Context Protocol) Server
 * Enables any AI agent to connect and use Nexus AI Framework capabilities
 * Supports Claude Code, GPT CLI, Gemini, Grok, and other AI development tools
 */

const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { Logger } = require('../../utils/logger');

class MCPServer {
    constructor(nexusAI, config = {}) {
        this.nexusAI = nexusAI;
        this.config = {
            port: config.port || 3000,
            host: config.host || 'localhost',
            maxConnections: config.maxConnections || 10,
            protocols: config.protocols || ['websocket', 'http'],
            authentication: config.authentication || { enabled: false },
            ...config
        };
        
        this.logger = new Logger('MCPServer');
        this.clients = new Map();
        this.tools = new Map();
        this.resources = new Map();
        
        // Server instances
        this.httpServer = null;
        this.wsServer = null;
        this.expressApp = null;
        
        // Protocol handlers
        this.messageHandlers = new Map();
        this.setupMessageHandlers();
        
        // Statistics
        this.stats = {
            connections: 0,
            totalMessages: 0,
            toolCalls: 0,
            errors: 0,
            startTime: Date.now()
        };
        
        this.setupTools();
        this.setupResources();
    }

    /**
     * Start the MCP server
     */
    async start() {
        try {
            this.logger.info(`Starting MCP Server on ${this.config.host}:${this.config.port}`);
            
            // Setup Express app for HTTP protocol
            this.setupExpressApp();
            
            // Create HTTP server
            this.httpServer = http.createServer(this.expressApp);
            
            // Setup WebSocket server if enabled
            if (this.config.protocols.includes('websocket')) {
                this.setupWebSocketServer();
            }
            
            // Start listening
            await new Promise((resolve, reject) => {
                this.httpServer.listen(this.config.port, this.config.host, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
            
            this.logger.info(`✅ MCP Server started successfully`);
            this.logger.info(`📡 WebSocket: ws://${this.config.host}:${this.config.port}/mcp`);
            this.logger.info(`🌐 HTTP: http://${this.config.host}:${this.config.port}/mcp`);
            
        } catch (error) {
            this.logger.error('Failed to start MCP Server:', error);
            throw error;
        }
    }

    /**
     * Setup Express application for HTTP protocol
     */
    setupExpressApp() {
        this.expressApp = express();
        this.expressApp.use(express.json({ limit: '10mb' }));
        this.expressApp.use(express.urlencoded({ extended: true }));
        
        // CORS middleware
        this.expressApp.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // MCP HTTP endpoint
        this.expressApp.post('/mcp', async (req, res) => {
            try {
                const response = await this.handleMessage(req.body, 'http');
                res.json(response);
            } catch (error) {
                this.logger.error('HTTP MCP request failed:', error);
                res.status(500).json({
                    error: {
                        code: -32603,
                        message: 'Internal error',
                        data: error.message
                    }
                });
            }
        });
        
        // Health check endpoint
        this.expressApp.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: Date.now() - this.stats.startTime,
                connections: this.clients.size,
                stats: this.stats
            });
        });
        
        // MCP capability discovery
        this.expressApp.get('/mcp/capabilities', (req, res) => {
            res.json(this.getCapabilities());
        });
        
        // Tool documentation
        this.expressApp.get('/mcp/tools', (req, res) => {
            res.json(this.getToolDocumentation());
        });
    }

    /**
     * Setup WebSocket server
     */
    setupWebSocketServer() {
        this.wsServer = new WebSocket.Server({
            server: this.httpServer,
            path: '/mcp',
            maxPayload: 10 * 1024 * 1024 // 10MB
        });
        
        this.wsServer.on('connection', (ws, request) => {
            this.handleWebSocketConnection(ws, request);
        });
        
        this.wsServer.on('error', (error) => {
            this.logger.error('WebSocket server error:', error);
        });
    }

    /**
     * Handle new WebSocket connection
     */
    handleWebSocketConnection(ws, request) {
        const clientId = uuidv4();
        const clientInfo = {
            id: clientId,
            ws,
            protocol: 'websocket',
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            userAgent: request.headers['user-agent'] || 'Unknown'
        };
        
        this.clients.set(clientId, clientInfo);
        this.stats.connections++;
        
        this.logger.info(`New WebSocket client connected: ${clientId}`);
        
        // Send initialization message
        this.sendMessage(ws, {
            jsonrpc: '2.0',
            method: 'initialized',
            params: {
                server: 'Nexus AI Framework MCP Server',
                version: '1.0.0',
                capabilities: this.getCapabilities()
            }
        });
        
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                clientInfo.lastActivity = Date.now();
                this.stats.totalMessages++;
                
                const response = await this.handleMessage(message, 'websocket', clientInfo);
                if (response && message.id) {
                    response.id = message.id;
                    this.sendMessage(ws, response);
                }
                
            } catch (error) {
                this.logger.error(`WebSocket message error for client ${clientId}:`, error);
                this.sendMessage(ws, {
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                        code: -32700,
                        message: 'Parse error'
                    }
                });
            }
        });
        
        ws.on('close', () => {
            this.logger.info(`WebSocket client disconnected: ${clientId}`);
            this.clients.delete(clientId);
        });
        
        ws.on('error', (error) => {
            this.logger.error(`WebSocket client error ${clientId}:`, error);
            this.clients.delete(clientId);
        });
    }

    /**
     * Setup message handlers for different MCP methods
     */
    setupMessageHandlers() {
        // Tool-related handlers
        this.messageHandlers.set('tools/list', this.handleToolsList.bind(this));
        this.messageHandlers.set('tools/call', this.handleToolsCall.bind(this));
        
        // Resource handlers
        this.messageHandlers.set('resources/list', this.handleResourcesList.bind(this));
        this.messageHandlers.set('resources/read', this.handleResourcesRead.bind(this));
        
        // Prompts handlers
        this.messageHandlers.set('prompts/list', this.handlePromptsList.bind(this));
        this.messageHandlers.set('prompts/get', this.handlePromptsGet.bind(this));
        
        // Nexus-specific handlers
        this.messageHandlers.set('nexus/ask', this.handleNexusAsk.bind(this));
        this.messageHandlers.set('nexus/project/create', this.handleProjectCreate.bind(this));
        this.messageHandlers.set('nexus/project/continue', this.handleProjectContinue.bind(this));
        this.messageHandlers.set('nexus/memory/save', this.handleMemorySave.bind(this));
        this.messageHandlers.set('nexus/knowledge/query', this.handleKnowledgeQuery.bind(this));
        
        // Standard MCP handlers
        this.messageHandlers.set('initialize', this.handleInitialize.bind(this));
        this.messageHandlers.set('ping', this.handlePing.bind(this));
    }

    /**
     * Setup available tools
     */
    setupTools() {
        // Core Nexus AI tools
        this.tools.set('nexus_ask', {
            name: 'nexus_ask',
            description: 'Ask the Nexus AI system a question with full context and knowledge base access',
            inputSchema: {
                type: 'object',
                properties: {
                    question: { type: 'string', description: 'The question to ask' },
                    taskType: { type: 'string', description: 'Type of task (coding, reasoning, research, etc.)' },
                    includeContext: { type: 'boolean', description: 'Include project context' },
                    model: { type: 'string', description: 'Preferred AI model' }
                },
                required: ['question']
            }
        });
        
        this.tools.set('nexus_project_create', {
            name: 'nexus_project_create',
            description: 'Create a new AI-native project with autonomous research and planning',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Project name' },
                    description: { type: 'string', description: 'Project description' },
                    ecosystem: { type: 'string', description: 'Target ecosystem (web3, ai, fullstack, etc.)' },
                    research: { type: 'boolean', description: 'Enable autonomous research' }
                },
                required: ['name', 'description']
            }
        });
        
        this.tools.set('nexus_memory_save', {
            name: 'nexus_memory_save',
            description: 'Save current state to persistent memory',
            inputSchema: {
                type: 'object',
                properties: {
                    checkpointName: { type: 'string', description: 'Name for the checkpoint' },
                    description: { type: 'string', description: 'Description of the checkpoint' }
                },
                required: ['checkpointName']
            }
        });
        
        this.tools.set('nexus_knowledge_query', {
            name: 'nexus_knowledge_query',
            description: 'Query the knowledge base for specific information',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    ecosystem: { type: 'string', description: 'Specific ecosystem to search' },
                    limit: { type: 'number', description: 'Maximum results to return' }
                },
                required: ['query']
            }
        });
        
        // File operations
        this.tools.set('file_read', {
            name: 'file_read',
            description: 'Read file contents',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path to read' }
                },
                required: ['path']
            }
        });
        
        this.tools.set('file_write', {
            name: 'file_write',
            description: 'Write content to file',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path to write' },
                    content: { type: 'string', description: 'Content to write' }
                },
                required: ['path', 'content']
            }
        });
        
        // Git operations
        this.tools.set('git_status', {
            name: 'git_status',
            description: 'Get git repository status',
            inputSchema: {
                type: 'object',
                properties: {},
                required: []
            }
        });
        
        this.tools.set('git_commit', {
            name: 'git_commit',
            description: 'Create git commit with Nexus tracking',
            inputSchema: {
                type: 'object',
                properties: {
                    message: { type: 'string', description: 'Commit message' },
                    files: { type: 'array', items: { type: 'string' }, description: 'Files to commit' }
                },
                required: ['message']
            }
        });
    }

    /**
     * Setup available resources
     */
    setupResources() {
        this.resources.set('project_context', {
            uri: 'nexus://project/context',
            name: 'Project Context',
            description: 'Current project context and state',
            mimeType: 'application/json'
        });
        
        this.resources.set('memory_state', {
            uri: 'nexus://memory/state',
            name: 'Memory State',
            description: 'Current memory and conversation state',
            mimeType: 'application/json'
        });
        
        this.resources.set('knowledge_base', {
            uri: 'nexus://knowledge/base',
            name: 'Knowledge Base',
            description: 'Available knowledge base ecosystems',
            mimeType: 'application/json'
        });
    }

    /**
     * Handle incoming MCP messages
     */
    async handleMessage(message, protocol, clientInfo = null) {
        try {
            if (!message.method) {
                throw new Error('Missing method in message');
            }
            
            const handler = this.messageHandlers.get(message.method);
            if (!handler) {
                throw new Error(`Unknown method: ${message.method}`);
            }
            
            const result = await handler(message.params || {}, clientInfo);
            
            return {
                jsonrpc: '2.0',
                id: message.id,
                result
            };
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Message handling error:', error);
            
            return {
                jsonrpc: '2.0',
                id: message.id,
                error: {
                    code: -32603,
                    message: error.message
                }
            };
        }
    }

    /**
     * Handle tools list request
     */
    async handleToolsList() {
        return {
            tools: Array.from(this.tools.values())
        };
    }

    /**
     * Handle tool call request
     */
    async handleToolsCall(params) {
        const { name, arguments: args } = params;
        this.stats.toolCalls++;
        
        this.logger.debug(`Tool call: ${name}`, args);
        
        switch (name) {
            case 'nexus_ask':
                return await this.nexusAI.ask(args);
                
            case 'nexus_project_create':
                return await this.nexusAI.createProject(args);
                
            case 'nexus_memory_save':
                return await this.nexusAI.memory.saveCheckpoint(args.checkpointName, args.description);
                
            case 'nexus_knowledge_query':
                return await this.nexusAI.knowledgeBase.query(args);
                
            case 'file_read':
                const fs = require('fs-extra');
                return { content: await fs.readFile(args.path, 'utf8') };
                
            case 'file_write':
                const fsWrite = require('fs-extra');
                await fsWrite.writeFile(args.path, args.content, 'utf8');
                return { success: true };
                
            case 'git_status':
                return await this.nexusAI.git.getStatus();
                
            case 'git_commit':
                return await this.nexusAI.git.commit(args.message, args.files);
                
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }

    /**
     * Handle resources list request
     */
    async handleResourcesList() {
        return {
            resources: Array.from(this.resources.values())
        };
    }

    /**
     * Handle resource read request
     */
    async handleResourcesRead(params) {
        const { uri } = params;
        
        switch (uri) {
            case 'nexus://project/context':
                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(this.nexusAI.currentContext || {}, null, 2)
                    }]
                };
                
            case 'nexus://memory/state':
                const memoryState = await this.nexusAI.memory.getState();
                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(memoryState, null, 2)
                    }]
                };
                
            case 'nexus://knowledge/base':
                const kbInfo = await this.nexusAI.knowledgeBase.getInfo();
                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(kbInfo, null, 2)
                    }]
                };
                
            default:
                throw new Error(`Unknown resource: ${uri}`);
        }
    }

    /**
     * Handle prompts list request
     */
    async handlePromptsList() {
        return {
            prompts: [
                {
                    name: 'nexus_project_init',
                    description: 'Initialize a new Nexus AI project',
                    arguments: [
                        {
                            name: 'project_type',
                            description: 'Type of project to create',
                            required: true
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Handle initialize request
     */
    async handleInitialize(params) {
        return {
            protocolVersion: '1.0.0',
            capabilities: this.getCapabilities(),
            serverInfo: {
                name: 'Nexus AI Framework MCP Server',
                version: '1.0.0'
            }
        };
    }

    /**
     * Handle ping request
     */
    async handlePing() {
        return { pong: true };
    }

    /**
     * Get server capabilities
     */
    getCapabilities() {
        return {
            tools: {
                listChanged: false
            },
            resources: {
                subscribe: false,
                listChanged: false
            },
            prompts: {
                listChanged: false
            },
            logging: {},
            experimental: {
                nexus: {
                    aiInterface: true,
                    memorySystem: true,
                    knowledgeBase: true,
                    projectCreation: true,
                    gitIntegration: true
                }
            }
        };
    }

    /**
     * Get tool documentation
     */
    getToolDocumentation() {
        const tools = Array.from(this.tools.values());
        return {
            tools,
            examples: {
                nexus_ask: {
                    request: {
                        question: "How do I implement authentication in a React app?",
                        taskType: "coding",
                        includeContext: true
                    }
                },
                nexus_project_create: {
                    request: {
                        name: "defi-yield-farm",
                        description: "A DeFi yield farming protocol on Solana",
                        ecosystem: "web3",
                        research: true
                    }
                }
            }
        };
    }

    /**
     * Send message to WebSocket client
     */
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(message) {
        this.clients.forEach(client => {
            if (client.ws && client.ws.readyState === WebSocket.OPEN) {
                this.sendMessage(client.ws, message);
            }
        });
    }

    /**
     * Get server statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            activeConnections: this.clients.size,
            availableTools: this.tools.size,
            availableResources: this.resources.size
        };
    }

    /**
     * Stop the MCP server
     */
    async stop() {
        this.logger.info('Stopping MCP Server...');
        
        // Close all WebSocket connections
        this.clients.forEach(client => {
            if (client.ws) {
                client.ws.close();
            }
        });
        
        // Close WebSocket server
        if (this.wsServer) {
            this.wsServer.close();
        }
        
        // Close HTTP server
        if (this.httpServer) {
            await new Promise((resolve) => {
                this.httpServer.close(() => resolve());
            });
        }
        
        this.logger.info('✅ MCP Server stopped');
    }
}

module.exports = { MCPServer };