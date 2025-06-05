import { CodeChunk } from '../../common/types.js';
import { TermExtractor } from './TermExtractor.js';

/**
 * Lexical index builder using TF-IDF (MUCH faster than embeddings)
 */
export class LexicalIndexBuilder {
  private termFrequency: Map<string, Map<string, number>> = new Map(); // term -> chunkId -> frequency
  private documentFrequency: Map<string, number> = new Map(); // term -> document count
  private chunkTerms: Map<string, Set<string>> = new Map(); // chunkId -> terms

  /**
   * Build lexical index using TF-IDF
   */
  async buildIndex(chunks: CodeChunk[]): Promise<void> {
    console.log(`🚀 Building lexical index for ${chunks.length} chunks...`);
    const startTime = Date.now();

    // Clear existing index
    this.termFrequency.clear();
    this.documentFrequency.clear();
    this.chunkTerms.clear();

    // Process chunks in parallel batches
    const batchSize = 1000;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      // Process batch
      for (const chunk of batch) {
        const terms = TermExtractor.extractTerms(chunk.content);
        this.chunkTerms.set(chunk.id, terms);
        
        // Update term frequency
        for (const term of terms) {
          if (!this.termFrequency.has(term)) {
            this.termFrequency.set(term, new Map());
          }
          const termMap = this.termFrequency.get(term)!;
          termMap.set(chunk.id, (termMap.get(chunk.id) || 0) + 1);
          
          // Update document frequency
          this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
        }
      }

      console.log(`📊 Indexed ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ Lexical index built in ${duration.toFixed(1)}s`);
  }

  /**
   * Get term frequency for a specific term and chunk
   */
  getTermFrequency(term: string, chunkId: string): number {
    return this.termFrequency.get(term)?.get(chunkId) || 0;
  }

  /**
   * Get document frequency for a term
   */
  getDocumentFrequency(term: string): number {
    return this.documentFrequency.get(term) || 0;
  }

  /**
   * Get all terms for a chunk
   */
  getChunkTerms(chunkId: string): Set<string> {
    return this.chunkTerms.get(chunkId) || new Set();
  }

  /**
   * Get all term frequency data
   */
  getTermFrequencyMap(): Map<string, Map<string, number>> {
    return this.termFrequency;
  }

  /**
   * Get all document frequency data
   */
  getDocumentFrequencyMap(): Map<string, number> {
    return this.documentFrequency;
  }

  /**
   * Get all chunk terms data
   */
  getChunkTermsMap(): Map<string, Set<string>> {
    return this.chunkTerms;
  }

  /**
   * Load index data from external source
   */
  loadIndexData(
    termFrequency: Map<string, Map<string, number>>,
    documentFrequency: Map<string, number>,
    chunkTerms: Map<string, Set<string>>
  ): void {
    this.termFrequency = termFrequency;
    this.documentFrequency = documentFrequency;
    this.chunkTerms = chunkTerms;
  }

  /**
   * Clear all index data
   */
  clear(): void {
    this.termFrequency.clear();
    this.documentFrequency.clear();
    this.chunkTerms.clear();
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalTerms: number;
    totalChunks: number;
    averageTermsPerChunk: number;
  } {
    const totalTerms = this.termFrequency.size;
    const totalChunks = this.chunkTerms.size;
    
    let totalTermCount = 0;
    for (const terms of this.chunkTerms.values()) {
      totalTermCount += terms.size;
    }
    
    const averageTermsPerChunk = totalChunks > 0 ? totalTermCount / totalChunks : 0;

    return {
      totalTerms,
      totalChunks,
      averageTermsPerChunk
    };
  }
}
