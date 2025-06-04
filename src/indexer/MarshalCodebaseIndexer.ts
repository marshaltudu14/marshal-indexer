import { cpus } from 'os';
import { 
  IndexingOptions, 
  IndexingProgress, 
  // IndexMetadata,
  DEFAULT_INDEXING_OPTIONS,
  SearchResult
} from '../common/types.js';
import { 
  getAllFiles,
  shouldProcessFile,
} from '../utils.js';
import { MarshalContextEngine as EnhancedMarshalContextEngine } from '../core/MarshalContextEngine.js';
import { MarshalContextEngine } from '../engine/MarshalContextEngine.js';
import { MarshalChunker } from '../chunker/MarshalChunker.js';
import { FileProcessor } from './FileProcessor.js';
import { DataStore } from './DataStore.js';
import { Watcher } from './Watcher.js';
import { MetadataManager } from './MetadataManager.js';

/**
 * Marshal Codebase Indexer - World-class code understanding and search
 */
export class MarshalCodebaseIndexer {
  private projectPath: string;
  private embeddingsDir: string;
  private contextEngine: MarshalContextEngine;
  private enhancedEngine?: EnhancedMarshalContextEngine;
  private chunker: MarshalChunker;
  private options: IndexingOptions;
  private metadataManager: MetadataManager;
  private dataStore: DataStore;
  private fileProcessor: FileProcessor;
  private watcher: Watcher | undefined;
  private isIndexing = false;
  
  constructor(
    projectPath: string,
    embeddingsDir: string,
    options: Partial<IndexingOptions> = {}
  ) {
    this.projectPath = projectPath;
    this.embeddingsDir = embeddingsDir;
    this.options = { ...DEFAULT_INDEXING_OPTIONS, ...options };
    this.contextEngine = new MarshalContextEngine(embeddingsDir);
    this.chunker = new MarshalChunker();
    this.metadataManager = new MetadataManager(this.projectPath, this.options);
    this.fileProcessor = new FileProcessor(this.chunker, this.options);
    this.dataStore = new DataStore(this.contextEngine, this.fileProcessor);
  }

  /**
   * Initialize the Marshal indexer
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Marshal Codebase Indexer...');
    await this.contextEngine.initialize();
    this.dataStore.clear(); // Clear existing data on initialize
    this.metadataManager.createDefaultMetadata(); // Ensure metadata is initialized
    // Load metadata and populate data store if needed
    // const loadedMetadata = await this.metadataManager.loadMetadata();
    // TODO: Potentially load existing chunks/relationships from disk based on metadata
    console.log('✅ Marshal indexer ready');
  }

  /**
   * Index the entire codebase with Marshal's advanced understanding
   */
  async indexCodebase(onProgress?: (progress: IndexingProgress) => void): Promise<void> {
    if (this.isIndexing) {
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    const startTime = Date.now();

    try {
      console.log('🔍 Starting Marshal codebase indexing...');
      
      const allFiles = await getAllFiles(this.projectPath, this.options.supportedExtensions, this.options.ignorePatterns);
      const filesToProcess = allFiles.filter(file => shouldProcessFile(file, this.options.supportedExtensions, this.options.ignorePatterns, this.projectPath));
      
      console.log(`📁 Found ${filesToProcess.length} files to process`);

      const concurrency = Math.min(16, Math.max(4, Math.floor(cpus().length * 2)));
      let processedCount = 0;

      for (let i = 0; i < filesToProcess.length; i += concurrency) {
        const batch = filesToProcess.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (filePath) => {
          try {
            const result = await this.fileProcessor.processFileWithMarshal(filePath);
            processedCount++;
            
            if (onProgress) {
              onProgress({
                totalFiles: filesToProcess.length,
                filesProcessed: processedCount,
                chunksProcessed: 0,
                totalChunks: 0,
                currentFile: filePath,
                phase: 'parsing',
                errors: []
              });
            }
            
            return result;
          } catch (error) {
            console.warn(`⚠️ Failed to process ${filePath}: ${error}`);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          if (result) {
            const standardChunks = this.fileProcessor.convertMarshalChunksToStandard(result.chunks);
            await this.contextEngine.addChunks(standardChunks);
            this.dataStore.storeMarshalData(result.chunks, result.relationships);
          }
        }

        console.log(`📊 Processed ${Math.min(i + concurrency, filesToProcess.length)}/${filesToProcess.length} files`);
      }

      const stats = this.dataStore.getStats();
      console.log(`🧠 Generated ${stats.totalChunks} Marshal chunks with ${stats.totalRelationships} relationships`);

      if (onProgress) {
        onProgress({
          totalFiles: filesToProcess.length,
          filesProcessed: processedCount,
          chunksProcessed: stats.totalChunks,
          totalChunks: stats.totalChunks,
          currentFile: '',
          phase: 'embedding',
          errors: []
        });
      }

      let metadata = this.metadataManager.createDefaultMetadata();
      metadata.lastIndexed = Date.now();
      metadata.totalFiles = filesToProcess.length;
      metadata.totalChunks = stats.totalChunks;
      metadata.indexingTime = Date.now() - startTime;
      
      await this.metadataManager.saveMetadata(metadata);

      console.log(`🎉 Marshal indexing completed in ${(Date.now() - startTime) / 1000}s`);
      console.log(`📈 Performance: ${stats.totalChunks} chunks, ${stats.totalRelationships} relationships`);

    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Advanced search using Marshal Context Engine
   */
  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    console.log(`🔍 Marshal Search: "${query}"`);
    
    const results = await this.contextEngine.search(query, topK);
    
    return results.map(result => {
      const marshalMetadata = this.dataStore.getMarshalMetadata(result.chunk.id);
      return {
        ...result,
        marshalMetadata: {
          level: marshalMetadata.level || 'file', // Provide a default if undefined
          concepts: marshalMetadata.concepts,
          complexity: marshalMetadata.complexity,
          importance: marshalMetadata.importance,
          relationships: marshalMetadata.relationships.map(rel => ({
            ...rel,
            context: rel.context || '' // Ensure context is always a string
          }))
        }
      };
    });
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    totalChunks: number;
    totalFiles: number;
    totalRelationships: number;
    languages: Record<string, number>;
    concepts: Record<string, number>;
    chunkLevels: Record<string, number>;
    averageComplexity: number;
    indexingTime: number;
  } {
    const dataStoreStats = this.dataStore.getStats();
    const metadata = this.metadataManager.createDefaultMetadata(); // This will load the latest saved metadata
    return {
      ...dataStoreStats,
      indexingTime: metadata.indexingTime || 0
    };
  }

  /**
   * Start watching for file changes
   */
  async startWatching(): Promise<void> {
    if (!this.watcher) {
      this.watcher = new Watcher(this.projectPath, this.options, this.dataStore);
    }
    await this.watcher.startWatching();
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stopWatching();
    }
  }

  /**
   * Clear all indexed data
   */
  async clear(): Promise<void> {
    // Clear the original context engine
    if (this.contextEngine && typeof this.contextEngine.clear === 'function') {
      await this.contextEngine.clear();
    }

    // Clear enhanced engine cache if available
    if (this.enhancedEngine && typeof this.enhancedEngine.clearCache === 'function') {
      this.enhancedEngine.clearCache();
    }

    this.dataStore.clear();
    let metadata = this.metadataManager.createDefaultMetadata();
    await this.metadataManager.saveMetadata(metadata);
    console.log('🧹 Marshal index cleared');
  }

  /**
   * Initialize enhanced engine for superior search capabilities
   */
  async initializeEnhancedEngine(): Promise<void> {
    this.enhancedEngine = new EnhancedMarshalContextEngine(this.embeddingsDir);
    await this.enhancedEngine.initialize();
    console.log('🚀 Enhanced Marshal Context Engine initialized');
  }
}