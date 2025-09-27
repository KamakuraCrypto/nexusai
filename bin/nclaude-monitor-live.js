#!/usr/bin/env node
/**
 * Real-time Transcript Monitor
 * Monitors the current Claude session transcript and captures conversations in real-time
 */

const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { Logger } = require('../utils/logger');
const TranscriptParser = require('./nclaude-transcript');

class LiveTranscriptMonitor {
    constructor(options = {}) {
        this.logger = new Logger('LiveTranscriptMonitor');
        this.parser = new TranscriptParser(options);
        this.currentTranscript = null;
        this.lastPosition = 0;
        this.watcher = null;
        this.processingQueue = [];
        this.isProcessing = false;
    }

    async start() {
        this.logger.info('Starting live transcript monitoring...');
        
        // Find current session transcript
        const transcriptPath = await this.findCurrentTranscript();
        if (!transcriptPath) {
            this.logger.warn('No active Claude session transcript found');
            return false;
        }

        this.currentTranscript = transcriptPath;
        this.logger.info(`Monitoring transcript: ${transcriptPath}`);

        // Get current file size to track new additions
        if (await fs.pathExists(transcriptPath)) {
            const stats = await fs.stat(transcriptPath);
            this.lastPosition = stats.size;
        }

        // Start watching the file
        this.watcher = chokidar.watch(transcriptPath, {
            persistent: true,
            usePolling: true,
            interval: 1000
        });

        this.watcher.on('change', async () => {
            await this.processNewContent();
        });

        this.logger.info('Live monitoring started successfully');
        return true;
    }

    async findCurrentTranscript() {
        // Look for the most recent transcript in Claude projects
        const claudeProjectsDir = path.join(process.env.HOME, '.claude', 'projects');
        
        try {
            const projects = await fs.readdir(claudeProjectsDir);
            let latestTranscript = null;
            let latestTime = 0;

            for (const project of projects) {
                const projectDir = path.join(claudeProjectsDir, project);
                const files = await fs.readdir(projectDir).catch(() => []);
                
                for (const file of files) {
                    if (file.endsWith('.jsonl')) {
                        const filePath = path.join(projectDir, file);
                        const stats = await fs.stat(filePath);
                        
                        if (stats.mtimeMs > latestTime) {
                            latestTime = stats.mtimeMs;
                            latestTranscript = filePath;
                        }
                    }
                }
            }

            return latestTranscript;
        } catch (error) {
            this.logger.error(`Error finding transcript: ${error.message}`);
            return null;
        }
    }

    async processNewContent() {
        if (this.isProcessing) {
            this.processingQueue.push(Date.now());
            return;
        }

        this.isProcessing = true;

        try {
            if (!await fs.pathExists(this.currentTranscript)) {
                this.logger.warn('Transcript file no longer exists');
                this.stop();
                return;
            }

            const stats = await fs.stat(this.currentTranscript);
            
            if (stats.size <= this.lastPosition) {
                // File hasn't grown
                this.isProcessing = false;
                return;
            }

            // Read new content
            const stream = fs.createReadStream(this.currentTranscript, {
                start: this.lastPosition,
                encoding: 'utf8'
            });

            let buffer = '';
            
            stream.on('data', (chunk) => {
                buffer += chunk;
            });

            stream.on('end', async () => {
                // Process complete lines
                const lines = buffer.split('\n');
                const completeLines = lines.slice(0, -1); // Exclude potential incomplete last line
                
                for (const line of completeLines) {
                    if (line.trim()) {
                        await this.processTranscriptLine(line);
                    }
                }

                // Update position
                this.lastPosition = stats.size;
                this.isProcessing = false;

                // Process any queued requests
                if (this.processingQueue.length > 0) {
                    this.processingQueue = [];
                    setTimeout(() => this.processNewContent(), 100);
                }
            });

            stream.on('error', (error) => {
                this.logger.error(`Error reading transcript: ${error.message}`);
                this.isProcessing = false;
            });

        } catch (error) {
            this.logger.error(`Error processing new content: ${error.message}`);
            this.isProcessing = false;
        }
    }

    async processTranscriptLine(line) {
        try {
            const entry = JSON.parse(line);
            const timestamp = new Date(entry.timestamp).toLocaleString();

            if (entry.type === 'user' && entry.message?.role === 'user') {
                // User prompt detected
                let content = '';
                if (typeof entry.message.content === 'string') {
                    content = entry.message.content;
                } else if (Array.isArray(entry.message.content)) {
                    content = entry.message.content
                        .filter(item => item.type === 'text')
                        .map(item => item.text || '')
                        .join('\n');
                }

                if (content) {
                    this.logger.info(`👤 User prompt captured [${timestamp}]: ${content.substring(0, 100)}...`);
                    
                    // Save using manual logger as backup
                    try {
                        const { spawn } = require('child_process');
                        const logger = spawn('node', [
                            path.join(__dirname, 'nclaude-log.js'),
                            'prompt',
                            content
                        ], {
                            stdio: 'ignore',
                            timeout: 5000
                        });
                    } catch (error) {
                        // Silent fallback
                    }
                }

            } else if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
                // Assistant response detected
                let hasTextContent = false;
                let hasThinking = false;
                let toolCount = 0;

                if (Array.isArray(entry.message.content)) {
                    for (const item of entry.message.content) {
                        if (item.type === 'text' && item.text) {
                            hasTextContent = true;
                        } else if (item.type === 'thinking') {
                            hasThinking = true;
                        } else if (item.type === 'tool_use') {
                            toolCount++;
                        }
                    }
                }

                const features = [];
                if (hasTextContent) features.push('text');
                if (hasThinking) features.push('thinking');
                if (toolCount > 0) features.push(`${toolCount} tools`);

                this.logger.info(`🤖 Assistant response captured [${timestamp}]: ${features.join(', ')}`);
            }

        } catch (error) {
            this.logger.error(`Error processing transcript line: ${error.message}`);
        }
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.logger.info('Stopped live monitoring');
        }
    }

    async getStatus() {
        return {
            active: this.watcher !== null,
            transcript: this.currentTranscript,
            lastPosition: this.lastPosition,
            isProcessing: this.isProcessing,
            queueLength: this.processingQueue.length
        };
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const monitor = new LiveTranscriptMonitor();

    switch (command) {
        case 'start':
            const started = await monitor.start();
            if (started) {
                console.log('✅ Live transcript monitoring started');
                console.log('Press Ctrl+C to stop');
                
                // Keep process alive
                process.on('SIGINT', () => {
                    console.log('\n🛑 Stopping live monitor...');
                    monitor.stop();
                    process.exit(0);
                });

                // Prevent exit
                setInterval(() => {}, 1000);
            } else {
                console.log('❌ Failed to start monitoring');
                process.exit(1);
            }
            break;

        case 'status':
            const status = await monitor.getStatus();
            console.log('Live Transcript Monitor Status:');
            console.log(`  Active: ${status.active ? '✅' : '❌'}`);
            console.log(`  Transcript: ${status.transcript || 'None'}`);
            console.log(`  Position: ${status.lastPosition} bytes`);
            console.log(`  Processing: ${status.isProcessing ? 'Yes' : 'No'}`);
            console.log(`  Queue: ${status.queueLength} items`);
            break;

        default:
            console.log('Live Transcript Monitor\n');
            console.log('Commands:');
            console.log('  start    Start monitoring current session transcript');
            console.log('  status   Show monitoring status');
            console.log('\nExample:');
            console.log('  nclaude-monitor-live start');
    }
}

if (require.main === module) {
    main();
}

module.exports = LiveTranscriptMonitor;