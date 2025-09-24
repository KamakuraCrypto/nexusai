// Stub for axios to prevent import errors
module.exports = {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
    delete: async () => ({ data: {} }),
    create: () => module.exports
};