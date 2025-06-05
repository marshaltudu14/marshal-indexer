import { SearchResult, HierarchicalChunk, ProcessedQuery } from '../common/types.js';
import { LexicalSearch } from './LexicalSearch.js';

/**
 * Enhanced search engine that combines lexical search with semantic understanding,
 * code-specific ranking, and result clustering for better performance
 */
export class EnhancedSearch {
  private lexicalSearch: LexicalSearch | null = null;
  private fileImportanceCache: Map<string, number> = new Map();
  private semanticCache: Map<string, any> = new Map();

  constructor(chunks?: Map<string, HierarchicalChunk>) {
    if (chunks) {
      this.lexicalSearch = new LexicalSearch(chunks);
    }
  }

  /**
   * Initialize with chunks if not provided in constructor
   */
  initialize(chunks: Map<string, HierarchicalChunk>): void {
    this.lexicalSearch = new LexicalSearch(chunks);
  }

  /**
   * Enhanced search with semantic understanding and improved ranking
   */
  async search(
    query: string,
    options: {
      maxResults?: number;
      includeSemanticExpansion?: boolean;
      enableResultClustering?: boolean;
      codeSpecificRanking?: boolean;
      fuzzySearch?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.lexicalSearch) {
      throw new Error('EnhancedSearch not initialized. Call initialize() with chunks first.');
    }

    const {
      maxResults = 20,
      includeSemanticExpansion = true,
      enableResultClustering = true,
      codeSpecificRanking = true
    } = options;

    // Step 1: Query expansion for better semantic matching
    const expandedQueries = includeSemanticExpansion
      ? this.expandQuery(query)
      : [query];

    // Step 2: Perform lexical search with expanded queries
    let allResults: SearchResult[] = [];

    for (const expandedQuery of expandedQueries) {
      // Create a ProcessedQuery object for the lexical search
      const processedQuery: ProcessedQuery = {
        original: expandedQuery,
        normalized: expandedQuery.toLowerCase(),
        intent: {
          type: 'general',
          confidence: 1.0,
          keywords: expandedQuery.split(' '),
          entities: [],
          context: []
        },
        entities: [],
        keywords: expandedQuery.split(' '),
        expandedQueries: [expandedQuery],
        context: {
          originalQuery: query,
          normalizedQuery: query.toLowerCase(),
          timestamp: Date.now(),
          sessionId: 'default',
          previousQueries: []
        },
        processingTime: 0
      };

      const lexicalResults = await this.lexicalSearch.search(processedQuery, maxResults * 2);

      // Weight results based on query expansion (original query gets higher weight)
      const weight = expandedQuery === query ? 1.0 : 0.7;
      const weightedResults = lexicalResults.map(result => ({
        ...result,
        score: result.score * weight
      }));

      allResults.push(...weightedResults);
    }

    // Step 3: Remove duplicates and merge scores
    const mergedResults = this.mergeAndDeduplicateResults(allResults);

    // Step 4: Apply enhanced ranking with code-specific signals
    if (codeSpecificRanking) {
      await this.applyCodeSpecificRanking(mergedResults, query);
    }

    // Step 5: Apply file importance weighting
    this.applyFileImportanceWeighting(mergedResults);

    // Step 6: Result clustering to group related results
    let finalResults = enableResultClustering
      ? this.clusterResults(mergedResults)
      : mergedResults;

    // Step 7: Sort by final score and limit results
    finalResults.sort((a, b) => b.score - a.score);

    return finalResults.slice(0, maxResults);
  }

  /**
   * Expand query with semantic understanding and code patterns
   */
  private expandQuery(query: string): string[] {
    const queries = [query];
    const queryLower = query.toLowerCase();

    // Code pattern expansions
    const codePatternExpansions: Record<string, string[]> = {
      'authentication': ['auth', 'login', 'signup', 'session', 'token', 'password'],
      'auth': ['authentication', 'login', 'signup', 'session', 'token'],
      'database': ['db', 'sql', 'query', 'table', 'schema', 'supabase'],
      'api': ['endpoint', 'route', 'fetch', 'axios', 'request', 'response'],
      'component': ['react', 'jsx', 'tsx', 'ui', 'element'],
      'hook': ['use', 'react', 'state', 'effect', 'context'],
      'form': ['input', 'submit', 'validation', 'field', 'button'],
      'user': ['customer', 'profile', 'account', 'person'],
      'error': ['exception', 'catch', 'try', 'fail', 'bug'],
      'config': ['configuration', 'settings', 'env', 'environment']
    };

    // Framework-specific expansions
    const frameworkExpansions: Record<string, string[]> = {
      'react': ['component', 'jsx', 'tsx', 'hook', 'state', 'props'],
      'nextjs': ['next', 'page', 'api', 'route', 'getServerSideProps'],
      'supabase': ['database', 'auth', 'client', 'query', 'table'],
      'typescript': ['ts', 'tsx', 'interface', 'type', 'generic'],
      'tailwind': ['css', 'class', 'style', 'design', 'ui']
    };

    // Add expansions based on query content
    for (const [key, expansions] of Object.entries(codePatternExpansions)) {
      if (queryLower.includes(key)) {
        queries.push(...expansions.map(exp => query.replace(new RegExp(key, 'gi'), exp)));
      }
    }

    for (const [key, expansions] of Object.entries(frameworkExpansions)) {
      if (queryLower.includes(key)) {
        queries.push(...expansions.map(exp => `${query} ${exp}`));
      }
    }

    // Add synonym expansions
    const synonyms: Record<string, string[]> = {
      'function': ['method', 'procedure', 'routine'],
      'class': ['component', 'object', 'entity'],
      'variable': ['field', 'property', 'attribute'],
      'create': ['make', 'build', 'generate', 'add'],
      'delete': ['remove', 'destroy', 'clear'],
      'update': ['modify', 'change', 'edit'],
      'get': ['fetch', 'retrieve', 'obtain'],
      'set': ['assign', 'define', 'configure']
    };

    for (const [key, syns] of Object.entries(synonyms)) {
      if (queryLower.includes(key)) {
        queries.push(...syns.map(syn => query.replace(new RegExp(key, 'gi'), syn)));
      }
    }

    // Remove duplicates and return unique queries
    return [...new Set(queries)].slice(0, 5); // Limit to 5 expanded queries
  }

  /**
   * Merge results and remove duplicates, combining scores
   */
  private mergeAndDeduplicateResults(results: SearchResult[]): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    for (const result of results) {
      const key = `${result.chunk.filePath}:${result.chunk.startLine}:${result.chunk.endLine}`;

      if (resultMap.has(key)) {
        const existing = resultMap.get(key)!;
        // Combine scores using weighted average
        existing.score = Math.max(existing.score, result.score);
        existing.relevance = Math.max(existing.relevance, result.relevance);
      } else {
        resultMap.set(key, { ...result });
      }
    }

    return Array.from(resultMap.values());
  }

  /**
   * Apply code-specific ranking signals
   */
  private async applyCodeSpecificRanking(
    results: SearchResult[],
    query: string
  ): Promise<void> {
    const queryLower = query.toLowerCase();

    for (const result of results) {
      const chunk = result.chunk;

      let codeSpecificBoost = 1.0;

      // Symbol density boost
      if (chunk.metadata?.symbolDensity) {
        codeSpecificBoost *= (1 + chunk.metadata.symbolDensity * 0.3);
      }

      // Code quality boost
      if (chunk.metadata?.codeQuality) {
        codeSpecificBoost *= (1 + chunk.metadata.codeQuality * 0.2);
      }

      // Framework relevance boost
      if (chunk.metadata?.frameworkSpecific) {
        for (const framework of chunk.metadata.frameworkSpecific) {
          if (queryLower.includes(framework.toLowerCase())) {
            codeSpecificBoost *= 1.4;
            break;
          }
        }
      }

      // Semantic keyword boost
      if (chunk.metadata?.semanticKeywords) {
        for (const keyword of chunk.metadata.semanticKeywords) {
          if (queryLower.includes(keyword.toLowerCase())) {
            codeSpecificBoost *= 1.3;
          }
        }
      }

      // Code pattern boost
      if (chunk.metadata?.codePatterns) {
        for (const pattern of chunk.metadata.codePatterns) {
          if (queryLower.includes(pattern.toLowerCase())) {
            codeSpecificBoost *= 1.2;
          }
        }
      }

      // Function/class name exact match boost
      if (chunk.functions) {
        for (const func of chunk.functions) {
          if (func.name && queryLower.includes(func.name.toLowerCase())) {
            codeSpecificBoost *= 1.5;
          }
        }
      }

      if (chunk.classes) {
        for (const cls of chunk.classes) {
          if (cls.name && queryLower.includes(cls.name.toLowerCase())) {
            codeSpecificBoost *= 1.5;
          }
        }
      }

      // Export importance boost
      if (chunk.content.includes('export default')) {
        codeSpecificBoost *= 1.3;
      } else if (chunk.content.includes('export')) {
        codeSpecificBoost *= 1.1;
      }

      // Documentation boost
      if (chunk.metadata?.documentationRatio && chunk.metadata.documentationRatio > 0.1) {
        codeSpecificBoost *= 1.1;
      }

      // Apply the boost
      result.score *= codeSpecificBoost;
    }
  }

  /**
   * Apply file importance weighting based on file type and characteristics
   */
  private applyFileImportanceWeighting(results: SearchResult[]): void {
    for (const result of results) {
      let importance = this.getFileImportance(result.chunk.filePath);
      result.score *= importance;
    }
  }

  /**
   * Get or calculate file importance
   */
  private getFileImportance(filePath: string): number {
    if (this.fileImportanceCache.has(filePath)) {
      return this.fileImportanceCache.get(filePath)!;
    }

    let importance = 1.0;
    const pathLower = filePath.toLowerCase();

    // File type importance
    if (pathLower.includes('/api/') || pathLower.includes('\\api\\')) importance *= 1.5;
    if (pathLower.includes('/components/') || pathLower.includes('\\components\\')) importance *= 1.3;
    if (pathLower.includes('/pages/') || pathLower.includes('\\pages\\')) importance *= 1.3;
    if (pathLower.includes('/lib/') || pathLower.includes('\\lib\\')) importance *= 1.2;
    if (pathLower.includes('/utils/') || pathLower.includes('\\utils\\')) importance *= 1.1;
    
    // Penalize test files
    if (pathLower.includes('test') || pathLower.includes('spec')) importance *= 0.7;
    
    // Penalize generated files
    if (pathLower.includes('generated') || pathLower.includes('.d.ts')) importance *= 0.5;
    
    // Boost important configuration files
    if (pathLower.includes('config') || pathLower.includes('index.')) importance *= 1.2;

    this.fileImportanceCache.set(filePath, importance);
    return importance;
  }

  /**
   * Cluster similar results to reduce redundancy
   */
  private clusterResults(results: SearchResult[]): SearchResult[] {
    const clusters: SearchResult[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < results.length; i++) {
      if (processed.has(i)) continue;

      const currentResult = results[i];
      if (!currentResult) continue;

      const cluster: SearchResult[] = [currentResult];
      processed.add(i);

      // Find similar results
      for (let j = i + 1; j < results.length; j++) {
        if (processed.has(j)) continue;

        const otherResult = results[j];
        if (!otherResult) continue;

        if (this.areResultsSimilar(currentResult, otherResult)) {
          cluster.push(otherResult);
          processed.add(j);
        }
      }

      clusters.push(cluster);
    }

    // Return the best result from each cluster
    return clusters.map(cluster => {
      // Sort cluster by score and return the best one
      cluster.sort((a, b) => b.score - a.score);
      const best = cluster[0];

      // If cluster has multiple results, boost the score slightly
      if (best && cluster.length > 1) {
        best.score *= (1 + Math.log(cluster.length) * 0.1);
      }

      return best;
    }).filter((result): result is SearchResult => result !== undefined);
  }

  /**
   * Check if two results are similar enough to be clustered
   */
  private areResultsSimilar(a: SearchResult, b: SearchResult): boolean {
    // Same file and close line numbers
    if (a.chunk.filePath === b.chunk.filePath) {
      const lineDiff = Math.abs(a.chunk.startLine - b.chunk.startLine);
      return lineDiff <= 10; // Within 10 lines
    }

    // Similar file paths (same directory or similar names)
    const pathA = a.chunk.filePath.toLowerCase();
    const pathB = b.chunk.filePath.toLowerCase();
    
    // Same directory
    const dirA = pathA.substring(0, pathA.lastIndexOf('/'));
    const dirB = pathB.substring(0, pathB.lastIndexOf('/'));
    if (dirA === dirB) return true;

    // Similar file names
    const fileA = pathA.substring(pathA.lastIndexOf('/') + 1);
    const fileB = pathB.substring(pathB.lastIndexOf('/') + 1);
    const similarity = this.calculateStringSimilarity(fileA, fileB);
    
    return similarity > 0.7;
  }

  /**
   * Calculate string similarity using Jaccard similarity
   */
  private calculateStringSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(''));
    const setB = new Set(b.toLowerCase().split(''));
    
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return intersection.size / union.size;
  }

  /**
   * Clear caches to free memory
   */
  clearCaches(): void {
    this.fileImportanceCache.clear();
    this.semanticCache.clear();
  }
}
