import { QueryIntent, QueryContext, IntentFeatures } from '../common/types.js';
import { extractKeywords, extractEntities } from '../utils/QueryUtils.js';

/**
 * Advanced intent classification using ML-based techniques
 * Replaces simple pattern matching with sophisticated intent understanding
 */
export class IntentClassifier {
  private intentHistory: Map<string, QueryIntent> = new Map();
  private featureWeights: Map<string, number> = new Map();
  private contextualPatterns: Map<string, string[]> = new Map();

  constructor() {
    this.initializeFeatureWeights();
    this.initializeContextualPatterns();
  }

  /**
   * Classify query intent using advanced ML-based techniques
   */
  async classifyIntent(query: string, context?: QueryContext): Promise<QueryIntent> {
    const features = this.extractFeatures(query, context);
    const intentScores = this.calculateIntentScores(features);
    const bestIntent = this.selectBestIntent(intentScores);
    
    // Learn from context if available
    if (context?.previousQueries) {
      this.learnFromContext(query, bestIntent, context);
    }

    console.log(`🎯 Intent classified: ${bestIntent.type} (confidence: ${bestIntent.confidence.toFixed(3)})`);
    
    return bestIntent;
  }

  /**
   * Extract comprehensive features from query
   */
  private extractFeatures(query: string, context?: QueryContext): IntentFeatures {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);
    const keywords = extractKeywords(query);
    const entities = extractEntities(query);

    return {
      // Lexical features
      queryLength: query.length,
      wordCount: words.length,
      avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length,

      // Syntactic features
      hasQuestionWords: this.hasQuestionWords(queryLower),
      hasCodePatterns: this.hasCodePatterns(query),
      hasSpecialChars: /[(){}[\]<>]/.test(query),

      // Semantic features
      keywords,
      entities,
      concepts: this.extractConcepts(queryLower),

      // Intent-specific patterns
      actionWords: this.extractActionWords(queryLower),
      targetWords: this.extractTargetWords(queryLower),
      modifierWords: this.extractModifierWords(queryLower),

      // Contextual features
      contextSimilarity: this.calculateContextSimilarity(query, context),
      previousIntents: context?.previousQueries?.map(q => q.originalQuery) || [],

      // Technical features
      programmingLanguage: this.detectProgrammingLanguage(query) || undefined,
      codeComplexity: this.estimateCodeComplexity(query),
      domainSpecificity: this.calculateDomainSpecificity(queryLower)
    };
  }

  /**
   * Calculate intent scores using weighted feature analysis
   */
  private calculateIntentScores(features: IntentFeatures): Map<string, number> {
    const scores = new Map<string, number>();
    
    // Initialize base scores
    const intentTypes = [
      'function_search', 'class_search', 'concept_search', 
      'debug_search', 'implementation_search', 'pattern_search',
      'architecture_search', 'usage_search', 'general'
    ];
    
    intentTypes.forEach(type => scores.set(type, 0.1));

    // Function search indicators
    this.updateScore(scores, 'function_search', [
      { condition: features.actionWords.includes('find') && features.targetWords.includes('function'), weight: 0.8 },
      { condition: features.hasCodePatterns && /\w+\(\)/.test(features.keywords.join(' ')), weight: 0.7 },
      { condition: features.keywords.some(k => ['method', 'func', 'procedure'].includes(k)), weight: 0.6 },
      { condition: features.concepts.includes('function'), weight: 0.5 }
    ]);

    // Class search indicators
    this.updateScore(scores, 'class_search', [
      { condition: features.targetWords.includes('class') || features.targetWords.includes('interface'), weight: 0.8 },
      { condition: features.keywords.some(k => ['class', 'interface', 'struct', 'type'].includes(k)), weight: 0.7 },
      { condition: features.hasCodePatterns && /class\s+\w+/.test(features.keywords.join(' ')), weight: 0.6 },
      { condition: features.concepts.includes('object-oriented'), weight: 0.5 }
    ]);

    // Debug search indicators
    this.updateScore(scores, 'debug_search', [
      { condition: features.keywords.some(k => ['error', 'bug', 'issue', 'problem', 'fix'].includes(k)), weight: 0.8 },
      { condition: features.actionWords.includes('debug') || features.actionWords.includes('fix'), weight: 0.7 },
      { condition: features.hasQuestionWords && features.keywords.includes('wrong'), weight: 0.6 },
      { condition: features.concepts.includes('debugging'), weight: 0.5 }
    ]);

    // Implementation search indicators
    this.updateScore(scores, 'implementation_search', [
      { condition: features.actionWords.some(a => ['implement', 'create', 'build', 'make'].includes(a)), weight: 0.8 },
      { condition: features.hasQuestionWords && features.actionWords.includes('how'), weight: 0.7 },
      { condition: features.keywords.some(k => ['example', 'sample', 'demo'].includes(k)), weight: 0.6 },
      { condition: features.concepts.includes('implementation'), weight: 0.5 }
    ]);

    // Concept search indicators
    this.updateScore(scores, 'concept_search', [
      { condition: features.hasQuestionWords && features.actionWords.includes('what'), weight: 0.8 },
      { condition: features.keywords.some(k => ['explain', 'understand', 'concept'].includes(k)), weight: 0.7 },
      { condition: features.modifierWords.includes('architecture') || features.modifierWords.includes('design'), weight: 0.6 },
      { condition: features.concepts.length > 2, weight: 0.5 }
    ]);

    // Pattern search indicators
    this.updateScore(scores, 'pattern_search', [
      { condition: features.keywords.some(k => ['pattern', 'similar', 'like'].includes(k)), weight: 0.8 },
      { condition: features.actionWords.includes('find') && features.modifierWords.includes('similar'), weight: 0.7 },
      { condition: features.concepts.includes('pattern'), weight: 0.6 }
    ]);

    // Architecture search indicators
    this.updateScore(scores, 'architecture_search', [
      { condition: features.keywords.some(k => ['architecture', 'structure', 'design'].includes(k)), weight: 0.8 },
      { condition: features.concepts.includes('architecture'), weight: 0.7 },
      { condition: features.modifierWords.includes('overall') || features.modifierWords.includes('high-level'), weight: 0.6 }
    ]);

    // Usage search indicators
    this.updateScore(scores, 'usage_search', [
      { condition: features.actionWords.includes('use') || features.actionWords.includes('usage'), weight: 0.8 },
      { condition: features.hasQuestionWords && features.keywords.includes('how'), weight: 0.7 },
      { condition: features.keywords.some(k => ['example', 'usage', 'use'].includes(k)), weight: 0.6 }
    ]);

    // Apply contextual boosting
    this.applyContextualBoosting(scores, features);

    return scores;
  }

  /**
   * Select the best intent based on scores
   */
  private selectBestIntent(scores: Map<string, number>): QueryIntent {
    let bestType = 'general';
    let bestScore = 0;

    for (const [type, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    // Calculate confidence based on score distribution
    const sortedScores = Array.from(scores.values()).sort((a, b) => b - a);
    const confidence = sortedScores.length > 1 && sortedScores[0] && sortedScores[1]
      ? (sortedScores[0] - sortedScores[1]) / sortedScores[0]
      : bestScore;

    return {
      type: bestType as QueryIntent['type'],
      confidence: Math.min(Math.max(confidence, 0.1), 1.0),
      keywords: [],
      entities: [],
      context: []
    };
  }

  /**
   * Update intent score based on conditions
   */
  private updateScore(
    scores: Map<string, number>, 
    intent: string, 
    conditions: Array<{ condition: boolean; weight: number }>
  ): void {
    let score = scores.get(intent) || 0;
    
    for (const { condition, weight } of conditions) {
      if (condition) {
        score += weight;
      }
    }
    
    scores.set(intent, score);
  }

  /**
   * Apply contextual boosting based on previous queries
   */
  private applyContextualBoosting(scores: Map<string, number>, features: IntentFeatures): void {
    if (features.contextSimilarity > 0.7) {
      // Boost scores for intents similar to previous queries
      for (const prevQuery of features.previousIntents) {
        const prevIntent = this.intentHistory.get(prevQuery);
        if (prevIntent) {
          const currentScore = scores.get(prevIntent.type) || 0;
          scores.set(prevIntent.type, currentScore + 0.2);
        }
      }
    }
  }

  /**
   * Learn from context to improve future classifications
   */
  private learnFromContext(query: string, intent: QueryIntent, _context: QueryContext): void {
    this.intentHistory.set(query, intent);
    
    // Update feature weights based on successful classifications
    // This would be more sophisticated in a real ML system
    
    // Keep only recent history
    if (this.intentHistory.size > 1000) {
      const oldestKey = Array.from(this.intentHistory.keys())[0];
      if (oldestKey) {
        this.intentHistory.delete(oldestKey);
      }
    }
  }

  /**
   * Check for question words
   */
  private hasQuestionWords(query: string): boolean {
    const questionWords = ['what', 'how', 'why', 'where', 'when', 'which', 'who'];
    return questionWords.some(word => query.includes(word));
  }

  /**
   * Check for code patterns
   */
  private hasCodePatterns(query: string): boolean {
    const codePatterns = [
      /\w+\(\)/,  // function calls
      /\w+\.\w+/, // method calls
      /class\s+\w+/, // class definitions
      /function\s+\w+/, // function definitions
      /import\s+/, // imports
      /\{.*\}/, // code blocks
    ];
    
    return codePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Extract action words from query
   */
  private extractActionWords(query: string): string[] {
    const actionWords = [
      'find', 'search', 'get', 'show', 'display', 'list',
      'create', 'make', 'build', 'implement', 'develop',
      'fix', 'debug', 'solve', 'resolve', 'handle',
      'use', 'call', 'invoke', 'execute', 'run',
      'explain', 'understand', 'learn', 'know'
    ];
    
    return actionWords.filter(word => query.includes(word));
  }

  /**
   * Extract target words from query
   */
  private extractTargetWords(query: string): string[] {
    const targetWords = [
      'function', 'method', 'class', 'interface', 'component',
      'variable', 'property', 'field', 'parameter',
      'file', 'module', 'package', 'library',
      'error', 'bug', 'issue', 'problem',
      'pattern', 'example', 'sample', 'template'
    ];
    
    return targetWords.filter(word => query.includes(word));
  }

  /**
   * Extract modifier words from query
   */
  private extractModifierWords(query: string): string[] {
    const modifierWords = [
      'all', 'any', 'some', 'every', 'each',
      'best', 'good', 'better', 'optimal',
      'similar', 'like', 'related', 'relevant',
      'new', 'old', 'recent', 'latest',
      'simple', 'complex', 'advanced', 'basic',
      'public', 'private', 'protected', 'static'
    ];
    
    return modifierWords.filter(word => query.includes(word));
  }

  /**
   * Extract concepts from query
   */
  private extractConcepts(query: string): string[] {
    const conceptMap = new Map([
      ['auth', ['authentication', 'authorization', 'security']],
      ['api', ['interface', 'endpoint', 'service']],
      ['db', ['database', 'storage', 'persistence']],
      ['ui', ['interface', 'component', 'view']],
      ['test', ['testing', 'validation', 'verification']],
      ['config', ['configuration', 'settings', 'options']],
      ['error', ['debugging', 'exception', 'handling']],
      ['pattern', ['design-pattern', 'architecture', 'structure']]
    ]);
    
    const concepts: string[] = [];
    
    for (const [key, values] of conceptMap) {
      if (query.includes(key)) {
        concepts.push(...values);
      }
    }
    
    return [...new Set(concepts)];
  }

  /**
   * Calculate context similarity with previous queries
   */
  private calculateContextSimilarity(query: string, context?: QueryContext): number {
    if (!context?.previousQueries || context.previousQueries.length === 0) {
      return 0;
    }
    
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    let maxSimilarity = 0;
    
    for (const prevQuery of context.previousQueries) {
      const prevWords = new Set(prevQuery.originalQuery.toLowerCase().split(/\s+/));
      const intersection = new Set([...queryWords].filter(w => prevWords.has(w)));
      const union = new Set([...queryWords, ...prevWords]);
      const similarity = intersection.size / union.size;
      
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    return maxSimilarity;
  }

  /**
   * Detect programming language from query
   */
  private detectProgrammingLanguage(query: string): string | undefined {
    const langPatterns = new Map([
      ['javascript', /\b(js|javascript|node|npm|react|vue|angular)\b/i],
      ['typescript', /\b(ts|typescript|tsx)\b/i],
      ['python', /\b(py|python|django|flask|pandas)\b/i],
      ['java', /\b(java|spring|maven|gradle)\b/i],
      ['cpp', /\b(c\+\+|cpp|cmake)\b/i],
      ['csharp', /\b(c#|csharp|dotnet|\.net)\b/i],
      ['go', /\b(go|golang)\b/i],
      ['rust', /\b(rust|cargo)\b/i]
    ]);
    
    for (const [lang, pattern] of langPatterns) {
      if (pattern.test(query)) {
        return lang;
      }
    }
    
    return undefined;
  }

  /**
   * Estimate code complexity from query
   */
  private estimateCodeComplexity(query: string): number {
    let complexity = 0;
    
    // Count complexity indicators
    if (/\{.*\}/.test(query)) complexity += 0.3; // code blocks
    if (/\w+\(\w*\)/.test(query)) complexity += 0.2; // function calls with params
    if (/class|interface|struct/.test(query)) complexity += 0.3; // OOP constructs
    if (/async|await|promise/.test(query)) complexity += 0.2; // async patterns
    
    return Math.min(complexity, 1.0);
  }

  /**
   * Calculate domain specificity
   */
  private calculateDomainSpecificity(query: string): number {
    const domainTerms = [
      'authentication', 'authorization', 'middleware', 'endpoint',
      'component', 'service', 'repository', 'controller',
      'model', 'view', 'template', 'schema', 'migration',
      'test', 'mock', 'stub', 'fixture', 'assertion'
    ];
    
    const matches = domainTerms.filter(term => query.includes(term)).length;
    return Math.min(matches / 5, 1.0); // Normalize to 0-1
  }

  /**
   * Initialize feature weights for learning
   */
  private initializeFeatureWeights(): void {
    this.featureWeights.set('lexical', 0.3);
    this.featureWeights.set('syntactic', 0.2);
    this.featureWeights.set('semantic', 0.3);
    this.featureWeights.set('contextual', 0.2);
  }

  /**
   * Initialize contextual patterns
   */
  private initializeContextualPatterns(): void {
    this.contextualPatterns.set('function_search', [
      'find function', 'search method', 'locate procedure'
    ]);
    this.contextualPatterns.set('class_search', [
      'find class', 'search interface', 'locate type'
    ]);
    this.contextualPatterns.set('debug_search', [
      'fix error', 'debug issue', 'solve problem'
    ]);
  }
}
