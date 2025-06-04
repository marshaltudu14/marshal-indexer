/**
 * Utility functions for query processing and analysis
 */

/**
 * Extract keywords from a query string
 */
export function extractKeywords(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'i', 'me', 'my', 'we', 'our', 'you',
    'your', 'they', 'them', 'their', 'this', 'these', 'those', 'can',
    'could', 'should', 'would', 'do', 'does', 'did', 'have', 'had'
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter(word => /^[a-zA-Z0-9_-]+$/.test(word)); // Only alphanumeric and common symbols
}

/**
 * Extract entities (identifiers, function names, etc.) from query
 */
export function extractEntities(query: string): string[] {
  const entities: string[] = [];
  
  // CamelCase/PascalCase entities
  const camelCaseMatches = query.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g);
  if (camelCaseMatches) entities.push(...camelCaseMatches);
  
  // snake_case entities
  const snakeCaseMatches = query.match(/\b[a-z]+(?:_[a-z]+)+\b/g);
  if (snakeCaseMatches) entities.push(...snakeCaseMatches);
  
  // kebab-case entities
  const kebabCaseMatches = query.match(/\b[a-z]+(?:-[a-z]+)+\b/g);
  if (kebabCaseMatches) entities.push(...kebabCaseMatches);
  
  // Function call patterns
  const functionMatches = query.match(/\b\w+\(\)/g);
  if (functionMatches) entities.push(...functionMatches.map(f => f.replace('()', '')));
  
  // Quoted strings (potential identifiers)
  const quotedMatches = query.match(/["'`]([^"'`]+)["'`]/g);
  if (quotedMatches) entities.push(...quotedMatches.map(q => q.slice(1, -1)));
  
  return [...new Set(entities)];
}

/**
 * Normalize query for consistent processing
 */
export function normalizeQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s(){}[\]<>.,;:!?'"@#$%^&*+=|\\/-]/g, '') // Remove special chars except common ones
    .toLowerCase();
}

/**
 * Extract words from a string (splitting on various delimiters)
 */
export function extractWords(text: string): string[] {
  return text
    .split(/[\s\-_.,;:!?(){}[\]<>'"@#$%^&*+=|\\\/]+/)
    .filter(word => word.length > 0)
    .map(word => word.toLowerCase());
}

/**
 * Calculate edit distance between two strings (Levenshtein distance)
 */
export function calculateEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

  for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1,
        matrix[j - 1]![i]! + 1,
        matrix[j - 1]![i - 1]! + indicator
      );
    }
  }

  return matrix[str2.length]![str1.length]!;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i]! * vecB[i]!;
    normA += vecA[i]! * vecA[i]!;
    normB += vecB[i]! * vecB[i]!;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Fuzzy string matching using multiple algorithms
 */
export function fuzzyMatch(query: string, target: string, threshold: number = 0.7): boolean {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact match
  if (queryLower === targetLower) return true;

  // Substring match
  if (targetLower.includes(queryLower) || queryLower.includes(targetLower)) return true;

  // Edit distance match
  const editDistance = calculateEditDistance(queryLower, targetLower);
  const maxLength = Math.max(queryLower.length, targetLower.length);
  const editSimilarity = 1 - (editDistance / maxLength);
  if (editSimilarity >= threshold) return true;

  // Word-level Jaccard similarity
  const queryWords = new Set(extractWords(queryLower));
  const targetWords = new Set(extractWords(targetLower));
  const jaccardSim = jaccardSimilarity(queryWords, targetWords);
  if (jaccardSim >= threshold) return true;

  return false;
}

/**
 * Extract programming language indicators from text
 */
export function detectLanguageIndicators(text: string): string[] {
  const indicators: string[] = [];
  const textLower = text.toLowerCase();

  const languagePatterns = {
    javascript: /\b(function|const|let|var|=>|require|module\.exports)\b/g,
    typescript: /\b(interface|type|enum|namespace|implements|extends)\b/g,
    python: /\b(def|class|import|from|lambda|self|__init__)\b/g,
    java: /\b(public|private|protected|class|interface|static|void)\b/g,
    cpp: /\b(#include|namespace|template|class|struct|std::)\b/g,
    csharp: /\b(using|namespace|class|interface|public|private|static)\b/g,
    go: /\b(func|package|import|type|struct|interface)\b/g,
    rust: /\b(fn|struct|impl|trait|use|mod|pub)\b/g,
    php: /\b(<\?php|function|class|namespace|use|public|private)\b/g,
    ruby: /\b(def|class|module|require|include|attr_accessor)\b/g
  };

  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(textLower)) {
      indicators.push(lang);
    }
  }

  return indicators;
}

/**
 * Extract code patterns from text
 */
export function extractCodePatterns(text: string): string[] {
  const patterns: string[] = [];

  const patternRegexes = {
    'function-call': /\w+\([^)]*\)/g,
    'method-chain': /\w+\.\w+(?:\.\w+)*/g,
    'class-definition': /class\s+\w+/gi,
    'function-definition': /(?:function|def|func)\s+\w+/gi,
    'import-statement': /(?:import|require|include|using)\s+/gi,
    'variable-declaration': /(?:var|let|const|final)\s+\w+/gi,
    'arrow-function': /\w+\s*=>\s*/g,
    'template-literal': /`[^`]*`/g,
    'regex-pattern': /\/[^\/\n]+\/[gimuy]*/g,
    'comment': /(?:\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g
  };

  for (const [patternName, regex] of Object.entries(patternRegexes)) {
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      patterns.push(patternName);
    }
  }

  return patterns;
}

/**
 * Calculate text complexity score
 */
export function calculateTextComplexity(text: string): number {
  let complexity = 0;

  // Length factor
  complexity += Math.min(text.length / 1000, 0.3);

  // Nesting level (braces, brackets, parentheses)
  const nestingChars = text.match(/[(){}[\]]/g);
  if (nestingChars) {
    complexity += Math.min(nestingChars.length / 20, 0.2);
  }

  // Special characters
  const specialChars = text.match(/[!@#$%^&*+=|\\:;"'<>?]/g);
  if (specialChars) {
    complexity += Math.min(specialChars.length / 50, 0.2);
  }

  // Code patterns
  const patterns = extractCodePatterns(text);
  complexity += Math.min(patterns.length / 10, 0.3);

  return Math.min(complexity, 1.0);
}

/**
 * Generate n-grams from text
 */
export function generateNGrams(text: string, n: number): string[] {
  const words = extractWords(text);
  const ngrams: string[] = [];

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }

  return ngrams;
}

/**
 * Calculate semantic similarity between two texts using simple heuristics
 */
export function calculateSemanticSimilarity(text1: string, text2: string): number {
  const words1 = new Set(extractWords(text1));
  const words2 = new Set(extractWords(text2));
  
  const jaccard = jaccardSimilarity(words1, words2);
  
  // Boost similarity for exact phrase matches
  const phrases1 = generateNGrams(text1, 2);
  const phrases2 = generateNGrams(text2, 2);
  const phraseSet1 = new Set(phrases1);
  const phraseSet2 = new Set(phrases2);
  const phraseJaccard = jaccardSimilarity(phraseSet1, phraseSet2);
  
  return (jaccard * 0.7) + (phraseJaccard * 0.3);
}
