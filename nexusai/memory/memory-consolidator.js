#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

class MemoryConsolidator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.nexusDir = path.join(this.projectRoot, '.nexus');
    this.memoryDir = path.join(this.nexusDir, 'memory');
    
    this.workingSet = new Map();
    this.longTermMemory = new Map();
    this.priorities = new Map();
    this.learnings = [];
    this.decisions = [];
    
    this.maxWorkingSetSize = options.maxWorkingSetSize || 100;
    this.consolidationThreshold = options.consolidationThreshold || 50;
    this.decayFactor = options.decayFactor || 0.95;
  }

  async initialize() {
    console.log('🧠 Initializing Memory Consolidator...');
    
    await this.ensureDirectories();
    await this.loadMemoryState();
    
    console.log('✅ Memory Consolidator initialized');
  }

  async ensureDirectories() {
    const dirs = [
      this.memoryDir,
      path.join(this.memoryDir, 'snapshots')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadMemoryState() {
    try {
      // Load working set
      const workingSetFile = path.join(this.memoryDir, 'working-set.json');
      const workingSetData = await fs.readFile(workingSetFile, 'utf8');
      const workingSet = JSON.parse(workingSetData);
      this.workingSet = new Map(Object.entries(workingSet));

      // Load long-term memory
      const longTermFile = path.join(this.memoryDir, 'long-term.json');
      const longTermData = await fs.readFile(longTermFile, 'utf8');
      const longTerm = JSON.parse(longTermData);
      this.longTermMemory = new Map(Object.entries(longTerm));

      // Load priorities
      const prioritiesFile = path.join(this.memoryDir, 'priorities.json');
      const prioritiesData = await fs.readFile(prioritiesFile, 'utf8');
      const priorities = JSON.parse(prioritiesData);
      this.priorities = new Map(Object.entries(priorities));

      // Load learnings
      const learningsFile = path.join(this.memoryDir, 'learnings.md');
      const learningsData = await fs.readFile(learningsFile, 'utf8');
      this.learnings = this.parseLearnings(learningsData);

      console.log(`🧠 Loaded memory: ${this.workingSet.size} working, ${this.longTermMemory.size} long-term`);
    } catch (error) {
      console.log('🧠 No existing memory found, starting fresh');
    }
  }

  async saveMemoryState() {
    // Save working set
    const workingSetFile = path.join(this.memoryDir, 'working-set.json');
    await fs.writeFile(
      workingSetFile,
      JSON.stringify(Object.fromEntries(this.workingSet), null, 2)
    );

    // Save long-term memory
    const longTermFile = path.join(this.memoryDir, 'long-term.json');
    await fs.writeFile(
      longTermFile,
      JSON.stringify(Object.fromEntries(this.longTermMemory), null, 2)
    );

    // Save priorities
    const prioritiesFile = path.join(this.memoryDir, 'priorities.json');
    await fs.writeFile(
      prioritiesFile,
      JSON.stringify(Object.fromEntries(this.priorities), null, 2)
    );

    // Save learnings
    const learningsFile = path.join(this.memoryDir, 'learnings.md');
    await fs.writeFile(learningsFile, this.formatLearnings());

    // Create snapshot
    await this.createSnapshot();
  }

  async addMemory(key, content, metadata = {}) {
    const memory = {
      content,
      timestamp: Date.now(),
      accessCount: 1,
      priority: metadata.priority || 0.5,
      tags: metadata.tags || [],
      source: metadata.source || 'unknown',
      ...metadata
    };

    this.workingSet.set(key, memory);
    this.updatePriority(key, memory.priority);

    // Auto-consolidate if working set is too large
    if (this.workingSet.size > this.maxWorkingSetSize) {
      await this.consolidate();
    }

    await this.saveMemoryState();
  }

  async getMemory(key) {
    let memory = this.workingSet.get(key) || this.longTermMemory.get(key);
    
    if (memory) {
      memory.accessCount = (memory.accessCount || 0) + 1;
      memory.lastAccessed = Date.now();
      this.updatePriority(key, this.calculatePriority(memory));
    }

    return memory;
  }

  async consolidate(force = false) {
    console.log('🔄 Starting memory consolidation...');

    const workingSetSize = this.workingSet.size;
    const shouldConsolidate = force || workingSetSize > this.consolidationThreshold;

    if (!shouldConsolidate) {
      console.log('📊 No consolidation needed');
      return;
    }

    // Sort by priority (lowest first for archival)
    const sortedMemories = Array.from(this.workingSet.entries())
      .sort(([, a], [, b]) => this.getPriority(a) - this.getPriority(b));

    const toArchive = sortedMemories.slice(0, Math.floor(workingSetSize * 0.3));
    const toKeep = sortedMemories.slice(Math.floor(workingSetSize * 0.3));

    // Move low-priority memories to long-term storage
    for (const [key, memory] of toArchive) {
      this.longTermMemory.set(key, {
        ...memory,
        archivedAt: Date.now(),
        priority: memory.priority * this.decayFactor
      });
      this.workingSet.delete(key);
    }

    // Update priorities for remaining memories
    for (const [key, memory] of toKeep) {
      this.updatePriority(key, memory.priority * this.decayFactor);
    }

    await this.saveMemoryState();
    await this.updateContextFile();

    console.log(`🔄 Consolidated: ${toArchive.length} archived, ${toKeep.length} retained`);
  }

  calculatePriority(memory) {
    const recency = 1 - (Date.now() - memory.timestamp) / (30 * 24 * 60 * 60 * 1000); // 30 days
    const frequency = Math.log(memory.accessCount + 1) / 10;
    const basePriority = memory.priority || 0.5;
    
    return Math.min(1, Math.max(0, basePriority + recency * 0.3 + frequency * 0.2));
  }

  updatePriority(key, priority) {
    this.priorities.set(key, {
      value: priority,
      updated: Date.now()
    });
  }

  getPriority(memory) {
    const key = this.findMemoryKey(memory);
    const priority = this.priorities.get(key);
    return priority ? priority.value : memory.priority || 0.5;
  }

  findMemoryKey(memory) {
    for (const [key, mem] of this.workingSet) {
      if (mem === memory) return key;
    }
    for (const [key, mem] of this.longTermMemory) {
      if (mem === memory) return key;
    }
    return null;
  }

  async addLearning(learning, metadata = {}) {
    const learningEntry = {
      content: learning,
      timestamp: Date.now(),
      importance: metadata.importance || 'medium',
      category: metadata.category || 'general',
      tags: metadata.tags || [],
      ...metadata
    };

    this.learnings.push(learningEntry);
    await this.saveMemoryState();

    console.log(`📚 Learning added: ${learning.substring(0, 50)}...`);
  }

  async addDecision(decision, context, outcome = null) {
    const decisionEntry = {
      decision,
      context,
      outcome,
      timestamp: Date.now(),
      importance: 'high'
    };

    this.decisions.push(decisionEntry);
    await this.addMemory(`decision_${Date.now()}`, decisionEntry, {
      priority: 0.8,
      tags: ['decision'],
      source: 'decision_tracker'
    });

    console.log(`⚖️  Decision recorded: ${decision.substring(0, 50)}...`);
  }

  async updateContextFile() {
    const contextFile = path.join(this.memoryDir, 'context.json');
    
    // Generate current context summary
    const context = {
      generatedAt: Date.now(),
      projectState: await this.getProjectState(),
      recentMemories: this.getRecentMemories(),
      topPriorities: this.getTopPriorities(),
      keyLearnings: this.getKeyLearnings(),
      importantDecisions: this.getImportantDecisions(),
      systemStats: this.getSystemStats()
    };

    await fs.writeFile(contextFile, JSON.stringify(context, null, 2));

    // Update CLAUDE.md
    await this.updateClaudeInstructions(context);

    console.log('📝 Context file updated');
  }

  async getProjectState() {
    try {
      const timelineFile = path.join(this.nexusDir, 'timeline', 'events.jsonl');
      const timelineData = await fs.readFile(timelineFile, 'utf8');
      const events = timelineData.trim().split('\n').map(line => JSON.parse(line));
      
      const recentEvents = events.slice(-10);
      const fileCount = new Set(events.map(e => e.file)).size;
      
      return {
        recentActivity: recentEvents,
        trackedFiles: fileCount,
        totalEvents: events.length,
        lastActivity: events[events.length - 1]?.timestamp
      };
    } catch (error) {
      return { error: 'Could not read project state' };
    }
  }

  getRecentMemories(limit = 10) {
    return Array.from(this.workingSet.entries())
      .sort(([, a], [, b]) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(([key, memory]) => ({
        key,
        content: memory.content.substring(0, 200),
        timestamp: memory.timestamp,
        priority: this.getPriority(memory)
      }));
  }

  getTopPriorities(limit = 5) {
    return Array.from(this.priorities.entries())
      .sort(([, a], [, b]) => b.value - a.value)
      .slice(0, limit)
      .map(([key, priority]) => ({
        key,
        priority: priority.value,
        memory: this.workingSet.get(key) || this.longTermMemory.get(key)
      }))
      .filter(item => item.memory);
  }

  getKeyLearnings(limit = 5) {
    return this.learnings
      .sort((a, b) => {
        const importanceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return importanceOrder[b.importance] - importanceOrder[a.importance];
      })
      .slice(0, limit);
  }

  getImportantDecisions(limit = 3) {
    return this.decisions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getSystemStats() {
    return {
      workingSetSize: this.workingSet.size,
      longTermSize: this.longTermMemory.size,
      totalPriorities: this.priorities.size,
      totalLearnings: this.learnings.length,
      totalDecisions: this.decisions.length
    };
  }

  async updateClaudeInstructions(context) {
    const claudeFile = path.join(this.projectRoot, 'CLAUDE.md');
    
    const instructions = `# 🧠 Nexus AI Memory System - Current Context

**Generated**: ${new Date(context.generatedAt).toISOString()}

## 📊 Project Status

**Files Tracked**: ${context.projectState.trackedFiles || 'Unknown'}
**Total Events**: ${context.projectState.totalEvents || 0}
**Last Activity**: ${context.projectState.lastActivity ? new Date(context.projectState.lastActivity).toISOString() : 'None'}

## 🔥 High Priority Items

${context.topPriorities.map(item => 
  `- **${item.key}** (Priority: ${(item.priority * 100).toFixed(1)}%)`
).join('\n')}

## 📚 Key Learnings

${context.keyLearnings.map(learning => 
  `- **[${learning.importance.toUpperCase()}]** ${learning.content}`
).join('\n')}

## ⚖️ Recent Decisions

${context.importantDecisions.map(decision => 
  `- **${new Date(decision.timestamp).toISOString().split('T')[0]}**: ${decision.decision}`
).join('\n')}

## 🔄 Recent Activity

${context.projectState.recentActivity?.map(event => 
  `- ${new Date(event.timestamp).toISOString().split('T')[0]} - ${event.type}: ${event.file}`
).join('\n') || 'No recent activity'}

## 🎯 System Instructions

This project uses the Nexus AI Everlasting Memory System. Key capabilities:

1. **Persistent Context**: All conversations and changes are tracked
2. **File Versioning**: Every file change is saved with complete history
3. **Time Travel**: Any file can be restored to any previous version
4. **Memory Consolidation**: Important information is preserved across sessions
5. **Learning Accumulation**: Knowledge builds up over time

### Available Commands:
- \`nexus-memory status\` - Check system health
- \`nexus-memory timeline\` - View change history
- \`nexus-memory restore <file>\` - Restore file versions
- \`nexus-memory memory context\` - Update this context

### Current Memory Stats:
- Working Set: ${context.systemStats.workingSetSize} items
- Long-term Memory: ${context.systemStats.longTermSize} items
- Total Learnings: ${context.systemStats.totalLearnings}
- Total Decisions: ${context.systemStats.totalDecisions}

---
*This file is automatically updated by the Nexus AI Memory System*
`;

    await fs.writeFile(claudeFile, instructions);
  }

  formatLearnings() {
    return `# Accumulated Learnings

${this.learnings.map(learning => 
  `## ${new Date(learning.timestamp).toISOString().split('T')[0]} - ${learning.category}

**Importance**: ${learning.importance.toUpperCase()}
**Tags**: ${learning.tags.join(', ')}

${learning.content}

---
`).join('\n')}`;
  }

  parseLearnings(content) {
    // Simple parsing - in production this would be more sophisticated
    const learnings = [];
    const sections = content.split('---').filter(s => s.trim());
    
    for (const section of sections) {
      const lines = section.trim().split('\n');
      if (lines.length > 0) {
        learnings.push({
          content: section.trim(),
          timestamp: Date.now(),
          importance: 'medium',
          category: 'general'
        });
      }
    }
    
    return learnings;
  }

  async createSnapshot() {
    const snapshotFile = path.join(
      this.memoryDir, 
      'snapshots', 
      `memory-${Date.now()}.json`
    );

    const snapshot = {
      timestamp: Date.now(),
      workingSet: Object.fromEntries(this.workingSet),
      longTermMemory: Object.fromEntries(this.longTermMemory),
      priorities: Object.fromEntries(this.priorities),
      stats: this.getSystemStats()
    };

    await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));
  }

  async getStatus() {
    return {
      memoryStats: this.getSystemStats(),
      lastConsolidation: await this.getLastConsolidationTime(),
      contextGenerated: await this.getContextTime()
    };
  }

  async getLastConsolidationTime() {
    try {
      const snapshots = await fs.readdir(path.join(this.memoryDir, 'snapshots'));
      if (snapshots.length === 0) return null;
      
      const latest = snapshots.sort().pop();
      const timestamp = latest.match(/memory-(\d+)\.json/)?.[1];
      return timestamp ? parseInt(timestamp) : null;
    } catch {
      return null;
    }
  }

  async getContextTime() {
    try {
      const contextFile = path.join(this.memoryDir, 'context.json');
      const stats = await fs.stat(contextFile);
      return stats.mtime.getTime();
    } catch {
      return null;
    }
  }
}

module.exports = MemoryConsolidator;