import { HierarchicalChunk, CodeChunk, SearchResult } from '../common/types.js';

/**
 * Cosine similarity calculation
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] || 0;
    const bVal = b[i] || 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const norm = Math.sqrt(normA * normB);
  return norm === 0 ? 0 : dotProduct / norm;
}

/**
 * Convert HierarchicalChunk to CodeChunk for compatibility
 */
export function convertToCodeChunk(hChunk: HierarchicalChunk): CodeChunk {
  return {
    id: hChunk.id,
    filePath: hChunk.metadata.filePath,
    content: hChunk.content,
    startLine: hChunk.metadata.startLine,
    endLine: hChunk.metadata.endLine,
    chunkIndex: 0,
    fileHash: '',
    lastModified: 0,
    language: hChunk.metadata.language,
    symbols: hChunk.metadata.symbols
  };
}

/**
 * Merge and deduplicate search results from multiple models
 */
export function mergeAndDeduplicateResults(results: SearchResult[]): SearchResult[] {
  const merged = new Map<string, SearchResult>();
  
  for (const result of results) {
    const key = result.chunk.id;
    if (merged.has(key)) {
      // Combine scores from multiple models
      const existing = merged.get(key)!;
      existing.relevance = Math.max(existing.relevance, result.relevance);
      existing.score = Math.max(existing.score, result.score);
    } else {
      merged.set(key, result);
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Extract words with enhanced parsing
 */
export function extractWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-\.\/\\]+/)
    .filter(word => word.length > 0)
    .map(word => word.toLowerCase());
}

/**
 * Calculate edit distance for fuzzy matching
 */
export function calculateEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

  for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1,     // deletion
        matrix[j - 1]![i]! + 1,     // insertion
        matrix[j - 1]![i - 1]! + indicator // substitution
      );
    }
  }

  return matrix[str2.length]![str1.length]!;
}

/**
 * Extract keywords from query
 */
export function extractKeywords(query: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10); // Limit keywords
}