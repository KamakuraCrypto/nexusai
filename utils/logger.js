/**
 * Advanced Logging Utility
 * Provides structured, colorized logging with different levels
 * Supports file output, filtering, and performance tracking
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const winston = require('winston');

class Logger {
    constructor(component = 'Nexus', options = {}) {
        this.component = component;
        this.options = {
            level: options.level || process.env.LOG_LEVEL || 'info',
            writeToFile: options.writeToFile !== false,
            colorize: options.colorize !== false,
            includeTimestamp: options.includeTimestamp !== false,
            maxFileSize: options.maxFileSize || '10m',
            maxFiles: options.maxFiles || 5,
            logDir: options.logDir || '.nexus/logs',
            ...options
        };

        this.winston = null;
        this.initializeWinston();
        
        // Performance tracking
        this.timers = new Map();
        this.counters = new Map();
        
        // Log levels with colors
        this.levels = {
            error: { priority: 0, color: chalk.red, symbol: '❌' },
            warn: { priority: 1, color: chalk.yellow, symbol: '⚠️' },
            info: { priority: 2, color: chalk.blue, symbol: 'ℹ️' },
            debug: { priority: 3, color: chalk.gray, symbol: '🔍' },
            verbose: { priority: 4, color: chalk.cyan, symbol: '📝' },
            trace: { priority: 5, color: chalk.magenta, symbol: '🔬' }
        };
        
        this.currentLevel = this.levels[this.options.level]?.priority || 2;
    }

    initializeWinston() {
        try {
            // Ensure log directory exists
            if (this.options.writeToFile) {
                fs.ensureDirSync(this.options.logDir);
            }

            // Winston transports
            const transports = [];

            // Console transport
            transports.push(new winston.transports.Console({
                level: this.options.level,
                format: winston.format.combine(
                    winston.format.colorize({ all: true }),
                    winston.format.printf(({ timestamp, level, message, component }) => {
                        const ts = this.options.includeTimestamp ? `[${timestamp}] ` : '';
                        const comp = component ? `[${component}] ` : '';
                        return `${ts}${comp}${message}`;
                    })
                )
            }));

            // File transport
            if (this.options.writeToFile) {
                transports.push(new winston.transports.File({
                    filename: path.join(this.options.logDir, 'nexus.log'),
                    level: 'debug',
                    maxsize: this.options.maxFileSize,
                    maxFiles: this.options.maxFiles,
                    tailable: true,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                }));

                // Error-specific file
                transports.push(new winston.transports.File({
                    filename: path.join(this.options.logDir, 'errors.log'),
                    level: 'error',
                    maxsize: this.options.maxFileSize,
                    maxFiles: this.options.maxFiles,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                }));
            }

            this.winston = winston.createLogger({
                level: this.options.level,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.errors({ stack: true })
                ),
                defaultMeta: { component: this.component },
                transports
            });

        } catch (error) {
            console.error('Failed to initialize Winston logger:', error);
            this.winston = console; // Fallback to console
        }
    }

    /**
     * Log error message
     */
    error(message, ...args) {
        this.log('error', message, ...args);
    }

    /**
     * Log warning message
     */
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }

    /**
     * Log info message
     */
    info(message, ...args) {
        this.log('info', message, ...args);
    }

    /**
     * Log debug message
     */
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }

    /**
     * Log verbose message
     */
    verbose(message, ...args) {
        this.log('verbose', message, ...args);
    }

    /**
     * Log trace message
     */
    trace(message, ...args) {
        this.log('trace', message, ...args);
    }

    /**
     * Core logging method
     */
    log(level, message, ...args) {
        const levelInfo = this.levels[level];
        
        if (!levelInfo || levelInfo.priority > this.currentLevel) {
            return;
        }

        // Format message
        let formattedMessage = message;
        if (args.length > 0) {
            formattedMessage += ' ' + args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');
        }

        // Console output with colors and symbols
        if (this.options.colorize) {
            const symbol = levelInfo.symbol;
            const coloredMessage = levelInfo.color(formattedMessage);
            const timestamp = this.options.includeTimestamp 
                ? chalk.gray(`[${new Date().toISOString()}]`) 
                : '';
            const component = chalk.cyan(`[${this.component}]`);
            
            console.log(`${timestamp} ${symbol} ${component} ${coloredMessage}`);
        }

        // Winston logging
        if (this.winston && typeof this.winston[level] === 'function') {
            this.winston[level](formattedMessage, { component: this.component });
        }
    }

    /**
     * Start performance timer
     */
    startTimer(label) {
        this.timers.set(label, {
            start: process.hrtime.bigint(),
            label
        });
        this.trace(`Timer started: ${label}`);
    }

    /**
     * End performance timer and log duration
     */
    endTimer(label, logLevel = 'debug') {
        const timer = this.timers.get(label);
        if (!timer) {
            this.warn(`Timer not found: ${label}`);
            return null;
        }

        const end = process.hrtime.bigint();
        const duration = Number(end - timer.start) / 1000000; // Convert to milliseconds
        
        this.timers.delete(label);
        this[logLevel](`Timer completed: ${label} - ${duration.toFixed(2)}ms`);
        
        return duration;
    }

    /**
     * Increment counter
     */
    incrementCounter(name, value = 1) {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
    }

    /**
     * Get counter value
     */
    getCounter(name) {
        return this.counters.get(name) || 0;
    }

    /**
     * Reset counter
     */
    resetCounter(name) {
        this.counters.set(name, 0);
    }

    /**
     * Log structured data
     */
    structured(level, event, data = {}) {
        const structuredData = {
            timestamp: new Date().toISOString(),
            component: this.component,
            event,
            ...data
        };

        this.log(level, `${event}: ${JSON.stringify(structuredData, null, 2)}`);
        
        // Also send to Winston for structured logging
        if (this.winston) {
            this.winston[level](event, structuredData);
        }
    }

    /**
     * Log performance metrics
     */
    metrics(name, value, unit = '', metadata = {}) {
        const metricsData = {
            timestamp: new Date().toISOString(),
            component: this.component,
            metric: name,
            value,
            unit,
            ...metadata
        };

        this.structured('info', 'METRIC', metricsData);
    }

    /**
     * Log request/response cycles
     */
    request(method, url, statusCode, duration, metadata = {}) {
        const requestData = {
            method,
            url,
            statusCode,
            duration,
            ...metadata
        };

        const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
        this.structured(level, 'REQUEST', requestData);
    }

    /**
     * Log security events
     */
    security(event, severity = 'medium', details = {}) {
        const securityData = {
            event,
            severity,
            timestamp: new Date().toISOString(),
            component: this.component,
            ...details
        };

        const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
        this.structured(level, 'SECURITY', securityData);
    }

    /**
     * Create child logger with additional context
     */
    child(additionalComponent, additionalOptions = {}) {
        const childComponent = `${this.component}:${additionalComponent}`;
        const childOptions = { ...this.options, ...additionalOptions };
        return new Logger(childComponent, childOptions);
    }

    /**
     * Set log level dynamically
     */
    setLevel(level) {
        if (this.levels[level]) {
            this.options.level = level;
            this.currentLevel = this.levels[level].priority;
            
            if (this.winston) {
                this.winston.level = level;
            }
            
            this.info(`Log level changed to: ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}`);
        }
    }

    /**
     * Get current log level
     */
    getLevel() {
        return this.options.level;
    }

    /**
     * Check if level is enabled
     */
    isLevelEnabled(level) {
        const levelInfo = this.levels[level];
        return levelInfo && levelInfo.priority <= this.currentLevel;
    }

    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        return {
            activeTimers: Array.from(this.timers.keys()),
            counters: Object.fromEntries(this.counters),
            component: this.component
        };
    }

    /**
     * Clear all timers and counters
     */
    clearPerformanceData() {
        this.timers.clear();
        this.counters.clear();
        this.debug('Performance data cleared');
    }

    /**
     * Log memory usage
     */
    logMemoryUsage() {
        const usage = process.memoryUsage();
        const memoryData = {
            rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
            external: `${Math.round(usage.external / 1024 / 1024)} MB`
        };
        
        this.metrics('memory_usage', memoryData);
    }

    /**
     * Create log snapshot for debugging
     */
    snapshot(label, data = {}) {
        const snapshotData = {
            label,
            timestamp: new Date().toISOString(),
            component: this.component,
            memory: process.memoryUsage(),
            performance: this.getPerformanceSummary(),
            ...data
        };

        this.structured('debug', 'SNAPSHOT', snapshotData);
        return snapshotData;
    }

    /**
     * Graceful shutdown - flush logs
     */
    async shutdown() {
        this.info('Logger shutting down...');
        
        if (this.winston) {
            return new Promise((resolve) => {
                this.winston.end(() => {
                    resolve();
                });
            });
        }
    }
}

// Static methods for global logging
Logger.global = new Logger('Global');

Logger.error = (...args) => Logger.global.error(...args);
Logger.warn = (...args) => Logger.global.warn(...args);
Logger.info = (...args) => Logger.global.info(...args);
Logger.debug = (...args) => Logger.global.debug(...args);
Logger.verbose = (...args) => Logger.global.verbose(...args);
Logger.trace = (...args) => Logger.global.trace(...args);

module.exports = { Logger };