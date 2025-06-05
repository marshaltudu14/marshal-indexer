import { FlagEmbedding, EmbeddingModel } from 'fastembed';
import { join } from 'path';
import { ensureDir } from '../utils.js';
import { CodeChunk, HierarchicalChunk, CodeRelationship, FusedResult } from '../common/types.js';
import { QueryProcessor } from './QueryProcessor.js';
import { ResultFusion } from './ResultFusion.js';
import { HybridSearchEngine } from '../search/HybridSearchEngine.js';
// import { IntentClassifier } from '../intelligence/IntentClassifier.js';
import { LearningRanker } from '../intelligence/LearningRanker.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import { CacheManager } from '../utils/CacheManager.js';

/**
 * Enhanced Marshal Context Engine - Superior to other context engines
 * Provides advanced intent understanding, multi-modal search, and learning-based ranking
 */
export class MarshalContextEngine {
  private embeddingsDir: string;
  private isInitialized = false;

  // Core components
  private queryProcessor: QueryProcessor;
  private resultFusion: ResultFusion;
  private hybridSearchEngine: HybridSearchEngine;
  private learningRanker: LearningRanker;
  private performanceMonitor: PerformanceMonitor;
  private cache: CacheManager<FusedResult[]>;

  // Data storage
  private chunks: Map<string, HierarchicalChunk> = new Map();
  private embeddings: Map<string, { code: number[]; concept: number[] }> = new Map();
  private relationships: Map<string, CodeRelationship[]> = new Map();

  // AI Models
  private codeModel: FlagEmbedding | null = null;
  private conceptModel: FlagEmbedding | null = null;

  constructor(embeddingsDir: string) {
    this.embeddingsDir = embeddingsDir;
    this.queryProcessor = new QueryProcessor();
    this.resultFusion = new ResultFusion();
    this.learningRanker = new LearningRanker();
    this.performanceMonitor = new PerformanceMonitor();
    this.cache = new CacheManager<FusedResult[]>(100 * 1024 * 1024); // 100MB cache
    
    // Initialize hybrid search engine (will be updated after model initialization)
    this.hybridSearchEngine = new HybridSearchEngine(this.chunks, this.embeddings, this.relationships);
  }

  /**
   * Initialize the Marshal Context Engine with all components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const startTime = Date.now();
    console.log('🚀 Initializing Marshal Context Engine...');

    await ensureDir(this.embeddingsDir);

    // Initialize embedding models
    console.log('📥 Loading embedding models...');
    
    // Code model - optimized for code structure and syntax
    this.codeModel = await FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
      maxLength: 512,
      cacheDir: join(this.embeddingsDir, 'code_model_cache')
    });

    // Concept model - optimized for semantic understanding
    this.conceptModel = await FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15, // In production, use different model
      maxLength: 256,
      cacheDir: join(this.embeddingsDir, 'concept_model_cache')
    });

    // Update hybrid search engine with models
    this.hybridSearchEngine = new HybridSearchEngine(this.chunks, this.embeddings, this.relationships);

    // Load existing data
    await this.loadExistingData();

    this.isInitialized = true;
    
    console.log(`🚀 Marshal Context Engine initialized in ${Date.now() - startTime}ms`);
    console.log(`📊 Loaded: ${this.chunks.size} chunks, ${this.embeddings.size} embeddings, ${this.relationships.size} relationships`);
  }

  /**
   * Advanced search with superior intent understanding and multi-phase ranking
   */
  async search(query: string, topK: number = 10): Promise<FusedResult[]> {
    if (!this.isInitialized) await this.initialize();

    const searchStartTime = Date.now();
    console.log(`🔍 Marshal Search: "${query}"`);

    // Check cache first
    const cacheKey = `search_${query}_${topK}`;
    const cachedResults = this.cache.get(cacheKey);
    if (cachedResults) {
      console.log(`💾 Cache hit for query: "${query}"`);
      this.performanceMonitor.recordQueryPerformance({
        query,
        processingTime: 0,
        searchTime: Date.now() - searchStartTime,
        fusionTime: 0,
        resultCount: cachedResults.length,
        cacheHit: true,
        timestamp: Date.now()
      });
      return cachedResults;
    }

    // Phase 1: Advanced Query Processing
    const processedQuery = await this.queryProcessor.processQuery(
      query,
      undefined,
      this.getCodebaseMetadata()
    );

    // Phase 2: Multi-Modal Hybrid Search
    const searchResults = await this.hybridSearchEngine.adaptiveSearch(processedQuery, topK * 3);
    
    // Phase 3: Advanced Result Fusion with Explainable Ranking
    const fusedResults = await this.resultFusion.fuseResults(
      searchResults.vectorResults,
      searchResults.lexicalResults,
      searchResults.graphResults,
      processedQuery
    );

    // Phase 4: Learning-Based Re-ranking
    const finalResults = await this.learningRanker.rankResults(fusedResults, processedQuery);

    // Phase 5: Cache results
    this.cache.set(cacheKey, finalResults);

    // Record performance metrics
    const totalTime = Date.now() - searchStartTime;
    this.performanceMonitor.recordQueryPerformance({
      query,
      processingTime: processedQuery.processingTime,
      searchTime: totalTime - processedQuery.processingTime,
      fusionTime: 0, // Would be tracked separately
      resultCount: finalResults.length,
      cacheHit: false,
      timestamp: Date.now()
    });

    console.log(`✨ Marshal Search completed in ${totalTime}ms`);
    console.log(`📈 Strategy: ${searchResults.strategy}, Results: ${finalResults.length}`);
    
    return finalResults.slice(0, topK);
  }

  /**
   * Add chunks with embeddings and relationships
   */
  async addChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    console.log(`📥 Adding ${chunks.length} chunks to Marshal Context Engine...`);

    // Convert CodeChunks to HierarchicalChunks
    const hierarchicalChunks = chunks.map(chunk => this.convertToHierarchicalChunk(chunk));

    // Generate embeddings for new chunks
    await this.generateEmbeddings(hierarchicalChunks);

    // Store chunks
    for (const chunk of hierarchicalChunks) {
      this.chunks.set(chunk.id, chunk);
    }

    // Clear cache to ensure fresh results
    this.cache.clear();

    console.log(`✅ Added ${chunks.length} chunks successfully`);
  }

  /**
   * Record user feedback for learning
   */
  recordFeedback(
    query: string,
    resultId: string,
    feedbackType: 'click' | 'like' | 'dislike' | 'copy' | 'ignore',
    relevanceScore?: number
  ): void {
    const queryId = this.generateQueryId(query);
    this.learningRanker.recordFeedback(queryId, resultId, feedbackType, relevanceScore);
  }

  /**
   * Record click-through data for learning
   */
  recordClick(query: string, resultId: string, position: number, dwellTime?: number): void {
    const queryId = this.generateQueryId(query);
    this.learningRanker.recordClick(queryId, resultId, position, dwellTime);
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics() {
    return {
      searchMetrics: this.performanceMonitor.getMetrics(),
      cacheStats: this.cache.getStats(),
      hybridSearchStats: this.hybridSearchEngine.getPerformanceMetrics(),
      learningStats: this.learningRanker.getStats(),
      dataStats: {
        totalChunks: this.chunks.size,
        totalEmbeddings: this.embeddings.size,
        totalRelationships: this.relationships.size
      }
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    return this.performanceMonitor.generateReport();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.hybridSearchEngine.clearCache();
    console.log('🧹 Marshal Context Engine cache cleared');
  }

  /**
   * Optimize engine performance
   */
  optimize(): void {
    console.log('🔧 Optimizing Marshal Context Engine...');

    this.cache.optimize();
    this.hybridSearchEngine.optimize();

    // Clean up old data
    this.cleanupOldData();

    console.log('✅ Optimization completed');
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(chunks: HierarchicalChunk[]): Promise<void> {
    if (!this.codeModel || !this.conceptModel) {
      throw new Error('Embedding models not initialized');
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
      const codeEmbedding = codeEmbeddings[i];
      const conceptEmbedding = conceptEmbeddings[i];

      if (chunk && codeEmbedding && conceptEmbedding) {
        this.embeddings.set(chunk.id, {
          code: codeEmbedding,
          concept: conceptEmbedding
        });
      }
    }
  }

  /**
   * Prepare text for embedding generation
   */
  private prepareTextForEmbedding(chunk: HierarchicalChunk): string {
    const symbols = chunk.metadata.symbols.join(' ');
    const concepts = chunk.metadata.concepts.join(' ');
    const content = chunk.content.substring(0, 1000); // Limit content length
    
    return `${content} ${symbols} ${concepts}`.trim();
  }

  /**
   * Convert CodeChunk to HierarchicalChunk
   */
  private convertToHierarchicalChunk(chunk: CodeChunk): HierarchicalChunk {
    return {
      id: chunk.id,
      content: chunk.content,
      level: 'block', // Default level
      childIds: [],
      metadata: {
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.language,
        symbols: chunk.symbols || [],
        concepts: chunk.concepts || [],
        complexity: 0.5, // Default complexity
        importance: 0.5, // Default importance
        dependencies: chunk.dependencies || [],
        exports: chunk.exports || []
      }
    };
  }

  /**
   * Get codebase metadata for query processing
   */
  private getCodebaseMetadata() {
    const languages = new Set<string>();
    const symbols = new Set<string>();
    const concepts = new Set<string>();

    for (const chunk of this.chunks.values()) {
      languages.add(chunk.metadata.language);
      chunk.metadata.symbols.forEach(s => symbols.add(s));
      chunk.metadata.concepts.forEach(c => concepts.add(c));
    }

    return {
      totalFiles: new Set(Array.from(this.chunks.values()).map(c => c.metadata.filePath)).size,
      totalChunks: this.chunks.size,
      languages: Array.from(languages),
      commonSymbols: Array.from(symbols).slice(0, 100),
      commonPatterns: Array.from(concepts).slice(0, 50),
      technologies: Array.from(languages),
      architecturalPatterns: [],
      frameworksUsed: []
    };
  }

  /**
   * Load existing data from storage
   */
  private async loadExistingData(): Promise<void> {
    // This would load from persistent storage
    // For now, it's a placeholder
    console.log('📂 Loading existing data...');
  }

  /**
   * Generate query ID for tracking
   */
  private generateQueryId(query: string): string {
    return `query_${Date.now()}_${query.substring(0, 20).replace(/\s+/g, '_')}`;
  }

  /**
   * Clean up old data to maintain performance
   */
  private cleanupOldData(): void {
    // Remove old cache entries, unused embeddings, etc.
    // This would be more sophisticated in production
  }
}
