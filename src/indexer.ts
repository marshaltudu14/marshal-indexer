import { promises as fs } from 'fs';
import { join, relative, extname } from 'path';
import * as chokidar from 'chokidar';
import {
  CodeChunk,
  IndexMetadata,
  IndexingOptions,
  IndexingProgress,
  DEFAULT_INDEXING_OPTIONS,
  FileInfo
} from './types.js';
import {
  getAllFiles,
  getFileInfo,
  calculateContentHash,
  splitTextIntoChunks,
  fileExists
} from './utils.js';
import { CodeParser } from './parser.js';
import { EmbeddingManager } from './embeddings.js';

/**
 * Main indexer class that manages the codebase indexing process
 */
export class CodebaseIndexer {
  private projectPath: string;
  private embeddingManager: EmbeddingManager;
  private options: IndexingOptions;
  private metadata: IndexMetadata;
  private watcher: chokidar.FSWatcher | undefined;
  private isIndexing = false;

  constructor(
    projectPath: string, 
    embeddingsDir: string,
    options: Partial<IndexingOptions> = {}
  ) {
    this.projectPath = projectPath;
    this.options = { ...DEFAULT_INDEXING_OPTIONS, ...options };
    this.embeddingManager = new EmbeddingManager(embeddingsDir);
    this.metadata = this.createDefaultMetadata();
  }

  /**
   * Initialize the indexer
   */
  async initialize(): Promise<void> {
    await this.embeddingManager.initialize();
    await this.loadMetadata();
  }

  /**
   * Index the entire codebase
   */
  async indexCodebase(onProgress?: (_progress: IndexingProgress) => void): Promise<void> {
    if (this.isIndexing) {
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    const startTime = Date.now();

    try {
      console.log(`Starting indexing of ${this.projectPath}...`);
      
      // Phase 1: Scanning files
      onProgress?.({
        phase: 'scanning',
        filesProcessed: 0,
        totalFiles: 0,
        chunksProcessed: 0,
        totalChunks: 0,
        errors: []
      });

      const files = await getAllFiles(
        this.projectPath,
        this.options.supportedExtensions,
        this.options.ignorePatterns
      );

      console.log(`Found ${files.length} files to process`);

      // Phase 2: Processing files
      const allChunks: CodeChunk[] = [];
      const errors: string[] = [];
      let totalChunks = 0;

      // Process files in parallel batches to improve performance
      const concurrency = 8; // Process 8 files at a time for better performance
      const filesToProcess: string[] = [];

      // First, filter files that need processing
      for (const filePath of files) {
        try {
          const fileInfo = await getFileInfo(filePath);

          // Skip if file is too large
          if (fileInfo.size > this.options.maxFileSize) {
            console.warn(`Skipping large file: ${filePath} (${fileInfo.size} bytes)`);
            continue;
          }

          // Check if file has changed since last indexing
          if (this.metadata.fileHashes[filePath] === fileInfo.hash) {
            console.log(`Skipping unchanged file: ${relative(this.projectPath, filePath)}`);
            continue;
          }

          filesToProcess.push(filePath);
        } catch (error) {
          const errorMsg = `Error checking ${filePath}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Process files in parallel batches
      for (let i = 0; i < filesToProcess.length; i += concurrency) {
        const batch = filesToProcess.slice(i, i + concurrency);

        const batchPromises = batch.map(async (filePath) => {
          try {
            const fileInfo = await getFileInfo(filePath);

            // Remove old chunks for this file
            await this.embeddingManager.removeChunksByFile(filePath);

            // Process file
            const chunks = await this.processFile(filePath, fileInfo);

            // Update metadata
            this.metadata.fileHashes[filePath] = fileInfo.hash;

            return { filePath, chunks, success: true };
          } catch (error) {
            const errorMsg = `Error processing ${filePath}: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            return { filePath, chunks: [], success: false };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Collect results
        for (const result of batchResults) {
          if (result.success) {
            allChunks.push(...result.chunks);
            totalChunks += result.chunks.length;
          }
        }

        // Update progress
        onProgress?.({
          phase: 'parsing',
          filesProcessed: Math.min(i + concurrency, filesToProcess.length),
          totalFiles: filesToProcess.length,
          chunksProcessed: totalChunks,
          totalChunks: 0,
          currentFile: batch.length > 0 ? relative(this.projectPath, batch[batch.length - 1]!) : '',
          errors
        });
      }

      // Phase 3: Generating embeddings and storing
      if (allChunks.length > 0) {
        onProgress?.({
          phase: 'embedding',
          filesProcessed: files.length,
          totalFiles: files.length,
          chunksProcessed: 0,
          totalChunks: allChunks.length,
          errors
        });

        await this.embeddingManager.addChunks(allChunks);
      }

      // Phase 4: Saving
      onProgress?.({
        phase: 'storing',
        filesProcessed: files.length,
        totalFiles: files.length,
        chunksProcessed: allChunks.length,
        totalChunks: allChunks.length,
        errors
      });

      await this.embeddingManager.save();
      
      // Update metadata
      this.metadata.totalFiles = files.length;
      this.metadata.totalChunks += allChunks.length;
      this.metadata.lastIndexed = Date.now();
      await this.saveMetadata();

      // Phase 5: Complete
      onProgress?.({
        phase: 'complete',
        filesProcessed: files.length,
        totalFiles: files.length,
        chunksProcessed: allChunks.length,
        totalChunks: allChunks.length,
        errors
      });

      const duration = Date.now() - startTime;
      console.log(`Indexing completed in ${duration}ms. Processed ${files.length} files, ${allChunks.length} chunks.`);
      
      if (errors.length > 0) {
        console.warn(`Indexing completed with ${errors.length} errors.`);
      }

    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Process a single file and extract chunks
   */
  private async processFile(filePath: string, fileInfo: FileInfo): Promise<CodeChunk[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const chunks: CodeChunk[] = [];
    
    // Split content into chunks
    const textChunks = splitTextIntoChunks(
      content, 
      this.options.chunkSize, 
      this.options.chunkOverlap
    );

    // Parse symbols and dependencies if enabled
    let symbols: string[] | undefined;
    let imports: string[] | undefined;
    let exports: string[] | undefined;
    let functions: string[] | undefined;
    let classes: string[] | undefined;

    if (this.options.includeSymbols) {
      try {
        const symbolInfo = CodeParser.parseSymbols(content, fileInfo.language);
        const symbolNames = symbolInfo.map(s => s.name);
        const functionNames = symbolInfo.filter(s => s.type === 'function').map(s => s.name);
        const classNames = symbolInfo.filter(s => s.type === 'class').map(s => s.name);

        symbols = symbolNames.length > 0 ? symbolNames : undefined;
        functions = functionNames.length > 0 ? functionNames : undefined;
        classes = classNames.length > 0 ? classNames : undefined;

        if (this.options.includeDependencies) {
          const deps = CodeParser.parseDependencies(content, fileInfo.language);
          const importNames = deps.filter(d => d.type === 'import').map(d => d.name);
          imports = importNames.length > 0 ? importNames : undefined;
        }
      } catch (error) {
        console.warn(`Failed to parse symbols for ${filePath}: ${error}`);
      }
    }

    // Create chunks
    textChunks.forEach((textChunk, index) => {
      const chunk: CodeChunk = {
        id: `${calculateContentHash(filePath + index)}`,
        filePath,
        content: textChunk.content,
        startLine: textChunk.startLine,
        endLine: textChunk.endLine,
        chunkIndex: index,
        fileHash: fileInfo.hash,
        lastModified: fileInfo.lastModified,
        language: fileInfo.language,
        ...(symbols && { symbols }),
        ...(imports && { imports }),
        ...(exports && { exports }),
        ...(functions && { functions }),
        ...(classes && { classes })
      };

      chunks.push(chunk);
    });

    return chunks;
  }

  /**
   * Start watching for file changes
   */
  async startWatching(): Promise<void> {
    if (this.watcher) {
      return;
    }

    console.log('Starting file watcher...');
    
    this.watcher = chokidar.watch(this.projectPath, {
      ignored: this.options.ignorePatterns,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', (path) => this.handleFileChange(path, 'added'))
      .on('change', (path) => this.handleFileChange(path, 'changed'))
      .on('unlink', (path) => this.handleFileChange(path, 'deleted'));
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      console.log('Stopped file watcher');
    }
  }

  /**
   * Handle file changes
   */
  private async handleFileChange(filePath: string, changeType: 'added' | 'changed' | 'deleted'): Promise<void> {
    if (this.isIndexing) {
      return; // Skip if currently indexing
    }

    // Additional filtering to prevent recursive indexing
    const relativePath = relative(this.projectPath, filePath);

    // Skip indexer's own files
    if (relativePath.includes('custom-indexer/embeddings') ||
        relativePath.includes('.indexer-metadata.json') ||
        relativePath.endsWith('.json') && relativePath.includes('embeddings')) {
      return;
    }

    // Check if file extension is supported
    const ext = extname(filePath);
    if (!this.options.supportedExtensions.includes(ext)) {
      return;
    }

    console.log(`File ${changeType}: ${relativePath}`);

    try {
      if (changeType === 'deleted') {
        await this.embeddingManager.removeChunksByFile(filePath);
        delete this.metadata.fileHashes[filePath];
      } else {
        const fileInfo = await getFileInfo(filePath);

        // Check if file should be processed
        if (fileInfo.size <= this.options.maxFileSize) {
          // Remove old chunks
          await this.embeddingManager.removeChunksByFile(filePath);

          // Process and add new chunks
          const chunks = await this.processFile(filePath, fileInfo);
          if (chunks.length > 0) {
            await this.embeddingManager.addChunks(chunks);
          }

          // Update metadata
          this.metadata.fileHashes[filePath] = fileInfo.hash;
        }
      }

      await this.embeddingManager.save();
      await this.saveMetadata();

    } catch (error) {
      console.error(`Error handling file change for ${filePath}: ${error}`);
    }
  }

  /**
   * Search the indexed codebase
   */
  async search(query: string, topK: number = 10) {
    return this.embeddingManager.search(query, topK);
  }

  /**
   * Get indexing statistics
   */
  getStats() {
    return {
      ...this.embeddingManager.getStats(),
      metadata: this.metadata
    };
  }

  /**
   * Create default metadata
   */
  private createDefaultMetadata(): IndexMetadata {
    return {
      version: '2.0.0',
      totalChunks: 0,
      totalFiles: 0,
      lastIndexed: 0,
      projectPath: this.projectPath,
      fileHashes: {},
      chunkCount: 0
    };
  }

  /**
   * Load metadata from disk
   */
  private async loadMetadata(): Promise<void> {
    const metadataPath = join(this.projectPath, '.indexer-metadata.json');
    
    try {
      if (await fileExists(metadataPath)) {
        const content = await fs.readFile(metadataPath, 'utf-8');
        this.metadata = { ...this.createDefaultMetadata(), ...JSON.parse(content) };
        console.log('Loaded existing metadata');
      }
    } catch (error) {
      console.warn(`Failed to load metadata: ${error}`);
      this.metadata = this.createDefaultMetadata();
    }
  }

  /**
   * Save metadata to disk
   */
  private async saveMetadata(): Promise<void> {
    const metadataPath = join(this.projectPath, '.indexer-metadata.json');
    
    try {
      await fs.writeFile(metadataPath, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error(`Failed to save metadata: ${error}`);
    }
  }

  /**
   * Clear all indexed data
   */
  async clear(): Promise<void> {
    await this.embeddingManager.clear();
    this.metadata = this.createDefaultMetadata();
    await this.saveMetadata();
    console.log('Cleared all indexed data');
  }
}
