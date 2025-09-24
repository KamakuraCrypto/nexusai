#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

// Simple colors without chalk dependency for install script
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(color, ...args) {
    console.log(colors[color] + args.join(' ') + colors.reset);
}

log('cyan', colors.bright + '\n🚀 Setting up Nexus AI Claude Edition...\n');

async function setup() {
    try {
        // Create necessary directories
        const dirs = [
            '.nexus',
            '.nexus/sessions', 
            '.nexus/artifacts',
            '.nexus/summaries',
            '.nexus/backups'
        ];
        
        const baseDir = process.cwd();
        
        for (const dir of dirs) {
            const dirPath = path.join(baseDir, dir);
            if (!fs.existsSync(dirPath)) {
                await fs.ensureDir(dirPath);
                log('green', '✓', `Created ${dir}`);
            }
        }
        
        log('green', colors.bright + '\n✅ Setup complete!');
        log('cyan', '\nNext steps:');
        console.log('  1. Run', colors.yellow + 'nexus claude init' + colors.reset, 'to initialize Claude integration');
        console.log('  2. Run', colors.yellow + 'nexus claude status' + colors.reset, 'to check status');
        console.log('  3. Run', colors.yellow + 'nexus claude --help' + colors.reset, 'for all commands\n');
        
    } catch (error) {
        log('red', 'Setup error:', error.message);
        // Don't exit with error to allow npm install to continue
    }
}

setup();