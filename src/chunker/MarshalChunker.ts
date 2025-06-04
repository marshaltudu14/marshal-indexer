// import { estimateTokenCount } from '../utils.js';
import { MarshalChunk, CodeRelationship } from '../common/types.js';
import { createFileChunk, parseCodeStructure, createHierarchicalChunks } from './ChunkCreation.js';
import { buildRelationships } from './RelationshipBuilder.js';
import { indexSymbolsAndConcepts } from './SymbolConceptIndexer.js';

/**
 * Marshal Context Engine - Hierarchical chunker that builds code understanding graphs
 */
export class MarshalChunker {
  private chunks: Map<string, MarshalChunk> = new Map();
  private relationships: Map<string, CodeRelationship[]> = new Map();
  private symbolIndex: Map<string, string[]> = new Map(); // symbol -> chunk IDs
  private conceptIndex: Map<string, string[]> = new Map(); // concept -> chunk IDs

  /**
   * Process a file and create hierarchical chunks with relationships
   */
  async processFile(filePath: string, content: string, language: string): Promise<{
    chunks: MarshalChunk[];
    relationships: CodeRelationship[];
  }> {
    console.log(`🔍 Processing ${filePath} with Marshal chunking...`);
    
    const lines = content.split('\n');
    const fileChunk = createFileChunk(filePath, content, language);
    this.chunks.set(fileChunk.id, fileChunk);

    // Parse code structure
    const codeStructure = parseCodeStructure(lines, language);
    
    // Create hierarchical chunks
    const hierarchicalChunks = createHierarchicalChunks(
      codeStructure, 
      filePath, 
      language, 
      fileChunk.id
    );

    // Add newly created chunks to the main chunks map
    for (const chunk of hierarchicalChunks) {
      this.chunks.set(chunk.id, chunk);
    }

    // Build relationships
    const relationships = buildRelationships(hierarchicalChunks, this.symbolIndex, this.conceptIndex);
    
    // Store relationships
    for (const rel of relationships) {
      if (!this.relationships.has(rel.sourceChunkId)) {
        this.relationships.set(rel.sourceChunkId, []);
      }
      this.relationships.get(rel.sourceChunkId)!.push(rel);
    }

    // Index symbols and concepts
    indexSymbolsAndConcepts(hierarchicalChunks, this.symbolIndex, this.conceptIndex);

    console.log(`✅ Created ${hierarchicalChunks.length} chunks with ${relationships.length} relationships`);
    
    return {
      chunks: [fileChunk, ...hierarchicalChunks],
      relationships
    };
  }

  // Getters for external access
  getChunks(): Map<string, MarshalChunk> {
    return this.chunks;
  }

  getRelationships(): Map<string, CodeRelationship[]> {
    return this.relationships;
  }

  getSymbolIndex(): Map<string, string[]> {
    return this.symbolIndex;
  }

  getConceptIndex(): Map<string, string[]> {
    return this.conceptIndex;
  }
}