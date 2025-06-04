import { MarshalChunk, CodeRelationship } from '../common/types.js';
import { MarshalContextEngine } from '../engine/MarshalContextEngine.js';
import { FileProcessor } from './FileProcessor.js';

export class DataStore {
  private marshalChunks: Map<string, MarshalChunk> = new Map();
  private relationships: Map<string, CodeRelationship[]> = new Map();
  private fileToChunks: Map<string, string[]> = new Map();
  private contextEngine: MarshalContextEngine;
  private fileProcessor: FileProcessor;

  constructor(contextEngine: MarshalContextEngine, fileProcessor: FileProcessor) {
    this.contextEngine = contextEngine;
    this.fileProcessor = fileProcessor;
  }

  storeMarshalData(chunks: MarshalChunk[], relationships: CodeRelationship[]): void {
    for (const chunk of chunks) {
      this.marshalChunks.set(chunk.id, chunk);
    }

    for (const rel of relationships) {
      if (!this.relationships.has(rel.sourceChunkId)) {
        this.relationships.set(rel.sourceChunkId, []);
      }
      this.relationships.get(rel.sourceChunkId)!.push(rel);
    }

    console.log(`💾 Stored ${chunks.length} Marshal chunks and ${relationships.length} relationships`);
  }

  getMarshalMetadata(chunkId: string) {
    const marshalChunk = this.marshalChunks.get(chunkId);
    const relationships = this.relationships.get(chunkId) || [];
    
    return {
      level: marshalChunk?.level,
      concepts: marshalChunk?.metadata.concepts || [],
      complexity: marshalChunk?.metadata.complexity || 1,
      importance: marshalChunk?.metadata.importance || 1,
      relationships: relationships.map(r => ({
        type: r.type,
        target: r.targetChunkId,
        strength: r.strength,
        context: r.context
      }))
    };
  }

  async updateFile(filePath: string): Promise<void> {
    await this.removeFile(filePath);
    
    const result = await this.fileProcessor.processFileWithMarshal(filePath);
    
    if (result) {
      const standardChunks = this.fileProcessor.convertMarshalChunksToStandard(result.chunks);
      await this.contextEngine.addChunks(standardChunks);
      
      this.storeMarshalData(result.chunks, result.relationships);
      
      // Track file to chunks mapping
      const chunkIds = result.chunks.map(c => c.id);
      this.fileToChunks.set(filePath, chunkIds);

      console.log(`✅ Updated ${filePath}: ${result.chunks.length} chunks, ${result.relationships.length} relationships`);
    }
  }

  async removeFile(filePath: string): Promise<void> {
    const chunkIds = this.fileToChunks.get(filePath) || [];
    
    await this.contextEngine.removeChunksByFile(filePath);
    
    for (const chunkId of chunkIds) {
      this.marshalChunks.delete(chunkId);
      this.relationships.delete(chunkId);
    }
    
    this.fileToChunks.delete(filePath);
    
    if (chunkIds.length > 0) {
      console.log(`🗑️ Removed ${filePath}: ${chunkIds.length} chunks`);
    }
  }

  clear(): void {
    this.marshalChunks.clear();
    this.relationships.clear();
    this.fileToChunks.clear();
  }

  getStats(): {
    totalChunks: number;
    totalFiles: number;
    totalRelationships: number;
    languages: Record<string, number>;
    concepts: Record<string, number>;
    chunkLevels: Record<string, number>;
    averageComplexity: number;
  } {
    const languages: Record<string, number> = {};
    const concepts: Record<string, number> = {};
    const chunkLevels: Record<string, number> = {};
    let totalComplexity = 0;

    for (const chunk of this.marshalChunks.values()) {
      languages[chunk.metadata.language] = (languages[chunk.metadata.language] || 0) + 1;
      
      for (const concept of chunk.metadata.concepts) {
        concepts[concept] = (concepts[concept] || 0) + 1;
      }
      
      chunkLevels[chunk.level] = (chunkLevels[chunk.level] || 0) + 1;
      
      totalComplexity += chunk.metadata.complexity;
    }

    return {
      totalChunks: this.marshalChunks.size,
      totalFiles: this.fileToChunks.size,
      totalRelationships: Array.from(this.relationships.values()).reduce((sum, rels) => sum + rels.length, 0),
      languages,
      concepts,
      chunkLevels,
      averageComplexity: this.marshalChunks.size > 0 ? totalComplexity / this.marshalChunks.size : 0,
    };
  }
}