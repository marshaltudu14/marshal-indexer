import { FlagEmbedding, EmbeddingModel } from 'fastembed';
import { promises as fs } from 'fs';
import { join } from 'path';
import { CodeChunk, SearchResult } from './types.js';
import { ensureDir, fileExists } from './utils.js';

interface StoredEmbedding {
  chunkId: string;
  embedding: number[];
}

/**
 * Manages embeddings and vector search using simple cosine similarity
 */
export class EmbeddingManager {
  private model: FlagEmbedding | null = null;
  private embeddings: StoredEmbedding[] = [];
  private chunks: CodeChunk[] = [];
  private embeddingsDir: string;
  private isInitialized = false;

  constructor(embeddingsDir: string) {
    this.embeddingsDir = embeddingsDir;
  }

  /**
   * Initialize the embedding manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await ensureDir(this.embeddingsDir);

    // Initialize the embedding model
    this.model = await FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15 // Use a smaller, faster model
    });

    await this.loadExistingIndex();
    this.isInitialized = true;
  }

  /**
   * Load existing embeddings and metadata
   */
  private async loadExistingIndex(): Promise<void> {
    const embeddingsPath = join(this.embeddingsDir, 'embeddings.json');
    const metadataPath = join(this.embeddingsDir, 'metadata.json');

    try {
      if (await fileExists(embeddingsPath) && await fileExists(metadataPath)) {
        // Load embeddings
        const embeddingsContent = await fs.readFile(embeddingsPath, 'utf-8');
        const rawEmbeddings = JSON.parse(embeddingsContent);

        // Convert embeddings to proper array format if needed
        this.embeddings = rawEmbeddings.map((item: { chunkId: string; embedding: number[] | Record<string, number> }) => ({
          chunkId: item.chunkId,
          embedding: Array.isArray(item.embedding)
            ? item.embedding
            : Object.values(item.embedding) as number[]
        }));

        // Load metadata
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        this.chunks = JSON.parse(metadataContent);

        console.log(`Loaded existing index with ${this.chunks.length} chunks`);
      } else {
        // Create new index
        this.embeddings = [];
        this.chunks = [];
        console.log('Created new embedding index');
      }
    } catch (error) {
      console.warn(`Failed to load existing index: ${error}`);
      this.embeddings = [];
      this.chunks = [];
    }
  }

  /**
   * Add chunks to the index
   */
  async addChunks(newChunks: CodeChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`Adding ${newChunks.length} chunks to index...`);

    // Generate embeddings in larger batches for better performance
    const batchSize = 500;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);
      const batchTexts = batch.map(chunk => this.prepareTextForEmbedding(chunk));

      try {
        if (!this.model) throw new Error('Model not initialized');

        const embeddingGenerator = this.model.embed(batchTexts);
        for await (const batchEmbeddings of embeddingGenerator) {
          // Store embeddings and chunks
          for (let j = 0; j < batchEmbeddings.length; j++) {
            const chunk = batch[j];
            if (!chunk) continue;

            // Convert embedding to proper array format
            const embeddingData = batchEmbeddings[j];
            if (!embeddingData) continue;

            const embedding = Array.isArray(embeddingData)
              ? embeddingData as number[]
              : Array.from(embeddingData as ArrayLike<number>);

            this.embeddings.push({
              chunkId: chunk.id,
              embedding: embedding
            });
            this.chunks.push(chunk);
          }
        }

        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newChunks.length / batchSize)}`);
      } catch (error) {
        console.error(`Failed to generate embeddings for batch starting at ${i}: ${error}`);
        // Continue with next batch
      }
    }

    console.log(`Successfully added chunks to index`);
  }

  /**
   * Remove chunks by file path
   */
  async removeChunksByFile(filePath: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const indicesToRemove: number[] = [];

    this.chunks.forEach((chunk, index) => {
      if (chunk.filePath === filePath) {
        indicesToRemove.push(index);
      }
    });

    if (indicesToRemove.length === 0) {
      return;
    }

    // Remove chunks and embeddings
    indicesToRemove.reverse().forEach(index => {
      this.chunks.splice(index, 1);
      this.embeddings.splice(index, 1);
    });

    console.log(`Removed ${indicesToRemove.length} chunks for file ${filePath}`);
  }

  /**
   * Search for similar chunks using cosine similarity
   */
  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.chunks.length === 0) {
      return [];
    }

    try {
      if (!this.model) throw new Error('Model not initialized');

      // Generate query embedding
      const embeddingGenerator = this.model.embed([query]);
      let queryEmbedding: number[] = [];

      for await (const batch of embeddingGenerator) {
        const firstEmbedding = batch[0];
        if (firstEmbedding) {
          queryEmbedding = firstEmbedding as number[];
        }
        break;
      }

      // Calculate cosine similarity with all embeddings
      const similarities: Array<{ index: number; similarity: number }> = [];

      for (let i = 0; i < this.embeddings.length; i++) {
        const embedding = this.embeddings[i];
        if (embedding?.embedding) {
          const similarity = this.cosineSimilarity(queryEmbedding, embedding.embedding);
          similarities.push({ index: i, similarity });
        }
      }

      // Sort by similarity and take top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, Math.min(topK, similarities.length));

      // Convert to search results
      const results: SearchResult[] = topResults
        .map(({ index, similarity }) => {
          const chunk = this.chunks[index];
          if (!chunk) return null;

          const distance = 1 - similarity; // Convert similarity to distance

          return {
            chunk,
            score: similarity,
            distance,
            relevance: this.calculateRelevance(chunk, query, similarity)
          };
        })
        .filter((result): result is SearchResult => result !== null);

      return results;
    } catch (error) {
      console.error(`Search failed: ${error}`);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
        normA += aVal * aVal;
        normB += bVal * bVal;
      }
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate relevance score based on multiple factors
   */
  private calculateRelevance(chunk: CodeChunk, query: string, similarityScore: number): number {
    let relevance = similarityScore;
    
    // Boost score for exact matches in symbols
    const queryLower = query.toLowerCase();
    if (chunk.symbols?.some(symbol => symbol.toLowerCase().includes(queryLower))) {
      relevance *= 1.5;
    }
    
    // Boost score for matches in file name
    if (chunk.filePath.toLowerCase().includes(queryLower)) {
      relevance *= 1.2;
    }
    
    // Boost score for certain file types
    if (chunk.language === 'typescript' || chunk.language === 'javascript') {
      relevance *= 1.1;
    }
    
    return relevance;
  }

  /**
   * Prepare text for embedding by combining content with metadata
   */
  private prepareTextForEmbedding(chunk: CodeChunk): string {
    let text = chunk.content;
    
    // Add file path context
    text += `\n// File: ${chunk.filePath}`;
    
    // Add language context
    text += `\n// Language: ${chunk.language}`;
    
    // Add symbols context
    if (chunk.symbols && chunk.symbols.length > 0) {
      text += `\n// Symbols: ${chunk.symbols.join(', ')}`;
    }
    
    return text;
  }

  /**
   * Save embeddings and metadata to disk
   */
  async save(): Promise<void> {
    const embeddingsPath = join(this.embeddingsDir, 'embeddings.json');
    const metadataPath = join(this.embeddingsDir, 'metadata.json');

    try {
      // Save embeddings
      await fs.writeFile(embeddingsPath, JSON.stringify(this.embeddings, null, 2));

      // Save metadata
      await fs.writeFile(metadataPath, JSON.stringify(this.chunks, null, 2));

      console.log(`Saved index with ${this.chunks.length} chunks`);
    } catch (error) {
      throw new Error(`Failed to save index: ${error}`);
    }
  }

  /**
   * Get index statistics
   */
  getStats(): { totalChunks: number; totalFiles: number; languages: Record<string, number> } {
    const languages: Record<string, number> = {};
    const files = new Set<string>();
    
    this.chunks.forEach(chunk => {
      files.add(chunk.filePath);
      languages[chunk.language] = (languages[chunk.language] || 0) + 1;
    });
    
    return {
      totalChunks: this.chunks.length,
      totalFiles: files.size,
      languages
    };
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.embeddings = [];
    this.chunks = [];

    // Remove files
    const embeddingsPath = join(this.embeddingsDir, 'embeddings.json');
    const metadataPath = join(this.embeddingsDir, 'metadata.json');

    try {
      await fs.unlink(embeddingsPath);
    } catch {}

    try {
      await fs.unlink(metadataPath);
    } catch {}

    console.log('Cleared all index data');
  }
}
