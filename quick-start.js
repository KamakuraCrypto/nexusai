#!/usr/bin/env node

/**
 * Quick Start Script for Nexus AI Claude Edition
 * Run this directly with: node quick-start.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🚀 Nexus AI Claude Edition - Quick Start\n');
console.log('====================================\n');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...\n');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('\n✅ Dependencies installed!\n');
    } catch (error) {
        console.error('❌ Failed to install dependencies. Please run: npm install');
        process.exit(1);
    }
}

// Run the Claude CLI directly
const claudePath = path.join(__dirname, 'bin', 'nexus-claude.js');

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    // No arguments, show help
    console.log('Usage: node quick-start.js [command] [options]\n');
    console.log('Commands:');
    console.log('  init       - Initialize Claude integration');
    console.log('  status     - Show Claude context status');
    console.log('  save       - Save current session');
    console.log('  restore    - Restore previous session');
    console.log('  --help     - Show all commands\n');
    console.log('Example:');
    console.log('  node quick-start.js init');
    console.log('  node quick-start.js status\n');
    
    // Show full help
    try {
        execSync(`node "${claudePath}" --help`, { stdio: 'inherit' });
    } catch (error) {
        // Ignore error, help was shown
    }
} else {
    // Run the command
    try {
        const command = `node "${claudePath}" ${args.join(' ')}`;
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        // Error already shown by the command
        process.exit(1);
    }
}