#!/usr/bin/env node

/**
 * Nexus AI Recovery System
 * Restores files, edits, and conversation state to previous points in time
 * Usage: nclaude-recover [command] [options]
 * 
 * Commands:
 *   list-edits <file>     - Show edit history for a file
 *   restore-file <file> <edit-id>  - Restore file to specific edit
 *   list-conversations    - Show available conversation sessions
 *   restore-conversation <id>      - Show conversation content
 *   list-backups         - Show available backups
 *   restore-backup <timestamp>     - Restore from backup
 *   show-timeline        - Show comprehensive activity timeline
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const diff = require('diff');

class NexusRecovery {
    constructor(projectDir = process.cwd()) {
        this.projectDir = projectDir;
        this.nexusDir = path.join(projectDir, '.nexus');
        this.backupsDir = path.join(this.nexusDir, 'backups');
        this.conversationsDir = path.join(this.nexusDir, 'conversations');
        this.editsDir = path.join(this.nexusDir, 'edits');
        this.responsesDir = path.join(this.nexusDir, 'responses');
    }

    async initialize() {
        // Ensure all directories exist
        const dirs = [this.nexusDir, this.backupsDir, this.conversationsDir, this.editsDir, this.responsesDir];
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    // File Recovery Functions
    async listFileEdits(filePath) {
        console.log(`\n🔍 Edit History for: ${filePath}`);
        console.log('═'.repeat(80));

        const edits = await this.getFileEdits(filePath);
        
        if (edits.length === 0) {
            console.log('No edit history found for this file.');
            return;
        }

        for (const edit of edits.slice(0, 20)) { // Show last 20 edits
            const timestamp = new Date(edit.timestamp).toLocaleString();
            const operation = edit.operation || 'edit';
            const linesChanged = edit.metrics ? `+${edit.metrics.linesAdded}/-${edit.metrics.linesRemoved}` : '';
            
            console.log(`${edit.id} | ${timestamp} | ${operation} ${linesChanged}`);
            
            if (edit.description) {
                console.log(`  └─ ${edit.description}`);
            }
        }

        console.log(`\n💡 Use: nclaude-recover restore-file "${filePath}" <edit-id>`);
    }

    async getFileEdits(filePath) {
        const edits = [];
        
        try {
            // Get edits from operations directory
            const operationsDir = path.join(this.editsDir, 'operations');
            const days = await fs.readdir(operationsDir).catch(() => []);
            
            for (const day of days) {
                const dayDir = path.join(operationsDir, day);
                const editFiles = await fs.readdir(dayDir).catch(() => []);
                
                for (const editFile of editFiles) {
                    if (editFile.endsWith('.json')) {
                        const editPath = path.join(dayDir, editFile);
                        const editData = JSON.parse(await fs.readFile(editPath, 'utf8'));
                        
                        if (editData.file_path === filePath) {
                            edits.push(editData);
                        }
                    }
                }
            }
            
            // Also check edit-tracker storage
            const trackingDir = path.join(this.editsDir, 'tracking');
            const trackingFiles = await fs.readdir(trackingDir).catch(() => []);
            
            for (const file of trackingFiles) {
                if (file.endsWith('.json')) {
                    const trackingPath = path.join(trackingDir, file);
                    const trackingData = JSON.parse(await fs.readFile(trackingPath, 'utf8'));
                    
                    if (trackingData.filePath === filePath) {
                        edits.push({
                            id: trackingData.id,
                            timestamp: trackingData.timestamp,
                            file_path: trackingData.filePath,
                            operation: trackingData.operation,
                            metrics: trackingData.metrics,
                            oldContent: trackingData.oldContent,
                            newContent: trackingData.newContent
                        });
                    }
                }
            }
            
        } catch (error) {
            console.error('Error getting file edits:', error.message);
        }
        
        return edits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    async restoreFile(filePath, editId) {
        console.log(`\n🔄 Restoring: ${filePath} to edit: ${editId}`);
        console.log('═'.repeat(80));

        try {
            // Find the edit record
            const edits = await this.getFileEdits(filePath);
            const targetEdit = edits.find(edit => edit.id === editId);
            
            if (!targetEdit) {
                console.error('❌ Edit ID not found');
                return false;
            }

            // Get the content at that point
            let contentToRestore = null;
            
            if (targetEdit.oldContent !== undefined) {
                contentToRestore = targetEdit.oldContent;
            } else if (targetEdit.newContent !== undefined) {
                contentToRestore = targetEdit.newContent;
            }
            
            if (contentToRestore === null) {
                console.error('❌ No content data found for this edit');
                return false;
            }

            // Create backup of current file
            const currentContent = await fs.readFile(filePath, 'utf8').catch(() => '');
            const backupPath = `${filePath}.backup.${Date.now()}`;
            await fs.writeFile(backupPath, currentContent);
            
            console.log(`📝 Current version backed up to: ${backupPath}`);

            // Restore the file
            await fs.writeFile(filePath, contentToRestore);
            
            const timestamp = new Date(targetEdit.timestamp).toLocaleString();
            console.log(`✅ File restored to state from: ${timestamp}`);
            
            // Show diff
            const diffResult = diff.createPatch(filePath, currentContent, contentToRestore);
            console.log('\n📊 Changes applied:');
            console.log(diffResult);
            
            return true;
            
        } catch (error) {
            console.error('❌ Restore failed:', error.message);
            return false;
        }
    }

    // Conversation Recovery Functions
    async listConversations() {
        console.log('\n💬 Available Conversations');
        console.log('═'.repeat(80));

        try {
            const conversations = [];
            
            // Get conversations from sessions directory
            const sessionsDir = path.join(this.conversationsDir, 'sessions');
            const sessionFiles = await fs.readdir(sessionsDir).catch(() => []);
            
            for (const file of sessionFiles) {
                if (file.endsWith('.json')) {
                    const sessionPath = path.join(sessionsDir, file);
                    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
                    
                    conversations.push({
                        id: sessionData.id,
                        startTime: sessionData.startTime,
                        endTime: sessionData.endTime,
                        turns: sessionData.turns || 0,
                        duration: this.formatDuration(sessionData.startTime, sessionData.endTime)
                    });
                }
            }
            
            conversations.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            
            for (const conv of conversations.slice(0, 10)) {
                const startTime = new Date(conv.startTime).toLocaleString();
                console.log(`${conv.id} | ${startTime} | ${conv.turns} turns | ${conv.duration}`);
            }
            
            console.log(`\n💡 Use: nclaude-recover restore-conversation <id>`);
            
        } catch (error) {
            console.error('Error listing conversations:', error.message);
        }
    }

    async restoreConversation(conversationId) {
        console.log(`\n💬 Conversation: ${conversationId}`);
        console.log('═'.repeat(80));

        try {
            const sessionPath = path.join(this.conversationsDir, 'sessions', `${conversationId}.json`);
            const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
            
            console.log(`Start: ${new Date(sessionData.startTime).toLocaleString()}`);
            console.log(`End: ${sessionData.endTime ? new Date(sessionData.endTime).toLocaleString() : 'Ongoing'}`);
            console.log(`Turns: ${sessionData.turns || 0}`);
            console.log('');
            
            // Show conversation content
            if (sessionData.prompts && sessionData.prompts.length > 0) {
                console.log('📝 User Prompts:');
                sessionData.prompts.forEach((prompt, i) => {
                    const timestamp = new Date(prompt.timestamp).toLocaleString();
                    console.log(`${i + 1}. [${timestamp}] ${prompt.content.substring(0, 100)}...`);
                });
                console.log('');
            }
            
            // Show responses
            const responseFiles = await fs.readdir(this.responsesDir).catch(() => []);
            const conversationResponses = responseFiles.filter(f => f.includes(conversationId));
            
            if (conversationResponses.length > 0) {
                console.log('🤖 AI Responses:');
                for (const responseFile of conversationResponses.slice(0, 5)) {
                    const responsePath = path.join(this.responsesDir, responseFile);
                    const responseData = JSON.parse(await fs.readFile(responsePath, 'utf8'));
                    const timestamp = new Date(responseData.timestamp).toLocaleString();
                    console.log(`[${timestamp}] ${responseData.content.substring(0, 100)}...`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error restoring conversation:', error.message);
        }
    }

    // Backup Recovery Functions
    async listBackups() {
        console.log('\n💾 Available Backups');
        console.log('═'.repeat(80));

        try {
            const backupTypes = ['quick', 'hourly', 'daily'];
            
            for (const type of backupTypes) {
                const typeDir = path.join(this.backupsDir, type);
                const backups = await fs.readdir(typeDir).catch(() => []);
                
                if (backups.length > 0) {
                    console.log(`\n${type.toUpperCase()} Backups:`);
                    backups.sort().reverse().slice(0, 5).forEach(backup => {
                        const timestamp = backup.replace('.tar.gz', '');
                        const date = new Date(timestamp).toLocaleString();
                        console.log(`  ${timestamp} | ${date}`);
                    });
                }
            }
            
            console.log(`\n💡 Use: nclaude-recover restore-backup <timestamp>`);
            
        } catch (error) {
            console.error('Error listing backups:', error.message);
        }
    }

    async restoreBackup(timestamp) {
        console.log(`\n💾 Restoring from backup: ${timestamp}`);
        console.log('═'.repeat(80));

        try {
            // Find backup file
            const backupTypes = ['quick', 'hourly', 'daily'];
            let backupPath = null;
            
            for (const type of backupTypes) {
                const testPath = path.join(this.backupsDir, type, `${timestamp}.tar.gz`);
                try {
                    await fs.access(testPath);
                    backupPath = testPath;
                    break;
                } catch {}
            }
            
            if (!backupPath) {
                console.error('❌ Backup not found');
                return false;
            }
            
            // Create restore directory
            const restoreDir = path.join(this.nexusDir, 'restore', timestamp);
            await fs.mkdir(restoreDir, { recursive: true });
            
            // Extract backup
            console.log('📦 Extracting backup...');
            execSync(`tar -xzf "${backupPath}" -C "${restoreDir}"`);
            
            console.log(`✅ Backup extracted to: ${restoreDir}`);
            console.log('💡 Review files and manually copy what you need back to the project');
            
            return true;
            
        } catch (error) {
            console.error('❌ Restore failed:', error.message);
            return false;
        }
    }

    // Timeline and Analysis
    async showTimeline(limit = 50) {
        console.log('\n📅 Activity Timeline');
        console.log('═'.repeat(80));

        const activities = [];
        
        try {
            // Get edits
            const edits = await this.getAllEdits();
            if (edits && edits.length > 0) {
                edits.forEach(edit => {
                    activities.push({
                        timestamp: edit.timestamp,
                        type: 'edit',
                        description: `Edited ${path.basename(edit.file_path || edit.filePath)}`,
                        details: edit
                    });
                });
            }
            
            // Get conversations
            const conversations = await this.getAllConversations();
            if (conversations && conversations.length > 0) {
                conversations.forEach(conv => {
                    activities.push({
                        timestamp: conv.startTime,
                        type: 'conversation',
                        description: `Started conversation (${conv.turns || 0} turns)`,
                        details: conv
                    });
                });
            }
            
            // Get responses
            const responses = await this.getAllResponses();
            if (responses && responses.length > 0) {
                responses.forEach(response => {
                    const contentLength = response.content ? response.content.length : 0;
                    activities.push({
                        timestamp: response.timestamp,
                        type: 'response',
                        description: `AI response (${contentLength} chars)`,
                        details: response
                    });
                });
            }
            
            // Sort by timestamp
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Display timeline
            if (activities.length === 0) {
                console.log('No activity found yet.');
            } else {
                activities.slice(0, limit).forEach(activity => {
                    const time = new Date(activity.timestamp).toLocaleString();
                    const icon = activity.type === 'edit' ? '✏️' : activity.type === 'conversation' ? '💬' : '🤖';
                    console.log(`${icon} ${time} | ${activity.description}`);
                });
            }
            
        } catch (error) {
            console.error('Error generating timeline:', error.message);
        }
    }

    // Helper functions
    async getAllEdits() {
        const edits = [];
        try {
            const operationsDir = path.join(this.editsDir, 'operations');
            const days = await fs.readdir(operationsDir).catch(() => []);
            
            for (const day of days) {
                const dayDir = path.join(operationsDir, day);
                const editFiles = await fs.readdir(dayDir).catch(() => []);
                
                for (const editFile of editFiles) {
                    if (editFile.endsWith('.json')) {
                        const editPath = path.join(dayDir, editFile);
                        const editData = JSON.parse(await fs.readFile(editPath, 'utf8'));
                        edits.push(editData);
                    }
                }
            }
        } catch (error) {
            console.error('Error getting all edits:', error.message);
        }
        return edits;
    }

    async getAllConversations() {
        const conversations = [];
        try {
            const sessionsDir = path.join(this.conversationsDir, 'sessions');
            const sessionFiles = await fs.readdir(sessionsDir).catch(() => []);
            
            for (const file of sessionFiles) {
                if (file.endsWith('.json')) {
                    const sessionPath = path.join(sessionsDir, file);
                    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
                    conversations.push(sessionData);
                }
            }
        } catch (error) {
            console.error('Error getting conversations:', error.message);
        }
        return conversations;
    }

    async getAllResponses() {
        const responses = [];
        try {
            const responseFiles = await fs.readdir(this.responsesDir).catch(() => []);
            
            for (const file of responseFiles) {
                if (file.endsWith('.json')) {
                    const responsePath = path.join(this.responsesDir, file);
                    const responseData = JSON.parse(await fs.readFile(responsePath, 'utf8'));
                    responses.push(responseData);
                }
            }
        } catch (error) {
            console.error('Error getting responses:', error.message);
        }
        return responses;
    }

    formatDuration(startTime, endTime) {
        if (!endTime) return 'ongoing';
        const duration = new Date(endTime) - new Date(startTime);
        const minutes = Math.floor(duration / 60000);
        return `${minutes}m`;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const recovery = new NexusRecovery();
    
    await recovery.initialize();
    
    try {
        switch (command) {
            case 'list-edits':
                if (!args[1]) {
                    console.error('❌ Usage: nclaude-recover list-edits <file-path>');
                    process.exit(1);
                }
                await recovery.listFileEdits(args[1]);
                break;
                
            case 'restore-file':
                if (!args[1] || !args[2]) {
                    console.error('❌ Usage: nclaude-recover restore-file <file-path> <edit-id>');
                    process.exit(1);
                }
                await recovery.restoreFile(args[1], args[2]);
                break;
                
            case 'list-conversations':
                await recovery.listConversations();
                break;
                
            case 'restore-conversation':
                if (!args[1]) {
                    console.error('❌ Usage: nclaude-recover restore-conversation <conversation-id>');
                    process.exit(1);
                }
                await recovery.restoreConversation(args[1]);
                break;
                
            case 'list-backups':
                await recovery.listBackups();
                break;
                
            case 'restore-backup':
                if (!args[1]) {
                    console.error('❌ Usage: nclaude-recover restore-backup <timestamp>');
                    process.exit(1);
                }
                await recovery.restoreBackup(args[1]);
                break;
                
            case 'show-timeline':
                const limit = args[1] ? parseInt(args[1]) : 50;
                await recovery.showTimeline(limit);
                break;
                
            default:
                console.log('Nexus AI Recovery System\n');
                console.log('Available commands:');
                console.log('  list-edits <file>          Show edit history for a file');
                console.log('  restore-file <file> <id>   Restore file to specific edit');
                console.log('  list-conversations         Show available conversations');
                console.log('  restore-conversation <id>  Show conversation content');
                console.log('  list-backups               Show available backups');
                console.log('  restore-backup <timestamp> Restore from backup');
                console.log('  show-timeline [limit]      Show activity timeline');
                console.log('\nExamples:');
                console.log('  nclaude-recover list-edits /path/to/file.js');
                console.log('  nclaude-recover restore-file /path/to/file.js edit-1234567890-abcd');
                console.log('  nclaude-recover show-timeline 20');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = NexusRecovery;