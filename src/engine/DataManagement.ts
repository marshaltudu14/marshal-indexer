import { FlagEmbedding } from 'fastembed';
import { HierarchicalChunk } from '../common/types.js';

export class DataManagement {
  private codeModel: FlagEmbedding | null;
  private conceptModel: FlagEmbedding | null;

  constructor(codeModel: FlagEmbedding | null, conceptModel: FlagEmbedding | null) {
    this.codeModel = codeModel;
    this.conceptModel = conceptModel;
  }

  /**
   * Generate embeddings for chunks
   */
  public async generateEmbeddings(
    chunks: HierarchicalChunk[],
    embeddingsMap: Map<string, { code: number[]; concept: number[] }>
  ): Promise<void> {
    if (!this.codeModel || !this.conceptModel) {
      throw new Error('Models not initialized');
    }

    const texts = chunks.map(chunk => this.prepareTextForEmbedding(chunk));

    // Generate code embeddings
    const codeEmbeddingGenerator = this.codeModel.embed(texts);
    const codeEmbeddings: number[][] = [];

    for await (const batch of codeEmbeddingGenerator) {
      for (const embedding of batch) {
        codeEmbeddings.push(Array.from(embedding as ArrayLike<number>));
      }
    }

    // Generate concept embeddings
    const conceptEmbeddingGenerator = this.conceptModel.embed(texts);
    const conceptEmbeddings: number[][] = [];

    for await (const batch of conceptEmbeddingGenerator) {
      for (const embedding of batch) {
        conceptEmbeddings.push(Array.from(embedding as ArrayLike<number>));
      }
    }

    // Store embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk && codeEmbeddings[i] && conceptEmbeddings[i]) {
        embeddingsMap.set(chunk.id, {
          code: codeEmbeddings[i]!,
          concept: conceptEmbeddings[i]!
        });
      }
    }
  }

  /**
   * Prepare text for embedding
   */
  private prepareTextForEmbedding(chunk: HierarchicalChunk): string {
    let text = chunk.content;
    text += `\n// File: ${chunk.metadata.filePath}`;
    text += `\n// Language: ${chunk.metadata.language}`;

    if (chunk.metadata.symbols.length > 0) {
      text += `\n// Symbols: ${chunk.metadata.symbols.join(', ')}`;
    }

    return text;
  }

  /**
   * Load existing data (placeholder for now)
   */
  public async loadExistingData(): Promise<void> {
    // This would load existing chunks, embeddings, and relationships
    console.log('📂 Loading existing context data...');
  }
}