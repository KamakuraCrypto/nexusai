/**
 * Documentation Analyzer
 * AI-powered analysis of documentation and technical content
 * Extracts best practices, examples, and actionable insights
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { Logger } = require('../utils/logger');

class DocumentationAnalyzer {
    constructor(nexusCore) {
        this.nexusCore = nexusCore;
        this.logger = new Logger('DocumentationAnalyzer');
        this.cache = new Map();
        
        this.config = {
            maxContentLength: 50000,
            analysisDepth: 'comprehensive',
            extractCodeExamples: true,
            identifyPatterns: true,
            generateSummaries: true
        };
        
        this.stats = {
            documentsAnalyzed: 0,
            patternsIdentified: 0,
            examplesExtracted: 0,
            summariesGenerated: 0
        };
    }

    /**
     * Analyze documentation for a specific topic
     */
    async analyzeTopicDocumentation(topic, searchResults) {
        this.logger.info(`📖 Analyzing documentation for: ${topic}`);
        
        try {
            const analysis = {
                topic,
                documentation: [],
                bestPractices: [],
                codeExamples: [],
                patterns: [],
                recommendations: [],
                summary: ''
            };

            // Process each search result
            for (const result of searchResults.slice(0, 10)) {
                if (this.isDocumentationSource(result.url)) {
                    const docAnalysis = await this.analyzeDocument(result);
                    if (docAnalysis) {
                        analysis.documentation.push(docAnalysis);
                    }
                }
            }

            // Extract best practices from all documentation
            analysis.bestPractices = await this.extractBestPractices(analysis.documentation);
            
            // Extract code examples
            analysis.codeExamples = await this.extractCodeExamples(analysis.documentation);
            
            // Identify patterns
            analysis.patterns = await this.identifyPatterns(analysis.documentation);
            
            // Generate recommendations
            analysis.recommendations = await this.generateRecommendations(topic, analysis);
            
            // Create comprehensive summary
            analysis.summary = await this.generateTopicSummary(topic, analysis);
            
            this.stats.documentsAnalyzed += analysis.documentation.length;
            this.stats.patternsIdentified += analysis.patterns.length;
            this.stats.examplesExtracted += analysis.codeExamples.length;
            this.stats.summariesGenerated++;
            
            return analysis;
            
        } catch (error) {
            this.logger.error('Documentation analysis failed:', error);
            throw error;
        }
    }

    /**
     * Analyze a single document
     */
    async analyzeDocument(searchResult) {
        const { url, title } = searchResult;
        
        try {
            // Check cache first
            if (this.cache.has(url)) {
                return this.cache.get(url);
            }

            // Fetch document content
            const content = await this.fetchDocumentContent(url);
            if (!content) {
                return null;
            }

            // Analyze content with AI
            const analysisPrompt = `
Analyze this documentation content and extract key information:

TITLE: ${title}
URL: ${url}
CONTENT: ${content.substring(0, this.config.maxContentLength)}

Extract and structure the following:

1. MAIN CONCEPTS: Core ideas and technologies discussed
2. BEST PRACTICES: Recommended approaches and methodologies
3. CODE EXAMPLES: Any code snippets or implementations shown
4. WARNINGS/GOTCHAS: Things to avoid or be careful about
5. DEPENDENCIES: Required libraries, tools, or prerequisites
6. USE CASES: When and why to use this approach
7. ALTERNATIVES: Other approaches or tools mentioned

Return as structured JSON:
{
    "mainConcepts": ["concept1", "concept2"],
    "bestPractices": [
        {
            "practice": "description",
            "reasoning": "why it's recommended"
        }
    ],
    "codeExamples": [
        {
            "language": "javascript",
            "code": "example code",
            "description": "what it does"
        }
    ],
    "warnings": ["warning1", "warning2"],
    "dependencies": ["dep1", "dep2"],
    "useCases": ["use case 1", "use case 2"],
    "alternatives": ["alt1", "alt2"],
    "keyTakeaways": ["takeaway1", "takeaway2"]
}`;

            const analysis = await this.nexusCore.aiInterface.generateResponse(analysisPrompt, {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                responseFormat: 'json'
            });

            const parsedAnalysis = JSON.parse(analysis);
            const documentAnalysis = {
                url,
                title,
                source: this.identifyDocumentationSource(url),
                analysis: parsedAnalysis,
                analyzedAt: new Date().toISOString()
            };

            // Cache the result
            this.cache.set(url, documentAnalysis);
            
            return documentAnalysis;
            
        } catch (error) {
            this.logger.warn(`Failed to analyze document ${url}:`, error.message);
            return null;
        }
    }

    /**
     * Fetch content from a documentation URL
     */
    async fetchDocumentContent(url) {
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Nexus AI Documentation Analyzer)'
                }
            });

            // Parse HTML content
            const $ = cheerio.load(response.data);
            
            // Remove navigation, ads, and other non-content elements
            $('nav, header, footer, .sidebar, .advertisement, .comments').remove();
            
            // Extract main content
            let content = '';
            
            // Try common content selectors
            const contentSelectors = [
                'main',
                '.content',
                '.documentation',
                '.docs',
                '.markdown-body',
                'article',
                '.post-content',
                '#content'
            ];
            
            for (const selector of contentSelectors) {
                const element = $(selector);
                if (element.length > 0) {
                    content = element.text();
                    break;
                }
            }
            
            // Fallback to body if no specific content found
            if (!content) {
                content = $('body').text();
            }
            
            // Clean up whitespace
            content = content.replace(/\s+/g, ' ').trim();
            
            return content;
            
        } catch (error) {
            this.logger.warn(`Failed to fetch content from ${url}:`, error.message);
            return null;
        }
    }

    /**
     * Extract best practices from multiple documents
     */
    async extractBestPractices(documentAnalyses) {
        if (documentAnalyses.length === 0) {
            return [];
        }

        const allPractices = documentAnalyses.flatMap(doc => 
            doc.analysis.bestPractices || []
        );

        // Use AI to consolidate and rank best practices
        const consolidationPrompt = `
Analyze these best practices from multiple documentation sources and consolidate them:

PRACTICES: ${JSON.stringify(allPractices, null, 2)}

Tasks:
1. Remove duplicates and near-duplicates
2. Rank by importance and frequency
3. Group related practices
4. Add implementation difficulty level
5. Provide clear, actionable descriptions

Return as JSON array:
[
    {
        "practice": "clear description",
        "category": "security|performance|maintainability|usability",
        "importance": "critical|high|medium|low",
        "difficulty": "easy|medium|hard",
        "reasoning": "why this is important",
        "implementation": "how to implement this"
    }
]`;

        try {
            const consolidatedPractices = await this.nexusCore.aiInterface.generateResponse(consolidationPrompt, {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                responseFormat: 'json'
            });

            return JSON.parse(consolidatedPractices);
        } catch (error) {
            this.logger.error('Failed to consolidate best practices:', error);
            return allPractices.slice(0, 10); // Return first 10 as fallback
        }
    }

    /**
     * Extract and analyze code examples
     */
    async extractCodeExamples(documentAnalyses) {
        const allExamples = documentAnalyses.flatMap(doc => 
            doc.analysis.codeExamples || []
        );

        if (allExamples.length === 0) {
            return [];
        }

        // Use AI to analyze and categorize code examples
        const analysisPrompt = `
Analyze these code examples and categorize them:

EXAMPLES: ${JSON.stringify(allExamples, null, 2)}

For each example:
1. Identify the pattern or concept it demonstrates
2. Rate its quality and completeness
3. Suggest improvements if needed
4. Categorize by purpose (setup, implementation, testing, etc.)

Return structured analysis as JSON.`;

        try {
            const analyzedExamples = await this.nexusCore.aiInterface.generateResponse(analysisPrompt, {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                responseFormat: 'json'
            });

            return JSON.parse(analyzedExamples);
        } catch (error) {
            this.logger.error('Failed to analyze code examples:', error);
            return allExamples.slice(0, 15); // Return first 15 as fallback
        }
    }

    /**
     * Identify patterns across documentation
     */
    async identifyPatterns(documentAnalyses) {
        const allConcepts = documentAnalyses.flatMap(doc => 
            doc.analysis.mainConcepts || []
        );

        const patternPrompt = `
Identify recurring patterns and themes from these concepts:

CONCEPTS: ${JSON.stringify(allConcepts, null, 2)}

Identify:
1. Architectural patterns
2. Design patterns
3. Implementation patterns
4. Anti-patterns to avoid
5. Evolution trends

Return as structured JSON with pattern names, descriptions, and frequency.`;

        try {
            const patterns = await this.nexusCore.aiInterface.generateResponse(patternPrompt, {
                provider: 'gpt',
                model: 'gpt-4o',
                responseFormat: 'json'
            });

            return JSON.parse(patterns);
        } catch (error) {
            this.logger.error('Failed to identify patterns:', error);
            return [];
        }
    }

    /**
     * Generate recommendations based on analysis
     */
    async generateRecommendations(topic, analysis) {
        const recommendationPrompt = `
Based on this comprehensive documentation analysis, generate specific recommendations:

TOPIC: ${topic}
ANALYSIS: ${JSON.stringify(analysis, null, 2)}

Generate recommendations for:
1. TECHNOLOGY CHOICES: Which tools/frameworks to use and why
2. ARCHITECTURE: How to structure the solution
3. IMPLEMENTATION ORDER: What to build first
4. POTENTIAL PITFALLS: What to watch out for
5. OPTIMIZATION OPPORTUNITIES: How to improve performance/maintainability
6. TESTING STRATEGY: How to ensure quality

Each recommendation should be:
- Specific and actionable
- Based on the documentation evidence
- Include reasoning and trade-offs
- Suggest concrete next steps

Return as structured JSON.`;

        try {
            const recommendations = await this.nexusCore.aiInterface.generateResponse(recommendationPrompt, {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                responseFormat: 'json'
            });

            return JSON.parse(recommendations);
        } catch (error) {
            this.logger.error('Failed to generate recommendations:', error);
            return {
                technologyChoices: [],
                architecture: [],
                implementationOrder: [],
                pitfalls: [],
                optimizations: [],
                testing: []
            };
        }
    }

    /**
     * Generate comprehensive topic summary
     */
    async generateTopicSummary(topic, analysis) {
        const summaryPrompt = `
Create a comprehensive summary of the research on "${topic}":

ANALYSIS: ${JSON.stringify(analysis, null, 2)}

Create a detailed summary that includes:
1. Overview of the topic and its importance
2. Key concepts and technologies involved
3. Main approaches and methodologies
4. Critical best practices to follow
5. Common challenges and solutions
6. Recommended learning path
7. Practical next steps for implementation

Write this as a clear, well-structured markdown document that serves as a complete reference.`;

        try {
            const summary = await this.nexusCore.aiInterface.generateResponse(summaryPrompt, {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022'
            });

            return summary;
        } catch (error) {
            this.logger.error('Failed to generate topic summary:', error);
            return `# ${topic}\n\nSummary generation failed. Please refer to individual documentation sources.`;
        }
    }

    /**
     * Check if URL is a documentation source
     */
    isDocumentationSource(url) {
        const docIndicators = [
            'docs.',
            'documentation',
            'developer.',
            'api.',
            'guide',
            'tutorial',
            'reference',
            'manual',
            'wiki',
            '/docs/',
            '/documentation/',
            '/guide/',
            '/tutorial/',
            'readme',
            'getting-started'
        ];

        return docIndicators.some(indicator => 
            url.toLowerCase().includes(indicator)
        );
    }

    /**
     * Identify specific documentation source type
     */
    identifyDocumentationSource(url) {
        const sourcePatterns = {
            'official': ['docs.', 'developer.', 'api.'],
            'github': ['github.com'],
            'community': ['wiki', 'community'],
            'tutorial': ['tutorial', 'guide', 'getting-started'],
            'blog': ['medium.com', 'dev.to', 'blog'],
            'stackoverflow': ['stackoverflow.com'],
            'other': []
        };

        for (const [sourceType, patterns] of Object.entries(sourcePatterns)) {
            if (patterns.some(pattern => url.toLowerCase().includes(pattern))) {
                return sourceType;
            }
        }

        return 'other';
    }

    /**
     * Get analyzer statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            averageAnalysisTime: this.stats.averageAnalysisTime || 0
        };
    }

    /**
     * Clear analysis cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Documentation analysis cache cleared');
    }

    /**
     * Export analysis results for knowledge base
     */
    async exportAnalysisResults() {
        const results = [];
        
        for (const [url, analysis] of this.cache) {
            results.push({
                url,
                analysis,
                exportedAt: new Date().toISOString()
            });
        }
        
        return {
            results,
            stats: this.getStats(),
            exportedAt: new Date().toISOString()
        };
    }
}

module.exports = { DocumentationAnalyzer };