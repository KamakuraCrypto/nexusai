#!/usr/bin/env node
/**
 * Conversation tracking CLI for hook integration
 * This allows hooks to track conversation events
 */

const path = require('path');
const fs = require('fs-extra');
const ConversationTracker = require('../tracking/conversation-tracker');

const CONVERSATION_PATH = path.join(process.cwd(), '.nexus', 'conversations');

async function main() {
    const action = process.argv[2];
    const data = process.argv[3] ? JSON.parse(process.argv[3]) : {};
    
    // Initialize tracker
    const tracker = new ConversationTracker({
        storagePath: CONVERSATION_PATH
    });
    
    await tracker.initialize();
    
    switch(action) {
        case 'prompt':
            // Track user prompt
            await tracker.trackPrompt(data.content || '');
            break;
            
        case 'tool':
            // Track tool invocation
            await tracker.trackToolInvocation(data.tool || 'unknown', data.params || {});
            break;
            
        case 'response':
            // Track AI response
            await tracker.trackResponseEnd(data.content || '');
            break;
            
        case 'turn':
            // Increment turn
            tracker.incrementTurn();
            await tracker.saveConversation();
            break;
            
        case 'checkpoint':
            // Create checkpoint
            await tracker.createCheckpoint(data.name || 'Manual checkpoint');
            break;
            
        default:
            console.error(`Unknown action: ${action}`);
            process.exit(1);
    }
    
    // Save changes
    await tracker.saveConversation();
    console.log(`Tracked ${action}`);
}

main().catch(error => {
    console.error('Error tracking conversation:', error.message);
    process.exit(1);
});