import { promises as fs } from 'fs';
import { CodeChunk, MarshalChunk, CodeRelationship, IndexingOptions } from '../common/types.js';
import { getFileInfo, calculateContentHash } from '../utils.js';
import { MarshalChunker } from '../chunker/MarshalChunker.js';

export class FileProcessor {
  private chunker: MarshalChunker;
  private options: IndexingOptions;

  constructor(chunker: MarshalChunker, options: IndexingOptions) {
    this.chunker = chunker;
    this.options = options;
  }

  async processFileWithMarshal(filePath: string): Promise<{
    chunks: MarshalChunk[];
    relationships: CodeRelationship[];
  } | null> {
    try {
      const fileInfo = await getFileInfo(filePath);
      
      if (fileInfo.size > this.options.maxFileSize) {
        console.warn(`⚠️ Skipping large file: ${filePath} (${fileInfo.size} bytes)`);
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      
      const result = await this.chunker.processFile(filePath, content, fileInfo.language);
      
      return result;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}: ${error}`);
      return null;
    }
  }

  convertMarshalChunksToStandard(marshalChunks: MarshalChunk[]): CodeChunk[] {
    return marshalChunks.map((mChunk, index) => ({
      id: mChunk.id,
      filePath: mChunk.metadata.filePath,
      content: mChunk.content,
      startLine: mChunk.metadata.startLine,
      endLine: mChunk.metadata.endLine,
      chunkIndex: index,
      fileHash: calculateContentHash(mChunk.content),
      lastModified: Date.now(),
      language: mChunk.metadata.language,
      symbols: mChunk.metadata.symbols,
      ...(mChunk.metadata.concepts.length > 0 && { concepts: mChunk.metadata.concepts }),
      ...(mChunk.metadata.dependencies.length > 0 && { dependencies: mChunk.metadata.dependencies }),
      ...(mChunk.metadata.exports.length > 0 && { exports: mChunk.metadata.exports })
    }));
  }
}