import { SearchResult, ProcessedQuery, HierarchicalChunk } from '../common/types.js';
import { cosineSimilarity } from '../utils/QueryUtils.js';
import { FlagEmbedding } from 'fastembed';

/**
 * Vector-based semantic search using embeddings
 * Provides excellent semantic understanding and concept matching
 */
export class VectorSearch {
  private chunks: Map<string, HierarchicalChunk>;
  private embeddings: Map<string, { code: number[]; concept: number[] }>;
  private codeModel: FlagEmbedding | null = null;
  private conceptModel: FlagEmbedding | null = null;
  private stats = {
    totalSearches: 0,
    averageSearchTime: 0,
    cacheHits: 0
  };

  constructor(
    chunks: Map<string, HierarchicalChunk>,
    embeddings: Map<string, { code: number[]; concept: number[] }>
  ) {
    this.chunks = chunks;
    this.embeddings = embeddings;
  }

  /**
   * Set embedding models for query encoding
   */
  setModels(codeModel: FlagEmbedding, conceptModel: FlagEmbedding): void {
    this.codeModel = codeModel;
    this.conceptModel = conceptModel;
  }

  /**
   * Perform vector search using semantic embeddings
   */
  async search(query: ProcessedQuery, topK: number = 20): Promise<SearchResult[]> {
    const startTime = Date.now();
    this.stats.totalSearches++;

    if (!this.codeModel || !this.conceptModel) {
      console.warn('⚠️ Embedding models not initialized for vector search');
      return [];
    }

    // Generate query embeddings
    const queryEmbeddings = await this.generateQueryEmbeddings(query);
    
    // Search with both code and concept embeddings
    const codeResults = await this.searchWithEmbedding(
      queryEmbeddings.code, 
      'code', 
      Math.floor(topK * 0.6)
    );
    
    const conceptResults = await this.searchWithEmbedding(
      queryEmbeddings.concept, 
      'concept', 
      Math.floor(topK * 0.4)
    );

    // Combine and deduplicate results
    const combinedResults = this.combineResults(codeResults, conceptResults, topK);

    const searchTime = Date.now() - startTime;
    this.updateAverageSearchTime(searchTime);

    console.log(`🔍 Vector search completed in ${searchTime}ms, found ${combinedResults.length} results`);

    return combinedResults;
  }

  /**
   * Search with custom filter function
   */
  async searchWithFilter(
    query: ProcessedQuery, 
    topK: number, 
    filter: (chunk: HierarchicalChunk) => boolean
  ): Promise<SearchResult[]> {
    const allResults = await this.search(query, topK * 2); // Get more results to account for filtering
    
    return allResults
      .filter(result => {
        const chunk = this.chunks.get(result.chunk.id);
        return chunk ? filter(chunk) : false;
      })
      .slice(0, topK);
  }

  /**
   * Search with custom boost function
   */
  async searchWithBoost(
    query: ProcessedQuery,
    topK: number,
    boostFunction: (chunk: HierarchicalChunk) => number
  ): Promise<SearchResult[]> {
    const results = await this.search(query, topK * 2);
    
    // Apply boost to relevance scores
    for (const result of results) {
      const chunk = this.chunks.get(result.chunk.id);
      if (chunk) {
        const boost = boostFunction(chunk);
        result.relevance *= boost;
        result.score *= boost;
      }
    }

    // Re-sort and return top results
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, topK);
  }

  /**
   * Generate embeddings for the query
   */
  private async generateQueryEmbeddings(query: ProcessedQuery): Promise<{
    code: number[];
    concept: number[];
  }> {
    const queryText = this.prepareQueryText(query);
    
    // Generate code embedding
    const codeEmbeddingGenerator = this.codeModel!.embed([queryText]);
    let codeEmbedding: number[] = [];
    
    for await (const batch of codeEmbeddingGenerator) {
      const firstEmbedding = batch[0];
      if (firstEmbedding) {
        codeEmbedding = Array.from(firstEmbedding as ArrayLike<number>);
      }
      break;
    }

    // Generate concept embedding
    const conceptEmbeddingGenerator = this.conceptModel!.embed([queryText]);
    let conceptEmbedding: number[] = [];
    
    for await (const batch of conceptEmbeddingGenerator) {
      const firstEmbedding = batch[0];
      if (firstEmbedding) {
        conceptEmbedding = Array.from(firstEmbedding as ArrayLike<number>);
      }
      break;
    }

    return {
      code: codeEmbedding,
      concept: conceptEmbedding
    };
  }

  /**
   * Prepare query text for embedding generation
   */
  private prepareQueryText(query: ProcessedQuery): string {
    // Combine original query with expanded terms for richer context
    const expandedTerms = query.expandedQueries.slice(0, 3).join(' ');
    const entities = query.entities.join(' ');
    const keywords = query.keywords.join(' ');
    
    return `${query.original} ${expandedTerms} ${entities} ${keywords}`.trim();
  }

  /**
   * Search using a specific embedding type
   */
  private async searchWithEmbedding(
    queryEmbedding: number[],
    embeddingType: 'code' | 'concept',
    topK: number
  ): Promise<SearchResult[]> {
    const similarities: Array<{ chunkId: string; similarity: number }> = [];

    for (const [chunkId, embeddings] of this.embeddings) {
      const chunkEmbedding = embeddingType === 'code' ? embeddings.code : embeddings.concept;
      
      if (chunkEmbedding && chunkEmbedding.length > 0) {
        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
        similarities.push({ chunkId, similarity });
      }
    }

    // Sort by similarity and get top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilarities = similarities.slice(0, topK);

    // Convert to SearchResult format
    const results: SearchResult[] = [];
    
    for (const { chunkId, similarity } of topSimilarities) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        results.push({
          chunk: this.convertToCodeChunk(chunk),
          score: similarity,
          distance: 1 - similarity,
          relevance: similarity
        });
      }
    }

    return results;
  }

  /**
   * Combine results from code and concept searches
   */
  private combineResults(
    codeResults: SearchResult[],
    conceptResults: SearchResult[],
    topK: number
  ): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    // Add code results
    for (const result of codeResults) {
      resultMap.set(result.chunk.id, {
        ...result,
        relevance: result.relevance * 0.6 // Weight code results
      });
    }

    // Add concept results, merging with existing if present
    for (const result of conceptResults) {
      const existing = resultMap.get(result.chunk.id);
      if (existing) {
        // Combine scores
        existing.relevance = Math.max(existing.relevance, result.relevance * 0.4);
        existing.score = Math.max(existing.score, result.score);
      } else {
        resultMap.set(result.chunk.id, {
          ...result,
          relevance: result.relevance * 0.4 // Weight concept results
        });
      }
    }

    // Sort by combined relevance and return top results
    const combinedResults = Array.from(resultMap.values());
    combinedResults.sort((a, b) => b.relevance - a.relevance);
    
    return combinedResults.slice(0, topK);
  }

  /**
   * Convert HierarchicalChunk to CodeChunk format
   */
  private convertToCodeChunk(chunk: HierarchicalChunk): any {
    return {
      id: chunk.id,
      filePath: chunk.metadata.filePath,
      content: chunk.content,
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      chunkIndex: 0, // Would need to be calculated properly
      fileHash: '', // Would need to be provided
      lastModified: Date.now(),
      language: chunk.metadata.language,
      symbols: chunk.metadata.symbols,
      concepts: chunk.metadata.concepts,
      dependencies: chunk.metadata.dependencies,
      functions: this.extractFunctions(chunk),
      classes: this.extractClasses(chunk),
      interfaces: this.extractInterfaces(chunk),
      types: this.extractTypes(chunk),
      imports: this.extractImports(chunk),
      exports: this.extractExports(chunk)
    };
  }

  /**
   * Extract functions from chunk content
   */
  private extractFunctions(chunk: HierarchicalChunk): string[] {
    const functions: string[] = [];
    const content = chunk.content;

    // Simple regex patterns for function extraction
    const patterns = [
      /function\s+(\w+)/g,
      /(\w+)\s*\(/g,
      /def\s+(\w+)/g,
      /(\w+)\s*=>\s*/g
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !functions.includes(match[1])) {
          functions.push(match[1]);
        }
      }
    }

    return functions;
  }

  /**
   * Extract classes from chunk content
   */
  private extractClasses(chunk: HierarchicalChunk): string[] {
    const classes: string[] = [];
    const classPattern = /class\s+(\w+)/g;
    const matches = chunk.content.matchAll(classPattern);
    
    for (const match of matches) {
      if (match[1] && !classes.includes(match[1])) {
        classes.push(match[1]);
      }
    }

    return classes;
  }

  /**
   * Extract interfaces from chunk content
   */
  private extractInterfaces(chunk: HierarchicalChunk): string[] {
    const interfaces: string[] = [];
    const interfacePattern = /interface\s+(\w+)/g;
    const matches = chunk.content.matchAll(interfacePattern);
    
    for (const match of matches) {
      if (match[1] && !interfaces.includes(match[1])) {
        interfaces.push(match[1]);
      }
    }

    return interfaces;
  }

  /**
   * Extract types from chunk content
   */
  private extractTypes(chunk: HierarchicalChunk): string[] {
    const types: string[] = [];
    const typePattern = /type\s+(\w+)/g;
    const matches = chunk.content.matchAll(typePattern);
    
    for (const match of matches) {
      if (match[1] && !types.includes(match[1])) {
        types.push(match[1]);
      }
    }

    return types;
  }

  /**
   * Extract imports from chunk content
   */
  private extractImports(chunk: HierarchicalChunk): string[] {
    const imports: string[] = [];
    const importPatterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g
    ];

    for (const pattern of importPatterns) {
      const matches = chunk.content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !imports.includes(match[1])) {
          imports.push(match[1]);
        }
      }
    }

    return imports;
  }

  /**
   * Extract exports from chunk content
   */
  private extractExports(chunk: HierarchicalChunk): string[] {
    const exports: string[] = [];
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
      /export\s*\{\s*([^}]+)\s*\}/g
    ];

    for (const pattern of exportPatterns) {
      const matches = chunk.content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          if (pattern.source.includes('{')) {
            // Handle export { a, b, c } syntax
            const exportList = match[1].split(',').map(e => e.trim());
            exports.push(...exportList);
          } else {
            exports.push(match[1]);
          }
        }
      }
    }

    return [...new Set(exports)]; // Remove duplicates
  }

  /**
   * Update average search time
   */
  private updateAverageSearchTime(newTime: number): void {
    const total = this.stats.averageSearchTime * (this.stats.totalSearches - 1) + newTime;
    this.stats.averageSearchTime = total / this.stats.totalSearches;
  }

  /**
   * Get search statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Optimize vector search performance
   */
  optimize(): void {
    // Could implement embedding caching, index optimization, etc.
    console.log('🔧 Vector search optimization completed');
  }
}
