/**
 * Simple Logging Utility for Nexus AI Claude
 */

const fs = require('fs-extra');
const path = require('path');

// Use local colors utility for consistency
const chalk = require('./colors');

class Logger {
    constructor(component = 'Nexus', options = {}) {
        this.component = component;
        this.options = {
            level: options.level || process.env.LOG_LEVEL || 'info',
            colorize: options.colorize !== false,
            includeTimestamp: options.includeTimestamp !== false
        };
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            verbose: 4
        };
    }
    
    log(level, message, ...args) {
        const levelNum = this.levels[level] || 2;
        const configLevel = this.levels[this.options.level] || 2;
        
        if (levelNum > configLevel) return;
        
        const timestamp = this.options.includeTimestamp 
            ? new Date().toISOString() 
            : '';
            
        const prefix = timestamp ? `[${timestamp}] ` : '';
        const componentStr = `[${this.component}]`;
        
        let color = (str) => str;
        if (this.options.colorize) {
            switch(level) {
                case 'error': color = chalk.red; break;
                case 'warn': color = chalk.yellow; break;
                case 'info': color = chalk.blue; break;
                case 'debug': color = chalk.gray; break;
                case 'verbose': color = chalk.gray; break;
            }
        }
        
        const output = `${prefix}${color(componentStr)} ${message}`;
        
        if (level === 'error') {
            console.error(output, ...args);
        } else {
            console.log(output, ...args);
        }
    }
    
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
    
    verbose(message, ...args) {
        this.log('verbose', message, ...args);
    }
    
    success(message, ...args) {
        if (this.options.colorize) {
            console.log(chalk.green(`✓ ${message}`), ...args);
        } else {
            console.log(`✓ ${message}`, ...args);
        }
    }
    
    startSpinner(message) {
        console.log(`⏳ ${message}...`);
        return {
            succeed: (msg) => console.log(chalk.green(`✓ ${msg || message}`)),
            fail: (msg) => console.log(chalk.red(`✗ ${msg || message}`)),
            stop: () => {}
        };
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = {
    Logger,
    logger,
    createLogger: (component, options) => new Logger(component, options)
};