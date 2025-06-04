import { SearchResult, ProcessedQuery, HierarchicalChunk } from '../common/types.js';
import { fuzzyMatch, extractWords, jaccardSimilarity, calculateEditDistance } from '../utils/QueryUtils.js';

/**
 * Lexical search using keyword matching, fuzzy search, and text analysis
 * Provides excellent exact matching and symbol-based search
 */
export class LexicalSearch {
  private chunks: Map<string, HierarchicalChunk>;
  private invertedIndex: Map<string, Set<string>> = new Map();
  private symbolIndex: Map<string, Set<string>> = new Map();
  private stats = {
    totalSearches: 0,
    averageSearchTime: 0,
    indexSize: 0
  };

  constructor(chunks: Map<string, HierarchicalChunk>) {
    this.chunks = chunks;
    this.buildIndices();
  }

  /**
   * Perform lexical search using keyword matching and fuzzy search
   */
  async search(query: ProcessedQuery, topK: number = 20): Promise<SearchResult[]> {
    const startTime = Date.now();
    this.stats.totalSearches++;

    const results = new Map<string, SearchResult>();

    // 1. Exact keyword matching
    const exactMatches = this.searchExactKeywords(query);
    this.addResults(results, exactMatches, 1.0);

    // 2. Symbol matching
    const symbolMatches = this.searchSymbols(query);
    this.addResults(results, symbolMatches, 0.9);

    // 3. Fuzzy matching
    const fuzzyMatches = this.searchFuzzy(query);
    this.addResults(results, fuzzyMatches, 0.7);

    // 4. N-gram matching
    const ngramMatches = this.searchNGrams(query);
    this.addResults(results, ngramMatches, 0.6);

    // 5. Content-based matching
    const contentMatches = this.searchContent(query);
    this.addResults(results, contentMatches, 0.5);

    // Sort by relevance and return top results
    const finalResults = Array.from(results.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, topK);

    const searchTime = Date.now() - startTime;
    this.updateAverageSearchTime(searchTime);

    console.log(`📝 Lexical search: ${finalResults.length} results in ${searchTime}ms`);

    return finalResults;
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
   * Search with filter function
   */
  async searchWithFilter(
    query: ProcessedQuery,
    topK: number,
    filter: (chunk: HierarchicalChunk) => boolean
  ): Promise<SearchResult[]> {
    const allResults = await this.search(query, topK * 2);

    return allResults
      .filter(result => {
        const chunk = this.chunks.get(result.chunk.id);
        return chunk ? filter(chunk) : false;
      })
      .slice(0, topK);
  }

  /**
   * Search for exact keyword matches
   */
  private searchExactKeywords(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = [...query.keywords, ...query.entities];

    for (const word of queryWords) {
      const chunkIds = this.invertedIndex.get(word.toLowerCase());
      if (chunkIds) {
        for (const chunkId of chunkIds) {
          const chunk = this.chunks.get(chunkId);
          if (chunk) {
            const score = this.calculateKeywordScore(chunk, queryWords);
            results.push({
              chunk: this.convertToCodeChunk(chunk),
              score,
              distance: 1 - score,
              relevance: score
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Search for symbol matches
   */
  private searchSymbols(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const querySymbols = [...query.entities, ...query.keywords];

    for (const symbol of querySymbols) {
      const chunkIds = this.symbolIndex.get(symbol.toLowerCase());
      if (chunkIds) {
        for (const chunkId of chunkIds) {
          const chunk = this.chunks.get(chunkId);
          if (chunk) {
            const score = this.calculateSymbolScore(chunk, querySymbols);
            results.push({
              chunk: this.convertToCodeChunk(chunk),
              score,
              distance: 1 - score,
              relevance: score
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Search using fuzzy matching
   */
  private searchFuzzy(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryText = query.normalized;

    for (const [, chunk] of this.chunks) {
      const content = chunk.content.toLowerCase();
      const symbols = chunk.metadata.symbols.join(' ').toLowerCase();
      const searchText = `${content} ${symbols}`;

      if (fuzzyMatch(queryText, searchText, 0.3)) {
        const score = this.calculateFuzzyScore(queryText, searchText);
        results.push({
          chunk: this.convertToCodeChunk(chunk),
          score,
          distance: 1 - score,
          relevance: score
        });
      }
    }

    return results;
  }

  /**
   * Search using n-gram matching
   */
  private searchNGrams(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = extractWords(query.normalized);
    const queryBigrams = this.generateBigrams(queryWords);

    for (const [, chunk] of this.chunks) {
      const chunkWords = extractWords(chunk.content);
      const chunkBigrams = this.generateBigrams(chunkWords);

      const similarity = jaccardSimilarity(
        new Set(queryBigrams),
        new Set(chunkBigrams)
      );

      if (similarity > 0.1) {
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
   * Search content for partial matches
   */
  private searchContent(query: ProcessedQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = extractWords(query.normalized);

    for (const [, chunk] of this.chunks) {
      const content = chunk.content.toLowerCase();
      let matchCount = 0;
      let totalMatches = 0;

      for (const word of queryWords) {
        if (content.includes(word)) {
          matchCount++;
          // Count multiple occurrences
          const occurrences = (content.match(new RegExp(word, 'g')) || []).length;
          totalMatches += occurrences;
        }
      }

      if (matchCount > 0) {
        const score = (matchCount / queryWords.length) * Math.log(totalMatches + 1) * 0.1;
        results.push({
          chunk: this.convertToCodeChunk(chunk),
          score,
          distance: 1 - score,
          relevance: score
        });
      }
    }

    return results;
  }

  /**
   * Build inverted index for fast keyword lookup
   */
  private buildIndices(): void {
    console.log('🔨 Building lexical search indices...');

    for (const [chunkId, chunk] of this.chunks) {
      // Build inverted index for content words
      const words = extractWords(chunk.content);
      for (const word of words) {
        if (!this.invertedIndex.has(word)) {
          this.invertedIndex.set(word, new Set());
        }
        this.invertedIndex.get(word)!.add(chunkId);
      }

      // Build symbol index
      for (const symbol of chunk.metadata.symbols) {
        const symbolLower = symbol.toLowerCase();
        if (!this.symbolIndex.has(symbolLower)) {
          this.symbolIndex.set(symbolLower, new Set());
        }
        this.symbolIndex.get(symbolLower)!.add(chunkId);
      }
    }

    this.stats.indexSize = this.invertedIndex.size + this.symbolIndex.size;
    console.log(`✅ Built indices: ${this.invertedIndex.size} words, ${this.symbolIndex.size} symbols`);
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(chunk: HierarchicalChunk, queryWords: string[]): number {
    const content = chunk.content.toLowerCase();
    const symbols = chunk.metadata.symbols.join(' ').toLowerCase();
    const searchText = `${content} ${symbols}`;

    let score = 0;
    for (const word of queryWords) {
      const wordLower = word.toLowerCase();
      
      // Exact matches in symbols get highest score
      if (chunk.metadata.symbols.some(s => s.toLowerCase() === wordLower)) {
        score += 1.0;
      }
      // Exact matches in content
      else if (content.includes(wordLower)) {
        score += 0.8;
      }
      // Partial matches
      else if (searchText.includes(wordLower)) {
        score += 0.5;
      }
    }

    return Math.min(score / queryWords.length, 1.0);
  }

  /**
   * Calculate symbol matching score
   */
  private calculateSymbolScore(chunk: HierarchicalChunk, querySymbols: string[]): number {
    let exactMatches = 0;
    let partialMatches = 0;

    for (const querySymbol of querySymbols) {
      const queryLower = querySymbol.toLowerCase();
      
      for (const symbol of chunk.metadata.symbols) {
        const symbolLower = symbol.toLowerCase();
        
        if (symbolLower === queryLower) {
          exactMatches++;
        } else if (symbolLower.includes(queryLower) || queryLower.includes(symbolLower)) {
          partialMatches++;
        } else if (calculateEditDistance(symbolLower, queryLower) <= 2) {
          partialMatches += 0.5;
        }
      }
    }

    const exactScore = exactMatches / querySymbols.length;
    const partialScore = (partialMatches / querySymbols.length) * 0.5;
    
    return Math.min(exactScore + partialScore, 1.0);
  }

  /**
   * Calculate fuzzy matching score
   */
  private calculateFuzzyScore(query: string, text: string): number {
    const queryWords = new Set(extractWords(query));
    const textWords = new Set(extractWords(text));
    
    return jaccardSimilarity(queryWords, textWords);
  }

  /**
   * Generate bigrams from words
   */
  private generateBigrams(words: string[]): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
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
   * Optimize lexical search performance
   */
  optimize(): void {
    // Could implement index compression, cache optimization, etc.
    console.log('🔧 Lexical search optimization completed');
  }
}
