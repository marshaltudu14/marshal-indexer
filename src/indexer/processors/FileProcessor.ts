import { promises as fs } from 'fs';
import { CodeChunk } from '../../common/types.js';
import { getFileInfo, calculateContentHash } from '../../utils.js';
import { ContextualAnalyzer, CodeStructureInfo } from '../ContextualAnalyzer.js';
import { SymbolIndexer } from '../SymbolIndexer.js';
import { MetadataEnhancer } from './MetadataEnhancer.js';

/**
 * File processor for ultra-fast file processing with contextual analysis
 */
export class FileProcessor {
  private contextualAnalyzer: ContextualAnalyzer;
  private metadataEnhancer: MetadataEnhancer;

  constructor() {
    this.contextualAnalyzer = new ContextualAnalyzer();
    this.metadataEnhancer = new MetadataEnhancer();
  }

  /**
   * Ultra-fast file processing with contextual analysis
   */
  async processFile(filePath: string, maxFileSize: number): Promise<{
    chunks: CodeChunk[];
    structure: CodeStructureInfo;
  }> {
    const fileInfo = await getFileInfo(filePath);

    if (fileInfo.size > maxFileSize) {
      return { chunks: [], structure: {} as CodeStructureInfo };
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Perform contextual analysis for the entire file
    const structure = this.contextualAnalyzer.analyzeCodeStructure(content, filePath);

    // Enhanced symbol-aware chunking for better code understanding
    let chunks: CodeChunk[] = [];

    try {
      // Try symbol-aware chunking first for better code structure understanding
      chunks = SymbolIndexer.createSymbolAwareChunks(content, filePath, fileInfo.language, 30);
    } catch (error) {
      console.warn(`⚠️ Symbol-aware chunking failed for ${filePath}, falling back to simple chunking: ${error}`);

      // Fallback to simple chunking if symbol-aware chunking fails
      chunks = this.createSimpleChunks(content, filePath, fileInfo.language, structure, lines);
    }

    // Enhance chunks with semantic context and quality metrics
    for (const chunk of chunks) {
      this.metadataEnhancer.enhanceChunkMetadata(chunk, structure);
    }

    return { chunks, structure };
  }

  /**
   * Create simple chunks when symbol-aware chunking fails
   */
  private createSimpleChunks(
    _content: string,
    filePath: string,
    language: string,
    structure: CodeStructureInfo,
    lines: string[]
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const chunkSize = 30;

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkLines = lines.slice(i, Math.min(i + chunkSize, lines.length));
      const chunkContent = chunkLines.join('\n');

      if (chunkContent.trim().length > 10) {
        const chunk: CodeChunk = {
          id: `${filePath}:${i}:${Math.min(i + chunkSize, lines.length)}`,
          filePath,
          content: chunkContent,
          startLine: i + 1,
          endLine: Math.min(i + chunkSize, lines.length),
          chunkIndex: Math.floor(i / chunkSize),
          fileHash: calculateContentHash(chunkContent),
          lastModified: Date.now(),
          language,
          symbols: [],
          metadata: {
            fileType: structure.fileType,
            exports: structure.exports.map(e => e.name),
            functions: structure.functions.map(f => f.name),
            components: structure.components.map(c => c.name),
            keywords: structure.keywords,
            complexity: structure.complexity,
            importance: structure.importance
          }
        };
        chunks.push(chunk);
      }
    }

    return chunks;
  }
}
