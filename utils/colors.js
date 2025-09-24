// Simple color utility for cross-platform support
const colors = {
    red: (str) => `\x1b[31m${str}\x1b[0m`,
    green: (str) => `\x1b[32m${str}\x1b[0m`,
    yellow: (str) => `\x1b[33m${str}\x1b[0m`,
    blue: (str) => `\x1b[34m${str}\x1b[0m`,
    cyan: (str) => `\x1b[36m${str}\x1b[0m`,
    gray: (str) => `\x1b[90m${str}\x1b[0m`,
    bold: (str) => `\x1b[1m${str}\x1b[0m`
};

module.exports = colors;