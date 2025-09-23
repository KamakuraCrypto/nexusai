/**
 * Web Search Component
 * Autonomous web research with intelligent source prioritization
 * Integrates with multiple search engines and documentation sources
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { Logger } = require('../utils/logger');

class WebSearch {
    constructor(config = {}) {
        this.config = {
            searchEngines: config.searchEngines || ['duckduckgo', 'bing'],
            maxResults: config.maxResults || 20,
            timeout: config.timeout || 10000,
            retryAttempts: config.retryAttempts || 3,
            prioritySources: config.prioritySources || [
                'github.com',
                'docs.',
                'developer.',
                'api.',
                'stackoverflow.com',
                'medium.com',
                'dev.to'
            ],
            ...config
        };
        
        this.logger = new Logger('WebSearch');
        this.cache = new Map();
        this.stats = {
            totalSearches: 0,
            totalResults: 0,
            cacheHits: 0,
            errors: 0
        };
    }

    /**
     * Main search function with intelligent result aggregation
     */
    async search(query, options = {}) {
        const searchOptions = {
            depth: options.depth || 'standard', // 'basic', 'standard', 'comprehensive'
            sources: options.sources || ['documentation', 'github', 'blogs'],
            language: options.language || 'en',
            timeframe: options.timeframe || 'any', // 'recent', 'year', 'any'
            ...options
        };

        this.logger.info(`🔍 Searching: "${query}" (${searchOptions.depth})`);
        
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(query, searchOptions);
            if (this.cache.has(cacheKey)) {
                this.stats.cacheHits++;
                return this.cache.get(cacheKey);
            }

            // Execute search strategy based on depth
            let results = [];
            switch (searchOptions.depth) {
                case 'basic':
                    results = await this.basicSearch(query, searchOptions);
                    break;
                case 'standard':
                    results = await this.standardSearch(query, searchOptions);
                    break;
                case 'comprehensive':
                    results = await this.comprehensiveSearch(query, searchOptions);
                    break;
            }

            // Post-process and rank results
            const processedResults = await this.processAndRankResults(results, query);
            
            // Cache results
            this.cache.set(cacheKey, processedResults);
            
            // Update statistics
            this.stats.totalSearches++;
            this.stats.totalResults += processedResults.length;
            
            this.logger.info(`Found ${processedResults.length} relevant results`);
            return processedResults;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Search failed:', error);
            throw error;
        }
    }

    /**
     * Basic search - single search engine, limited results
     */
    async basicSearch(query, options) {
        const searchQueries = this.generateSearchQueries(query, options);
        const results = [];
        
        for (const searchQuery of searchQueries.slice(0, 2)) {
            const searchResults = await this.executeSearch(searchQuery, options);
            results.push(...searchResults.slice(0, 5));
        }
        
        return results;
    }

    /**
     * Standard search - multiple queries, moderate depth
     */
    async standardSearch(query, options) {
        const searchQueries = this.generateSearchQueries(query, options);
        const results = [];
        
        // Execute searches in parallel
        const searchPromises = searchQueries.slice(0, 4).map(searchQuery => 
            this.executeSearch(searchQuery, options)
        );
        
        const searchResults = await Promise.allSettled(searchPromises);
        
        for (const result of searchResults) {
            if (result.status === 'fulfilled') {
                results.push(...result.value.slice(0, 8));
            }
        }
        
        return results;
    }

    /**
     * Comprehensive search - exhaustive research
     */
    async comprehensiveSearch(query, options) {
        const searchQueries = this.generateSearchQueries(query, options);
        const results = [];
        
        // Execute all search variations
        const searchPromises = searchQueries.map(searchQuery => 
            this.executeSearch(searchQuery, options)
        );
        
        const searchResults = await Promise.allSettled(searchPromises);
        
        for (const result of searchResults) {
            if (result.status === 'fulfilled') {
                results.push(...result.value);
            }
        }
        
        // Additional specialized searches
        const specializedResults = await this.executeSpecializedSearches(query, options);
        results.push(...specializedResults);
        
        return results;
    }

    /**
     * Generate search query variations
     */
    generateSearchQueries(baseQuery, options) {
        const queries = [baseQuery];
        
        // Add technical variations
        if (options.sources.includes('documentation')) {
            queries.push(`${baseQuery} documentation`);
            queries.push(`${baseQuery} docs API`);
            queries.push(`${baseQuery} getting started tutorial`);
        }
        
        if (options.sources.includes('github')) {
            queries.push(`${baseQuery} github repository`);
            queries.push(`${baseQuery} open source implementation`);
            queries.push(`${baseQuery} code examples`);
        }
        
        if (options.sources.includes('blogs')) {
            queries.push(`${baseQuery} best practices`);
            queries.push(`${baseQuery} tutorial guide`);
            queries.push(`${baseQuery} how to implement`);
        }
        
        // Add framework-specific queries
        const frameworks = ['react', 'node.js', 'python', 'javascript'];
        for (const framework of frameworks) {
            if (baseQuery.toLowerCase().includes(framework)) {
                queries.push(`${baseQuery} ${framework} example`);
            }
        }
        
        return [...new Set(queries)]; // Remove duplicates
    }

    /**
     * Execute search using available search engines
     */
    async executeSearch(query, options) {
        const results = [];
        
        // Try each configured search engine
        for (const engine of this.config.searchEngines) {
            try {
                const engineResults = await this.searchWithEngine(query, engine, options);
                results.push(...engineResults);
            } catch (error) {
                this.logger.warn(`Search engine ${engine} failed:`, error.message);
            }
        }
        
        return results;
    }

    /**
     * Search with specific search engine
     */
    async searchWithEngine(query, engine, options) {
        switch (engine) {
            case 'duckduckgo':
                return await this.searchDuckDuckGo(query, options);
            case 'bing':
                return await this.searchBing(query, options);
            case 'google':
                return await this.searchGoogle(query, options);
            default:
                throw new Error(`Unsupported search engine: ${engine}`);
        }
    }

    /**
     * DuckDuckGo search implementation
     */
    async searchDuckDuckGo(query, options) {
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                timeout: this.config.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Nexus AI Research Bot)'
                }
            });
            
            const $ = cheerio.load(response.data);
            const results = [];
            
            $('.result').each((index, element) => {
                const title = $(element).find('.result__title a').text().trim();
                const url = $(element).find('.result__title a').attr('href');
                const snippet = $(element).find('.result__snippet').text().trim();
                
                if (title && url) {
                    results.push({
                        title,
                        url: this.cleanUrl(url),
                        snippet,
                        source: 'duckduckgo',
                        relevanceScore: this.calculateRelevanceScore(title, snippet, query)
                    });
                }
            });
            
            return results.slice(0, this.config.maxResults);
            
        } catch (error) {
            this.logger.error('DuckDuckGo search failed:', error);
            return [];
        }
    }

    /**
     * Bing search implementation (would require API key)
     */
    async searchBing(query, options) {
        // Placeholder for Bing search implementation
        // Would use Bing Search API with proper authentication
        this.logger.debug('Bing search not implemented yet');
        return [];
    }

    /**
     * Google search implementation (would require API key)
     */
    async searchGoogle(query, options) {
        // Placeholder for Google search implementation
        // Would use Google Custom Search API
        this.logger.debug('Google search not implemented yet');
        return [];
    }

    /**
     * Execute specialized searches for documentation and code
     */
    async executeSpecializedSearches(query, options) {
        const results = [];
        
        // GitHub repository search
        if (options.sources.includes('github')) {
            const githubResults = await this.searchGitHub(query);
            results.push(...githubResults);
        }
        
        // Stack Overflow search
        if (options.sources.includes('stackoverflow')) {
            const stackResults = await this.searchStackOverflow(query);
            results.push(...stackResults);
        }
        
        // Documentation site search
        if (options.sources.includes('documentation')) {
            const docResults = await this.searchDocumentationSites(query);
            results.push(...docResults);
        }
        
        return results;
    }

    /**
     * Search GitHub repositories and issues
     */
    async searchGitHub(query) {
        try {
            const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc`;
            const response = await axios.get(searchUrl, {
                timeout: this.config.timeout,
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Nexus-AI-Framework'
                }
            });
            
            return response.data.items.slice(0, 10).map(repo => ({
                title: repo.full_name,
                url: repo.html_url,
                snippet: repo.description || '',
                source: 'github',
                relevanceScore: this.calculateGitHubRelevance(repo, query),
                metadata: {
                    stars: repo.stargazers_count,
                    language: repo.language,
                    updated: repo.updated_at
                }
            }));
            
        } catch (error) {
            this.logger.error('GitHub search failed:', error);
            return [];
        }
    }

    /**
     * Search Stack Overflow
     */
    async searchStackOverflow(query) {
        try {
            const searchUrl = `https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&intitle=${encodeURIComponent(query)}&site=stackoverflow`;
            const response = await axios.get(searchUrl, {
                timeout: this.config.timeout
            });
            
            return response.data.items.slice(0, 10).map(item => ({
                title: item.title,
                url: item.link,
                snippet: item.body_markdown ? item.body_markdown.substring(0, 200) + '...' : '',
                source: 'stackoverflow',
                relevanceScore: this.calculateStackOverflowRelevance(item, query),
                metadata: {
                    score: item.score,
                    answers: item.answer_count,
                    views: item.view_count
                }
            }));
            
        } catch (error) {
            this.logger.error('Stack Overflow search failed:', error);
            return [];
        }
    }

    /**
     * Search documentation sites
     */
    async searchDocumentationSites(query) {
        const docSites = [
            'docs.python.org',
            'nodejs.org/docs',
            'developer.mozilla.org',
            'reactjs.org/docs',
            'docs.npmjs.com'
        ];
        
        const results = [];
        
        for (const site of docSites) {
            try {
                const siteQuery = `site:${site} ${query}`;
                const siteResults = await this.searchDuckDuckGo(siteQuery, {});
                results.push(...siteResults.slice(0, 3));
            } catch (error) {
                this.logger.warn(`Documentation search failed for ${site}:`, error.message);
            }
        }
        
        return results;
    }

    /**
     * Process and rank all search results
     */
    async processAndRankResults(results, originalQuery) {
        // Remove duplicates
        const uniqueResults = this.removeDuplicates(results);
        
        // Apply relevance scoring
        const scoredResults = uniqueResults.map(result => ({
            ...result,
            finalScore: this.calculateFinalScore(result, originalQuery)
        }));
        
        // Sort by relevance and priority
        scoredResults.sort((a, b) => {
            // Priority source bonus
            const aPriority = this.isPrioritySource(a.url) ? 0.2 : 0;
            const bPriority = this.isPrioritySource(b.url) ? 0.2 : 0;
            
            return (b.finalScore + bPriority) - (a.finalScore + aPriority);
        });
        
        // Limit results
        return scoredResults.slice(0, this.config.maxResults);
    }

    /**
     * Remove duplicate results
     */
    removeDuplicates(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = result.url.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Calculate relevance score for search results
     */
    calculateRelevanceScore(title, snippet, query) {
        const queryWords = query.toLowerCase().split(' ');
        const text = (title + ' ' + snippet).toLowerCase();
        
        let score = 0;
        for (const word of queryWords) {
            if (text.includes(word)) {
                score += 1;
                // Bonus for title matches
                if (title.toLowerCase().includes(word)) {
                    score += 0.5;
                }
            }
        }
        
        return score / queryWords.length;
    }

    /**
     * Calculate GitHub repository relevance
     */
    calculateGitHubRelevance(repo, query) {
        let score = this.calculateRelevanceScore(repo.full_name, repo.description || '', query);
        
        // Boost for popular repositories
        if (repo.stargazers_count > 1000) score += 0.3;
        if (repo.stargazers_count > 10000) score += 0.2;
        
        // Boost for recently updated
        const updatedDate = new Date(repo.updated_at);
        const monthsOld = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsOld < 6) score += 0.2;
        
        return score;
    }

    /**
     * Calculate Stack Overflow relevance
     */
    calculateStackOverflowRelevance(item, query) {
        let score = this.calculateRelevanceScore(item.title, '', query);
        
        // Boost for high-score answers
        if (item.score > 5) score += 0.2;
        if (item.answer_count > 0) score += 0.1;
        
        return score;
    }

    /**
     * Calculate final ranking score
     */
    calculateFinalScore(result, originalQuery) {
        let score = result.relevanceScore || 0;
        
        // Source-specific bonuses
        switch (result.source) {
            case 'github':
                score += 0.3; // GitHub is valuable for code
                break;
            case 'stackoverflow':
                score += 0.2; // SO is good for problems
                break;
            case 'documentation':
                score += 0.4; // Official docs are most valuable
                break;
        }
        
        return score;
    }

    /**
     * Check if URL is from a priority source
     */
    isPrioritySource(url) {
        return this.config.prioritySources.some(source => 
            url.toLowerCase().includes(source.toLowerCase())
        );
    }

    /**
     * Clean and normalize URLs
     */
    cleanUrl(url) {
        // Remove tracking parameters and normalize
        try {
            const urlObj = new URL(url);
            // Remove common tracking parameters
            const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'];
            trackingParams.forEach(param => urlObj.searchParams.delete(param));
            return urlObj.toString();
        } catch (error) {
            return url; // Return original if URL parsing fails
        }
    }

    /**
     * Generate cache key for search results
     */
    generateCacheKey(query, options) {
        return `${query}_${JSON.stringify(options)}`.toLowerCase();
    }

    /**
     * Get search statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            cacheHitRate: this.stats.totalSearches > 0 
                ? (this.stats.cacheHits / this.stats.totalSearches * 100).toFixed(2)
                : 0
        };
    }

    /**
     * Clear search cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Search cache cleared');
    }
}

module.exports = { WebSearch };