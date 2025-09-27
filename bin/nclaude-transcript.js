#!/usr/bin/env node
/**
 * Claude Transcript Parser
 * Parses Claude Code JSONL transcript files and extracts conversations
 */

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { Logger } = require('../utils/logger');

class TranscriptParser {
    constructor(options = {}) {
        this.logger = new Logger('TranscriptParser');
        this.nexusDir = options.nexusDir || path.join(process.cwd(), '.nexus');
        this.conversationsDir = path.join(this.nexusDir, 'conversations');
        this.responsesDir = path.join(this.nexusDir, 'responses');
        this.promptsDir = path.join(this.nexusDir, 'prompts');
        
        this.ensureDirectories();
    }

    async ensureDirectories() {
        await fs.ensureDir(this.conversationsDir);
        await fs.ensureDir(this.responsesDir);
        await fs.ensureDir(this.promptsDir);
        await fs.ensureDir(path.join(this.responsesDir, 'full'));
        await fs.ensureDir(path.join(this.promptsDir, 'by-session'));
    }

    async parseTranscript(transcriptPath, sessionId) {
        this.logger.info(`Parsing transcript: ${transcriptPath}`);
        
        if (!await fs.pathExists(transcriptPath)) {
            this.logger.error(`Transcript file not found: ${transcriptPath}`);
            return null;
        }

        const conversation = {
            sessionId: sessionId,
            transcriptPath: transcriptPath,
            startTime: null,
            endTime: null,
            turns: [],
            prompts: [],
            responses: [],
            toolUses: [],
            totalTokens: {
                input: 0,
                output: 0,
                cache: 0
            }
        };

        // Read JSONL file line by line
        const fileStream = fs.createReadStream(transcriptPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let currentTurn = 0;
        let lastUserPrompt = null;
        let responseBuffer = null;

        for await (const line of rl) {
            if (!line.trim()) continue;
            
            try {
                const entry = JSON.parse(line);
                
                // Set start time from first entry
                if (!conversation.startTime && entry.timestamp) {
                    conversation.startTime = entry.timestamp;
                }
                
                // Update end time with each entry
                if (entry.timestamp) {
                    conversation.endTime = entry.timestamp;
                }

                // Process based on entry type
                if (entry.type === 'user' && entry.message?.role === 'user') {
                    // Handle user messages (prompts)
                    await this.processUserMessage(entry, conversation);
                    lastUserPrompt = entry;
                    currentTurn++;
                    
                } else if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
                    // Handle assistant messages (responses)
                    await this.processAssistantMessage(entry, conversation, lastUserPrompt);
                    
                    // Track token usage
                    if (entry.message?.usage) {
                        conversation.totalTokens.input += entry.message.usage.input_tokens || 0;
                        conversation.totalTokens.output += entry.message.usage.output_tokens || 0;
                        conversation.totalTokens.cache += entry.message.usage.cache_read_input_tokens || 0;
                    }
                }
                
            } catch (error) {
                this.logger.error(`Error parsing line: ${error.message}`);
            }
        }

        // Save the parsed conversation
        await this.saveConversation(conversation);
        
        this.logger.info(`Parsed ${conversation.prompts.length} prompts and ${conversation.responses.length} responses`);
        return conversation;
    }

    async processUserMessage(entry, conversation) {
        // Extract prompt content
        let promptContent = '';
        
        if (entry.message?.content) {
            // Handle different content formats
            if (typeof entry.message.content === 'string') {
                promptContent = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
                // Extract text from content array
                promptContent = entry.message.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text || '')
                    .join('\n');
            }
        }

        if (promptContent) {
            const prompt = {
                id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                sessionId: entry.sessionId,
                timestamp: entry.timestamp,
                content: promptContent,
                metadata: {
                    uuid: entry.uuid,
                    parentUuid: entry.parentUuid,
                    cwd: entry.cwd
                }
            };

            conversation.prompts.push(prompt);
            
            // Save individual prompt
            const promptPath = path.join(this.promptsDir, 'by-session', `${entry.sessionId}-prompt-${conversation.prompts.length}.json`);
            await fs.outputJson(promptPath, prompt, { spaces: 2 });
        }
    }

    async processAssistantMessage(entry, conversation, lastUserPrompt) {
        const response = {
            id: `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId: entry.sessionId,
            timestamp: entry.timestamp,
            promptId: lastUserPrompt?.uuid || null,
            content: '',
            thinking: [],
            toolUses: [],
            codeBlocks: [],
            metadata: {
                uuid: entry.uuid,
                parentUuid: entry.parentUuid,
                model: entry.message?.model,
                stopReason: entry.message?.stop_reason,
                usage: entry.message?.usage
            }
        };

        // Extract response content
        if (entry.message?.content) {
            if (typeof entry.message.content === 'string') {
                response.content = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
                for (const item of entry.message.content) {
                    if (item.type === 'text') {
                        response.content += (item.text || '') + '\n';
                    } else if (item.type === 'thinking') {
                        // Capture thinking process
                        response.thinking.push({
                            timestamp: entry.timestamp,
                            content: item.text || ''
                        });
                    } else if (item.type === 'tool_use') {
                        // Capture tool usage
                        response.toolUses.push({
                            id: item.id,
                            name: item.name,
                            input: item.input
                        });
                    }
                }
            }
        }

        // Extract code blocks from content
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response.content)) !== null) {
            response.codeBlocks.push({
                language: match[1] || 'plaintext',
                code: match[2]
            });
        }

        conversation.responses.push(response);
        
        // Save individual response with full content
        const responsePath = path.join(this.responsesDir, 'full', `${entry.sessionId}-response-${conversation.responses.length}.json`);
        await fs.outputJson(responsePath, response, { spaces: 2 });
    }

    async saveConversation(conversation) {
        // Save main conversation file
        const conversationPath = path.join(this.conversationsDir, `session-${conversation.sessionId}.json`);
        await fs.outputJson(conversationPath, conversation, { spaces: 2 });
        
        // Create summary file
        const summary = {
            sessionId: conversation.sessionId,
            transcriptPath: conversation.transcriptPath,
            startTime: conversation.startTime,
            endTime: conversation.endTime,
            duration: this.calculateDuration(conversation.startTime, conversation.endTime),
            stats: {
                prompts: conversation.prompts.length,
                responses: conversation.responses.length,
                toolUses: conversation.toolUses.length,
                totalTokens: conversation.totalTokens
            },
            lastUpdated: new Date().toISOString()
        };
        
        const summaryPath = path.join(this.conversationsDir, `summary-${conversation.sessionId}.json`);
        await fs.outputJson(summaryPath, summary, { spaces: 2 });
        
        this.logger.info(`Saved conversation to ${conversationPath}`);
    }

    calculateDuration(startTime, endTime) {
        if (!startTime || !endTime) return 0;
        const start = new Date(startTime);
        const end = new Date(endTime);
        return Math.round((end - start) / 1000); // Duration in seconds
    }

    async listSessions() {
        const files = await fs.readdir(this.conversationsDir);
        const sessions = [];
        
        for (const file of files) {
            if (file.startsWith('summary-')) {
                const summaryPath = path.join(this.conversationsDir, file);
                const summary = await fs.readJson(summaryPath);
                sessions.push(summary);
            }
        }
        
        return sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    }

    async getSession(sessionId) {
        const conversationPath = path.join(this.conversationsDir, `session-${sessionId}.json`);
        if (await fs.pathExists(conversationPath)) {
            return await fs.readJson(conversationPath);
        }
        return null;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const parser = new TranscriptParser();
    
    try {
        switch (command) {
            case 'parse':
                if (!args[1]) {
                    console.error('Usage: nclaude-transcript parse <transcript-path> [--session <id>]');
                    process.exit(1);
                }
                
                const transcriptPath = args[1];
                const sessionIndex = args.indexOf('--session');
                const sessionId = sessionIndex > -1 ? args[sessionIndex + 1] : path.basename(transcriptPath, '.jsonl');
                
                const conversation = await parser.parseTranscript(transcriptPath, sessionId);
                if (conversation) {
                    console.log(`✅ Parsed conversation with ${conversation.prompts.length} prompts and ${conversation.responses.length} responses`);
                    console.log(`💾 Saved to .nexus/conversations/session-${sessionId}.json`);
                }
                break;
                
            case 'list':
                const sessions = await parser.listSessions();
                console.log('\n📚 Captured Sessions:\n');
                sessions.forEach(session => {
                    const start = new Date(session.startTime).toLocaleString();
                    const duration = Math.round(session.duration / 60);
                    console.log(`${session.sessionId}`);
                    console.log(`  Started: ${start}`);
                    console.log(`  Duration: ${duration} minutes`);
                    console.log(`  Prompts: ${session.stats.prompts}, Responses: ${session.stats.responses}`);
                    console.log(`  Tokens: ${session.stats.totalTokens.input + session.stats.totalTokens.output}`);
                    console.log('');
                });
                break;
                
            case 'show':
                if (!args[1]) {
                    console.error('Usage: nclaude-transcript show <session-id>');
                    process.exit(1);
                }
                
                const session = await parser.getSession(args[1]);
                if (session) {
                    console.log('\n💬 Conversation:\n');
                    for (let i = 0; i < session.prompts.length; i++) {
                        const prompt = session.prompts[i];
                        console.log(`👤 User [${new Date(prompt.timestamp).toLocaleTimeString()}]:`);
                        console.log(`   ${prompt.content.substring(0, 200)}${prompt.content.length > 200 ? '...' : ''}`);
                        
                        if (session.responses[i]) {
                            const response = session.responses[i];
                            console.log(`🤖 Assistant [${new Date(response.timestamp).toLocaleTimeString()}]:`);
                            console.log(`   ${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}`);
                            
                            if (response.thinking.length > 0) {
                                console.log(`   💭 Thinking: ${response.thinking[0].content.substring(0, 100)}...`);
                            }
                        }
                        console.log('');
                    }
                } else {
                    console.error('Session not found');
                }
                break;
                
            default:
                console.log('Claude Transcript Parser\n');
                console.log('Commands:');
                console.log('  parse <transcript-path> [--session <id>]  Parse a transcript file');
                console.log('  list                                       List all captured sessions');
                console.log('  show <session-id>                          Show session conversation');
                console.log('\nExample:');
                console.log('  nclaude-transcript parse ~/.claude/projects/.../abc123.jsonl');
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = TranscriptParser;