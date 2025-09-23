/**
 * Documentation Scraper
 * Scrapes and indexes documentation from websites, PDFs, and local files
 * Creates searchable, AI-optimized knowledge bases
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { Logger } = require('../utils/logger');

class DocumentationScraper {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('DocumentationScraper');
        
        this.config = {
            maxDepth: 5,
            maxPages: 1000,
            requestDelay: 100, // ms between requests
            timeout: 30000,
            userAgent: 'Nexus-AI-Documentation-Scraper/1.0',
            supportedFormats: {
                web: ['html', 'htm', 'php', 'asp', 'aspx'],
                markdown: ['md', 'mdx'],
                pdf: ['pdf'],
                text: ['txt', 'text'],
                code: ['js', 'ts', 'py', 'java', 'cpp', 'go', 'rust']
            },
            blacklistPatterns: [
                /\/api\/v\d+\//, // Versioned APIs (too granular)
                /\/(login|signin|auth)/, // Authentication pages
                /\/(search|query)/, // Search pages
                /\/tag\//, // Tag pages
                /\/page\/\d+/ // Pagination
            ]
        };
        
        this.knowledgeBasePath = path.join(process.cwd(), '.nexus', 'knowledge-base', 'scraped');
        this.scrapedUrls = new Set();
        this.browser = null;
    }
    
    /**
     * Initialize scraper
     */
    async initialize() {
        await fs.ensureDir(this.knowledgeBasePath);
        
        // Launch puppeteer for JavaScript-heavy sites
        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        } catch (error) {
            this.logger.warn('Puppeteer unavailable, falling back to basic scraping');
        }
    }
    
    /**
     * Scrape documentation from a URL or local path
     */
    async scrapeDocumentation(source, options = {}) {
        this.logger.info(`📚 Starting documentation scrape: ${source}`);
        
        const {
            type = 'auto', // 'web', 'local', 'github', 'auto'
            maxDepth = this.config.maxDepth,
            includePaths = [],
            excludePaths = [],
            format = 'auto',
            outputName = null
        } = options;
        
        try {
            let documentation;
            
            // Detect source type
            const sourceType = type === 'auto' ? this.detectSourceType(source) : type;
            
            switch (sourceType) {
                case 'web':
                    documentation = await this.scrapeWebsite(source, options);
                    break;
                    
                case 'local':
                    documentation = await this.scrapeLocalFiles(source, options);
                    break;
                    
                case 'github':
                    documentation = await this.scrapeGitHubDocs(source, options);
                    break;
                    
                default:
                    throw new Error(`Unsupported source type: ${sourceType}`);
            }
            
            // Process and optimize for AI
            const optimized = await this.optimizeForAI(documentation);
            
            // Create knowledge base
            const knowledgeBase = await this.createKnowledgeBase(optimized, outputName || this.generateKBName(source));
            
            // Index for search
            await this.indexDocumentation(knowledgeBase);
            
            this.logger.info('✅ Documentation scraping completed');
            
            return knowledgeBase;
            
        } catch (error) {
            this.logger.error('Documentation scraping failed:', error);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
    
    /**
     * Scrape website documentation
     */
    async scrapeWebsite(url, options) {
        this.logger.info('🌐 Scraping website documentation...');
        
        const documentation = {
            source: url,
            type: 'website',
            pages: [],
            structure: {},
            metadata: {
                scrapedAt: new Date().toISOString(),
                totalPages: 0,
                totalSections: 0
            }
        };
        
        // Reset scraped URLs
        this.scrapedUrls.clear();
        
        // Start recursive scraping
        await this.scrapePageRecursive(url, documentation, 0, options.maxDepth);
        
        documentation.metadata.totalPages = documentation.pages.length;
        
        return documentation;
    }
    
    /**
     * Recursively scrape pages
     */
    async scrapePageRecursive(url, documentation, depth, maxDepth) {
        // Check depth limit
        if (depth > maxDepth) return;
        
        // Check if already scraped
        if (this.scrapedUrls.has(url)) return;
        
        // Check blacklist patterns
        if (this.config.blacklistPatterns.some(pattern => pattern.test(url))) {
            return;
        }
        
        this.scrapedUrls.add(url);
        
        try {
            // Add delay to be respectful
            await this.delay(this.config.requestDelay);
            
            // Fetch page content
            const pageContent = await this.fetchPage(url);
            
            // Parse content
            const parsed = await this.parsePage(pageContent, url);
            
            // Add to documentation
            documentation.pages.push({
                url,
                title: parsed.title,
                content: parsed.content,
                sections: parsed.sections,
                codeBlocks: parsed.codeBlocks,
                links: parsed.links,
                depth
            });
            
            // Recursively scrape linked pages (same domain only)
            const baseUrl = new URL(url);
            for (const link of parsed.links) {
                try {
                    const linkUrl = new URL(link, url);
                    
                    // Only scrape same domain
                    if (linkUrl.hostname === baseUrl.hostname) {
                        await this.scrapePageRecursive(linkUrl.href, documentation, depth + 1, maxDepth);
                    }
                } catch (error) {
                    // Invalid URL, skip
                }
            }
            
        } catch (error) {
            this.logger.warn(`Failed to scrape ${url}:`, error.message);
        }
    }
    
    /**
     * Fetch page content
     */
    async fetchPage(url) {
        // Try with Puppeteer first for JavaScript-heavy sites
        if (this.browser) {
            try {
                const page = await this.browser.newPage();
                await page.setUserAgent(this.config.userAgent);
                await page.goto(url, {
                    waitUntil: 'networkidle2',
                    timeout: this.config.timeout
                });
                
                const content = await page.content();
                await page.close();
                
                return content;
            } catch (error) {
                this.logger.debug('Puppeteer fetch failed, trying axios:', error.message);
            }
        }
        
        // Fallback to axios
        const response = await axios.get(url, {
            headers: {
                'User-Agent': this.config.userAgent
            },
            timeout: this.config.timeout
        });
        
        return response.data;
    }
    
    /**
     * Parse page content
     */
    async parsePage(html, url) {
        const $ = cheerio.load(html);
        
        const parsed = {
            title: '',
            content: '',
            sections: [],
            codeBlocks: [],
            links: []
        };
        
        // Extract title
        parsed.title = $('title').text() || 
                      $('h1').first().text() || 
                      $('meta[property="og:title"]').attr('content') || 
                      'Untitled';
        
        // Remove script and style elements
        $('script, style, noscript').remove();
        
        // Extract main content
        const contentSelectors = [
            'main', 'article', '.documentation', '.content', 
            '#content', '.markdown-body', '.doc-content'
        ];
        
        let mainContent = null;
        for (const selector of contentSelectors) {
            if ($(selector).length > 0) {
                mainContent = $(selector).first();
                break;
            }
        }
        
        if (!mainContent) {
            mainContent = $('body');
        }
        
        // Extract sections
        mainContent.find('h1, h2, h3, h4, h5, h6').each((i, elem) => {
            const $elem = $(elem);
            const level = parseInt(elem.name.charAt(1));
            const text = $elem.text().trim();
            const id = $elem.attr('id') || this.slugify(text);
            
            parsed.sections.push({
                level,
                title: text,
                id,
                content: this.extractSectionContent($elem, $)
            });
        });
        
        // Extract code blocks
        mainContent.find('pre, code').each((i, elem) => {
            const $elem = $(elem);
            const code = $elem.text().trim();
            const language = $elem.attr('class')?.match(/language-(\w+)/)?.[1] || 
                           $elem.attr('data-language') || 
                           'unknown';
            
            if (code.length > 10) { // Skip tiny snippets
                parsed.codeBlocks.push({
                    language,
                    code,
                    context: $elem.parent().text().substring(0, 200)
                });
            }
        });
        
        // Extract text content
        parsed.content = mainContent.text()
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 50000); // Limit content size
        
        // Extract links
        mainContent.find('a[href]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                parsed.links.push(href);
            }
        });
        
        return parsed;
    }
    
    /**
     * Scrape local documentation files
     */
    async scrapeLocalFiles(sourcePath, options) {
        this.logger.info('📁 Scraping local documentation...');
        
        const documentation = {
            source: sourcePath,
            type: 'local',
            files: [],
            structure: {},
            metadata: {
                scrapedAt: new Date().toISOString(),
                totalFiles: 0
            }
        };
        
        // Find all documentation files
        const files = await this.findDocumentationFiles(sourcePath, options);
        
        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const parsed = await this.parseDocumentationFile(file, content);
            
            documentation.files.push({
                path: path.relative(sourcePath, file),
                ...parsed
            });
        }
        
        documentation.metadata.totalFiles = documentation.files.length;
        
        return documentation;
    }
    
    /**
     * Find documentation files in directory
     */
    async findDocumentationFiles(dir, options) {
        const files = [];
        const { includePaths = [], excludePaths = [] } = options;
        
        const walk = async (currentDir) => {
            const items = await fs.readdir(currentDir);
            
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stats = await fs.stat(fullPath);
                
                // Check exclusions
                if (excludePaths.some(exclude => fullPath.includes(exclude))) {
                    continue;
                }
                
                if (stats.isDirectory()) {
                    await walk(fullPath);
                } else {
                    const ext = path.extname(item).toLowerCase().replace('.', '');
                    
                    // Check if it's a documentation file
                    const isDoc = 
                        this.config.supportedFormats.markdown.includes(ext) ||
                        this.config.supportedFormats.text.includes(ext) ||
                        item.toLowerCase().includes('readme') ||
                        item.toLowerCase().includes('doc');
                    
                    if (isDoc) {
                        // Check inclusions
                        if (includePaths.length === 0 || 
                            includePaths.some(include => fullPath.includes(include))) {
                            files.push(fullPath);
                        }
                    }
                }
            }
        };
        
        await walk(dir);
        return files;
    }
    
    /**
     * Parse documentation file
     */
    async parseDocumentationFile(filePath, content) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.md' || ext === '.mdx') {
            return this.parseMarkdown(content);
        } else if (ext === '.html' || ext === '.htm') {
            return this.parseHTML(content);
        } else {
            return this.parsePlainText(content);
        }
    }
    
    /**
     * Parse Markdown content
     */
    parseMarkdown(content) {
        const parsed = {
            format: 'markdown',
            title: '',
            sections: [],
            codeBlocks: [],
            links: []
        };
        
        // Extract title (first H1)
        const titleMatch = content.match(/^#\s+(.+)$/m);
        parsed.title = titleMatch ? titleMatch[1] : 'Untitled';
        
        // Extract sections
        const sectionRegex = /^(#{1,6})\s+(.+)$/gm;
        let match;
        while ((match = sectionRegex.exec(content)) !== null) {
            parsed.sections.push({
                level: match[1].length,
                title: match[2],
                content: this.extractMarkdownSection(content, match.index)
            });
        }
        
        // Extract code blocks
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        while ((match = codeBlockRegex.exec(content)) !== null) {
            parsed.codeBlocks.push({
                language: match[1] || 'unknown',
                code: match[2].trim()
            });
        }
        
        // Extract links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        while ((match = linkRegex.exec(content)) !== null) {
            parsed.links.push({
                text: match[1],
                url: match[2]
            });
        }
        
        parsed.content = content;
        
        return parsed;
    }
    
    /**
     * Optimize documentation for AI consumption
     */
    async optimizeForAI(documentation) {
        this.logger.info('🤖 Optimizing documentation for AI...');
        
        const optimized = {
            ...documentation,
            aiOptimized: true,
            summary: '',
            keywords: [],
            concepts: [],
            examples: [],
            quickReference: {}
        };
        
        // Generate summary
        if (documentation.type === 'website') {
            optimized.summary = this.generateWebsiteSummary(documentation);
            optimized.keywords = this.extractKeywords(documentation);
            optimized.concepts = this.extractConcepts(documentation);
            optimized.examples = this.extractExamples(documentation);
            optimized.quickReference = this.generateQuickReference(documentation);
        } else if (documentation.type === 'local') {
            optimized.summary = this.generateLocalDocsSummary(documentation);
            optimized.keywords = this.extractKeywordsFromFiles(documentation);
            optimized.concepts = this.extractConceptsFromFiles(documentation);
        }
        
        return optimized;
    }
    
    /**
     * Create searchable knowledge base
     */
    async createKnowledgeBase(documentation, name) {
        const kbPath = path.join(this.knowledgeBasePath, name);
        await fs.ensureDir(kbPath);
        
        const knowledgeBase = {
            name,
            source: documentation.source,
            type: documentation.type,
            createdAt: new Date().toISOString(),
            metadata: documentation.metadata,
            summary: documentation.summary,
            keywords: documentation.keywords,
            concepts: documentation.concepts,
            searchIndex: {},
            content: {}
        };
        
        // Create searchable index
        if (documentation.type === 'website') {
            for (const page of documentation.pages) {
                const pageId = this.generatePageId(page.url);
                knowledgeBase.content[pageId] = {
                    url: page.url,
                    title: page.title,
                    content: page.content,
                    sections: page.sections,
                    codeBlocks: page.codeBlocks
                };
                
                // Add to search index
                this.addToSearchIndex(knowledgeBase.searchIndex, pageId, page);
            }
        } else if (documentation.type === 'local') {
            for (const file of documentation.files) {
                const fileId = this.generateFileId(file.path);
                knowledgeBase.content[fileId] = file;
                
                // Add to search index
                this.addToSearchIndex(knowledgeBase.searchIndex, fileId, file);
            }
        }
        
        // Save knowledge base
        await fs.writeJson(
            path.join(kbPath, 'knowledge-base.json'),
            knowledgeBase,
            { spaces: 2 }
        );
        
        // Save full documentation for reference
        await fs.writeJson(
            path.join(kbPath, 'full-documentation.json'),
            documentation,
            { spaces: 2 }
        );
        
        this.logger.info(`✅ Knowledge base created: ${name}`);
        
        return knowledgeBase;
    }
    
    /**
     * Index documentation for search
     */
    async indexDocumentation(knowledgeBase) {
        // This would integrate with a search engine like ElasticSearch or a vector DB
        // For now, we'll create a simple inverted index
        
        const indexPath = path.join(
            this.knowledgeBasePath,
            knowledgeBase.name,
            'search-index.json'
        );
        
        const index = {
            terms: {},
            documents: {}
        };
        
        // Build inverted index
        for (const [docId, doc] of Object.entries(knowledgeBase.content)) {
            const text = this.extractSearchableText(doc);
            const terms = this.tokenize(text);
            
            index.documents[docId] = {
                title: doc.title || doc.path,
                url: doc.url || doc.path,
                preview: text.substring(0, 200)
            };
            
            for (const term of terms) {
                if (!index.terms[term]) {
                    index.terms[term] = [];
                }
                index.terms[term].push(docId);
            }
        }
        
        await fs.writeJson(indexPath, index, { spaces: 2 });
        
        this.logger.info('🔍 Search index created');
    }
    
    /**
     * Helper: Generate summary for website docs
     */
    generateWebsiteSummary(documentation) {
        const pageCount = documentation.pages.length;
        const sections = documentation.pages.flatMap(p => p.sections);
        const codeBlocks = documentation.pages.flatMap(p => p.codeBlocks);
        
        return `Documentation from ${documentation.source} containing ${pageCount} pages, ` +
               `${sections.length} sections, and ${codeBlocks.length} code examples. ` +
               `Topics covered include: ${this.extractTopics(sections).join(', ')}.`;
    }
    
    /**
     * Helper: Extract keywords
     */
    extractKeywords(documentation) {
        const text = documentation.pages.map(p => p.content).join(' ');
        const words = text.toLowerCase().split(/\W+/);
        
        // Count word frequency
        const frequency = {};
        for (const word of words) {
            if (word.length > 3) { // Skip short words
                frequency[word] = (frequency[word] || 0) + 1;
            }
        }
        
        // Get top keywords
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([word]) => word);
    }
    
    /**
     * Helper: Extract concepts
     */
    extractConcepts(documentation) {
        const concepts = new Set();
        
        for (const page of documentation.pages) {
            // Look for concept patterns in sections
            for (const section of page.sections) {
                if (section.title.match(/what is|introduction|overview|concept/i)) {
                    concepts.add(section.title);
                }
            }
        }
        
        return Array.from(concepts);
    }
    
    /**
     * Helper: Extract code examples
     */
    extractExamples(documentation) {
        const examples = [];
        
        for (const page of documentation.pages) {
            for (const codeBlock of page.codeBlocks) {
                if (codeBlock.code.length > 50) { // Meaningful examples only
                    examples.push({
                        language: codeBlock.language,
                        code: codeBlock.code,
                        source: page.url,
                        context: codeBlock.context
                    });
                }
            }
        }
        
        return examples.slice(0, 100); // Limit to 100 examples
    }
    
    /**
     * Helper: Tokenize text for indexing
     */
    tokenize(text) {
        return text.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 2)
            .filter(word => !this.isStopWord(word));
    }
    
    /**
     * Helper: Check if word is a stop word
     */
    isStopWord(word) {
        const stopWords = [
            'the', 'is', 'at', 'which', 'on', 'and', 'or', 'but',
            'in', 'with', 'to', 'for', 'of', 'as', 'from', 'by',
            'that', 'this', 'these', 'those', 'then', 'than'
        ];
        return stopWords.includes(word);
    }
    
    /**
     * Helper: Delay for rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Helper: Detect source type
     */
    detectSourceType(source) {
        if (source.startsWith('http://') || source.startsWith('https://')) {
            if (source.includes('github.com')) {
                return 'github';
            }
            return 'web';
        }
        return 'local';
    }
    
    /**
     * Helper: Generate KB name from source
     */
    generateKBName(source) {
        const url = new URL(source);
        return url.hostname.replace(/\./g, '-') + '-' + Date.now();
    }
    
    /**
     * Helper: Slugify text
     */
    slugify(text) {
        return text.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    // Additional helper methods...
}

module.exports = { DocumentationScraper };