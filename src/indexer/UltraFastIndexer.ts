import { cpus } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import {
  IndexingOptions,
  IndexingProgress,
  DEFAULT_INDEXING_OPTIONS,
  SearchResult,
  CodeChunk
} from '../common/types.js';
import {
  getAllFiles,
  shouldProcessFile,
  ensureDir,
  getFileInfo,
  calculateContentHash
} from '../utils.js';
import { ContextualAnalyzer, CodeStructureInfo } from './ContextualAnalyzer.js';

/**
 * Ultra-Fast Indexer - NO EMBEDDINGS APPROACH
 * Uses lexical search, TF-IDF, and AST parsing for maximum speed
 * Targets sub-60-second indexing like Augment
 */
export class UltraFastIndexer {
  private projectPath: string;
  private indexDir: string;
  private options: IndexingOptions;
  private chunks: Map<string, CodeChunk> = new Map();
  private termFrequency: Map<string, Map<string, number>> = new Map(); // term -> chunkId -> frequency
  private documentFrequency: Map<string, number> = new Map(); // term -> document count
  private chunkTerms: Map<string, Set<string>> = new Map(); // chunkId -> terms
  private isIndexing = false;
  private isInitialized = false;
  private watcher: FSWatcher | null = null;
  private isWatching = false;
  private contextualAnalyzer: ContextualAnalyzer;
  private codeStructures: Map<string, CodeStructureInfo> = new Map(); // filePath -> structure

  constructor(
    projectPath: string,
    indexDir: string,
    options: Partial<IndexingOptions> = {}
  ) {
    this.projectPath = projectPath;
    this.indexDir = indexDir;
    this.options = { ...DEFAULT_INDEXING_OPTIONS, ...options };
    this.contextualAnalyzer = new ContextualAnalyzer();
  }

  /**
   * Initialize - NO MODEL LOADING!
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Ultra-Fast Indexer (NO EMBEDDINGS)...');
    const startTime = Date.now();
    
    await ensureDir(this.indexDir);
    await this.loadExistingIndex();
    
    this.isInitialized = true;
    console.log(`✅ Ultra-Fast indexer ready in ${Date.now() - startTime}ms`);
  }

  /**
   * ULTRA-FAST indexing with lexical approach
   */
  async indexCodebase(onProgress?: (progress: IndexingProgress) => void): Promise<void> {
    if (this.isIndexing) {
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    const startTime = Date.now();

    try {
      console.log('⚡ Starting ULTRA-FAST indexing (NO EMBEDDINGS)...');
      
      const allFiles = await getAllFiles(this.projectPath, this.options.supportedExtensions, this.options.ignorePatterns);
      const filesToProcess = allFiles.filter(file => 
        shouldProcessFile(file, this.options.supportedExtensions, this.options.ignorePatterns, this.projectPath)
      );
      
      console.log(`📁 Found ${filesToProcess.length} files to process`);

      // MAXIMUM concurrency for speed
      const concurrency = Math.min(64, Math.max(16, cpus().length * 8));
      
      // Process all files in parallel batches
      const allChunks: CodeChunk[] = [];
      let processedCount = 0;

      for (let i = 0; i < filesToProcess.length; i += concurrency) {
        const batch = filesToProcess.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (filePath) => {
          try {
            const chunks = await this.processFileUltraFast(filePath);
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
            
            return chunks;
          } catch (error) {
            console.warn(`⚠️ Failed to process ${filePath}: ${error}`);
            return [];
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Flatten and collect all chunks
        for (const chunks of batchResults) {
          allChunks.push(...chunks);
        }

        console.log(`📊 Processed ${Math.min(i + concurrency, filesToProcess.length)}/${filesToProcess.length} files`);
      }

      console.log(`🧠 Building lexical index for ${allChunks.length} chunks...`);
      if (onProgress) {
        onProgress({
          totalFiles: filesToProcess.length,
          filesProcessed: processedCount,
          chunksProcessed: 0,
          totalChunks: allChunks.length,
          currentFile: '',
          phase: 'embedding', // Keep same phase name for compatibility
          errors: []
        });
      }

      // Build lexical index (MUCH faster than embeddings)
      await this.buildLexicalIndex(allChunks);
      
      // Store chunks
      for (const chunk of allChunks) {
        this.chunks.set(chunk.id, chunk);
      }

      // Save index
      await this.saveIndex();

      console.log(`🎉 ULTRA-FAST indexing completed in ${(Date.now() - startTime) / 1000}s`);
      console.log(`📈 Performance: ${allChunks.length} chunks processed`);

    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Ultra-fast file processing with contextual analysis
   */
  private async processFileUltraFast(filePath: string): Promise<CodeChunk[]> {
    const fileInfo = await getFileInfo(filePath);

    if (fileInfo.size > this.options.maxFileSize) {
      return [];
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Perform contextual analysis for the entire file
    const structure = this.contextualAnalyzer.analyzeCodeStructure(content, filePath);
    this.codeStructures.set(filePath, structure);

    // Simple chunking - optimized for speed
    const chunks: CodeChunk[] = [];
    const chunkSize = 30; // Smaller chunks for better search granularity

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
          language: fileInfo.language,
          symbols: [], // Skip for speed
          // Add contextual metadata from file-level analysis
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

  /**
   * Build lexical index using TF-IDF (MUCH faster than embeddings)
   */
  private async buildLexicalIndex(chunks: CodeChunk[]): Promise<void> {
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
        const terms = this.extractTerms(chunk.content);
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
   * Extract terms from content for lexical search with enhanced code-specific tokenization
   */
  private extractTerms(content: string): Set<string> {
    const terms = new Set<string>();

    // 1. Extract camelCase and PascalCase identifiers
    const camelCaseMatches = content.match(/\b[a-z]+(?:[A-Z][a-z]*)*\b/g) || [];
    const pascalCaseMatches = content.match(/\b[A-Z][a-z]*(?:[A-Z][a-z]*)*\b/g) || [];

    for (const match of [...camelCaseMatches, ...pascalCaseMatches]) {
      terms.add(match.toLowerCase());
      // Also add individual words from camelCase/PascalCase
      const words = match.split(/(?=[A-Z])/).filter(w => w.length > 1);
      for (const word of words) {
        terms.add(word.toLowerCase());
      }
    }

    // 2. Extract snake_case identifiers
    const snakeCaseMatches = content.match(/\b[a-z]+(?:_[a-z]+)+\b/g) || [];
    for (const match of snakeCaseMatches) {
      terms.add(match.toLowerCase());
      // Also add individual words
      const words = match.split('_').filter(w => w.length > 1);
      for (const word of words) {
        terms.add(word.toLowerCase());
      }
    }

    // 3. Extract kebab-case identifiers
    const kebabCaseMatches = content.match(/\b[a-z]+(?:-[a-z]+)+\b/g) || [];
    for (const match of kebabCaseMatches) {
      terms.add(match.toLowerCase());
      // Also add individual words
      const words = match.split('-').filter(w => w.length > 1);
      for (const word of words) {
        terms.add(word.toLowerCase());
      }
    }

    // 4. Extract function names and method calls
    const functionMatches = content.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g) || [];
    for (const match of functionMatches) {
      const funcName = match.replace(/\s*\($/, '').toLowerCase();
      if (funcName.length > 2) {
        terms.add(funcName);
      }
    }

    // 5. Extract class names and types
    const classMatches = content.match(/\b(?:class|interface|type|enum)\s+([A-Z][a-zA-Z0-9_]*)/g) || [];
    for (const match of classMatches) {
      const className = match.split(/\s+/)[1];
      if (className) {
        terms.add(className.toLowerCase());
      }
    }

    // 6. Extract import/export names
    const importMatches = content.match(/\b(?:import|export)\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)/g) || [];
    for (const match of importMatches) {
      const names = match.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
      for (const name of names) {
        if (name !== 'import' && name !== 'export' && name !== 'as' && name !== 'from') {
          terms.add(name.toLowerCase());
        }
      }
    }

    // 7. Extract string literals (for API endpoints, routes, etc.)
    const stringMatches = content.match(/["'`]([^"'`\n]{3,50})["'`]/g) || [];
    for (const match of stringMatches) {
      const str = match.slice(1, -1).toLowerCase();
      // Extract words from strings
      const words = str.split(/[^\w]+/).filter(w => w.length > 2);
      for (const word of words) {
        terms.add(word);
      }
    }

    // 8. Extract regular words and identifiers (fallback)
    const regularTokens = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && token.length < 50);

    for (const token of regularTokens) {
      terms.add(token);
    }

    // 9. Add file path terms for better file-based searching
    const pathTerms = this.extractPathTerms(content);
    for (const term of pathTerms) {
      terms.add(term);
    }

    return terms;
  }

  /**
   * Extract terms from file paths and URLs
   */
  private extractPathTerms(content: string): Set<string> {
    const terms = new Set<string>();

    // Extract file paths and URLs
    const pathMatches = content.match(/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.\/-]+/g) || [];
    for (const path of pathMatches) {
      const parts = path.split(/[\/\\.]/).filter(p => p.length > 1);
      for (const part of parts) {
        terms.add(part.toLowerCase());
      }
    }

    return terms;
  }

  /**
   * Ultra-fast search using enhanced TF-IDF scoring with quality filtering
   */
  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`🔍 Ultra-fast search: "${query}" (${this.chunks.size} chunks)`);

    if (this.chunks.size === 0) {
      console.log('⚠️ No indexed data found. Please run indexing first.');
      return [];
    }

    const queryTerms = Array.from(this.extractTerms(query));
    const scores = new Map<string, number>();

    // Calculate enhanced TF-IDF scores for each chunk
    for (const [chunkId, chunk] of this.chunks) {
      // Skip low-quality files
      if (this.isLowQualityFile(chunk.filePath)) {
        continue;
      }

      let score = 0;
      let termMatches = 0;

      for (const term of queryTerms) {
        const tf = this.termFrequency.get(term)?.get(chunkId) || 0;
        const df = this.documentFrequency.get(term) || 0;

        if (tf > 0 && df > 0) {
          // Enhanced TF-IDF calculation
          const tfScore = 1 + Math.log(tf);
          const idfScore = Math.log(this.chunks.size / df);
          score += tfScore * idfScore;
          termMatches++;
        }
      }

      // Only consider chunks that match multiple terms or have high individual scores
      if (termMatches === 0 || (termMatches === 1 && score < 2)) {
        continue;
      }

      // Apply quality boosting
      score = this.applyQualityBoosts(chunk, query, score, termMatches, queryTerms.length);

      if (score > 0) {
        scores.set(chunkId, score);
      }
    }

    // Convert to results and sort
    const results: SearchResult[] = [];
    for (const [chunkId, score] of scores) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        results.push({
          chunk,
          score,
          relevance: score,
          distance: 1 / (1 + score) // Convert score to distance-like metric
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Check if a file should be considered low quality for search results
   */
  private isLowQualityFile(filePath: string): boolean {
    const lowQualityPatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.next/,
      /\.nuxt/,
      /target/,
      /\.cache/,
      /\.temp/,
      /\.tmp/,
      /\.log$/,
      /\.map$/,
      /\.min\.(js|css)$/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      /Cargo\.lock$/,
      /\.d\.ts$/, // TypeScript declaration files
      /custom-indexer/, // Don't include indexer files in results
    ];

    return lowQualityPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Apply quality boosts to improve search relevance
   */
  private applyQualityBoosts(
    chunk: CodeChunk,
    query: string,
    baseScore: number,
    termMatches: number,
    totalQueryTerms: number
  ): number {
    let score = baseScore;

    // 1. Boost for multiple term matches
    const termMatchRatio = termMatches / totalQueryTerms;
    if (termMatchRatio > 0.5) {
      score *= 1.5;
    }

    // 2. Boost for exact phrase matches in content
    if (chunk.content.toLowerCase().includes(query.toLowerCase())) {
      score *= 2.0;
    }

    // 3. Boost for file path relevance
    const queryLower = query.toLowerCase();
    const pathLower = chunk.filePath.toLowerCase();

    if (pathLower.includes(queryLower)) {
      score *= 1.8;
    }

    // 4. Boost for file type relevance
    if (this.isRelevantFileType(chunk.filePath, query)) {
      score *= 1.3;
    }

    // 5. Boost for code structure relevance
    if (this.hasRelevantCodeStructure(chunk.content, query)) {
      score *= 1.4;
    }

    // 6. Penalty for very long chunks (likely auto-generated)
    if (chunk.content.length > 5000) {
      score *= 0.7;
    }

    // 7. Boost for chunks with function/class definitions
    if (this.hasDefinitions(chunk.content)) {
      score *= 1.2;
    }

    return score;
  }

  /**
   * Check if file type is relevant to the query
   */
  private isRelevantFileType(filePath: string, query: string): boolean {
    const queryLower = query.toLowerCase();

    // API/endpoint related queries
    if (queryLower.includes('api') || queryLower.includes('endpoint') || queryLower.includes('route')) {
      return /\/(api|routes?)\//.test(filePath) || /route\.(ts|js)$/.test(filePath);
    }

    // Component related queries
    if (queryLower.includes('component') || queryLower.includes('react')) {
      return /\.(tsx|jsx)$/.test(filePath) || /components?\//.test(filePath);
    }

    // Database/schema related queries
    if (queryLower.includes('database') || queryLower.includes('schema') || queryLower.includes('sql')) {
      return /\/(schema|db|database)\//.test(filePath) || /\.(sql|prisma)$/.test(filePath);
    }

    // Type/interface related queries
    if (queryLower.includes('type') || queryLower.includes('interface')) {
      return /\.(ts|tsx)$/.test(filePath) || /types?\//.test(filePath);
    }

    return false;
  }

  /**
   * Check if content has relevant code structure
   */
  private hasRelevantCodeStructure(content: string, query: string): boolean {
    const queryLower = query.toLowerCase();

    // Function/method definitions
    if (queryLower.includes('function') || queryLower.includes('method')) {
      return /\b(function|async\s+function|const\s+\w+\s*=|\w+\s*\([^)]*\)\s*{)/.test(content);
    }

    // Class definitions
    if (queryLower.includes('class') || queryLower.includes('component')) {
      return /\b(class|interface|type)\s+\w+/.test(content);
    }

    // Error handling
    if (queryLower.includes('error') || queryLower.includes('validation')) {
      return /\b(try|catch|throw|error|Error|validation|validate)/.test(content);
    }

    return false;
  }

  /**
   * Check if content has function or class definitions
   */
  private hasDefinitions(content: string): boolean {
    return /\b(function|class|interface|type|const\s+\w+\s*=|export\s+(function|class|const))/.test(content);
  }

  /**
   * Load existing index from disk
   */
  private async loadExistingIndex(): Promise<void> {
    const chunksPath = join(this.indexDir, 'chunks.json');
    const indexPath = join(this.indexDir, 'lexical_index.json');

    try {
      // Load chunks
      if (await fs.access(chunksPath).then(() => true).catch(() => false)) {
        const chunksData = await fs.readFile(chunksPath, 'utf-8');
        const chunksArray = JSON.parse(chunksData);
        this.chunks.clear();
        for (const chunk of chunksArray) {
          this.chunks.set(chunk.id, chunk);
        }
        console.log(`📦 Loaded ${chunksArray.length} existing chunks`);
      }

      // Load lexical index
      if (await fs.access(indexPath).then(() => true).catch(() => false)) {
        const indexData = await fs.readFile(indexPath, 'utf-8');
        const index = JSON.parse(indexData);

        // Restore Maps from JSON
        this.termFrequency = new Map(
          Object.entries(index.termFrequency).map(([term, chunkMap]) =>
            [term, new Map(Object.entries(chunkMap as Record<string, number>))]
          )
        );
        this.documentFrequency = new Map(Object.entries(index.documentFrequency));
        this.chunkTerms = new Map(
          Object.entries(index.chunkTerms).map(([chunkId, terms]) =>
            [chunkId, new Set(terms as string[])]
          )
        );

        console.log(`🧠 Loaded lexical index with ${this.termFrequency.size} terms`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load existing index: ${error}`);
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(): Promise<void> {
    const chunksPath = join(this.indexDir, 'chunks.json');
    const indexPath = join(this.indexDir, 'lexical_index.json');

    try {
      // Save chunks
      const chunksArray = Array.from(this.chunks.values());
      await fs.writeFile(chunksPath, JSON.stringify(chunksArray, null, 2));

      // Save lexical index (convert Maps to objects for JSON)
      const index = {
        termFrequency: Object.fromEntries(
          Array.from(this.termFrequency.entries()).map(([term, chunkMap]) =>
            [term, Object.fromEntries(chunkMap)]
          )
        ),
        documentFrequency: Object.fromEntries(this.documentFrequency),
        chunkTerms: Object.fromEntries(
          Array.from(this.chunkTerms.entries()).map(([chunkId, terms]) =>
            [chunkId, Array.from(terms)]
          )
        )
      };

      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      console.log(`💾 Saved ${chunksArray.length} chunks and lexical index`);
    } catch (error) {
      console.error(`❌ Failed to save index: ${error}`);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalFiles: new Set(Array.from(this.chunks.values()).map(c => c.filePath)).size,
      totalChunks: this.chunks.size,
      totalRelationships: 0,
      languages: this.getLanguageStats(),
      concepts: {},
      chunkLevels: {},
      averageComplexity: 0,
      indexingTime: 0,
      totalTerms: this.termFrequency.size
    };
  }

  private getLanguageStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const chunk of this.chunks.values()) {
      stats[chunk.language] = (stats[chunk.language] || 0) + 1;
    }
    return stats;
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    // Stop watching first
    await this.stopWatching();

    this.chunks.clear();
    this.termFrequency.clear();
    this.documentFrequency.clear();
    this.chunkTerms.clear();

    // Clear files
    const chunksPath = join(this.indexDir, 'chunks.json');
    const indexPath = join(this.indexDir, 'lexical_index.json');

    try {
      await fs.unlink(chunksPath).catch(() => {});
      await fs.unlink(indexPath).catch(() => {});
    } catch (error) {
      // Ignore errors
    }

    console.log('🧹 Ultra-Fast indexer cleared');
  }

  /**
   * Start file watching for auto-updates
   */
  async startWatching(): Promise<void> {
    if (this.isWatching || this.watcher) {
      return;
    }

    console.log('👀 Starting file watcher for auto-updates...');

    // Create ignore patterns for chokidar
    const ignorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.log',
      '**/*.tmp',
      '**/custom-indexer/**', // Don't watch the indexer itself
      ...this.options.ignorePatterns
    ];

    this.watcher = chokidar.watch(this.projectPath, {
      ignored: ignorePatterns,
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      depth: 10, // Reasonable depth limit
    });

    // Handle file changes
    this.watcher.on('add', async (filePath: string) => {
      if (shouldProcessFile(filePath, this.options.supportedExtensions, this.options.ignorePatterns, this.projectPath)) {
        await this.handleFileChange(filePath, 'add');
      }
    });

    this.watcher.on('change', async (filePath: string) => {
      if (shouldProcessFile(filePath, this.options.supportedExtensions, this.options.ignorePatterns, this.projectPath)) {
        await this.handleFileChange(filePath, 'change');
      }
    });

    this.watcher.on('unlink', async (filePath: string) => {
      await this.handleFileChange(filePath, 'delete');
    });

    this.watcher.on('error', (error: unknown) => {
      console.warn('⚠️ File watcher error:', error);
    });

    this.isWatching = true;
    console.log('✅ File watching enabled - index will auto-update on file changes');
  }

  /**
   * Stop file watching
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
    console.log('🛑 File watching stopped');
  }

  /**
   * Handle individual file changes
   */
  private async handleFileChange(filePath: string, changeType: 'add' | 'change' | 'delete'): Promise<void> {
    if (this.isIndexing) {
      // Skip updates during full indexing
      return;
    }

    try {
      if (changeType === 'delete') {
        // Remove chunks for deleted file
        const chunksToRemove = Array.from(this.chunks.keys()).filter(id => id.startsWith(filePath + ':'));
        for (const chunkId of chunksToRemove) {
          this.removeChunkFromIndex(chunkId);
        }
        console.log(`🗑️ Removed ${chunksToRemove.length} chunks for deleted file: ${filePath}`);
      } else {
        // Process added/changed file
        const newChunks = await this.processFileUltraFast(filePath);

        // Remove old chunks for this file
        const oldChunks = Array.from(this.chunks.keys()).filter(id => id.startsWith(filePath + ':'));
        for (const chunkId of oldChunks) {
          this.removeChunkFromIndex(chunkId);
        }

        // Add new chunks
        if (newChunks.length > 0) {
          await this.buildLexicalIndexForChunks(newChunks);
          for (const chunk of newChunks) {
            this.chunks.set(chunk.id, chunk);
          }
          console.log(`🔄 Updated ${newChunks.length} chunks for file: ${filePath}`);
        }
      }

      // Save updated index
      await this.saveIndex();
    } catch (error) {
      console.warn(`⚠️ Failed to update index for ${filePath}:`, error);
    }
  }

  /**
   * Remove a chunk from the lexical index
   */
  private removeChunkFromIndex(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return;

    const terms = this.chunkTerms.get(chunkId);
    if (terms) {
      for (const term of terms) {
        const termMap = this.termFrequency.get(term);
        if (termMap) {
          termMap.delete(chunkId);
          if (termMap.size === 0) {
            this.termFrequency.delete(term);
            this.documentFrequency.delete(term);
          } else {
            this.documentFrequency.set(term, (this.documentFrequency.get(term) || 1) - 1);
          }
        }
      }
      this.chunkTerms.delete(chunkId);
    }

    this.chunks.delete(chunkId);
  }

  /**
   * Build lexical index for specific chunks (for incremental updates)
   */
  private async buildLexicalIndexForChunks(chunks: CodeChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const terms = this.extractTerms(chunk.content);
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
  }
}
