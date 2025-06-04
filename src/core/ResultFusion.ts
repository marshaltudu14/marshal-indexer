import { SearchResult, ProcessedQuery, FusedResult, RankingFactor } from '../common/types.js';
import { LearningRanker } from '../intelligence/LearningRanker.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

/**
 * Advanced result fusion and ranking system
 * Combines multiple search strategies and provides explainable results
 */
export class ResultFusion {
  private learningRanker: LearningRanker;
  private performanceMonitor: PerformanceMonitor;
  private fusionHistory: Map<string, FusedResult[]> = new Map();

  constructor() {
    this.learningRanker = new LearningRanker();
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * Fuse results from multiple search strategies with explainable ranking
   */
  async fuseResults(
    vectorResults: SearchResult[],
    lexicalResults: SearchResult[],
    graphResults: SearchResult[],
    query: ProcessedQuery
  ): Promise<FusedResult[]> {
    const startTime = Date.now();
    
    console.log(`🔀 Fusing results: Vector(${vectorResults.length}), Lexical(${lexicalResults.length}), Graph(${graphResults.length})`);

    // Step 1: Normalize and deduplicate results
    const normalizedResults = this.normalizeResults([
      ...vectorResults.map(r => ({ ...r, source: 'vector' as const })),
      ...lexicalResults.map(r => ({ ...r, source: 'lexical' as const })),
      ...graphResults.map(r => ({ ...r, source: 'graph' as const }))
    ]);

    // Step 2: Calculate fusion scores
    const fusedResults = await this.calculateFusionScores(normalizedResults, query);

    // Step 3: Apply learning-based ranking
    const rankedResults = await this.learningRanker.rankResults(fusedResults, query);

    // Step 4: Add explanations
    const explainedResults = this.addExplanations(rankedResults, query);

    // Step 5: Apply diversity filtering
    const diverseResults = this.applyDiversityFiltering(explainedResults, query);

    // Step 6: Store for learning
    this.storeFusionResults(query.original, diverseResults);

    const processingTime = Date.now() - startTime;
    this.performanceMonitor.recordFusionTime(processingTime);

    console.log(`✨ Fused ${diverseResults.length} results in ${processingTime}ms`);
    
    return diverseResults;
  }

  /**
   * Normalize results from different search strategies
   */
  private normalizeResults(results: Array<SearchResult & { source: 'vector' | 'lexical' | 'graph' }>): Array<SearchResult & { source: 'vector' | 'lexical' | 'graph' }> {
    const resultMap = new Map<string, SearchResult & { source: 'vector' | 'lexical' | 'graph' }>();
    
    for (const result of results) {
      const key = result.chunk.id;
      const existing = resultMap.get(key);
      
      if (!existing) {
        resultMap.set(key, result);
      } else {
        // Merge scores from multiple sources
        const mergedResult = {
          ...existing,
          score: Math.max(existing.score, result.score),
          relevance: Math.max(existing.relevance, result.relevance),
          source: (existing.source === result.source ? existing.source : 'vector') as 'vector' | 'lexical' | 'graph'
        };
        resultMap.set(key, mergedResult);
      }
    }
    
    return Array.from(resultMap.values());
  }

  /**
   * Calculate fusion scores using multiple ranking factors
   */
  private async calculateFusionScores(
    results: Array<SearchResult & { source: 'vector' | 'lexical' | 'graph' | 'hybrid' }>,
    query: ProcessedQuery
  ): Promise<FusedResult[]> {
    const fusedResults: FusedResult[] = [];

    for (const result of results) {
      const factors = await this.calculateRankingFactors(result, query);
      const fusionScore = this.computeFusionScore(factors, query);
      
      fusedResults.push({
        ...result,
        fusionScore,
        rankingFactors: factors,
        explanation: '', // Will be filled later
        confidence: this.calculateConfidence(factors)
      });
    }

    return fusedResults.sort((a, b) => b.fusionScore - a.fusionScore);
  }

  /**
   * Calculate detailed ranking factors for explainable results
   */
  private async calculateRankingFactors(
    result: SearchResult & { source: string },
    query: ProcessedQuery
  ): Promise<RankingFactor[]> {
    const factors: RankingFactor[] = [];

    // Factor 1: Semantic similarity
    factors.push({
      name: 'semantic_similarity',
      value: result.score,
      weight: 0.3,
      explanation: `Semantic similarity score: ${result.score.toFixed(3)}`
    });

    // Factor 2: Symbol matching
    const symbolScore = this.calculateSymbolMatchScore(result, query);
    factors.push({
      name: 'symbol_matching',
      value: symbolScore,
      weight: 0.25,
      explanation: `Symbol matching score: ${symbolScore.toFixed(3)}`
    });

    // Factor 3: Intent alignment
    const intentScore = this.calculateIntentAlignmentScore(result, query);
    factors.push({
      name: 'intent_alignment',
      value: intentScore,
      weight: 0.2,
      explanation: `Intent alignment score: ${intentScore.toFixed(3)}`
    });

    // Factor 4: Code quality and importance
    const qualityScore = this.calculateQualityScore(result);
    factors.push({
      name: 'code_quality',
      value: qualityScore,
      weight: 0.15,
      explanation: `Code quality and importance: ${qualityScore.toFixed(3)}`
    });

    // Factor 5: Recency and usage
    const recencyScore = this.calculateRecencyScore(result);
    factors.push({
      name: 'recency',
      value: recencyScore,
      weight: 0.1,
      explanation: `Recency and usage score: ${recencyScore.toFixed(3)}`
    });

    return factors;
  }

  /**
   * Compute final fusion score from ranking factors
   */
  private computeFusionScore(factors: RankingFactor[], query: ProcessedQuery): number {
    let score = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      // Adjust weights based on query intent
      const adjustedWeight = this.adjustWeightForIntent(factor, query.intent);
      score += factor.value * adjustedWeight;
      totalWeight += adjustedWeight;
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Add detailed explanations to results
   */
  private addExplanations(results: FusedResult[], _query: ProcessedQuery): FusedResult[] {
    return results.map(result => {
      const topFactors = result.rankingFactors
        .sort((a, b) => (b.value * b.weight) - (a.value * a.weight))
        .slice(0, 3);

      const explanation = `Selected because: ${topFactors.map(f => f.explanation).join('; ')}`;
      
      return {
        ...result,
        explanation
      };
    });
  }

  /**
   * Apply diversity filtering to avoid redundant results
   */
  private applyDiversityFiltering(results: FusedResult[], _query: ProcessedQuery): FusedResult[] {
    const filtered: FusedResult[] = [];
    const seenFiles = new Set<string>();
    const seenConcepts = new Set<string>();
    const maxPerFile = 3;
    const maxSimilarConcepts = 2;

    for (const result of results) {
      if (filtered.length >= 20) break; // Limit total results

      const filePath = result.chunk.filePath;
      const fileCount = Array.from(seenFiles).filter(f => f === filePath).length;
      
      if (fileCount >= maxPerFile) continue;

      // Check concept diversity
      const concepts = result.chunk.concepts || [];
      const conceptOverlap = concepts.filter(c => seenConcepts.has(c)).length;
      
      if (conceptOverlap > maxSimilarConcepts) continue;

      // Quality threshold
      if (result.fusionScore < 0.1) continue;

      filtered.push(result);
      seenFiles.add(filePath);
      concepts.forEach(c => seenConcepts.add(c));
    }

    return filtered;
  }

  /**
   * Calculate symbol matching score
   */
  private calculateSymbolMatchScore(result: SearchResult, query: ProcessedQuery): number {
    const symbols = result.chunk.symbols || [];
    const querySymbols = query.entities;
    
    if (symbols.length === 0 || querySymbols.length === 0) return 0;

    let matches = 0;
    for (const symbol of symbols) {
      for (const querySymbol of querySymbols) {
        if (symbol.toLowerCase().includes(querySymbol.toLowerCase()) ||
            querySymbol.toLowerCase().includes(symbol.toLowerCase())) {
          matches++;
        }
      }
    }

    return Math.min(matches / Math.max(symbols.length, querySymbols.length), 1.0);
  }

  /**
   * Calculate intent alignment score
   */
  private calculateIntentAlignmentScore(result: SearchResult, query: ProcessedQuery): number {
    const intent = query.intent;
    let score = 0.5; // Base score

    // Adjust based on intent type and chunk characteristics
    switch (intent.type) {
      case 'function_search':
        if (result.chunk.functions && result.chunk.functions.length > 0) score += 0.3;
        break;
      case 'class_search':
        if (result.chunk.classes && result.chunk.classes.length > 0) score += 0.3;
        break;
      case 'debug_search':
        if (result.chunk.content.includes('error') || result.chunk.content.includes('exception')) score += 0.3;
        break;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate code quality score
   */
  private calculateQualityScore(result: SearchResult): number {
    let score = 0.5;

    // Consider various quality factors
    if (result.marshalMetadata) {
      score += result.marshalMetadata.importance * 0.3;
      score += Math.min(result.marshalMetadata.complexity * 0.1, 0.2);
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(_result: SearchResult): number {
    // This would use actual file modification times
    // For now, return a base score
    return 0.5;
  }

  /**
   * Adjust factor weights based on query intent
   */
  private adjustWeightForIntent(factor: RankingFactor, intent: any): number {
    let multiplier = 1.0;

    switch (intent.type) {
      case 'function_search':
        if (factor.name === 'symbol_matching') multiplier = 1.5;
        break;
      case 'debug_search':
        if (factor.name === 'intent_alignment') multiplier = 1.3;
        break;
      case 'concept_search':
        if (factor.name === 'semantic_similarity') multiplier = 1.4;
        break;
    }

    return factor.weight * multiplier;
  }

  /**
   * Calculate confidence score for the result
   */
  private calculateConfidence(factors: RankingFactor[]): number {
    const avgScore = factors.reduce((sum, f) => sum + f.value, 0) / factors.length;
    const variance = factors.reduce((sum, f) => sum + Math.pow(f.value - avgScore, 2), 0) / factors.length;
    
    // Higher confidence when scores are high and consistent
    return Math.max(0, Math.min(1, avgScore - Math.sqrt(variance)));
  }

  /**
   * Store fusion results for learning
   */
  private storeFusionResults(query: string, results: FusedResult[]): void {
    this.fusionHistory.set(query, results);
    
    // Keep only recent queries
    if (this.fusionHistory.size > 1000) {
      const oldestKey = Array.from(this.fusionHistory.keys())[0];
      if (oldestKey) {
        this.fusionHistory.delete(oldestKey);
      }
    }
  }
}
