#!/usr/bin/env node

const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const debounce = require('lodash.debounce');

class NexusWatcher {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.nexusDir = path.join(this.projectRoot, '.nexus');
    this.daemonDir = path.join(this.nexusDir, 'daemon');
    this.editsDir = path.join(this.nexusDir, 'edits');
    this.timelineDir = path.join(this.nexusDir, 'timeline');
    
    this.fileStates = new Map();
    this.isRunning = false;
    this.watcher = null;
    
    // Debounced file processing to prevent spam
    this.processFileChange = debounce(this.handleFileChange.bind(this), 100);
  }

  async initialize() {
    console.log('🚀 Initializing Nexus File Watcher...');
    
    // Ensure all directories exist
    await this.ensureDirectories();
    
    // Load existing file states
    await this.loadFileStates();
    
    // Setup file watcher with ignore patterns
    this.setupWatcher();
    
    console.log('✅ Nexus File Watcher initialized successfully');
  }

  async ensureDirectories() {
    const dirs = [
      this.nexusDir,
      this.daemonDir,
      this.editsDir,
      path.join(this.editsDir, 'by-file'),
      path.join(this.editsDir, 'by-timestamp'),
      path.join(this.editsDir, 'diffs'),
      this.timelineDir
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadFileStates() {
    const statesFile = path.join(this.daemonDir, 'file-states.json');
    
    try {
      const data = await fs.readFile(statesFile, 'utf8');
      const states = JSON.parse(data);
      this.fileStates = new Map(Object.entries(states));
      console.log(`📂 Loaded ${this.fileStates.size} file states`);
    } catch (error) {
      console.log('📂 No existing file states found, starting fresh');
      this.fileStates = new Map();
    }
  }

  async saveFileStates() {
    const statesFile = path.join(this.daemonDir, 'file-states.json');
    const states = Object.fromEntries(this.fileStates);
    
    await fs.writeFile(statesFile, JSON.stringify(states, null, 2));
  }

  setupWatcher() {
    // Comprehensive ignore patterns
    const ignorePatterns = [
      '.nexus/**',
      'node_modules/**',
      '.git/**',
      '*.log',
      '*.tmp',
      '*.temp',
      '.DS_Store',
      'Thumbs.db',
      '*.swp',
      '*.swo',
      '.vscode/**',
      '.idea/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '*.map'
    ];

    this.watcher = chokidar.watch(this.projectRoot, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    // File event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileAdd(filePath))
      .on('change', (filePath) => this.processFileChange(filePath, 'modify'))
      .on('unlink', (filePath) => this.handleFileDelete(filePath))
      .on('ready', () => {
        console.log('👁️  File watcher ready - monitoring all files');
        this.isRunning = true;
      })
      .on('error', (error) => {
        console.error('❌ Watcher error:', error);
      });
  }

  async handleFileAdd(filePath) {
    // Prevent tracking .nexus files to avoid recursion
    if (filePath.includes('.nexus')) {
      return;
    }

    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const hash = this.generateHash(content);
      
      const fileState = {
        path: filePath,
        size: stats.size,
        hash: hash,
        lastModified: stats.mtime.getTime(),
        created: Date.now()
      };

      this.fileStates.set(filePath, fileState);
      await this.saveFileStates();
      await this.logTimelineEvent('create', filePath, fileState);
      
      console.log(`📄 File added: ${path.relative(this.projectRoot, filePath)}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Error processing file add: ${filePath}`, error.message);
      }
    }
  }

  async handleFileChange(filePath, changeType = 'modify') {
    // Prevent tracking .nexus files
    if (filePath.includes('.nexus')) {
      return;
    }

    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const newHash = this.generateHash(content);
      
      const existingState = this.fileStates.get(filePath);
      
      // Only process if content actually changed
      if (existingState && existingState.hash === newHash) {
        return;
      }

      const timestamp = Date.now();
      const versionId = `${timestamp}-${newHash.substring(0, 8)}`;

      // Save file version
      await this.saveFileVersion(filePath, content, versionId, existingState);

      // Update file state
      const newState = {
        path: filePath,
        size: stats.size,
        hash: newHash,
        lastModified: stats.mtime.getTime(),
        lastVersion: versionId,
        changeCount: (existingState?.changeCount || 0) + 1
      };

      this.fileStates.set(filePath, newState);
      await this.saveFileStates();
      await this.logTimelineEvent(changeType, filePath, newState);

      console.log(`🔄 File ${changeType}: ${path.relative(this.projectRoot, filePath)} (v${newState.changeCount})`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Error processing file change: ${filePath}`, error.message);
      }
    }
  }

  async handleFileDelete(filePath) {
    if (filePath.includes('.nexus')) {
      return;
    }

    const existingState = this.fileStates.get(filePath);
    if (existingState) {
      this.fileStates.delete(filePath);
      await this.saveFileStates();
      await this.logTimelineEvent('delete', filePath, existingState);
      
      console.log(`🗑️  File deleted: ${path.relative(this.projectRoot, filePath)}`);
    }
  }

  async saveFileVersion(filePath, content, versionId, previousState) {
    const relativeFilePath = path.relative(this.projectRoot, filePath);
    const sanitizedPath = relativeFilePath.replace(/[\/\\]/g, '_');
    
    // Save by file path
    const fileVersionsDir = path.join(this.editsDir, 'by-file', sanitizedPath);
    await fs.mkdir(fileVersionsDir, { recursive: true });
    
    const versionData = {
      versionId,
      timestamp: Date.now(),
      filePath: relativeFilePath,
      content: content,
      size: content.length,
      hash: this.generateHash(content),
      previousVersion: previousState?.lastVersion,
      changeCount: (previousState?.changeCount || 0) + 1
    };

    await fs.writeFile(
      path.join(fileVersionsDir, `${versionId}.json`),
      JSON.stringify(versionData, null, 2)
    );

    // Save by timestamp
    const date = new Date().toISOString().split('T')[0];
    const timestampDir = path.join(this.editsDir, 'by-timestamp', date);
    await fs.mkdir(timestampDir, { recursive: true });
    
    await fs.writeFile(
      path.join(timestampDir, `${versionId}.json`),
      JSON.stringify(versionData, null, 2)
    );

    // Generate diff if there's a previous version
    if (previousState) {
      await this.generateDiff(filePath, versionId, content, previousState);
    }
  }

  async generateDiff(filePath, versionId, newContent, previousState) {
    try {
      const relativeFilePath = path.relative(this.projectRoot, filePath);
      const sanitizedPath = relativeFilePath.replace(/[\/\\]/g, '_');
      const previousVersionFile = path.join(
        this.editsDir, 
        'by-file', 
        sanitizedPath, 
        `${previousState.lastVersion}.json`
      );

      const previousData = JSON.parse(await fs.readFile(previousVersionFile, 'utf8'));
      const previousContent = previousData.content;

      // Simple diff generation
      const diff = this.createSimpleDiff(previousContent, newContent);
      
      const diffFile = path.join(this.editsDir, 'diffs', `${versionId}.diff`);
      await fs.writeFile(diffFile, diff);
      
    } catch (error) {
      console.error('❌ Error generating diff:', error.message);
    }
  }

  createSimpleDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    let diff = `--- Previous Version\n+++ Current Version\n`;
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (oldLine !== newLine) {
        if (oldLine) diff += `- ${oldLine}\n`;
        if (newLine) diff += `+ ${newLine}\n`;
      }
    }
    
    return diff;
  }

  async logTimelineEvent(eventType, filePath, fileState) {
    const timelineFile = path.join(this.timelineDir, 'events.jsonl');
    
    const event = {
      timestamp: Date.now(),
      type: eventType,
      file: path.relative(this.projectRoot, filePath),
      size: fileState.size,
      hash: fileState.hash,
      version: fileState.lastVersion || fileState.hash?.substring(0, 8),
      changeCount: fileState.changeCount || 1
    };

    await fs.appendFile(timelineFile, JSON.stringify(event) + '\n');
  }

  generateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.isRunning = false;
      console.log('🛑 File watcher stopped');
    }
  }

  async getStatus() {
    return {
      isRunning: this.isRunning,
      trackedFiles: this.fileStates.size,
      projectRoot: this.projectRoot,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }
}

// CLI functionality
if (require.main === module) {
  const watcher = new NexusWatcher();
  
  watcher.initialize().then(() => {
    watcher.startTime = Date.now();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Nexus File Watcher...');
      await watcher.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Nexus File Watcher...');
      await watcher.stop();
      process.exit(0);
    });

  }).catch(error => {
    console.error('❌ Failed to initialize file watcher:', error);
    process.exit(1);
  });
}

module.exports = NexusWatcher;