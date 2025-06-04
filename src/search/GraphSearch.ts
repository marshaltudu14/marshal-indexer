import { SearchResult, ProcessedQuery, HierarchicalChunk, CodeRelationship } from '../common/types.js';
import { extractWords, jaccardSimilarity } from '../utils/QueryUtils.js';

/**
 * Graph-based search using code relationships and dependencies
 * Provides excellent contextual understanding and related code discovery
 */
export class GraphSearch {
  private chunks: Map<string, HierarchicalChunk>;
  private relationships: Map<string, CodeRelationship[]>;
  private reverseRelationships: Map<string, CodeRelationship[]> = new Map();
  private stats = {
    totalSearches: 0,
    averageSearchTime: 0,
    graphSize: 0
  };

  constructor(
    chunks: Map<string, HierarchicalChunk>,
    relationships: Map<string, CodeRelationship[]>
  ) {
    this.chunks = chunks;
    this.relationships = relationships;
    this.buildReverseIndex();
  }

  /**
   * Perform graph-based search using relationships and context
   */
  async search(query: ProcessedQuery, topK: number = 20): Promise<SearchResult[]> {
    const startTime = Date.now();
    this.stats.totalSearches++;

    const results = new Map<string, SearchResult>();

    // 1. Direct content matching
    const directMatches = this.searchDirectMatches(query);
    this.addResults(results, directMatches, 1.0);

    // 2. Relationship-based expansion
    const relationshipMatches = this.searchRelationships(query, directMatches);
    this.addResults(results, relationshipMatches, 0.8);

    // 3. Dependency-based search
    const dependencyMatches = this.searchDependencies(query);
    this.addResults(results, dependencyMatches, 0.7);

    // 4. Hierarchical search (parent-child relationships)
    const hierarchicalMatches = this.searchHierarchical(query);
    this.addResults(results, hierarchicalMatches, 0.6);

    // 5. Similar code patterns
    const patternMatches = this.searchSimilarPatterns(query);
    this.addResults(results, patternMatches, 0.5);

    // Sort by relevance and return top results
    const finalResults = Array.from(results.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, topK);

    const searchTime = Date.now() - startTime;
    this.updateAverageSearchTime(searchTime);

    console.log(`🕸️ Graph search: ${finalResults.length} results in ${searchTime}ms`);

    return finalResults;
  }

  /**
   * Search with relationship type filter
   */
  async searchWithRelationshipFilter(
    query: ProcessedQuery,
    topK: number,
    relationshipTypes: string[]
  ): Promise<SearchResult[]> {
    const results = new Map<string, SearchResult>();

    // Find initial matches
    const directMatches = this.searchDirectMatches(query);
    
    // Expand using filtered relationships
    for (const match of directMatches) {
      const chunkRelationships = this.relationships.get(match.chunk.id) || [];
      
      for (const rel of chunkRelationships) {
        if (relationshipTypes.includes(rel.type)) {
          const targetChunk = this.chunks.get(rel.targetChunkId);
          if (targetChunk) {
            const score = match.score * rel.strength * 0.8;
            results.set(rel.targetChunkId, {
              chunk: this.convertToCodeChunk(targetChunk),
              score,
              distance: 1 - score,
              relevance: score
            });
          }
        }
      }
    }

    // Add original matches
    this.addResults(results, directMatches, 1.0);

    return Array.from(results.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, topK);
  }

  /**
   * Search for direct content matches
   */
  private searchDirectMatches(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = [...query.keywords, ...query.entities];

    for (const [, chunk] of this.chunks) {
      const score = this.calculateContentScore(chunk, queryWords);
      if (score > 0.1) {
        results.push({
          chunk: this.convertToCodeChunk(chunk),
          score,
          distance: 1 - score,
          relevance: score
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 50); // Limit initial matches
  }

  /**
   * Search using code relationships
   */
  private searchRelationships(query: ProcessedQuery, seedResults: SearchResult[]): SearchResult[] {
    const results: SearchResult[] = [];
    const visited = new Set<string>();

    for (const seedResult of seedResults.slice(0, 10)) { // Limit seed results
      const chunkId = seedResult.chunk.id;
      const relationships = this.relationships.get(chunkId) || [];

      for (const rel of relationships) {
        if (visited.has(rel.targetChunkId)) continue;
        visited.add(rel.targetChunkId);

        const targetChunk = this.chunks.get(rel.targetChunkId);
        if (targetChunk) {
          const relationshipScore = this.calculateRelationshipScore(rel, query);
          const propagatedScore = seedResult.score * rel.strength * relationshipScore;

          if (propagatedScore > 0.1) {
            results.push({
              chunk: this.convertToCodeChunk(targetChunk),
              score: propagatedScore,
              distance: 1 - propagatedScore,
              relevance: propagatedScore
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Search using dependency relationships
   */
  private searchDependencies(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = [...query.keywords, ...query.entities];

    for (const [, chunk] of this.chunks) {
      const dependencies = chunk.metadata.dependencies || [];

      for (const queryWord of queryWords) {
        for (const dep of dependencies) {
          if (dep.toLowerCase().includes(queryWord.toLowerCase()) ||
              queryWord.toLowerCase().includes(dep.toLowerCase())) {

            const score = this.calculateDependencyScore(chunk, queryWords);
            results.push({
              chunk: this.convertToCodeChunk(chunk),
              score,
              distance: 1 - score,
              relevance: score
            });
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Search using hierarchical relationships (parent-child)
   */
  private searchHierarchical(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = [...query.keywords, ...query.entities];

    for (const [, chunk] of this.chunks) {
      const score = this.calculateContentScore(chunk, queryWords);

      if (score > 0.3) { // Only expand from good matches
        // Add parent chunks
        if (chunk.parentId) {
          const parent = this.chunks.get(chunk.parentId);
          if (parent) {
            const parentScore = score * 0.7; // Reduce score for parent
            results.push({
              chunk: this.convertToCodeChunk(parent),
              score: parentScore,
              distance: 1 - parentScore,
              relevance: parentScore
            });
          }
        }

        // Add child chunks
        for (const childId of chunk.childIds) {
          const child = this.chunks.get(childId);
          if (child) {
            const childScore = score * 0.8; // Slightly reduce score for children
            results.push({
              chunk: this.convertToCodeChunk(child),
              score: childScore,
              distance: 1 - childScore,
              relevance: childScore
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Search for similar code patterns
   */
  private searchSimilarPatterns(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = new Set([...query.keywords, ...query.entities]);

    for (const [, chunk] of this.chunks) {
      const chunkWords = new Set([
        ...extractWords(chunk.content),
        ...chunk.metadata.symbols,
        ...chunk.metadata.concepts
      ]);

      const similarity = jaccardSimilarity(queryWords, chunkWords);

      if (similarity > 0.2) {
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
   * Build reverse relationship index for faster lookups
   */
  private buildReverseIndex(): void {
    console.log('🔨 Building graph search indices...');

    for (const [sourceId, relationships] of this.relationships) {
      for (const rel of relationships) {
        if (!this.reverseRelationships.has(rel.targetChunkId)) {
          this.reverseRelationships.set(rel.targetChunkId, []);
        }
        
        // Create reverse relationship
        this.reverseRelationships.get(rel.targetChunkId)!.push({
          sourceChunkId: rel.targetChunkId,
          targetChunkId: sourceId,
          type: rel.type,
          strength: rel.strength,
          context: rel.context
        });
      }
    }

    this.stats.graphSize = this.relationships.size + this.reverseRelationships.size;
    console.log(`✅ Built graph indices: ${this.relationships.size} forward, ${this.reverseRelationships.size} reverse`);
  }

  /**
   * Calculate content matching score
   */
  private calculateContentScore(chunk: HierarchicalChunk, queryWords: string[]): number {
    const content = chunk.content.toLowerCase();
    const symbols = chunk.metadata.symbols.join(' ').toLowerCase();
    const concepts = chunk.metadata.concepts.join(' ').toLowerCase();

    let score = 0;
    for (const word of queryWords) {
      const wordLower = word.toLowerCase();

      if (symbols.includes(wordLower)) {
        score += 1.0; // Symbol matches are most important
      } else if (concepts.includes(wordLower)) {
        score += 0.8; // Concept matches are important
      } else if (content.includes(wordLower)) {
        score += 0.6; // Content matches are good
      }
    }

    return Math.min(score / queryWords.length, 1.0);
  }

  /**
   * Calculate relationship relevance score
   */
  private calculateRelationshipScore(relationship: CodeRelationship, query: ProcessedQuery): number {
    const intent = query.intent;
    let score = 0.5; // Base score

    // Boost based on relationship type and query intent
    switch (intent.type) {
      case 'function_search':
        if (relationship.type === 'calls' || relationship.type === 'references') {
          score += 0.4;
        }
        break;
      
      case 'class_search':
        if (relationship.type === 'extends' || relationship.type === 'implements') {
          score += 0.5;
        }
        break;
      
      case 'debug_search':
        if (relationship.type === 'calls' || relationship.type === 'references') {
          score += 0.3;
        }
        break;
      
      case 'pattern_search':
        if (relationship.type === 'similar') {
          score += 0.6;
        }
        break;
    }

    // Boost based on relationship context
    if (relationship.context) {
      const contextWords = extractWords(relationship.context);
      const queryWords = [...query.keywords, ...query.entities];
      
      for (const queryWord of queryWords) {
        if (contextWords.some(cw => cw.includes(queryWord.toLowerCase()))) {
          score += 0.2;
          break;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate dependency matching score
   */
  private calculateDependencyScore(chunk: HierarchicalChunk, queryWords: string[]): number {
    const dependencies = chunk.metadata.dependencies || [];
    let matches = 0;

    for (const queryWord of queryWords) {
      for (const dep of dependencies) {
        if (dep.toLowerCase().includes(queryWord.toLowerCase())) {
          matches++;
          break;
        }
      }
    }

    return matches / Math.max(queryWords.length, 1);
  }

  /**
   * Add results to the results map, handling duplicates
   */
  private addResults(
    resultsMap: Map<string, SearchResult>,
    newResults: SearchResult[],
    weight: number
  ): void {
    for (const result of newResults) {
      const existing = resultsMap.get(result.chunk.id);
      if (existing) {
        // Boost existing result
        existing.relevance = Math.max(existing.relevance, result.relevance * weight);
        existing.score = Math.max(existing.score, result.score * weight);
      } else {
        // Add new result with weight
        resultsMap.set(result.chunk.id, {
          ...result,
          relevance: result.relevance * weight,
          score: result.score * weight
        });
      }
    }
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
      chunkIndex: 0,
      fileHash: '',
      lastModified: Date.now(),
      language: chunk.metadata.language,
      symbols: chunk.metadata.symbols,
      concepts: chunk.metadata.concepts,
      dependencies: chunk.metadata.dependencies,
      functions: chunk.metadata.symbols.filter(() => chunk.level === 'function'),
      classes: chunk.metadata.symbols.filter(() => chunk.level === 'class'),
      interfaces: [],
      types: [],
      imports: chunk.metadata.dependencies || [],
      exports: []
    };
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
   * Optimize graph search performance
   */
  optimize(): void {
    // Could implement graph compression, relationship pruning, etc.
    console.log('🔧 Graph search optimization completed');
  }
}
