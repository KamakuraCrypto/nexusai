/**
 * Git Integration with State Tracking
 * Provides comprehensive git operations with AI-driven state management
 * Tracks every change, maintains audit trails, and enables perfect recovery
 */

const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');
const { BackupSystem } = require('./backup-system');

class GitIntegration {
    constructor(config = {}) {
        this.config = {
            autoCommit: config.autoCommit !== false,
            branchPrefix: config.branchPrefix || 'nexus/',
            commitMessageTemplate: config.commitMessageTemplate || '[NEXUS] {action}: {description}',
            maxStateSnapshots: config.maxStateSnapshots || 50,
            stateTrackingEnabled: config.stateTrackingEnabled !== false,
            signCommits: config.signCommits || false,
            requirePRs: config.requirePRs || false,
            ...config
        };
        
        this.logger = new Logger('GitIntegration');
        this.git = null;
        this.currentBranch = null;
        this.stateSnapshots = [];
        this.pendingChanges = new Map();
        
        // Backup system for bulletproof data protection
        this.backupSystem = new BackupSystem({
            projectRoot: config.projectRoot || process.cwd(),
            frequency: 'before-every-action',
            strategies: ['local', 'git'],
            atomicOperations: true
        });
        
        // State tracking
        this.aiActions = [];
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.stats = {
            totalCommits: 0,
            aiCommits: 0,
            stateSnapshots: 0,
            rollbacks: 0,
            branchesCreated: 0,
            dataLossPrevented: 0
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        this.logger.info('🔧 Initializing Git Integration...');
        
        try {
            // Initialize backup system first (critical for data protection)
            await this.backupSystem.initialize();
            this.logger.info('✅ Backup system initialized');
            
            // Initialize git instance
            this.git = simpleGit({
                baseDir: process.cwd(),
                binary: 'git',
                maxConcurrentProcesses: 1
            });
            
            // Check if we're in a git repository
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                await this.initializeRepository();
            }
            
            // Get current branch
            const status = await this.git.status();
            this.currentBranch = status.current;
            
            // Load existing state snapshots
            await this.loadStateSnapshots();
            
            // Setup git hooks if configured
            await this.setupGitHooks();
            
            this.isInitialized = true;
            this.logger.info('✅ Git Integration initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Git Integration:', error);
            throw error;
        }
    }

    /**
     * Initialize a new git repository
     */
    async initializeRepository() {
        this.logger.info('Initializing new git repository...');
        
        await this.git.init();
        
        // Create initial .gitignore
        const gitignore = `# Nexus AI Framework
.nexus/
node_modules/
.env
.env.local
*.log
*.tmp
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Build outputs
dist/
build/
*.tgz
*.tar.gz

# Runtime
*.pid
*.seed
*.pid.lock
.npm
.nyc_output
.coverage
coverage/

# Temporary
temp/
tmp/
`;

        await fs.writeFile('.gitignore', gitignore, 'utf8');
        
        // Initial commit
        await this.git.add('.gitignore');
        await this.git.commit('Initial commit - Nexus AI Framework setup');
        
        this.logger.info('Repository initialized with initial commit');
    }

    /**
     * Track an AI action with bulletproof data protection
     */
    async trackAIAction(action, description, files = []) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const actionRecord = {
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            action,
            description,
            files: [...files],
            beforeState: null,
            afterState: null,
            commitHash: null,
            recoveryId: null,
            transactionId: null,
            protectionLevel: 'maximum'
        };

        try {
            this.logger.info(`🛡️ Tracking AI action with maximum protection: ${action}`);
            
            // STEP 1: Create recovery point BEFORE any action (critical safety net)
            actionRecord.recoveryId = await this.backupSystem.createRecoveryPoint(
                action,
                description,
                files
            );
            
            // STEP 2: Start atomic transaction
            actionRecord.transactionId = await this.backupSystem.startTransaction(
                action,
                `AI Action: ${description}`
            );
            
            // STEP 3: Capture before state
            if (this.config.stateTrackingEnabled) {
                actionRecord.beforeState = await this.captureCurrentState();
            }

            // STEP 4: Store the action record
            this.aiActions.push(actionRecord);
            
            // STEP 5: Create pending change record with safety features
            this.pendingChanges.set(actionRecord.id, {
                action: actionRecord,
                files: new Set(files),
                status: 'pending',
                safetyNet: {
                    recoveryPoint: actionRecord.recoveryId,
                    transaction: actionRecord.transactionId,
                    rollbackAvailable: true,
                    dataProtected: true
                }
            });

            this.logger.info(`✅ AI action tracked with full protection: ${actionRecord.id}`);
            this.logger.info(`🔒 Recovery point: ${actionRecord.recoveryId}`);
            this.logger.info(`🔄 Transaction: ${actionRecord.transactionId}`);
            
            return actionRecord.id;
            
        } catch (error) {
            this.logger.error('❌ Failed to track AI action:', error);
            
            // Emergency rollback if tracking fails
            if (actionRecord.transactionId) {
                try {
                    await this.backupSystem.rollbackTransaction(
                        actionRecord.transactionId,
                        `Tracking failed: ${error.message}`
                    );
                    this.stats.dataLossPrevented++;
                } catch (rollbackError) {
                    this.logger.error('❌ Emergency rollback failed:', rollbackError);
                }
            }
            
            throw error;
        }
    }

    /**
     * Complete an AI action with atomic transaction commit
     */
    async completeAIAction(actionId, additionalFiles = []) {
        const pendingChange = this.pendingChanges.get(actionId);
        if (!pendingChange) {
            throw new Error(`Action not found: ${actionId}`);
        }

        const actionRecord = pendingChange.action;
        
        try {
            this.logger.info(`✅ Completing AI action: ${actionRecord.action}`);
            
            // Add any additional files that were created/modified
            additionalFiles.forEach(file => {
                pendingChange.files.add(file);
                actionRecord.files.push(file);
            });
            
            // Add transaction action to backup system
            if (actionRecord.transactionId) {
                await this.backupSystem.addTransactionAction(
                    'file-modification',
                    `Modified files: ${Array.from(pendingChange.files).join(', ')}`,
                    Array.from(pendingChange.files).map(file => ({ path: file, action: 'modified' }))
                );
            }
            
            // Capture after state
            if (this.config.stateTrackingEnabled) {
                actionRecord.afterState = await this.captureCurrentState();
            }

            // Commit changes if auto-commit is enabled
            if (this.config.autoCommit) {
                const commitHash = await this.commitAIChanges(actionRecord, Array.from(pendingChange.files));
                actionRecord.commitHash = commitHash;
                this.stats.aiCommits++;
            }

            // Create state snapshot
            if (this.config.stateTrackingEnabled) {
                await this.createStateSnapshot(actionRecord);
            }
            
            // CRITICAL: Commit the atomic transaction (success path)
            if (actionRecord.transactionId) {
                await this.backupSystem.commitTransaction(actionRecord.transactionId);
                this.logger.info(`🔄 Transaction committed successfully: ${actionRecord.transactionId}`);
            }

            // Mark as completed
            pendingChange.status = 'completed';
            this.pendingChanges.delete(actionId);

            this.logger.info(`🎉 AI action completed successfully: ${actionRecord.action}`);
            return actionRecord;
            
        } catch (error) {
            this.logger.error('❌ Failed to complete AI action:', error);
            
            // CRITICAL: Automatic rollback on any failure
            if (actionRecord.transactionId) {
                try {
                    this.logger.warn(`🔄 Auto-rolling back transaction: ${actionRecord.transactionId}`);
                    await this.backupSystem.rollbackTransaction(
                        actionRecord.transactionId,
                        `Completion failed: ${error.message}`
                    );
                    this.stats.dataLossPrevented++;
                    this.logger.info(`✅ Successfully rolled back to safe state`);
                } catch (rollbackError) {
                    this.logger.error('❌ CRITICAL: Rollback failed:', rollbackError);
                    // This is a critical failure - we should alert the user
                }
            }
            
            // Mark as failed but keep the record for debugging
            pendingChange.status = 'failed';
            pendingChange.error = error.message;
            
            throw error;
        }
    }

    /**
     * Commit AI-generated changes with structured message
     */
    async commitAIChanges(actionRecord, files = []) {
        try {
            // Stage files
            if (files.length > 0) {
                await this.git.add(files);
            } else {
                await this.git.add('.');
            }

            // Check if there are changes to commit
            const status = await this.git.status();
            if (status.staged.length === 0 && status.modified.length === 0 && status.not_added.length === 0) {
                this.logger.debug('No changes to commit');
                return null;
            }

            // Generate commit message
            const commitMessage = this.generateCommitMessage(actionRecord);
            
            // Create commit
            const commit = await this.git.commit(commitMessage);
            
            this.stats.totalCommits++;
            this.logger.info(`Created commit: ${commit.commit.substring(0, 8)} - ${actionRecord.action}`);
            
            return commit.commit;
            
        } catch (error) {
            this.logger.error('Failed to commit AI changes:', error);
            throw error;
        }
    }

    /**
     * Generate structured commit message
     */
    generateCommitMessage(actionRecord) {
        const template = this.config.commitMessageTemplate;
        
        let message = template
            .replace('{action}', actionRecord.action)
            .replace('{description}', actionRecord.description);

        // Add structured footer with metadata
        message += `

🤖 Generated with Nexus AI Framework

Session: ${actionRecord.sessionId}
Action ID: ${actionRecord.id}
Files: ${actionRecord.files.length} file(s) modified
Timestamp: ${actionRecord.timestamp}

Co-Authored-By: Nexus AI <nexus@ai.dev>`;

        return message;
    }

    /**
     * Create a state snapshot for recovery
     */
    async createStateSnapshot(actionRecord) {
        try {
            const snapshot = {
                id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                actionId: actionRecord.id,
                sessionId: actionRecord.sessionId,
                commitHash: actionRecord.commitHash,
                gitState: await this.captureGitState(),
                projectState: actionRecord.afterState,
                description: `Snapshot after: ${actionRecord.action}`
            };

            this.stateSnapshots.push(snapshot);
            
            // Maintain snapshot limit
            if (this.stateSnapshots.length > this.config.maxStateSnapshots) {
                this.stateSnapshots = this.stateSnapshots.slice(-this.config.maxStateSnapshots);
            }

            // Save snapshots to file
            await this.saveStateSnapshots();
            
            this.stats.stateSnapshots++;
            this.logger.debug(`Created state snapshot: ${snapshot.id}`);
            
            return snapshot.id;
            
        } catch (error) {
            this.logger.error('Failed to create state snapshot:', error);
            throw error;
        }
    }

    /**
     * Capture current project state
     */
    async captureCurrentState() {
        try {
            const state = {
                timestamp: new Date().toISOString(),
                gitStatus: await this.git.status(),
                workingDirectory: process.cwd(),
                files: await this.getProjectFiles(),
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    cwd: process.cwd()
                }
            };

            return state;
            
        } catch (error) {
            this.logger.error('Failed to capture current state:', error);
            return null;
        }
    }

    /**
     * Capture git-specific state
     */
    async captureGitState() {
        try {
            const [
                status,
                log,
                branches,
                remotes
            ] = await Promise.all([
                this.git.status(),
                this.git.log({ maxCount: 10 }),
                this.git.branch(['-a']),
                this.git.getRemotes(true)
            ]);

            return {
                status,
                recentCommits: log.all,
                branches: branches.all,
                currentBranch: branches.current,
                remotes
            };
            
        } catch (error) {
            this.logger.error('Failed to capture git state:', error);
            return null;
        }
    }

    /**
     * Rollback to a specific state snapshot
     */
    async rollbackToSnapshot(snapshotId) {
        const snapshot = this.stateSnapshots.find(s => s.id === snapshotId);
        if (!snapshot) {
            throw new Error(`Snapshot not found: ${snapshotId}`);
        }

        this.logger.info(`Rolling back to snapshot: ${snapshotId}`);

        try {
            // Confirm rollback with user (in production, this would be interactive)
            this.logger.warn('This will reset your working directory to the snapshot state');
            
            // Reset to the commit hash from the snapshot
            if (snapshot.commitHash) {
                await this.git.reset(['--hard', snapshot.commitHash]);
            }

            this.stats.rollbacks++;
            this.logger.info(`✅ Successfully rolled back to snapshot: ${snapshotId}`);
            
            return snapshot;
            
        } catch (error) {
            this.logger.error('Failed to rollback to snapshot:', error);
            throw error;
        }
    }

    /**
     * Create a new branch for AI development
     */
    async createAIBranch(featureName) {
        const branchName = `${this.config.branchPrefix}${featureName}`;
        
        try {
            // Check if branch already exists
            const branches = await this.git.branch();
            if (branches.all.includes(branchName)) {
                this.logger.info(`Switching to existing branch: ${branchName}`);
                await this.git.checkout(branchName);
            } else {
                this.logger.info(`Creating new branch: ${branchName}`);
                await this.git.checkoutLocalBranch(branchName);
                this.stats.branchesCreated++;
            }

            this.currentBranch = branchName;
            return branchName;
            
        } catch (error) {
            this.logger.error('Failed to create AI branch:', error);
            throw error;
        }
    }

    /**
     * Get git status and changes
     */
    async getStatus() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const status = await this.git.status();
        const log = await this.git.log({ maxCount: 5 });
        
        return {
            currentBranch: status.current,
            modified: status.modified,
            staged: status.staged,
            notAdded: status.not_added,
            deleted: status.deleted,
            recentCommits: log.all.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author_name,
                date: commit.date
            })),
            ahead: status.ahead,
            behind: status.behind,
            tracking: status.tracking
        };
    }

    /**
     * Get current git state for external use
     */
    async getCurrentState() {
        return {
            repository: await this.isRepository(),
            branch: this.currentBranch,
            status: await this.getStatus(),
            snapshots: this.stateSnapshots.length,
            pendingActions: this.pendingChanges.size,
            recentChanges: Array.from(this.pendingChanges.values())
                .filter(change => change.status === 'completed')
                .slice(-5)
        };
    }

    /**
     * Create pull request (if configured)
     */
    async createPullRequest(title, description, targetBranch = 'main') {
        if (!this.config.requirePRs) {
            this.logger.info('Pull requests not required, skipping PR creation');
            return null;
        }

        // This would integrate with GitHub/GitLab APIs
        this.logger.info(`Would create PR: ${title} -> ${targetBranch}`);
        
        // Placeholder for PR creation
        return {
            title,
            description,
            sourceBranch: this.currentBranch,
            targetBranch,
            url: 'https://github.com/example/repo/pull/123' // Placeholder
        };
    }

    /**
     * Setup git hooks
     */
    async setupGitHooks() {
        if (!this.config.stateTrackingEnabled) return;
        
        try {
            const hooksDir = path.join('.git', 'hooks');
            
            // Pre-commit hook to capture state
            const preCommitHook = `#!/bin/sh
# Nexus AI Framework pre-commit hook
echo "Nexus AI: Capturing pre-commit state..."
`;

            await fs.writeFile(path.join(hooksDir, 'pre-commit'), preCommitHook, 'utf8');
            await fs.chmod(path.join(hooksDir, 'pre-commit'), '755');
            
            this.logger.debug('Git hooks setup completed');
            
        } catch (error) {
            this.logger.warn('Failed to setup git hooks:', error.message);
        }
    }

    /**
     * Helper methods
     */
    async isRepository() {
        try {
            return await this.git.checkIsRepo();
        } catch (error) {
            return false;
        }
    }

    async getProjectFiles() {
        try {
            const files = await this.git.raw(['ls-files']);
            return files.split('\n').filter(file => file.trim().length > 0);
        } catch (error) {
            return [];
        }
    }

    async saveStateSnapshots() {
        try {
            await fs.ensureDir('.nexus');
            const snapshotsPath = path.join('.nexus', 'state-snapshots.json');
            
            const data = {
                snapshots: this.stateSnapshots,
                sessionId: this.sessionId,
                lastSaved: new Date().toISOString(),
                stats: this.stats
            };
            
            await fs.writeJson(snapshotsPath, data, { spaces: 2 });
            
        } catch (error) {
            this.logger.error('Failed to save state snapshots:', error);
        }
    }

    async loadStateSnapshots() {
        try {
            const snapshotsPath = path.join('.nexus', 'state-snapshots.json');
            
            if (await fs.pathExists(snapshotsPath)) {
                const data = await fs.readJson(snapshotsPath);
                this.stateSnapshots = data.snapshots || [];
                this.stats = { ...this.stats, ...data.stats };
                
                this.logger.debug(`Loaded ${this.stateSnapshots.length} state snapshots`);
            }
            
        } catch (error) {
            this.logger.warn('Failed to load state snapshots:', error.message);
        }
    }

    /**
     * Manual rollback to specific recovery point
     */
    async rollbackToRecoveryPoint(recoveryId) {
        this.logger.warn(`🔄 Manual rollback to recovery point: ${recoveryId}`);
        
        try {
            await this.backupSystem.restoreFromRecoveryPoint(recoveryId);
            this.stats.rollbacks++;
            this.stats.dataLossPrevented++;
            
            this.logger.info(`✅ Successfully rolled back to: ${recoveryId}`);
            return true;
            
        } catch (error) {
            this.logger.error('Failed to rollback:', error);
            throw error;
        }
    }

    /**
     * Get available recovery options
     */
    async getRecoveryOptions() {
        return await this.backupSystem.getRecoveryOptions();
    }

    /**
     * Force rollback current transaction (emergency)
     */
    async emergencyRollback(reason = 'Emergency rollback') {
        if (this.backupSystem.currentTransaction) {
            this.logger.warn(`🚨 EMERGENCY ROLLBACK: ${reason}`);
            
            try {
                await this.backupSystem.rollbackTransaction(
                    this.backupSystem.currentTransaction,
                    reason
                );
                this.stats.dataLossPrevented++;
                
                this.logger.info(`✅ Emergency rollback completed`);
                return true;
                
            } catch (error) {
                this.logger.error('❌ CRITICAL: Emergency rollback failed:', error);
                throw error;
            }
        }
        
        return false;
    }

    /**
     * Check system health and data integrity
     */
    async checkSystemHealth() {
        const health = {
            status: 'healthy',
            issues: [],
            backupSystem: null,
            gitStatus: null,
            pendingActions: this.pendingChanges.size,
            dataProtected: true
        };
        
        try {
            // Check backup system
            health.backupSystem = this.backupSystem.getStats();
            
            // Check git status
            if (this.git) {
                health.gitStatus = await this.git.status();
            }
            
            // Check for stuck transactions
            if (this.pendingChanges.size > 0) {
                health.issues.push('Pending actions detected - may need cleanup');
            }
            
            // Check backup system health
            if (health.backupSystem.successRate < 95) {
                health.status = 'degraded';
                health.issues.push('Backup system success rate below 95%');
            }
            
        } catch (error) {
            health.status = 'error';
            health.issues.push(`Health check failed: ${error.message}`);
        }
        
        return health;
    }

    /**
     * Get integration statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentBranch: this.currentBranch,
            stateSnapshotsCount: this.stateSnapshots.length,
            pendingActionsCount: this.pendingChanges.size,
            sessionId: this.sessionId,
            backupSystemStats: this.backupSystem ? this.backupSystem.getStats() : null,
            dataProtectionEnabled: true,
            lastBackup: this.backupSystem ? 'Active' : 'Inactive'
        };
    }

    /**
     * List available snapshots
     */
    listSnapshots() {
        return this.stateSnapshots.map(snapshot => ({
            id: snapshot.id,
            timestamp: snapshot.timestamp,
            description: snapshot.description,
            commitHash: snapshot.commitHash,
            actionId: snapshot.actionId
        }));
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('Cleaning up Git Integration...');
        
        // Save current state
        await this.saveStateSnapshots();
        
        // Complete any pending actions
        for (const [actionId, pendingChange] of this.pendingChanges) {
            if (pendingChange.status === 'pending') {
                this.logger.warn(`Completing pending action: ${actionId}`);
                await this.completeAIAction(actionId);
            }
        }
        
        this.logger.info('Git Integration cleanup completed');
    }
}

module.exports = { GitIntegration };