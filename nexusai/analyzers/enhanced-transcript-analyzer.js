#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

class EnhancedTranscriptAnalyzer {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.nexusDir = path.join(this.projectRoot, '.nexus');
    this.transcriptsDir = path.join(this.nexusDir, 'transcripts');
    this.analyzedDir = path.join(this.transcriptsDir, 'analyzed');
    this.rawDir = path.join(this.transcriptsDir, 'raw');
    
    this.patterns = new Map();
    this.decisions = [];
    this.errors = [];
    this.learnings = [];
    
    // Analysis patterns for different types of content
    this.analysisPatterns = {
      codeBlocks: /```(\w+)?\n([\s\S]*?)```/g,
      fileEdits: /(?:edit|modify|change|update)\s+(?:file|the file)\s+([^\s]+)/gi,
      commands: /\$\s+([^\n]+)/g,
      decisions: /(?:decided|choose|selected|went with|opted for)\s+([^\n.]+)/gi,
      errors: /(?:error|failed|problem|issue|bug)[\s:]+([^\n]+)/gi,
      learnings: /(?:learned|discovered|found|realized)\s+(?:that\s+)?([^\n.]+)/gi,
      patterns: /(?:pattern|approach|method|technique)[\s:]+([^\n.]+)/gi
    };
  }

  async initialize() {
    console.log('📝 Initializing Enhanced Transcript Analyzer...');
    
    await this.ensureDirectories();
    
    console.log('✅ Transcript Analyzer initialized');
  }

  async ensureDirectories() {
    const dirs = [
      this.transcriptsDir,
      this.analyzedDir,
      this.rawDir
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async analyzeTranscript(filePath) {
    console.log(`📖 Analyzing transcript: ${path.basename(filePath)}`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');
      
      const conversation = {
        messages: [],
        messageCount: 0,
        summary: null
      };

      // Parse JSONL format
      for (const line of lines) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line);
            conversation.messages.push(entry);
            conversation.messageCount++;
          } catch (parseError) {
            console.warn(`Warning: Could not parse line: ${line.substring(0, 50)}...`);
          }
        }
      }

      // Perform analysis
      const analysis = await this.performAnalysis(conversation);
      
      // Save analysis results
      const analysisFile = path.join(
        this.analyzedDir,
        path.basename(filePath, '.jsonl') + '-analyzed.json'
      );

      const result = {
        originalPath: path.basename(filePath),
        analyzedAt: Date.now(),
        conversation: {
          messageCount: conversation.messageCount,
          summary: this.generateSummary(conversation)
        },
        insights: analysis,
        stats: this.generateStats(analysis)
      };

      await fs.writeFile(analysisFile, JSON.stringify(result, null, 2));
      
      console.log(`✅ Analysis complete: ${analysis.patterns.length} patterns, ${analysis.decisions.length} decisions`);
      
      return result;
    } catch (error) {
      console.error(`❌ Error analyzing transcript: ${error.message}`);
      throw error;
    }
  }

  async performAnalysis(conversation) {
    const analysis = {
      patterns: [],
      decisions: [],
      errors: [],
      codeBlocks: [],
      learnings: [],
      fileEdits: [],
      commands: [],
      keyTopics: []
    };

    const allText = conversation.messages
      .map(msg => msg.message?.content || '')
      .join('\n');

    // Extract code blocks
    analysis.codeBlocks = this.extractCodeBlocks(allText);

    // Extract file edits
    analysis.fileEdits = this.extractFileEdits(allText);

    // Extract commands
    analysis.commands = this.extractCommands(allText);

    // Extract decisions
    analysis.decisions = this.extractDecisions(allText);

    // Extract errors
    analysis.errors = this.extractErrors(allText);

    // Extract learnings
    analysis.learnings = this.extractLearnings(allText);

    // Extract patterns
    analysis.patterns = this.extractPatterns(allText);

    // Extract key topics
    analysis.keyTopics = this.extractKeyTopics(allText);

    return analysis;
  }

  extractCodeBlocks(text) {
    const codeBlocks = [];
    let match;
    
    while ((match = this.analysisPatterns.codeBlocks.exec(text)) !== null) {
      codeBlocks.push({
        language: match[1] || 'unknown',
        code: match[2],
        lineCount: match[2].split('\n').length,
        timestamp: Date.now()
      });
    }
    
    return codeBlocks;
  }

  extractFileEdits(text) {
    const fileEdits = [];
    let match;
    
    while ((match = this.analysisPatterns.fileEdits.exec(text)) !== null) {
      fileEdits.push({
        file: match[1],
        context: match[0],
        timestamp: Date.now()
      });
    }
    
    return fileEdits;
  }

  extractCommands(text) {
    const commands = [];
    let match;
    
    while ((match = this.analysisPatterns.commands.exec(text)) !== null) {
      commands.push({
        command: match[1].trim(),
        timestamp: Date.now()
      });
    }
    
    return commands;
  }

  extractDecisions(text) {
    const decisions = [];
    let match;
    
    while ((match = this.analysisPatterns.decisions.exec(text)) !== null) {
      decisions.push({
        decision: match[1].trim(),
        context: this.getContext(text, match.index),
        timestamp: Date.now(),
        importance: this.assessImportance(match[1])
      });
    }
    
    return decisions;
  }

  extractErrors(text) {
    const errors = [];
    let match;
    
    while ((match = this.analysisPatterns.errors.exec(text)) !== null) {
      errors.push({
        error: match[1].trim(),
        context: this.getContext(text, match.index),
        timestamp: Date.now(),
        severity: this.assessSeverity(match[1])
      });
    }
    
    return errors;
  }

  extractLearnings(text) {
    const learnings = [];
    let match;
    
    while ((match = this.analysisPatterns.learnings.exec(text)) !== null) {
      learnings.push({
        learning: match[1].trim(),
        context: this.getContext(text, match.index),
        timestamp: Date.now(),
        importance: this.assessImportance(match[1])
      });
    }
    
    return learnings;
  }

  extractPatterns(text) {
    const patterns = [];
    let match;
    
    while ((match = this.analysisPatterns.patterns.exec(text)) !== null) {
      patterns.push({
        pattern: match[1].trim(),
        context: this.getContext(text, match.index),
        timestamp: Date.now(),
        frequency: 1
      });
    }
    
    return patterns;
  }

  extractKeyTopics(text) {
    // Simple keyword extraction - in production this would use NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const frequency = new Map();
    
    // Count word frequencies
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }

    // Get top topics
    return Array.from(frequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
  }

  getContext(text, index, contextSize = 100) {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(text.length, index + contextSize);
    return text.substring(start, end).trim();
  }

  assessImportance(text) {
    const highImportanceKeywords = [
      'critical', 'important', 'major', 'significant', 'key', 'essential',
      'crucial', 'vital', 'fundamental', 'breaking', 'security', 'performance'
    ];
    
    const lowered = text.toLowerCase();
    for (const keyword of highImportanceKeywords) {
      if (lowered.includes(keyword)) {
        return 'high';
      }
    }
    
    return 'medium';
  }

  assessSeverity(text) {
    const highSeverityKeywords = [
      'critical', 'fatal', 'crash', 'security', 'data loss', 'corruption',
      'breach', 'exploit', 'vulnerability'
    ];
    
    const lowered = text.toLowerCase();
    for (const keyword of highSeverityKeywords) {
      if (lowered.includes(keyword)) {
        return 'high';
      }
    }
    
    return 'medium';
  }

  generateSummary(conversation) {
    if (conversation.messageCount === 0) return null;
    
    const firstMessage = conversation.messages[0]?.message?.content || '';
    const lastMessage = conversation.messages[conversation.messages.length - 1]?.message?.content || '';
    
    return {
      start: firstMessage.substring(0, 200),
      end: lastMessage.substring(0, 200),
      messageCount: conversation.messageCount
    };
  }

  generateStats(analysis) {
    return {
      patterns: analysis.patterns.length,
      decisions: analysis.decisions.length,
      errors: analysis.errors.length,
      codeBlocks: analysis.codeBlocks.length,
      fileEdits: analysis.fileEdits.length,
      commands: analysis.commands.length
    };
  }

  async analyzeAllTranscripts() {
    console.log('📚 Analyzing all transcripts...');
    
    try {
      const files = await fs.readdir(this.transcriptsDir);
      const transcriptFiles = files.filter(file => 
        file.endsWith('.jsonl') && !file.includes('analyzed')
      );

      const results = [];
      
      for (const file of transcriptFiles) {
        const filePath = path.join(this.transcriptsDir, file);
        try {
          const result = await this.analyzeTranscript(filePath);
          results.push(result);
        } catch (error) {
          console.error(`❌ Failed to analyze ${file}: ${error.message}`);
        }
      }

      console.log(`✅ Analyzed ${results.length} transcripts`);
      return results;
    } catch (error) {
      console.error('❌ Error analyzing transcripts:', error.message);
      throw error;
    }
  }

  async watchForNewTranscripts() {
    console.log('👁️  Watching for new transcripts...');
    
    const chokidar = require('chokidar');
    
    const watcher = chokidar.watch(this.transcriptsDir, {
      ignored: /analyzed/,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('add', async (filePath) => {
      if (filePath.endsWith('.jsonl')) {
        console.log(`📄 New transcript detected: ${path.basename(filePath)}`);
        try {
          await this.analyzeTranscript(filePath);
        } catch (error) {
          console.error(`❌ Auto-analysis failed: ${error.message}`);
        }
      }
    });

    return watcher;
  }

  async getAnalysisStatus() {
    try {
      const transcriptFiles = await fs.readdir(this.transcriptsDir);
      const analyzedFiles = await fs.readdir(this.analyzedDir);
      
      const totalTranscripts = transcriptFiles.filter(f => f.endsWith('.jsonl')).length;
      const totalAnalyzed = analyzedFiles.filter(f => f.endsWith('.json')).length;
      
      return {
        totalTranscripts,
        totalAnalyzed,
        pendingAnalysis: totalTranscripts - totalAnalyzed,
        lastAnalysis: await this.getLastAnalysisTime()
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getLastAnalysisTime() {
    try {
      const files = await fs.readdir(this.analyzedDir);
      if (files.length === 0) return null;
      
      let latestTime = 0;
      for (const file of files) {
        const filePath = path.join(this.analyzedDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() > latestTime) {
          latestTime = stats.mtime.getTime();
        }
      }
      
      return latestTime;
    } catch {
      return null;
    }
  }
}

// CLI functionality
if (require.main === module) {
  const analyzer = new EnhancedTranscriptAnalyzer();
  
  const command = process.argv[2];
  const filePath = process.argv[3];

  analyzer.initialize().then(async () => {
    switch (command) {
      case 'analyze':
        if (filePath) {
          await analyzer.analyzeTranscript(filePath);
        } else {
          await analyzer.analyzeAllTranscripts();
        }
        break;
      
      case 'watch':
        await analyzer.watchForNewTranscripts();
        console.log('👁️  Watching for new transcripts... Press Ctrl+C to stop');
        break;
      
      case 'status':
        const status = await analyzer.getAnalysisStatus();
        console.log('📊 Analysis Status:', status);
        break;
      
      default:
        console.log('Usage: node enhanced-transcript-analyzer.js <analyze|watch|status> [file]');
    }
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = EnhancedTranscriptAnalyzer;