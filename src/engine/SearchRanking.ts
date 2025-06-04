import { FlagEmbedding } from 'fastembed';
import { QueryIntent, HierarchicalChunk, CodeRelationship, SearchResult } from '../common/types.js';
import { cosineSimilarity, convertToCodeChunk, mergeAndDeduplicateResults, extractWords, calculateEditDistance, extractKeywords } from './utils.js';

export class SearchRanking {
  private chunks: Map<string, HierarchicalChunk>;
  private embeddings: Map<string, { code: number[]; concept: number[] }>;
  private relationships: Map<string, CodeRelationship[]>;
  private codeModel: FlagEmbedding | null;
  private conceptModel: FlagEmbedding | null;

  constructor(
    chunks: Map<string, HierarchicalChunk>,
    embeddings: Map<string, { code: number[]; concept: number[] }>,
    relationships: Map<string, CodeRelationship[]>,
    codeModel: FlagEmbedding | null,
    conceptModel: FlagEmbedding | null
  ) {
    this.chunks = chunks;
    this.embeddings = embeddings;
    this.relationships = relationships;
    this.codeModel = codeModel;
    this.conceptModel = conceptModel;
  }

  /**
   * Multi-model search using both code and concept embeddings
   */
  public async multiModelSearch(queries: string[], topK: number): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    for (const query of queries) {
      // Search with code model (structure-focused)
      const codeResults = await this.searchWithModel(query, this.codeModel!, 'code', topK / 2);
      
      // Search with concept model (semantic-focused)
      const conceptResults = await this.searchWithModel(query, this.conceptModel!, 'concept', topK / 2);
      
      allResults.push(...codeResults, ...conceptResults);
    }

    // Deduplicate and merge scores
    const mergedResults = mergeAndDeduplicateResults(allResults);
    
    // Sort by combined score and return top candidates
    mergedResults.sort((a, b) => b.relevance - a.relevance);
    return mergedResults.slice(0, topK);
  }

  /**
   * Search with a specific embedding model
   */
  private async searchWithModel(
    query: string, 
    model: FlagEmbedding, 
    modelType: 'code' | 'concept', 
    topK: number
  ): Promise<SearchResult[]> {
    // Generate query embedding
    const embeddingGenerator = model.embed([query]);
    let queryEmbedding: number[] = [];

    for await (const batch of embeddingGenerator) {
      const firstEmbedding = batch[0];
      if (firstEmbedding) {
        queryEmbedding = firstEmbedding as number[];
      }
      break;
    }

    // Calculate similarities
    const similarities: Array<{ chunkId: string; similarity: number }> = [];
    
    for (const [chunkId, embeddings] of this.embeddings) {
      const chunkEmbedding = modelType === 'code' ? embeddings.code : embeddings.concept;
      if (chunkEmbedding) {
        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
        similarities.push({ chunkId, similarity });
      }
    }

    // Sort and get top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilarities = similarities.slice(0, topK);

    // Convert to SearchResult format
    return topSimilarities.map(({ chunkId, similarity }) => {
      const chunk = this.chunks.get(chunkId);
      if (!chunk) return null;

      return {
        chunk: convertToCodeChunk(chunk),
        score: similarity,
        distance: 1 - similarity,
        relevance: similarity
      };
    }).filter((result): result is SearchResult => result !== null);
  }

  /**
   * Expand results with relationship-based candidates
   */
  public async expandWithRelationships(candidates: SearchResult[], intent: QueryIntent): Promise<SearchResult[]> {
    const expanded = [...candidates];
    const addedIds = new Set(candidates.map(c => c.chunk.id));

    for (const candidate of candidates) {
      const relationships = this.relationships.get(candidate.chunk.id) || [];

      for (const rel of relationships) {
        if (addedIds.has(rel.targetChunkId)) continue;

        const targetChunk = this.chunks.get(rel.targetChunkId);
        if (!targetChunk) continue;

        // Calculate relationship-based relevance
        let relRelevance = candidate.relevance * rel.strength;

        // Boost based on relationship type and intent
        switch (intent.type) {
          case 'function_search':
            if (rel.type === 'calls' || rel.type === 'references') relRelevance *= 1.5;
            break;
          case 'class_search':
            if (rel.type === 'extends' || rel.type === 'implements') relRelevance *= 1.8;
            break;
          case 'implementation_search':
            if (rel.type === 'similar' || rel.type === 'references') relRelevance *= 1.3;
            break;
        }

        if (relRelevance > 0.3) { // Only add if relevance is significant
          expanded.push({
            chunk: convertToCodeChunk(targetChunk),
            score: relRelevance,
            distance: 1 - relRelevance,
            relevance: relRelevance
          });
          addedIds.add(rel.targetChunkId);
        }
      }
    }

    return expanded;
  }

  /**
   * Advanced re-ranking using multiple factors
   */
  public async advancedRerank(candidates: SearchResult[], query: string, intent: QueryIntent): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase();
    const queryWords = extractKeywords(query);

    for (const result of candidates) {
      let newRelevance = result.relevance;
      const chunk = result.chunk;
      const hChunk = this.chunks.get(chunk.id);

      if (!hChunk) continue;

      // Factor 1: Exact symbol matches (highest priority)
      const symbolMatches = this.calculateSymbolMatches(hChunk.metadata.symbols, queryWords, queryLower);
      newRelevance += symbolMatches * 2.0;

      // Factor 2: Code complexity and importance
      const complexityScore = this.calculateComplexityScore(hChunk);
      newRelevance += complexityScore * 0.5;

      // Factor 3: Intent-specific boosting
      const intentBoost = this.calculateIntentBoost(hChunk, intent);
      newRelevance *= intentBoost;

      // Factor 4: Recency and usage patterns
      const recencyScore = this.calculateRecencyScore(hChunk);
      newRelevance += recencyScore * 0.3;

      // Factor 5: File type and location relevance
      const locationScore = this.calculateLocationScore(hChunk, intent);
      newRelevance += locationScore * 0.4;

      // Factor 6: Cross-reference density
      const crossRefScore = this.calculateCrossReferenceScore(hChunk);
      newRelevance += crossRefScore * 0.6;

      result.relevance = Math.min(newRelevance, 10.0); // Cap at 10.0
    }

    // Sort by new relevance scores
    candidates.sort((a, b) => b.relevance - a.relevance);
    return candidates;
  }

  /**
   * Context-aware filtering based on intent
   */
  public contextAwareFilter(results: SearchResult[], intent: QueryIntent, topK: number): SearchResult[] {
    const filtered: SearchResult[] = [];
    const seenFiles = new Set<string>();
    const seenConcepts = new Set<string>();

    for (const result of results) {
      if (filtered.length >= topK) break;

      const chunk = result.chunk;
      const hChunk = this.chunks.get(chunk.id);
      if (!hChunk) continue;

      // Diversity filtering - avoid too many results from same file
      const fileKey = hChunk.metadata.filePath;
      const fileCount = Array.from(seenFiles).filter(f => f === fileKey).length;
      if (fileCount >= 3) continue; // Max 3 results per file

      // Concept diversity - avoid redundant concepts
      const chunkConcepts = hChunk.metadata.concepts;
      const conceptOverlap = chunkConcepts.filter(c => seenConcepts.has(c)).length;
      if (conceptOverlap > chunkConcepts.length * 0.8) continue; // Skip if >80% concept overlap

      // Intent-specific filtering
      if (!this.passesIntentFilter(hChunk, intent)) continue;

      // Quality threshold
      if (result.relevance < 0.2) continue;

      filtered.push(result);
      seenFiles.add(fileKey);
      chunkConcepts.forEach(c => seenConcepts.add(c));
    }

    return filtered;
  }

  /**
   * Calculate symbol matches with fuzzy matching
   */
  private calculateSymbolMatches(symbols: string[], queryWords: string[], queryLower: string): number {
    let score = 0;

    for (const symbol of symbols) {
      const symbolLower = symbol.toLowerCase();

      // Exact match
      if (symbolLower === queryLower) {
        score += 3.0;
        continue;
      }

      // Substring match
      if (symbolLower.includes(queryLower) || queryLower.includes(symbolLower)) {
        score += 2.0;
        continue;
      }

      // Word-level matches
      const symbolWords = extractWords(symbolLower);
      let wordMatches = 0;
      for (const qWord of queryWords) {
        for (const sWord of symbolWords) {
          if (qWord === sWord) wordMatches += 1.0;
          else if (qWord.includes(sWord) || sWord.includes(qWord)) wordMatches += 0.7;
          else if (calculateEditDistance(qWord, sWord) <= 2) wordMatches += 0.5;
        }
      }
      score += wordMatches / Math.max(queryWords.length, symbolWords.length);
    }

    return Math.min(score, 5.0); // Cap at 5.0
  }

  /**
   * Calculate complexity score based on code characteristics
   */
  private calculateComplexityScore(chunk: HierarchicalChunk): number {
    let score = 0;

    // Higher level chunks are more important
    switch (chunk.level) {
      case 'file': score += 0.8; break;
      case 'class': score += 0.6; break;
      case 'function': score += 0.4; break;
      case 'block': score += 0.2; break;
      case 'line': score += 0.1; break;
    }

    // More symbols indicate higher importance
    score += Math.min(chunk.metadata.symbols.length * 0.1, 0.5);

    // Complexity factor
    score += Math.min(chunk.metadata.complexity * 0.1, 0.3);

    return score;
  }

  /**
   * Calculate intent-specific boost
   */
  private calculateIntentBoost(chunk: HierarchicalChunk, intent: QueryIntent): number {
    let boost = 1.0;

    switch (intent.type) {
      case 'function_search':
        if (chunk.level === 'function' || chunk.level === 'block') boost *= 1.5;
        break;
      case 'class_search':
        if (chunk.level === 'class' || chunk.level === 'file') boost *= 1.5;
        break;
      case 'debug_search':
        if (chunk.metadata.concepts.some(c => c.includes('error') || c.includes('exception'))) boost *= 1.8;
        break;
      case 'implementation_search':
        if (chunk.level === 'function' || chunk.level === 'class') boost *= 1.3;
        break;
    }

    return boost;
  }

  /**
   * Calculate recency score (placeholder - would use actual file modification times)
   */
  private calculateRecencyScore(_chunk: HierarchicalChunk): number {
    // This would calculate based on file modification time, git history, etc.
    return 0.1;
  }

  /**
   * Calculate location score based on file path and intent
   */
  private calculateLocationScore(chunk: HierarchicalChunk, intent: QueryIntent): number {
    const filePath = chunk.metadata.filePath.toLowerCase();
    let score = 0;

    // Boost for certain directories based on intent
    if (intent.type === 'function_search' && filePath.includes('/utils/')) score += 0.3;
    if (intent.type === 'class_search' && filePath.includes('/models/')) score += 0.3;
    if (intent.type === 'debug_search' && filePath.includes('/test/')) score += 0.2;

    // Boost for main source directories
    if (filePath.includes('/src/') || filePath.includes('/lib/')) score += 0.2;

    return score;
  }

  /**
   * Calculate cross-reference score
   */
  private calculateCrossReferenceScore(chunk: HierarchicalChunk): number {
    const relationships = this.relationships.get(chunk.id) || [];
    return Math.min(relationships.length * 0.1, 0.5);
  }

  /**
   * Check if chunk passes intent-specific filters
   */
  private passesIntentFilter(chunk: HierarchicalChunk, intent: QueryIntent): boolean {
    switch (intent.type) {
      case 'function_search':
        return chunk.level === 'function' || chunk.level === 'block' || chunk.metadata.symbols.length > 0;
      case 'class_search':
        return chunk.level === 'class' || chunk.level === 'file';
      case 'debug_search':
        return true; // Debug searches can match anything
      default:
        return true;
    }
  }
}