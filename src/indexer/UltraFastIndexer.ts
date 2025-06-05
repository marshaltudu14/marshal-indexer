import { CodeChunk, IndexingOptions, SearchResult } from '../common/types.js';
import { getAllCodeFiles, isCodeFile } from '../utils.js';
import { FileProcessor } from './processors/FileProcessor.js';
import { LexicalIndexBuilder } from './processors/LexicalIndexBuilder.js';
import { FileWatcher, FileChangeEvent } from './processors/FileWatcher.js';
import { IndexPersistence, IndexData } from './processors/IndexPersistence.js';
import { EnhancedSearch } from '../search/EnhancedSearch.js';
import { EnhancedRanking } from '../search/EnhancedRanking.js';
import { CodeStructureInfo } from './ContextualAnalyzer.js';

const DEFAULT_INDEXING_OPTIONS: IndexingOptions = {
  maxFileSize: 1024 * 1024, // 1MB
  chunkSize: 30,
  enableWatching: true,
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**'
  ]
};

/**
 * Ultra-fast indexer with enhanced symbol indexing, semantic analysis, and ranking
 * Now modular and maintainable with separated concerns
 */
export class UltraFastIndexer {
  private projectPath: string;
  private options: IndexingOptions;

  // Core processors
  private fileProcessor: FileProcessor;
  private lexicalIndexBuilder: LexicalIndexBuilder;
  private fileWatcher: FileWatcher;
  private indexPersistence: IndexPersistence;
  private enhancedSearch: EnhancedSearch;
  private enhancedRanking: EnhancedRanking;

  // Data storage
  private chunks: CodeChunk[] = [];
  private codeStructures: Map<string, CodeStructureInfo> = new Map();

  constructor(projectPath: string, indexDir: string, options: Partial<IndexingOptions> = {}) {
    this.projectPath = projectPath;
    this.options = { ...DEFAULT_INDEXING_OPTIONS, ...options };

    // Initialize processors
    this.fileProcessor = new FileProcessor();
    this.lexicalIndexBuilder = new LexicalIndexBuilder();
    this.fileWatcher = new FileWatcher(projectPath);
    this.indexPersistence = new IndexPersistence(indexDir);
    this.enhancedSearch = new EnhancedSearch();
    this.enhancedRanking = new EnhancedRanking();

    // Setup file watcher events
    this.setupFileWatcher();
  }

  /**
   * Initialize the indexer (required by server)
   */
  async initialize(): Promise<void> {
    // Initialize enhanced search with empty chunks initially
    this.enhancedSearch.initialize(new Map());
  }

  /**
   * Index codebase (alias for indexProject for server compatibility)
   */
  async indexCodebase(progressCallback?: (progress: any) => void): Promise<void> {
    return this.indexProject(progressCallback);
  }

  /**
   * Clear the index
   */
  async clear(): Promise<void> {
    this.chunks = [];
    this.codeStructures.clear();
    this.lexicalIndexBuilder.clear();
    this.enhancedSearch.clearCaches();
    this.enhancedRanking.clearCaches();
  }

  /**
   * Index the entire project with enhanced analysis
   */
  async indexProject(_progressCallback?: (progress: any) => void): Promise<void> {
    console.log(`🚀 Starting enhanced indexing of ${this.projectPath}...`);
    const startTime = Date.now();

    try {
      // Try to load existing index first
      const existingIndex = await this.indexPersistence.loadIndex();
      if (existingIndex && this.isIndexValid(existingIndex)) {
        console.log('📂 Loading existing index...');
        await this.loadIndexData(existingIndex);
        
        // Start watching if enabled
        if (this.options.enableWatching !== false) {
          this.fileWatcher.startWatching();
        }
        
        console.log(`✅ Index loaded successfully in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        return;
      }

      // Get all code files
      const files = await getAllCodeFiles(this.projectPath, this.options.excludePatterns || []);
      console.log(`📁 Found ${files.length} code files`);

      // Clear existing data
      this.chunks = [];
      this.codeStructures.clear();

      // Process files in parallel batches
      const batchSize = 50;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchPromises = batch.map(file => this.processFile(file));
        
        const results = await Promise.allSettled(batchPromises);
        
        // Handle results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const filePath = batch[j];
          if (result && result.status === 'fulfilled' && result.value && filePath) {
            const { chunks, structure } = result.value;
            this.chunks.push(...chunks);
            this.codeStructures.set(filePath, structure);
          } else if (result && result.status === 'rejected' && filePath) {
            console.warn(`⚠️ Failed to process ${filePath}: ${result.reason}`);
          }
        }

        console.log(`📊 Processed ${Math.min(i + batchSize, files.length)}/${files.length} files`);
      }

      // Build lexical index
      await this.lexicalIndexBuilder.buildIndex(this.chunks);

      // Initialize enhanced ranking
      this.enhancedRanking.initialize(this.chunks);

      // Initialize enhanced search with chunks
      const chunksMap = new Map();
      this.chunks.forEach(chunk => {
        chunksMap.set(chunk.id, {
          id: chunk.id,
          content: chunk.content,
          level: 'block' as const,
          parentId: undefined,
          childIds: [],
          metadata: {
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            language: chunk.language,
            symbols: chunk.symbols || [],
            concepts: chunk.concepts || [],
            complexity: chunk.metadata?.complexity || 1,
            importance: chunk.metadata?.importance || 1,
            dependencies: chunk.dependencies || [],
            exports: chunk.exports || []
          }
        });
      });
      this.enhancedSearch.initialize(chunksMap);

      // Save index
      await this.saveIndex();

      // Start watching if enabled
      if (this.options.enableWatching !== false) {
        this.fileWatcher.startWatching();
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Enhanced indexing completed in ${duration.toFixed(1)}s`);
      console.log(`📊 Indexed ${this.chunks.length} chunks from ${files.length} files`);

    } catch (error) {
      console.error('❌ Indexing failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced search with semantic understanding and improved ranking
   */
  async search(query: string, options: {
    maxResults?: number;
    includeSemanticExpansion?: boolean;
    enableResultClustering?: boolean;
    codeSpecificRanking?: boolean;
    fuzzySearch?: boolean;
  } = {}): Promise<SearchResult[]> {
    if (this.chunks.length === 0) {
      console.warn('⚠️ No chunks available. Please run indexProject() first.');
      return [];
    }

    return await this.enhancedSearch.search(query, options);
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string): Promise<{
    chunks: CodeChunk[];
    structure: CodeStructureInfo;
  } | null> {
    try {
      return await this.fileProcessor.processFile(filePath, this.options.maxFileSize);
    } catch (error) {
      console.warn(`⚠️ Failed to process ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Setup file watcher event handlers
   */
  private setupFileWatcher(): void {
    this.fileWatcher.on('fileChange', async (event: FileChangeEvent) => {
      console.log(`📝 File ${event.type}: ${event.filePath}`);
      
      try {
        if (event.type === 'unlink') {
          await this.removeFileFromIndex(event.filePath);
        } else {
          await this.updateFileInIndex(event.filePath);
        }
        
        // Rebuild lexical index
        await this.lexicalIndexBuilder.buildIndex(this.chunks);
        this.enhancedRanking.initialize(this.chunks);
        
        // Save updated index
        await this.saveIndex();
        
      } catch (error) {
        console.error(`❌ Failed to update index for ${event.filePath}:`, error);
      }
    });

    this.fileWatcher.on('error', (error) => {
      console.error('❌ File watcher error:', error);
    });
  }

  /**
   * Update a file in the index
   */
  private async updateFileInIndex(filePath: string): Promise<void> {
    if (!isCodeFile(filePath)) return;

    // Remove existing chunks for this file
    await this.removeFileFromIndex(filePath);

    // Process the file again
    const result = await this.processFile(filePath);
    if (result) {
      this.chunks.push(...result.chunks);
      this.codeStructures.set(filePath, result.structure);
    }
  }

  /**
   * Remove a file from the index
   */
  private async removeFileFromIndex(filePath: string): Promise<void> {
    // Remove chunks for this file
    this.chunks = this.chunks.filter(chunk => chunk.filePath !== filePath);
    
    // Remove code structure
    this.codeStructures.delete(filePath);
  }

  /**
   * Save index to disk
   */
  private async saveIndex(): Promise<void> {
    const indexData: IndexData = {
      chunks: this.chunks,
      codeStructures: this.codeStructures,
      termFrequency: this.lexicalIndexBuilder.getTermFrequencyMap(),
      documentFrequency: this.lexicalIndexBuilder.getDocumentFrequencyMap(),
      chunkTerms: this.lexicalIndexBuilder.getChunkTermsMap(),
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        totalFiles: this.codeStructures.size,
        totalChunks: this.chunks.length
      }
    };

    await this.indexPersistence.saveIndex(indexData);
  }

  /**
   * Load index data
   */
  private async loadIndexData(indexData: IndexData): Promise<void> {
    this.chunks = indexData.chunks;
    this.codeStructures = indexData.codeStructures;
    
    this.lexicalIndexBuilder.loadIndexData(
      indexData.termFrequency,
      indexData.documentFrequency,
      indexData.chunkTerms
    );
    
    this.enhancedRanking.initialize(this.chunks);
  }

  /**
   * Check if index is valid
   */
  private isIndexValid(indexData: IndexData): boolean {
    return indexData.chunks.length > 0 && indexData.metadata.version === '1.0.0';
  }

  /**
   * Stop the indexer and cleanup
   */
  async stop(): Promise<void> {
    await this.fileWatcher.stopWatching();
    this.lexicalIndexBuilder.clear();
    this.enhancedSearch.clearCaches();
    this.enhancedRanking.clearCaches();
    console.log('🛑 Indexer stopped');
  }

  /**
   * Get indexer statistics
   */
  getStats(): {
    totalChunks: number;
    totalFiles: number;
    isWatching: boolean;
    indexStats: any;
  } {
    return {
      totalChunks: this.chunks.length,
      totalFiles: this.codeStructures.size,
      isWatching: this.fileWatcher.getIsWatching(),
      indexStats: this.lexicalIndexBuilder.getStats()
    };
  }
}
