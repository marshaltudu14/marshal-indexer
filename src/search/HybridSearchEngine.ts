import { SearchResult, ProcessedQuery, HierarchicalChunk, CodeRelationship } from '../common/types.js';
import { VectorSearch } from './VectorSearch.js';
import { LexicalSearch } from './LexicalSearch.js';
import { GraphSearch } from './GraphSearch.js';
import { CacheManager } from '../utils/CacheManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

/**
 * Hybrid search engine that combines vector, lexical, and graph-based search
 * Provides superior accuracy and recall compared to single-strategy approaches
 */
export class HybridSearchEngine {
  private vectorSearch: VectorSearch;
  private lexicalSearch: LexicalSearch;
  private graphSearch: GraphSearch;
  private cache: CacheManager<SearchResult[]>;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    chunks: Map<string, HierarchicalChunk>,
    embeddings: Map<string, { code: number[]; concept: number[] }>,
    relationships: Map<string, CodeRelationship[]>
  ) {
    this.vectorSearch = new VectorSearch(chunks, embeddings);
    this.lexicalSearch = new LexicalSearch(chunks);
    this.graphSearch = new GraphSearch(chunks, relationships);
    this.cache = new CacheManager<SearchResult[]>(50 * 1024 * 1024); // 50MB cache
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * Perform hybrid search combining multiple strategies
   */
  async search(query: ProcessedQuery, topK: number = 20): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  }> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(query, topK);
    const cachedResults = this.cache.get(cacheKey);
    
    if (cachedResults) {
      console.log(`💾 Cache hit for query: "${query.original}"`);
      return this.splitCachedResults(cachedResults);
    }

    console.log(`🔍 Hybrid search for: "${query.original}"`);

    // Execute searches in parallel for better performance
    const [vectorResults, lexicalResults, graphResults] = await Promise.all([
      this.vectorSearch.search(query, topK),
      this.lexicalSearch.search(query, topK),
      this.graphSearch.search(query, topK)
    ]);

    // Cache the combined results
    const allResults = [...vectorResults, ...lexicalResults, ...graphResults];
    this.cache.set(cacheKey, allResults);

    const searchTime = Date.now() - startTime;
    this.performanceMonitor.recordSearchTime(searchTime);

    console.log(`⚡ Hybrid search completed in ${searchTime}ms`);
    console.log(`📊 Results: Vector(${vectorResults.length}), Lexical(${lexicalResults.length}), Graph(${graphResults.length})`);

    return {
      vectorResults,
      lexicalResults,
      graphResults
    };
  }

  /**
   * Perform adaptive search that adjusts strategy based on query characteristics
   */
  async adaptiveSearch(query: ProcessedQuery, topK: number = 20): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
    strategy: string;
  }> {
    const strategy = this.determineOptimalStrategy(query);
    
    console.log(`🎯 Using adaptive strategy: ${strategy} for query: "${query.original}"`);

    let vectorResults: SearchResult[] = [];
    let lexicalResults: SearchResult[] = [];
    let graphResults: SearchResult[] = [];

    switch (strategy) {
      case 'vector-heavy':
        vectorResults = await this.vectorSearch.search(query, Math.floor(topK * 0.7));
        lexicalResults = await this.lexicalSearch.search(query, Math.floor(topK * 0.2));
        graphResults = await this.graphSearch.search(query, Math.floor(topK * 0.1));
        break;

      case 'lexical-heavy':
        vectorResults = await this.vectorSearch.search(query, Math.floor(topK * 0.3));
        lexicalResults = await this.lexicalSearch.search(query, Math.floor(topK * 0.6));
        graphResults = await this.graphSearch.search(query, Math.floor(topK * 0.1));
        break;

      case 'graph-heavy':
        vectorResults = await this.vectorSearch.search(query, Math.floor(topK * 0.2));
        lexicalResults = await this.lexicalSearch.search(query, Math.floor(topK * 0.2));
        graphResults = await this.graphSearch.search(query, Math.floor(topK * 0.6));
        break;

      case 'balanced':
      default:
        const perStrategy = Math.floor(topK / 3);
        vectorResults = await this.vectorSearch.search(query, perStrategy);
        lexicalResults = await this.lexicalSearch.search(query, perStrategy);
        graphResults = await this.graphSearch.search(query, perStrategy);
        break;
    }

    return {
      vectorResults,
      lexicalResults,
      graphResults,
      strategy
    };
  }

  /**
   * Perform focused search for specific intent types
   */
  async focusedSearch(query: ProcessedQuery, topK: number = 20): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  }> {
    const intent = query.intent;
    
    switch (intent.type) {
      case 'function_search':
        return this.searchFunctions(query, topK);
      
      case 'class_search':
        return this.searchClasses(query, topK);
      
      case 'debug_search':
        return this.searchForDebugging(query, topK);
      
      case 'pattern_search':
        return this.searchPatterns(query, topK);
      
      case 'architecture_search':
        return this.searchArchitecture(query, topK);
      
      default:
        return this.search(query, topK);
    }
  }

  /**
   * Search specifically for functions and methods
   */
  private async searchFunctions(query: ProcessedQuery, topK: number): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  }> {
    // Boost function-level chunks
    const functionQuery = {
      ...query,
      keywords: [...query.keywords, 'function', 'method', 'procedure']
    };

    const vectorResults = await this.vectorSearch.searchWithFilter(
      functionQuery, 
      topK, 
      chunk => chunk.level === 'function' || chunk.level === 'block'
    );

    const lexicalResults = await this.lexicalSearch.searchWithBoost(
      functionQuery,
      topK,
      chunk => chunk.metadata.symbols.length > 0 ? 1.5 : 1.0
    );

    const graphResults = await this.graphSearch.searchWithRelationshipFilter(
      functionQuery,
      topK,
      ['calls', 'references']
    );

    return { vectorResults, lexicalResults, graphResults };
  }

  /**
   * Search specifically for classes and interfaces
   */
  private async searchClasses(query: ProcessedQuery, topK: number): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  }> {
    const classQuery = {
      ...query,
      keywords: [...query.keywords, 'class', 'interface', 'type']
    };

    const vectorResults = await this.vectorSearch.searchWithFilter(
      classQuery,
      topK,
      chunk => chunk.level === 'class' || chunk.level === 'file'
    );

    const lexicalResults = await this.lexicalSearch.searchWithBoost(
      classQuery,
      topK,
      chunk => chunk.level === 'class' ? 2.0 : 1.0
    );

    const graphResults = await this.graphSearch.searchWithRelationshipFilter(
      classQuery,
      topK,
      ['extends', 'implements', 'imports']
    );

    return { vectorResults, lexicalResults, graphResults };
  }

  /**
   * Search for debugging-related code
   */
  private async searchForDebugging(query: ProcessedQuery, topK: number): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  }> {
    const debugQuery = {
      ...query,
      keywords: [...query.keywords, 'error', 'exception', 'try', 'catch', 'debug']
    };

    const vectorResults = await this.vectorSearch.search(debugQuery, topK);

    const lexicalResults = await this.lexicalSearch.searchWithBoost(
      debugQuery,
      topK,
      chunk => {
        const content = chunk.content.toLowerCase();
        if (content.includes('error') || content.includes('exception') || 
            content.includes('try') || content.includes('catch')) {
          return 2.0;
        }
        return 1.0;
      }
    );

    const graphResults = await this.graphSearch.search(debugQuery, topK);

    return { vectorResults, lexicalResults, graphResults };
  }

  /**
   * Search for code patterns and similar implementations
   */
  private async searchPatterns(query: ProcessedQuery, topK: number): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  }> {
    // Pattern search relies heavily on vector similarity and graph relationships
    const vectorResults = await this.vectorSearch.search(query, Math.floor(topK * 0.6));
    const lexicalResults = await this.lexicalSearch.search(query, Math.floor(topK * 0.2));
    
    const graphResults = await this.graphSearch.searchWithRelationshipFilter(
      query,
      Math.floor(topK * 0.2),
      ['similar', 'references']
    );

    return { vectorResults, lexicalResults, graphResults };
  }

  /**
   * Search for architectural components and high-level structure
   */
  private async searchArchitecture(query: ProcessedQuery, topK: number): Promise<{
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  }> {
    const archQuery = {
      ...query,
      keywords: [...query.keywords, 'architecture', 'structure', 'design', 'pattern']
    };

    const vectorResults = await this.vectorSearch.searchWithFilter(
      archQuery,
      topK,
      chunk => chunk.level === 'file' || chunk.level === 'class'
    );

    const lexicalResults = await this.lexicalSearch.search(archQuery, topK);
    const graphResults = await this.graphSearch.search(archQuery, topK);

    return { vectorResults, lexicalResults, graphResults };
  }

  /**
   * Determine optimal search strategy based on query characteristics
   */
  private determineOptimalStrategy(query: ProcessedQuery): string {
    const { intent, keywords, entities } = query;

    // High entity count suggests lexical search might be better
    if (entities.length > 3) {
      return 'lexical-heavy';
    }

    // Relationship-heavy intents benefit from graph search
    if (['pattern_search', 'architecture_search'].includes(intent.type)) {
      return 'graph-heavy';
    }

    // Concept searches work well with vector search
    if (intent.type === 'concept_search' || keywords.some(k => 
      ['explain', 'understand', 'what', 'how'].includes(k))) {
      return 'vector-heavy';
    }

    // Default to balanced approach
    return 'balanced';
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: ProcessedQuery, topK: number): string {
    const keyData = {
      normalized: query.normalized,
      intent: query.intent.type,
      topK,
      entities: query.entities.sort(),
      keywords: query.keywords.sort()
    };
    
    return `hybrid_${JSON.stringify(keyData)}`;
  }

  /**
   * Split cached results back into separate categories
   */
  private splitCachedResults(allResults: SearchResult[]): {
    vectorResults: SearchResult[];
    lexicalResults: SearchResult[];
    graphResults: SearchResult[];
  } {
    // This is a simplified approach - in practice, you'd store metadata about result sources
    const third = Math.floor(allResults.length / 3);
    
    return {
      vectorResults: allResults.slice(0, third),
      lexicalResults: allResults.slice(third, third * 2),
      graphResults: allResults.slice(third * 2)
    };
  }

  /**
   * Get search performance metrics
   */
  getPerformanceMetrics() {
    return {
      searchMetrics: this.performanceMonitor.getMetrics(),
      cacheStats: this.cache.getStats(),
      vectorSearchStats: this.vectorSearch.getStats(),
      lexicalSearchStats: this.lexicalSearch.getStats(),
      graphSearchStats: this.graphSearch.getStats()
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Optimize search performance
   */
  optimize(): void {
    this.cache.optimize();
    this.vectorSearch.optimize();
    this.lexicalSearch.optimize();
    this.graphSearch.optimize();
  }
}
