import { FlagEmbedding, EmbeddingModel } from 'fastembed';
import { join } from 'path';
import { ensureDir } from '../utils.js';
import { CodeChunk, SearchResult, HierarchicalChunk, CodeRelationship } from '../common/types.js';
import { QueryAnalysis } from './QueryAnalysis.js';
import { SearchRanking } from './SearchRanking.js';
import { DataManagement } from './DataManagement.js';

/**
 * Marshal Context Engine - Advanced code understanding with world-class capabilities
 */
export class MarshalContextEngine {
  private codeModel: FlagEmbedding | null = null;
  private conceptModel: FlagEmbedding | null = null;
  private chunks: Map<string, HierarchicalChunk> = new Map();
  private embeddings: Map<string, { code: number[]; concept: number[] }> = new Map();
  private relationships: Map<string, CodeRelationship[]> = new Map();
  // private conceptGraph: Map<string, Set<string>> = new Map();
  private embeddingsDir: string;
  private isInitialized = false;

  // Advanced caching for different query types
  // private queryCache: Map<string, { results: SearchResult[]; timestamp: number; intent: QueryIntent }> = new Map();
  // private conceptCache: Map<string, string[]> = new Map();

  private queryAnalysis: QueryAnalysis;
  private searchRanking: SearchRanking;
  private dataManagement: DataManagement;

  constructor(embeddingsDir: string) {
    this.embeddingsDir = embeddingsDir;
    this.queryAnalysis = new QueryAnalysis();
    // Models are initialized in initialize(), so pass null for now
    this.searchRanking = new SearchRanking(this.chunks, this.embeddings, this.relationships, null, null);
    this.dataManagement = new DataManagement(null, null);
  }

  /**
   * Initialize the Augment-style context engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const startTime = Date.now();
    await ensureDir(this.embeddingsDir);

    // Initialize dual embedding models for different aspects
    console.log('🧠 Initializing dual embedding models...');
    
    // Code structure model - optimized for syntax and structure
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

    // Update models in sub-components after initialization
    this.searchRanking = new SearchRanking(this.chunks, this.embeddings, this.relationships, this.codeModel, this.conceptModel);
    this.dataManagement = new DataManagement(this.codeModel, this.conceptModel);

    await this.dataManagement.loadExistingData();
    this.isInitialized = true;
    
    console.log(`🚀 Augment Context Engine initialized in ${Date.now() - startTime}ms`);
  }

  /**
   * Advanced search with intent understanding and multi-phase ranking
   */
  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    if (!this.isInitialized) await this.initialize();

    const startTime = Date.now();
    console.log(`🔍 Marshal Search: "${query}"`);

    // Phase 1: Intent Analysis
    const intent = await this.queryAnalysis.analyzeQueryIntent(query);
    console.log(`📊 Intent: ${intent.type} (confidence: ${intent.confidence.toFixed(2)})`);

    // Phase 2: Query Expansion
    const expandedQueries = await this.queryAnalysis.expandQuery(query, intent);
    console.log(`🔄 Expanded to ${expandedQueries.length} query variations`);

    // Phase 3: Multi-Model Search
    const candidates = await this.searchRanking.multiModelSearch(expandedQueries, topK * 5);
    console.log(`🎯 Found ${candidates.length} candidates`);

    // Phase 4: Relationship-Based Expansion
    const expandedCandidates = await this.searchRanking.expandWithRelationships(candidates, intent);
    console.log(`🕸️ Expanded to ${expandedCandidates.length} with relationships`);

    // Phase 5: Advanced Re-ranking
    const rankedResults = await this.searchRanking.advancedRerank(expandedCandidates, query, intent);
    console.log(`📈 Re-ranked results`);

    // Phase 6: Context-Aware Filtering
    const finalResults = this.searchRanking.contextAwareFilter(rankedResults, intent, topK);
    
    console.log(`✅ Search completed in ${Date.now() - startTime}ms`);
    return finalResults;
  }

  /**
   * Add chunks to the context engine
   */
  async addChunks(chunks: CodeChunk[]): Promise<void> {
    // Convert CodeChunk to HierarchicalChunk format
    const hierarchicalChunks: HierarchicalChunk[] = chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      level: 'block' as const, // Default level
      childIds: [],
      metadata: {
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.language,
        symbols: chunk.symbols || [],
        concepts: [], // Would be extracted
        complexity: 1,
        importance: 1,
        dependencies: [],
        exports: []
      }
    }));

    // Store chunks
    for (const chunk of hierarchicalChunks) {
      this.chunks.set(chunk.id, chunk);
    }

    // Generate embeddings for new chunks
    await this.dataManagement.generateEmbeddings(hierarchicalChunks, this.embeddings);

    console.log(`✅ Added ${chunks.length} chunks to Marshal Context Engine`);
  }

  /**
   * Remove chunks by file path
   */
  async removeChunksByFile(filePath: string): Promise<void> {
    const chunksToRemove: string[] = [];

    for (const [chunkId, chunk] of this.chunks) {
      if (chunk.metadata.filePath === filePath) {
        chunksToRemove.push(chunkId);
      }
    }

    for (const chunkId of chunksToRemove) {
      this.chunks.delete(chunkId);
      this.embeddings.delete(chunkId);
      this.relationships.delete(chunkId);
    }

    console.log(`🗑️ Removed ${chunksToRemove.length} chunks for file: ${filePath}`);
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.chunks.clear();
    this.embeddings.clear();
    this.relationships.clear();
    console.log('🧹 Cleared all Marshal Context Engine data');
  }
}