import { FileType } from '../types/AnalyzerTypes.js';

/**
 * Code complexity and importance calculators
 */
export class ComplexityCalculators {

  /**
   * Calculate code complexity score
   */
  static calculateComplexity(content: string): number {
    let complexity = 0;
    
    // Count control structures
    complexity += (content.match(/\b(if|else|for|while|switch|case)\b/g) || []).length;
    
    // Count functions
    complexity += (content.match(/\bfunction\b/g) || []).length;
    complexity += (content.match(/=>\s*[{(]/g) || []).length;
    
    // Count classes and interfaces
    complexity += (content.match(/\b(class|interface)\b/g) || []).length;
    
    // Count try-catch blocks
    complexity += (content.match(/\b(try|catch|finally)\b/g) || []).length;
    
    // Count async/await patterns
    complexity += (content.match(/\b(async|await)\b/g) || []).length;
    
    return complexity;
  }

  /**
   * Calculate importance score based on various factors
   */
  static calculateImportance(content: string, filePath: string): number {
    let importance = 1;
    
    // File type importance
    const fileType = this.determineFileType(filePath);
    const typeImportance: Record<FileType, number> = {
      'api': 3,
      'component': 2.5,
      'page': 2.5,
      'utility': 2,
      'types': 1.5,
      'hook': 2,
      'action': 2.5,
      'middleware': 2.5,
      'schema': 2.5,
      'config': 2,
      'test': 1,
      'other': 1
    };
    importance *= typeImportance[fileType] || 1;
    
    // Export importance
    if (content.includes('export default')) importance *= 1.5;
    if (content.includes('export')) importance *= 1.2;
    
    // Size importance (moderate size is often more important)
    const lines = content.split('\n').length;
    if (lines > 50 && lines < 500) importance *= 1.3;
    
    // Framework importance
    if (content.includes('React') || content.includes('jsx')) importance *= 1.2;
    if (content.includes('Next') || content.includes('getServerSideProps')) importance *= 1.2;
    if (content.includes('Supabase') || content.includes('createClient')) importance *= 1.1;
    
    // API importance
    if (content.includes('fetch') || content.includes('axios') || content.includes('api')) importance *= 1.3;
    
    // Database importance
    if (content.includes('database') || content.includes('sql') || content.includes('query')) importance *= 1.2;
    
    // Authentication importance
    if (content.includes('auth') || content.includes('login') || content.includes('signup')) importance *= 1.3;
    
    // Configuration importance
    if (content.includes('config') || content.includes('env') || content.includes('settings')) importance *= 1.1;
    
    // Documentation penalty for very low documentation
    const docRatio = this.calculateDocumentationRatio(content);
    if (docRatio < 0.1) importance *= 0.9;
    
    return Math.max(0.1, Math.min(5.0, importance));
  }

  /**
   * Calculate cyclomatic complexity
   */
  static calculateCyclomaticComplexity(content: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const decisionPoints = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bdo\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*[^:]*:/g, // Ternary operators
      /\|\|/g, // Logical OR
      /&&/g   // Logical AND
    ];

    for (const pattern of decisionPoints) {
      const matches = content.match(pattern) || [];
      complexity += matches.length;
    }

    return complexity;
  }

  /**
   * Calculate maintainability index (0-100 scale)
   */
  static calculateMaintainabilityIndex(content: string): number {
    const lines = content.split('\n').length;
    const complexity = this.calculateCyclomaticComplexity(content);
    const commentRatio = this.calculateCommentRatio(content);
    
    // Simplified maintainability index calculation
    let maintainability = 100;
    
    // Penalize high complexity
    maintainability -= Math.min(complexity * 2, 40);
    
    // Penalize very long files
    if (lines > 500) {
      maintainability -= Math.min((lines - 500) / 10, 30);
    }
    
    // Reward good commenting
    maintainability += commentRatio * 20;
    
    // Penalize deep nesting
    const maxNesting = this.calculateMaxNesting(content);
    if (maxNesting > 4) {
      maintainability -= (maxNesting - 4) * 5;
    }
    
    // Reward type safety
    if (content.includes('interface') || content.includes('type ') || content.includes(': string') || content.includes(': number')) {
      maintainability += 5;
    }
    
    return Math.max(0, Math.min(100, maintainability));
  }

  /**
   * Calculate documentation ratio
   */
  static calculateDocumentationRatio(content: string): number {
    const lines = content.split('\n');
    let commentLines = 0;
    let codeLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || 
          trimmed.startsWith('*') || trimmed.startsWith('*/') ||
          trimmed.startsWith('/**')) {
        commentLines++;
      } else {
        codeLines++;
      }
    }

    return codeLines > 0 ? commentLines / codeLines : 0;
  }

  /**
   * Calculate comment ratio
   */
  private static calculateCommentRatio(content: string): number {
    const lines = content.split('\n');
    let commentLines = 0;
    let codeLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || 
          trimmed.startsWith('*') || trimmed.startsWith('*/')) {
        commentLines++;
      } else {
        codeLines++;
      }
    }

    return codeLines > 0 ? commentLines / codeLines : 0;
  }

  /**
   * Calculate maximum nesting level
   */
  private static calculateMaxNesting(content: string): number {
    let maxNesting = 0;
    let currentNesting = 0;

    for (let i = 0; i < content.length; i++) {
      if (content[i] === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (content[i] === '}') {
        currentNesting--;
      }
    }

    return maxNesting;
  }

  /**
   * Determine file type from path
   */
  private static determineFileType(filePath: string): FileType {
    const path = filePath.toLowerCase();
    
    if (path.includes('/api/') || path.includes('\\api\\')) return 'api';
    if (path.includes('/components/') || path.includes('\\components\\')) return 'component';
    if (path.includes('/pages/') || path.includes('/app/') || path.includes('\\pages\\') || path.includes('\\app\\')) return 'page';
    if (path.includes('/lib/') || path.includes('/utils/') || path.includes('\\lib\\') || path.includes('\\utils\\')) return 'utility';
    if (path.includes('/types/') || path.includes('\\types\\') || path.endsWith('.d.ts')) return 'types';
    if (path.includes('/hooks/') || path.includes('\\hooks\\')) return 'hook';
    if (path.includes('/actions/') || path.includes('\\actions\\')) return 'action';
    if (path.includes('/middleware/') || path.includes('\\middleware\\')) return 'middleware';
    if (path.includes('schema') || path.includes('model')) return 'schema';
    if (path.includes('config') || path.includes('settings')) return 'config';
    if (path.includes('test') || path.includes('spec')) return 'test';
    
    return 'other';
  }
}
