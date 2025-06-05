import { CodeChunk } from '../common/types.js';

/**
 * Enhanced ranking system that combines TF-IDF with code-specific signals
 * for better search result relevance
 */
export class EnhancedRanking {
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;
  private termFrequencyCache: Map<string, Map<string, number>> = new Map();

  /**
   * Initialize the ranking system with the corpus
   */
  initialize(chunks: CodeChunk[]): void {
    this.totalDocuments = chunks.length;
    this.documentFrequency.clear();
    this.termFrequencyCache.clear();

    // Calculate document frequency for each term
    const termDocumentCount = new Map<string, Set<string>>();

    for (const chunk of chunks) {
      const chunkId = `${chunk.filePath}:${chunk.startLine}:${chunk.endLine}`;
      const terms = this.extractTerms(chunk.content);
      const termFreq = new Map<string, number>();

      // Calculate term frequency for this document
      for (const term of terms) {
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
        
        // Track which documents contain this term
        if (!termDocumentCount.has(term)) {
          termDocumentCount.set(term, new Set());
        }
        termDocumentCount.get(term)!.add(chunkId);
      }

      this.termFrequencyCache.set(chunkId, termFreq);
    }

    // Calculate document frequency
    for (const [term, documents] of termDocumentCount) {
      this.documentFrequency.set(term, documents.size);
    }
  }

  /**
   * Calculate enhanced relevance score combining TF-IDF with code-specific signals
   */
  calculateRelevanceScore(
    query: string,
    chunk: CodeChunk,
    baseScore: number = 1.0
  ): number {
    const chunkId = `${chunk.filePath}:${chunk.startLine}:${chunk.endLine}`;
    const queryTerms = this.extractTerms(query);
    
    // Calculate TF-IDF score
    let tfidfScore = 0;
    const termFreq = this.termFrequencyCache.get(chunkId) || new Map();
    const totalTermsInDoc = Array.from(termFreq.values()).reduce((sum, freq) => sum + freq, 0);

    for (const term of queryTerms) {
      const tf = (termFreq.get(term) || 0) / totalTermsInDoc;
      const df = this.documentFrequency.get(term) || 0;
      const idf = df > 0 ? Math.log(this.totalDocuments / df) : 0;
      tfidfScore += tf * idf;
    }

    // Normalize TF-IDF score
    tfidfScore = tfidfScore / Math.sqrt(queryTerms.length);

    // Calculate code-specific signals
    const codeSignals = this.calculateCodeSpecificSignals(query, chunk);
    
    // Calculate file importance
    const fileImportance = this.calculateFileImportance(chunk.filePath);
    
    // Calculate content quality score
    const qualityScore = this.calculateContentQuality(chunk);

    // Combine all signals with weights
    const combinedScore = 
      baseScore * 0.3 +           // Base lexical match
      tfidfScore * 0.25 +         // TF-IDF relevance
      codeSignals * 0.25 +        // Code-specific signals
      fileImportance * 0.1 +      // File importance
      qualityScore * 0.1;         // Content quality

    return Math.max(0, combinedScore);
  }

  /**
   * Calculate code-specific ranking signals
   */
  private calculateCodeSpecificSignals(query: string, chunk: CodeChunk): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    // Symbol name matches (high weight)
    if (chunk.symbols) {
      for (const symbol of chunk.symbols) {
        if (symbol && queryLower.includes(symbol.toLowerCase())) {
          score += 2.0;
        }
      }
    }

    // Function name matches
    if (chunk.functions) {
      for (const func of chunk.functions) {
        if (func.name && queryLower.includes(func.name.toLowerCase())) {
          score += 1.8;
          // Bonus for exported functions
          if (func.isExported) score += 0.3;
          // Bonus for async functions if query mentions async
          if (func.isAsync && queryLower.includes('async')) score += 0.2;
        }
      }
    }

    // Class name matches
    if (chunk.classes) {
      for (const cls of chunk.classes) {
        if (cls.name && queryLower.includes(cls.name.toLowerCase())) {
          score += 1.8;
          // Bonus for exported classes
          if (cls.isExported) score += 0.3;
        }
      }
    }

    // Interface/Type matches
    if (chunk.interfaces) {
      for (const iface of chunk.interfaces) {
        if (iface.name && queryLower.includes(iface.name.toLowerCase())) {
          score += 1.5;
          if (iface.isExported) score += 0.2;
        }
      }
    }

    if (chunk.types) {
      for (const type of chunk.types) {
        if (type.name && queryLower.includes(type.name.toLowerCase())) {
          score += 1.5;
          if (type.isExported) score += 0.2;
        }
      }
    }

    // Import/Export relevance
    if (chunk.imports) {
      for (const imp of chunk.imports) {
        if (typeof imp === 'string') {
          if (queryLower.includes(imp.toLowerCase())) {
            score += 0.8;
          }
        } else if (imp && typeof imp === 'object') {
          // Handle object-style imports if they exist
          const impObj = imp as any;
          if (impObj.source && queryLower.includes(impObj.source.toLowerCase())) {
            score += 0.8;
          }
          if (impObj.items && Array.isArray(impObj.items)) {
            for (const item of impObj.items) {
              if (queryLower.includes(item.toLowerCase())) {
                score += 1.0;
              }
            }
          }
        }
      }
    }

    // Framework-specific boosts
    const frameworkBoosts: Record<string, number> = {
      'react': 0.5,
      'nextjs': 0.5,
      'supabase': 0.4,
      'typescript': 0.3,
      'tailwind': 0.3
    };

    for (const [framework, boost] of Object.entries(frameworkBoosts)) {
      if (queryLower.includes(framework) && contentLower.includes(framework)) {
        score += boost;
      }
    }

    // Code pattern matches
    const patterns = [
      'component', 'hook', 'api', 'route', 'middleware', 'schema',
      'validation', 'auth', 'database', 'form', 'button', 'input'
    ];

    for (const pattern of patterns) {
      if (queryLower.includes(pattern) && contentLower.includes(pattern)) {
        score += 0.3;
      }
    }

    // Comment/documentation matches (lower weight but still valuable)
    const commentMatches = this.countCommentMatches(query, chunk.content);
    score += commentMatches * 0.2;

    // Exact phrase matches in code (high weight)
    if (contentLower.includes(queryLower)) {
      score += 1.5;
    }

    // Camel case matches (e.g., "user profile" matches "userProfile")
    const camelCaseQuery = this.toCamelCase(query);
    if (camelCaseQuery && contentLower.includes(camelCaseQuery.toLowerCase())) {
      score += 1.2;
    }

    return Math.min(score, 10); // Cap the score to prevent extreme values
  }

  /**
   * Calculate file importance based on path and characteristics
   */
  private calculateFileImportance(filePath: string): number {
    let importance = 1.0;
    const pathLower = filePath.toLowerCase();

    // File type importance
    if (pathLower.includes('/api/') || pathLower.includes('\\api\\')) importance *= 1.4;
    if (pathLower.includes('/components/') || pathLower.includes('\\components\\')) importance *= 1.3;
    if (pathLower.includes('/pages/') || pathLower.includes('\\pages\\')) importance *= 1.3;
    if (pathLower.includes('/lib/') || pathLower.includes('\\lib\\')) importance *= 1.2;
    if (pathLower.includes('/utils/') || pathLower.includes('\\utils\\')) importance *= 1.1;
    if (pathLower.includes('/hooks/') || pathLower.includes('\\hooks\\')) importance *= 1.2;

    // Important files
    if (pathLower.includes('index.') || pathLower.includes('main.') || pathLower.includes('app.')) {
      importance *= 1.3;
    }

    // Configuration files
    if (pathLower.includes('config') || pathLower.includes('setting')) {
      importance *= 1.1;
    }

    // Penalize certain file types
    if (pathLower.includes('test') || pathLower.includes('spec')) importance *= 0.6;
    if (pathLower.includes('.d.ts') || pathLower.includes('generated')) importance *= 0.4;
    if (pathLower.includes('node_modules')) importance *= 0.1;

    // File depth penalty (deeper files are generally less important)
    const depth = (filePath.match(/[/\\]/g) || []).length;
    if (depth > 5) {
      importance *= Math.max(0.5, 1 - (depth - 5) * 0.1);
    }

    return Math.max(0.1, Math.min(2.0, importance));
  }

  /**
   * Calculate content quality score
   */
  private calculateContentQuality(chunk: CodeChunk): number {
    let quality = 0.5; // Base quality

    // Documentation presence
    const hasComments = chunk.content.includes('//') || chunk.content.includes('/*');
    if (hasComments) quality += 0.2;

    // Type annotations (TypeScript)
    const hasTypes = chunk.content.includes(': string') || 
                    chunk.content.includes(': number') || 
                    chunk.content.includes('interface') ||
                    chunk.content.includes('type ');
    if (hasTypes) quality += 0.15;

    // Export statements (indicates reusable code)
    if (chunk.content.includes('export default')) quality += 0.15;
    else if (chunk.content.includes('export')) quality += 0.1;

    // Error handling
    if (chunk.content.includes('try') && chunk.content.includes('catch')) {
      quality += 0.1;
    }

    // Reasonable length (not too short, not too long)
    const lines = chunk.content.split('\n').length;
    if (lines >= 5 && lines <= 100) {
      quality += 0.1;
    } else if (lines > 200) {
      quality -= 0.1;
    }

    // Use metadata if available
    if (chunk.metadata?.codeQuality) {
      quality = (quality + chunk.metadata.codeQuality) / 2;
    }

    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Extract terms from text for TF-IDF calculation
   */
  private extractTerms(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2)
      .filter(term => !this.isStopWord(term));
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);
    return stopWords.has(word);
  }

  /**
   * Count matches in comments
   */
  private countCommentMatches(query: string, content: string): number {
    const queryLower = query.toLowerCase();
    let matches = 0;

    // Single line comments
    const singleLineComments = content.match(/\/\/.*$/gm) || [];
    for (const comment of singleLineComments) {
      if (comment.toLowerCase().includes(queryLower)) {
        matches++;
      }
    }

    // Multi-line comments
    const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
    for (const comment of multiLineComments) {
      if (comment.toLowerCase().includes(queryLower)) {
        matches++;
      }
    }

    return matches;
  }

  /**
   * Convert space-separated words to camelCase
   */
  private toCamelCase(str: string): string {
    return str
      .split(' ')
      .map((word, index) => 
        index === 0 
          ? word.toLowerCase() 
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  /**
   * Clear caches to free memory
   */
  clearCaches(): void {
    this.termFrequencyCache.clear();
    this.documentFrequency.clear();
  }
}
