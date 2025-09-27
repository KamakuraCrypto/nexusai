#!/usr/bin/env node
/**
 * Conversation Export Tool
 * Exports complete conversation history with all edits and context
 */

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');
const ConversationTracker = require('../tracking/conversation-tracker');
const ResponseCapture = require('../tracking/response-capture');
const EditTracker = require('../tracking/edit-tracker');

const NEXUS_PATH = path.join(process.cwd(), '.nexus');

class ConversationExporter {
    constructor() {
        this.conversationTracker = new ConversationTracker({
            storagePath: path.join(NEXUS_PATH, 'conversations')
        });
        this.responseCapture = new ResponseCapture({
            storagePath: path.join(NEXUS_PATH, 'responses')
        });
        this.editTracker = new EditTracker({
            storagePath: path.join(NEXUS_PATH, 'edits')
        });
    }
    
    async initialize() {
        await this.conversationTracker.initialize();
        await this.responseCapture.initialize();
        await this.editTracker.initialize();
    }
    
    /**
     * Export conversation as Markdown
     */
    async exportAsMarkdown(outputPath, options = {}) {
        const spinner = ora('Exporting conversation as Markdown...').start();
        
        try {
            await this.initialize();
            
            const conversation = this.conversationTracker.conversation;
            if (!conversation) {
                throw new Error('No conversation found');
            }
            
            let markdown = this.generateMarkdownHeader(conversation);
            
            // Export each turn
            for (const turn of conversation.turns) {
                markdown += await this.generateTurnMarkdown(turn, options);
            }
            
            // Add summary section
            if (options.includeSummary) {
                markdown += this.generateSummaryMarkdown(conversation);
            }
            
            // Add file changes section
            if (options.includeFileChanges) {
                markdown += await this.generateFileChangesMarkdown();
            }
            
            await fs.writeFile(outputPath, markdown);
            
            spinner.succeed(chalk.green(`Exported conversation to ${outputPath}`));
            
        } catch (error) {
            spinner.fail(chalk.red('Export failed'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Export as JSON with full data
     */
    async exportAsJSON(outputPath, options = {}) {
        const spinner = ora('Exporting conversation as JSON...').start();
        
        try {
            await this.initialize();
            
            const exportData = {
                metadata: {
                    exportTime: new Date().toISOString(),
                    exportVersion: '1.0.0',
                    projectPath: process.cwd()
                },
                conversation: this.conversationTracker.conversation,
                responses: [],
                edits: [],
                timeline: {}
            };
            
            // Include responses
            if (options.includeResponses) {
                for (const responseItem of this.responseCapture.responseHistory) {
                    const response = await this.responseCapture.getResponse(responseItem.id);
                    if (response) {
                        exportData.responses.push(response);
                    }
                }
            }
            
            // Include edits
            if (options.includeEdits) {
                exportData.edits = this.editTracker.editHistory;
            }
            
            // Include timeline summary
            if (options.includeTimeline) {
                exportData.timeline = await this.editTracker.generateEditTimeline();
            }
            
            await fs.writeJson(outputPath, exportData, { spaces: 2 });
            
            spinner.succeed(chalk.green(`Exported conversation to ${outputPath}`));
            
        } catch (error) {
            spinner.fail(chalk.red('Export failed'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Export as HTML with interactive features
     */
    async exportAsHTML(outputPath, options = {}) {
        const spinner = ora('Exporting conversation as HTML...').start();
        
        try {
            await this.initialize();
            
            const conversation = this.conversationTracker.conversation;
            let html = this.generateHTMLHeader(conversation);
            
            html += '<div class="conversation">\n';
            
            // Export each turn
            for (const turn of conversation.turns) {
                html += await this.generateTurnHTML(turn, options);
            }
            
            html += '</div>\n';
            
            // Add edit timeline section
            if (options.includeTimeline) {
                html += await this.generateTimelineHTML();
            }
            
            html += this.generateHTMLFooter();
            
            await fs.writeFile(outputPath, html);
            
            spinner.succeed(chalk.green(`Exported conversation to ${outputPath}`));
            
        } catch (error) {
            spinner.fail(chalk.red('Export failed'));
            console.error(error.message);
            throw error;
        }
    }
    
    /**
     * Generate Markdown header
     */
    generateMarkdownHeader(conversation) {
        return `# Conversation Export

**Conversation ID:** ${conversation.id}  
**Started:** ${new Date(conversation.startTime).toLocaleString()}  
**Current Turn:** ${conversation.currentTurn}  
**Total Turns:** ${conversation.turns.length}  

---

`;
    }
    
    /**
     * Generate turn markdown
     */
    async generateTurnMarkdown(turn, options) {
        let markdown = `## Turn ${turn.number} (${turn.type})\n\n`;
        markdown += `**Timestamp:** ${new Date(turn.timestamp).toLocaleString()}\n\n`;
        
        // Add content
        markdown += turn.content + '\n\n';
        
        // Add tools used if any
        if (turn.tools && turn.tools.length > 0) {
            markdown += '**Tools Used:**\n';
            for (const toolId of turn.tools) {
                const toolData = await this.getToolData(toolId);
                if (toolData) {
                    markdown += `- ${toolData.tool}: ${toolData.params ? JSON.stringify(toolData.params, null, 2) : 'N/A'}\n`;
                }
            }
            markdown += '\n';
        }
        
        // Add file changes for this turn
        if (options.includeFileChanges) {
            const edits = await this.editTracker.getEditsForTurn(turn.number);
            if (edits.length > 0) {
                markdown += '**File Changes:**\n';
                for (const edit of edits) {
                    markdown += `- \`${path.basename(edit.filePath)}\`: ${edit.operation} (+${edit.metrics.linesAdded} -${edit.metrics.linesRemoved})\n`;
                }
                markdown += '\n';
            }
        }
        
        // Add thinking if available
        if (options.includeThinking && turn.type === 'assistant') {
            const response = await this.responseCapture.getResponsesForTurn(turn.number);
            if (response && response.thinking && response.thinking.length > 0) {
                markdown += '**Thinking Process:**\n\n';
                for (const thought of response.thinking) {
                    markdown += `> ${thought.content}\n\n`;
                }
            }
        }
        
        markdown += '---\n\n';
        return markdown;
    }
    
    /**
     * Generate summary markdown
     */
    generateSummaryMarkdown(conversation) {
        let markdown = '## Summary\n\n';
        
        // Tool usage summary
        if (conversation.toolUsage && conversation.toolUsage.length > 0) {
            markdown += '### Tool Usage\n\n';
            for (const [tool, stats] of conversation.toolUsage) {
                markdown += `- **${tool}:** ${stats.count} uses (${stats.successes} ✅, ${stats.failures} ❌)\n`;
            }
            markdown += '\n';
        }
        
        // File operations summary
        if (conversation.fileOperations && conversation.fileOperations.length > 0) {
            markdown += '### Files Modified\n\n';
            const fileMap = new Map();
            for (const op of conversation.fileOperations) {
                if (!fileMap.has(op.path)) {
                    fileMap.set(op.path, []);
                }
                fileMap.get(op.path).push(op);
            }
            
            for (const [filePath, operations] of fileMap) {
                markdown += `- **${filePath}:** ${operations.length} operations\n`;
            }
            markdown += '\n';
        }
        
        return markdown;
    }
    
    /**
     * Generate file changes markdown
     */
    async generateFileChangesMarkdown() {
        let markdown = '## File Changes Timeline\n\n';
        
        const timeline = await this.editTracker.generateEditTimeline();
        
        for (const edit of timeline.edits) {
            markdown += `- **${new Date(edit.timestamp).toLocaleString()}** - \`${edit.file}\`: ${edit.operation} (${edit.changes})\n`;
        }
        
        markdown += '\n';
        return markdown;
    }
    
    /**
     * Generate HTML header
     */
    generateHTMLHeader(conversation) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conversation Export - ${conversation.id}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .turn { margin: 20px 0; padding: 20px; border-radius: 8px; }
        .user-turn { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .assistant-turn { background: #f3e5f5; border-left: 4px solid #9c27b0; }
        .timestamp { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .content { margin: 10px 0; }
        .tools { background: #fff3e0; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .file-changes { background: #e8f5e8; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .thinking { background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 3px solid #999; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: 'Monaco', 'Consolas', monospace; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .timeline { margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; }
        .edit-item { margin: 5px 0; padding: 10px; background: #fafafa; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Conversation Export</h1>
            <p><strong>ID:</strong> ${conversation.id}</p>
            <p><strong>Started:</strong> ${new Date(conversation.startTime).toLocaleString()}</p>
            <p><strong>Current Turn:</strong> ${conversation.currentTurn}</p>
            <p><strong>Total Turns:</strong> ${conversation.turns.length}</p>
        </div>
`;
    }
    
    /**
     * Generate turn HTML
     */
    async generateTurnHTML(turn, options) {
        const turnClass = turn.type === 'user' ? 'user-turn' : 'assistant-turn';
        let html = `        <div class="turn ${turnClass}">
            <div class="timestamp">Turn ${turn.number} - ${new Date(turn.timestamp).toLocaleString()}</div>
            <div class="content">${this.escapeHTML(turn.content)}</div>
`;
        
        // Add tools
        if (turn.tools && turn.tools.length > 0) {
            html += '            <div class="tools"><strong>Tools Used:</strong><ul>';
            for (const toolId of turn.tools) {
                const toolData = await this.getToolData(toolId);
                if (toolData) {
                    html += `<li>${toolData.tool}</li>`;
                }
            }
            html += '</ul></div>';
        }
        
        // Add file changes
        if (options.includeFileChanges) {
            const edits = await this.editTracker.getEditsForTurn(turn.number);
            if (edits.length > 0) {
                html += '            <div class="file-changes"><strong>File Changes:</strong><ul>';
                for (const edit of edits) {
                    html += `<li><code>${path.basename(edit.filePath)}</code>: ${edit.operation} (+${edit.metrics.linesAdded} -${edit.metrics.linesRemoved})</li>`;
                }
                html += '</ul></div>';
            }
        }
        
        // Add thinking
        if (options.includeThinking && turn.type === 'assistant') {
            const response = await this.responseCapture.getResponsesForTurn(turn.number);
            if (response && response.thinking && response.thinking.length > 0) {
                html += '            <div class="thinking"><strong>Thinking Process:</strong>';
                for (const thought of response.thinking) {
                    html += `<p>${this.escapeHTML(thought.content)}</p>`;
                }
                html += '</div>';
            }
        }
        
        html += '        </div>\n';
        return html;
    }
    
    /**
     * Generate timeline HTML
     */
    async generateTimelineHTML() {
        const timeline = await this.editTracker.generateEditTimeline();
        
        let html = '        <div class="timeline">\n';
        html += '            <h2>File Changes Timeline</h2>\n';
        
        for (const edit of timeline.edits) {
            html += `            <div class="edit-item">
                <strong>${new Date(edit.timestamp).toLocaleString()}</strong> - 
                <code>${edit.file}</code>: ${edit.operation} (${edit.changes})
            </div>\n`;
        }
        
        html += '        </div>\n';
        return html;
    }
    
    /**
     * Generate HTML footer
     */
    generateHTMLFooter() {
        return `    </div>
</body>
</html>`;
    }
    
    /**
     * Get tool data by ID
     */
    async getToolData(toolId) {
        const toolFile = path.join(NEXUS_PATH, 'conversations', 'tools', `${toolId}.json`);
        
        if (await fs.pathExists(toolFile)) {
            return await fs.readJson(toolFile);
        }
        
        return null;
    }
    
    /**
     * Escape HTML
     */
    escapeHTML(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
    
    /**
     * Export conversation archive (all formats)
     */
    async exportArchive(outputDir, options = {}) {
        const spinner = ora('Creating conversation archive...').start();
        
        try {
            await fs.ensureDir(outputDir);
            
            const conversation = this.conversationTracker.conversation;
            const baseFileName = `conversation-${conversation.id}`;
            
            // Export as Markdown
            await this.exportAsMarkdown(
                path.join(outputDir, `${baseFileName}.md`),
                { includeFileChanges: true, includeSummary: true, includeThinking: true }
            );
            
            // Export as JSON
            await this.exportAsJSON(
                path.join(outputDir, `${baseFileName}.json`),
                { includeResponses: true, includeEdits: true, includeTimeline: true }
            );
            
            // Export as HTML
            await this.exportAsHTML(
                path.join(outputDir, `${baseFileName}.html`),
                { includeFileChanges: true, includeTimeline: true, includeThinking: true }
            );
            
            // Create archive info
            const archiveInfo = {
                createdAt: new Date().toISOString(),
                conversation: {
                    id: conversation.id,
                    startTime: conversation.startTime,
                    turns: conversation.turns.length,
                    currentTurn: conversation.currentTurn
                },
                stats: {
                    responses: this.responseCapture.responseHistory.length,
                    edits: this.editTracker.editHistory.length,
                    filesChanged: this.editTracker.fileEditMap.size
                }
            };
            
            await fs.writeJson(
                path.join(outputDir, 'archive-info.json'),
                archiveInfo,
                { spaces: 2 }
            );
            
            spinner.succeed(chalk.green(`Created conversation archive in ${outputDir}`));
            
        } catch (error) {
            spinner.fail(chalk.red('Archive creation failed'));
            console.error(error.message);
            throw error;
        }
    }
}

// CLI Interface
const program = require('commander');

program
    .version('1.0.0')
    .description('Export conversation data in various formats');

program
    .command('markdown <output>')
    .description('Export as Markdown')
    .option('--include-file-changes', 'Include file changes')
    .option('--include-summary', 'Include summary section')
    .option('--include-thinking', 'Include thinking processes')
    .action(async (output, options) => {
        const exporter = new ConversationExporter();
        await exporter.exportAsMarkdown(output, options);
    });

program
    .command('json <output>')
    .description('Export as JSON')
    .option('--include-responses', 'Include response data')
    .option('--include-edits', 'Include edit data')
    .option('--include-timeline', 'Include timeline data')
    .action(async (output, options) => {
        const exporter = new ConversationExporter();
        await exporter.exportAsJSON(output, options);
    });

program
    .command('html <output>')
    .description('Export as HTML')
    .option('--include-file-changes', 'Include file changes')
    .option('--include-timeline', 'Include timeline')
    .option('--include-thinking', 'Include thinking processes')
    .action(async (output, options) => {
        const exporter = new ConversationExporter();
        await exporter.exportAsHTML(output, options);
    });

program
    .command('archive <output-dir>')
    .description('Export complete archive (all formats)')
    .action(async (outputDir) => {
        const exporter = new ConversationExporter();
        await exporter.exportArchive(outputDir);
    });

program.parse(process.argv);

module.exports = ConversationExporter;