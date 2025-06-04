import { FusedResult, ProcessedQuery, RankingFactor } from '../common/types.js';

/**
 * Learning-based ranking system that adapts based on user interactions
 * Continuously improves ranking quality through feedback and usage patterns
 */
export class LearningRanker {
  private rankingHistory: Map<string, RankingData[]> = new Map();
  private featureWeights: Map<string, number> = new Map();
  private userFeedback: Map<string, FeedbackData[]> = new Map();
  private clickThroughData: Map<string, ClickData[]> = new Map();

  constructor() {
    this.initializeFeatureWeights();
  }

  /**
   * Rank results using learning-based algorithms
   */
  async rankResults(results: FusedResult[], query: ProcessedQuery): Promise<FusedResult[]> {
    console.log(`🧠 Learning-based ranking for ${results.length} results`);

    // 1. Apply learned feature weights
    const weightedResults = this.applyLearnedWeights(results, query);

    // 2. Apply personalization based on user patterns
    const personalizedResults = this.applyPersonalization(weightedResults, query);

    // 3. Apply diversity constraints
    const diverseResults = this.applyDiversityConstraints(personalizedResults);

    // 4. Store ranking data for learning
    this.storeRankingData(query, diverseResults);

    return diverseResults;
  }

  /**
   * Record user feedback for learning
   */
  recordFeedback(
    queryId: string,
    resultId: string,
    feedbackType: 'click' | 'like' | 'dislike' | 'copy' | 'ignore',
    relevanceScore?: number
  ): void {
    if (!this.userFeedback.has(queryId)) {
      this.userFeedback.set(queryId, []);
    }

    const feedbackData: FeedbackData = {
      resultId,
      feedbackType,
      timestamp: Date.now()
    };

    if (relevanceScore !== undefined) {
      feedbackData.relevanceScore = relevanceScore;
    }

    this.userFeedback.get(queryId)!.push(feedbackData);

    // Update feature weights based on feedback
    this.updateFeatureWeights(queryId, resultId, feedbackType);
  }

  /**
   * Record click-through data
   */
  recordClick(queryId: string, resultId: string, position: number, dwellTime?: number): void {
    if (!this.clickThroughData.has(queryId)) {
      this.clickThroughData.set(queryId, []);
    }

    const clickData: ClickData = {
      resultId,
      position,
      timestamp: Date.now()
    };

    if (dwellTime !== undefined) {
      clickData.dwellTime = dwellTime;
    }

    this.clickThroughData.get(queryId)!.push(clickData);

    // Learn from click patterns
    this.learnFromClickData(queryId, resultId, position, dwellTime);
  }

  /**
   * Apply learned feature weights to results
   */
  private applyLearnedWeights(results: FusedResult[], query: ProcessedQuery): FusedResult[] {
    for (const result of results) {
      let adjustedScore = 0;
      let totalWeight = 0;

      for (const factor of result.rankingFactors) {
        const learnedWeight = this.featureWeights.get(factor.name) || factor.weight;
        const intentAdjustedWeight = this.adjustWeightForIntent(learnedWeight, factor.name, query);
        
        adjustedScore += factor.value * intentAdjustedWeight;
        totalWeight += intentAdjustedWeight;
      }

      if (totalWeight > 0) {
        result.fusionScore = adjustedScore / totalWeight;
      }

      // Apply query-specific learning
      const queryPattern = this.getQueryPattern(query);
      const patternBoost = this.getPatternBoost(queryPattern, result);
      result.fusionScore *= (1 + patternBoost);
    }

    return results.sort((a, b) => b.fusionScore - a.fusionScore);
  }

  /**
   * Apply personalization based on user patterns
   */
  private applyPersonalization(results: FusedResult[], _query: ProcessedQuery): FusedResult[] {
    const userPreferences = this.getUserPreferences();

    for (const result of results) {
      let personalizationBoost = 1.0;

      // Language preference
      if (userPreferences.preferredLanguages.has(result.chunk.language)) {
        personalizationBoost *= 1.1;
      }

      // File type preference
      const fileExtension = this.getFileExtension(result.chunk.filePath);
      if (userPreferences.preferredFileTypes.has(fileExtension)) {
        personalizationBoost *= 1.05;
      }

      // Directory preference
      const directory = this.getDirectory(result.chunk.filePath);
      if (userPreferences.preferredDirectories.has(directory)) {
        personalizationBoost *= 1.08;
      }

      // Complexity preference
      const complexity = result.marshalMetadata?.complexity || 0.5;
      if (Math.abs(complexity - userPreferences.preferredComplexity) < 0.2) {
        personalizationBoost *= 1.06;
      }

      result.fusionScore *= personalizationBoost;
    }

    return results;
  }

  /**
   * Apply diversity constraints to avoid redundant results
   */
  private applyDiversityConstraints(results: FusedResult[]): FusedResult[] {
    const diverseResults: FusedResult[] = [];
    const seenFiles = new Set<string>();
    const seenConcepts = new Set<string>();
    const seenSymbols = new Set<string>();

    for (const result of results) {
      if (diverseResults.length >= 20) break; // Limit total results

      // File diversity
      const fileName = this.getFileName(result.chunk.filePath);
      const fileCount = Array.from(seenFiles).filter(f => f === fileName).length;
      if (fileCount >= 3) continue; // Max 3 results per file

      // Concept diversity
      const concepts = result.chunk.concepts || [];
      const conceptOverlap = concepts.filter(c => seenConcepts.has(c)).length;
      if (conceptOverlap > concepts.length * 0.7) continue; // Skip if >70% concept overlap

      // Symbol diversity
      const symbols = result.chunk.symbols || [];
      const symbolOverlap = symbols.filter(s => seenSymbols.has(s)).length;
      if (symbolOverlap > symbols.length * 0.8) continue; // Skip if >80% symbol overlap

      // Quality threshold
      if (result.fusionScore < 0.1) continue;

      diverseResults.push(result);
      seenFiles.add(fileName);
      concepts.forEach(c => seenConcepts.add(c));
      symbols.forEach(s => seenSymbols.add(s));
    }

    return diverseResults;
  }

  /**
   * Store ranking data for future learning
   */
  private storeRankingData(query: ProcessedQuery, results: FusedResult[]): void {
    const queryKey = this.getQueryKey(query);
    
    if (!this.rankingHistory.has(queryKey)) {
      this.rankingHistory.set(queryKey, []);
    }

    this.rankingHistory.get(queryKey)!.push({
      query: query.original,
      intent: query.intent.type,
      results: results.map(r => ({
        id: r.chunk.id,
        score: r.fusionScore,
        factors: r.rankingFactors
      })),
      timestamp: Date.now()
    });

    // Keep only recent history
    const history = this.rankingHistory.get(queryKey)!;
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Update feature weights based on user feedback
   */
  private updateFeatureWeights(queryId: string, resultId: string, feedbackType: string): void {
    const learningRate = 0.01;
    
    // Find the ranking data for this query
    const rankingData = this.findRankingData(queryId, resultId);
    if (!rankingData) return;

    // Adjust weights based on feedback
    for (const factor of rankingData.factors) {
      const currentWeight = this.featureWeights.get(factor.name) || factor.weight;
      let adjustment = 0;

      switch (feedbackType) {
        case 'click':
        case 'like':
        case 'copy':
          adjustment = learningRate * factor.value; // Positive feedback
          break;
        case 'dislike':
        case 'ignore':
          adjustment = -learningRate * factor.value; // Negative feedback
          break;
      }

      const newWeight = Math.max(0.01, Math.min(2.0, currentWeight + adjustment));
      this.featureWeights.set(factor.name, newWeight);
    }
  }

  /**
   * Learn from click-through data
   */
  private learnFromClickData(queryId: string, resultId: string, position: number, dwellTime?: number): void {
    // Higher positions should have higher expected click rates
    const expectedClickRate = 1 / (position + 1);
    
    // Longer dwell time indicates higher satisfaction
    const satisfactionScore = dwellTime ? Math.min(dwellTime / 30000, 1.0) : 0.5; // 30 seconds = full satisfaction
    
    // Adjust feature weights based on position and satisfaction
    const rankingData = this.findRankingData(queryId, resultId);
    if (rankingData) {
      const positionPenalty = position > 5 ? 0.1 : 0; // Penalize low positions
      const adjustment = (satisfactionScore - expectedClickRate - positionPenalty) * 0.005;
      
      for (const factor of rankingData.factors) {
        const currentWeight = this.featureWeights.get(factor.name) || factor.weight;
        const newWeight = Math.max(0.01, Math.min(2.0, currentWeight + adjustment));
        this.featureWeights.set(factor.name, newWeight);
      }
    }
  }

  /**
   * Get user preferences based on historical data
   */
  private getUserPreferences(): UserPreferences {
    const preferences: UserPreferences = {
      preferredLanguages: new Set(),
      preferredFileTypes: new Set(),
      preferredDirectories: new Set(),
      preferredComplexity: 0.5
    };

    // Analyze click-through data to infer preferences
    let totalComplexity = 0;
    let complexityCount = 0;

    for (const clicks of this.clickThroughData.values()) {
      for (const _click of clicks) {
        // This would need access to result metadata
        // For now, use placeholder logic
        preferences.preferredLanguages.add('typescript');
        preferences.preferredFileTypes.add('.ts');
        preferences.preferredDirectories.add('src');
        
        totalComplexity += 0.5; // Placeholder
        complexityCount++;
      }
    }

    if (complexityCount > 0) {
      preferences.preferredComplexity = totalComplexity / complexityCount;
    }

    return preferences;
  }

  /**
   * Get query pattern for learning
   */
  private getQueryPattern(query: ProcessedQuery): string {
    return `${query.intent.type}_${query.keywords.slice(0, 3).join('_')}`;
  }

  /**
   * Get pattern boost based on historical performance
   */
  private getPatternBoost(_pattern: string, _result: FusedResult): number {
    // This would analyze historical performance of similar patterns
    // For now, return a small boost
    return 0.05;
  }

  /**
   * Adjust weight based on query intent
   */
  private adjustWeightForIntent(weight: number, factorName: string, query: ProcessedQuery): number {
    const intent = query.intent.type;
    let multiplier = 1.0;

    switch (intent) {
      case 'function_search':
        if (factorName === 'symbol_matching') multiplier = 1.3;
        break;
      case 'concept_search':
        if (factorName === 'semantic_similarity') multiplier = 1.4;
        break;
      case 'debug_search':
        if (factorName === 'intent_alignment') multiplier = 1.2;
        break;
    }

    return weight * multiplier;
  }

  /**
   * Find ranking data for a specific query and result
   */
  private findRankingData(_queryId: string, _resultId: string): { factors: RankingFactor[] } | null {
    // This would need to map queryId to actual ranking data
    // For now, return null
    return null;
  }

  /**
   * Get query key for storage
   */
  private getQueryKey(query: ProcessedQuery): string {
    return `${query.intent.type}_${query.normalized.substring(0, 50)}`;
  }

  /**
   * Get file extension
   */
  private getFileExtension(filePath: string): string {
    return filePath.substring(filePath.lastIndexOf('.'));
  }

  /**
   * Get directory from file path
   */
  private getDirectory(filePath: string): string {
    return filePath.substring(0, filePath.lastIndexOf('/'));
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    return filePath.substring(filePath.lastIndexOf('/') + 1);
  }

  /**
   * Initialize default feature weights
   */
  private initializeFeatureWeights(): void {
    this.featureWeights.set('semantic_similarity', 0.3);
    this.featureWeights.set('symbol_matching', 0.25);
    this.featureWeights.set('intent_alignment', 0.2);
    this.featureWeights.set('code_quality', 0.15);
    this.featureWeights.set('recency', 0.1);
  }

  /**
   * Get learning statistics
   */
  getStats() {
    return {
      totalQueries: Array.from(this.rankingHistory.values()).reduce((sum, arr) => sum + arr.length, 0),
      totalFeedback: Array.from(this.userFeedback.values()).reduce((sum, arr) => sum + arr.length, 0),
      totalClicks: Array.from(this.clickThroughData.values()).reduce((sum, arr) => sum + arr.length, 0),
      featureWeights: Object.fromEntries(this.featureWeights)
    };
  }
}

interface RankingData {
  query: string;
  intent: string;
  results: Array<{
    id: string;
    score: number;
    factors: RankingFactor[];
  }>;
  timestamp: number;
}

interface FeedbackData {
  resultId: string;
  feedbackType: 'click' | 'like' | 'dislike' | 'copy' | 'ignore';
  relevanceScore?: number;
  timestamp: number;
}

interface ClickData {
  resultId: string;
  position: number;
  dwellTime?: number;
  timestamp: number;
}

interface UserPreferences {
  preferredLanguages: Set<string>;
  preferredFileTypes: Set<string>;
  preferredDirectories: Set<string>;
  preferredComplexity: number;
}
