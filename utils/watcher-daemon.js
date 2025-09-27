/**
 * Nexus Watcher Daemon Manager
 * Manages the background file watcher process
 */

const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('./logger');

class WatcherDaemon {
    constructor(options = {}) {
        this.logger = new Logger('WatcherDaemon');
        
        this.config = {
            projectPath: options.projectPath || process.cwd(),
            pidFile: options.pidFile || path.join(process.cwd(), '.nexus', 'watcher.pid'),
            logFile: options.logFile || path.join(process.cwd(), '.nexus', 'watcher.log'),
            watcherScript: options.watcherScript || path.join(__dirname, '..', 'bin', 'nclaude-timeline.js')
        };
        
        this.process = null;
    }
    
    /**
     * Check if watcher is currently running
     */
    async isRunning() {
        try {
            if (!await fs.pathExists(this.config.pidFile)) {
                return false;
            }
            
            const pid = parseInt(await fs.readFile(this.config.pidFile, 'utf8'));
            
            if (!pid) {
                return false;
            }
            
            // Check if process exists
            try {
                process.kill(pid, 0); // Signal 0 checks if process exists
                return true;
            } catch (error) {
                // Process doesn't exist
                await this.cleanupPidFile();
                return false;
            }
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Start the watcher daemon
     */
    async start(options = {}) {
        const { silent = false, restart = false } = options;
        
        // Check if already running
        const running = await this.isRunning();
        if (running && !restart) {
            if (!silent) {
                this.logger.info('Watcher is already running');
            }
            return true;
        }
        
        if (restart) {
            await this.stop();
        }
        
        try {
            // Ensure directories exist
            await fs.ensureDir(path.dirname(this.config.pidFile));
            await fs.ensureDir(path.dirname(this.config.logFile));
            
            // Start the watcher process
            const child = spawn('node', [this.config.watcherScript, 'watch'], {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                cwd: this.config.projectPath,
                env: { ...process.env, NEXUS_DAEMON: '1' }
            });
            
            // Save PID immediately before any async operations
            await fs.writeFile(this.config.pidFile, child.pid.toString());
            
            // Set up logging
            const logStream = fs.createWriteStream(this.config.logFile, { flags: 'a' });
            
            child.stdout.on('data', (data) => {
                logStream.write(`[${new Date().toISOString()}] STDOUT: ${data}`);
            });
            
            child.stderr.on('data', (data) => {
                logStream.write(`[${new Date().toISOString()}] STDERR: ${data}`);
            });
            
            child.on('exit', async (code, signal) => {
                logStream.write(`[${new Date().toISOString()}] Process exited with code ${code}, signal ${signal}\n`);
                logStream.end();
                await this.cleanupPidFile();
            });
            
            child.on('error', (error) => {
                this.logger.error('Failed to start watcher:', error);
                logStream.write(`[${new Date().toISOString()}] ERROR: ${error.message}\n`);
                logStream.end();
            });
            
            // Detach the process so it runs independently
            child.unref();
            
            // Wait a moment to see if it starts successfully
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify the PID file exists
            if (!await fs.pathExists(this.config.pidFile)) {
                this.logger.warn('PID file was not created, writing it manually');
                await fs.writeFile(this.config.pidFile, child.pid.toString());
            }
            
            const stillRunning = await this.isRunning();
            if (stillRunning) {
                if (!silent) {
                    this.logger.info(`✅ Watcher daemon started (PID: ${child.pid})`);
                    this.logger.info(`📝 Logs: ${this.config.logFile}`);
                }
                return true;
            } else {
                throw new Error('Watcher failed to start');
            }
            
        } catch (error) {
            this.logger.error('Failed to start watcher daemon:', error);
            return false;
        }
    }
    
    /**
     * Stop the watcher daemon
     */
    async stop(options = {}) {
        const { silent = false } = options;
        
        try {
            if (!await fs.pathExists(this.config.pidFile)) {
                if (!silent) {
                    this.logger.info('Watcher is not running');
                }
                return true;
            }
            
            const pid = parseInt(await fs.readFile(this.config.pidFile, 'utf8'));
            
            if (!pid) {
                await this.cleanupPidFile();
                return true;
            }
            
            // Try to kill the process
            try {
                process.kill(pid, 'SIGTERM');
                
                // Wait for process to exit
                let attempts = 0;
                while (attempts < 10) {
                    try {
                        process.kill(pid, 0);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        attempts++;
                    } catch (error) {
                        // Process is gone
                        break;
                    }
                }
                
                // If still running, force kill
                try {
                    process.kill(pid, 0);
                    process.kill(pid, 'SIGKILL');
                } catch (error) {
                    // Process is gone
                }
                
                await this.cleanupPidFile();
                
                if (!silent) {
                    this.logger.info('✅ Watcher daemon stopped');
                }
                return true;
                
            } catch (error) {
                if (error.code === 'ESRCH') {
                    // Process doesn't exist
                    await this.cleanupPidFile();
                    return true;
                }
                throw error;
            }
            
        } catch (error) {
            this.logger.error('Failed to stop watcher daemon:', error);
            return false;
        }
    }
    
    /**
     * Restart the watcher daemon
     */
    async restart(options = {}) {
        const { silent = false } = options;
        
        if (!silent) {
            this.logger.info('🔄 Restarting watcher daemon...');
        }
        
        await this.stop({ silent: true });
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await this.start({ silent });
    }
    
    /**
     * Get watcher status
     */
    async getStatus() {
        const running = await this.isRunning();
        
        let pid = null;
        let uptime = null;
        
        if (running) {
            try {
                pid = parseInt(await fs.readFile(this.config.pidFile, 'utf8'));
                
                // Get process start time (approximate)
                if (await fs.pathExists(this.config.pidFile)) {
                    const stats = await fs.stat(this.config.pidFile);
                    uptime = Date.now() - stats.mtime.getTime();
                }
            } catch (error) {
                // Ignore errors
            }
        }
        
        return {
            running,
            pid,
            uptime,
            pidFile: this.config.pidFile,
            logFile: this.config.logFile
        };
    }
    
    /**
     * Get recent log entries
     */
    async getLogs(lines = 50) {
        try {
            if (!await fs.pathExists(this.config.logFile)) {
                return [];
            }
            
            const content = await fs.readFile(this.config.logFile, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            
            return logLines.slice(-lines);
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Clean up PID file
     */
    async cleanupPidFile() {
        try {
            await fs.remove(this.config.pidFile);
        } catch (error) {
            // Ignore errors
        }
    }
    
    /**
     * Auto-start watcher on system events
     */
    setupAutoStart() {
        // Handle process exit
        process.on('exit', () => {
            // Don't stop daemon on main process exit
        });
        
        process.on('SIGINT', () => {
            // Allow daemon to continue running
        });
        
        process.on('SIGTERM', () => {
            // Allow daemon to continue running
        });
    }
}

module.exports = WatcherDaemon;

// CLI usage
if (require.main === module) {
    const daemon = new WatcherDaemon();
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            daemon.start().then(success => {
                process.exit(success ? 0 : 1);
            });
            break;
            
        case 'stop':
            daemon.stop().then(success => {
                process.exit(success ? 0 : 1);
            });
            break;
            
        case 'restart':
            daemon.restart().then(success => {
                process.exit(success ? 0 : 1);
            });
            break;
            
        case 'status':
            daemon.getStatus().then(status => {
                if (status.running) {
                    console.log(`✅ Watcher is running (PID: ${status.pid})`);
                    if (status.uptime) {
                        const hours = Math.floor(status.uptime / (1000 * 60 * 60));
                        const minutes = Math.floor((status.uptime % (1000 * 60 * 60)) / (1000 * 60));
                        console.log(`⏱️ Uptime: ${hours}h ${minutes}m`);
                    }
                } else {
                    console.log('❌ Watcher is not running');
                }
                process.exit(0);
            });
            break;
            
        case 'logs':
            daemon.getLogs(100).then(logs => {
                logs.forEach(line => console.log(line));
                process.exit(0);
            });
            break;
            
        default:
            console.log('Usage: node watcher-daemon.js <start|stop|restart|status|logs>');
            process.exit(1);
    }
}