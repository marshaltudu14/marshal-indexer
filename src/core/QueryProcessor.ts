import { ProcessedQuery, QueryContext } from '../common/types.js';
import { IntentClassifier } from '../intelligence/IntentClassifier.js';
import { QueryExpander } from '../intelligence/QueryExpander.js';
import { extractKeywords, extractEntities, normalizeQuery } from '../utils/QueryUtils.js';

/**
 * Advanced query processing with multi-modal understanding
 * Handles natural language, code snippets, and hybrid queries
 */
export class QueryProcessor {
  private intentClassifier: IntentClassifier;
  private queryExpander: QueryExpander;
  private queryHistory: Map<string, QueryContext> = new Map();

  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.queryExpander = new QueryExpander();
  }

  /**
   * Process a query with advanced intent understanding and expansion
   */
  async processQuery(
    query: string, 
    context?: QueryContext,
    codebaseMetadata?: any
  ): Promise<ProcessedQuery> {
    const startTime = Date.now();
    
    // Step 1: Normalize and clean the query
    const normalizedQuery = normalizeQuery(query);
    
    // Step 2: Detect query type and intent
    const intent = await this.intentClassifier.classifyIntent(normalizedQuery, context);
    
    // Step 3: Extract entities and keywords
    const entities = extractEntities(normalizedQuery);
    const keywords = extractKeywords(normalizedQuery);
    
    // Step 4: Expand query with contextual variations
    const expandedQueries = await this.queryExpander.expandQuery(
      normalizedQuery, 
      intent, 
      codebaseMetadata
    );
    
    // Step 5: Build query context
    const queryContext: QueryContext = {
      originalQuery: query,
      normalizedQuery,
      timestamp: Date.now(),
      sessionId: context?.sessionId || this.generateSessionId(),
      previousQueries: this.getRecentQueries(context?.sessionId),
      codebaseContext: codebaseMetadata
    };
    
    // Step 6: Store query for learning
    this.storeQueryContext(queryContext);
    
    const processedQuery: ProcessedQuery = {
      original: query,
      normalized: normalizedQuery,
      intent,
      entities,
      keywords,
      expandedQueries,
      context: queryContext,
      processingTime: Date.now() - startTime
    };

    console.log(`🧠 Query processed: "${query}" → ${intent.type} (${intent.confidence.toFixed(2)})`);
    console.log(`🔄 Generated ${expandedQueries.length} query variations`);
    
    return processedQuery;
  }

  /**
   * Analyze query for code patterns and structure
   */
  async analyzeCodePattern(query: string): Promise<{
    isCodeSnippet: boolean;
    language?: string;
    patterns: string[];
    symbols: string[];
  }> {
    const codePatterns = {
      function: /\b(function|def|func|method)\s+\w+/gi,
      class: /\b(class|interface|struct)\s+\w+/gi,
      variable: /\b(var|let|const|final)\s+\w+/gi,
      import: /\b(import|require|include|using)\s+/gi,
      comment: /\/\/|\/\*|\#|<!--/g
    };

    const languagePatterns = {
      javascript: /\b(function|const|let|var|=>|require)\b/gi,
      typescript: /\b(interface|type|enum|namespace)\b/gi,
      python: /\b(def|class|import|from|lambda)\b/gi,
      java: /\b(public|private|protected|class|interface)\b/gi,
      cpp: /\b(#include|namespace|template|class)\b/gi
    };

    let isCodeSnippet = false;
    let detectedLanguage: string | undefined;
    const patterns: string[] = [];
    const symbols: string[] = [];

    // Check for code patterns
    for (const [pattern, regex] of Object.entries(codePatterns)) {
      const matches = query.match(regex);
      if (matches) {
        isCodeSnippet = true;
        patterns.push(pattern);
        symbols.push(...matches);
      }
    }

    // Detect programming language
    if (isCodeSnippet) {
      for (const [lang, regex] of Object.entries(languagePatterns)) {
        if (regex.test(query)) {
          detectedLanguage = lang;
          break;
        }
      }
    }

    const result: {
      isCodeSnippet: boolean;
      language?: string;
      patterns: string[];
      symbols: string[];
    } = {
      isCodeSnippet,
      patterns,
      symbols
    };

    if (detectedLanguage) {
      result.language = detectedLanguage;
    }

    return result;
  }

  /**
   * Generate contextual query suggestions
   */
  async generateQuerySuggestions(
    partialQuery: string,
    _context?: QueryContext
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Get suggestions based on query history
    const historySuggestions = this.getHistoryBasedSuggestions(partialQuery);
    suggestions.push(...historySuggestions);
    
    // Get intent-based suggestions
    const intentSuggestions = await this.getIntentBasedSuggestions(partialQuery);
    suggestions.push(...intentSuggestions);
    
    // Get pattern-based suggestions
    const patternSuggestions = this.getPatternBasedSuggestions(partialQuery);
    suggestions.push(...patternSuggestions);
    
    // Remove duplicates and sort by relevance
    return [...new Set(suggestions)].slice(0, 10);
  }

  /**
   * Store query context for learning and improvement
   */
  private storeQueryContext(context: QueryContext): void {
    const key = `${context.sessionId}_${context.timestamp}`;
    this.queryHistory.set(key, context);
    
    // Keep only recent queries (last 100)
    if (this.queryHistory.size > 100) {
      const oldestKey = Array.from(this.queryHistory.keys())[0];
      if (oldestKey) {
        this.queryHistory.delete(oldestKey);
      }
    }
  }

  /**
   * Get recent queries for context
   */
  private getRecentQueries(sessionId?: string): QueryContext[] {
    if (!sessionId) return [];
    
    return Array.from(this.queryHistory.values())
      .filter(ctx => ctx.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get suggestions based on query history
   */
  private getHistoryBasedSuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    const queryLower = partialQuery.toLowerCase();
    
    for (const context of this.queryHistory.values()) {
      if (context.originalQuery.toLowerCase().includes(queryLower)) {
        suggestions.push(context.originalQuery);
      }
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Get intent-based query suggestions
   */
  private async getIntentBasedSuggestions(partialQuery: string): Promise<string[]> {
    const commonPatterns = {
      'find': ['find function', 'find class', 'find component', 'find method'],
      'how': ['how to implement', 'how to use', 'how to create', 'how to fix'],
      'what': ['what is', 'what does', 'what are', 'what happens'],
      'show': ['show me', 'show all', 'show examples', 'show usage'],
      'auth': ['authentication', 'authorization', 'auth middleware', 'login'],
      'api': ['api endpoint', 'api route', 'api handler', 'rest api'],
      'error': ['error handling', 'error message', 'exception', 'try catch']
    };
    
    const suggestions: string[] = [];
    const queryLower = partialQuery.toLowerCase();
    
    for (const [key, patterns] of Object.entries(commonPatterns)) {
      if (queryLower.includes(key)) {
        suggestions.push(...patterns);
      }
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Get pattern-based suggestions
   */
  private getPatternBasedSuggestions(partialQuery: string): string[] {
    const patterns = [
      'React component',
      'Vue component',
      'Angular component',
      'Express middleware',
      'Database query',
      'API endpoint',
      'Error handling',
      'Authentication',
      'State management',
      'Unit test',
      'Integration test',
      'Configuration',
      'Utility function',
      'Helper method',
      'Service class',
      'Model definition',
      'Interface declaration',
      'Type definition'
    ];
    
    const queryLower = partialQuery.toLowerCase();
    return patterns.filter(pattern => 
      pattern.toLowerCase().includes(queryLower) ||
      queryLower.includes(pattern.toLowerCase().split(' ')[0] || '')
    ).slice(0, 5);
  }
}
