import { CodeChunk } from '../../common/types.js';
import { CodeStructureInfo } from '../ContextualAnalyzerNew.js';

/**
 * Metadata enhancer for adding semantic context and quality metrics to chunks
 */
export class MetadataEnhancer {

  /**
   * Enhance chunk metadata with semantic context and quality metrics
   */
  enhanceChunkMetadata(chunk: CodeChunk, structure: CodeStructureInfo): void {
    if (!chunk.metadata) chunk.metadata = {};

    // Add enhanced metadata from structure analysis
    chunk.metadata.semanticKeywords = structure.keywords;
    chunk.metadata.codePatterns = this.extractCodePatterns(chunk.content);
    chunk.metadata.frameworkSpecific = this.detectFrameworkSpecific(chunk.content);
    chunk.metadata.symbolDensity = this.calculateSymbolDensity(chunk);
    chunk.metadata.codeQuality = this.assessCodeQuality(chunk.content);
    chunk.metadata.fileImportance = structure.importance;
    chunk.metadata.codeComplexityScore = structure.complexity;
    chunk.metadata.documentationRatio = this.calculateDocumentationRatio(chunk.content);
  }

  /**
   * Extract code patterns from content
   */
  private extractCodePatterns(content: string): string[] {
    const patterns: string[] = [];
    const contentLower = content.toLowerCase();

    // React patterns
    if (contentLower.includes('use') && (contentLower.includes('state') || 
        contentLower.includes('effect') || contentLower.includes('context'))) {
      patterns.push('react-hooks');
    }

    // Component pattern
    if (contentLower.includes('component') || 
        (content.includes('function') && content.includes('return') && content.includes('<'))) {
      patterns.push('component');
    }

    // API pattern
    if (contentLower.includes('fetch') || contentLower.includes('axios') || 
        contentLower.includes('api') || contentLower.includes('endpoint')) {
      patterns.push('api');
    }

    // Database pattern
    if (contentLower.includes('query') || contentLower.includes('database') || 
        contentLower.includes('sql') || contentLower.includes('supabase')) {
      patterns.push('database');
    }

    // Form pattern
    if (contentLower.includes('form') || contentLower.includes('input') || 
        contentLower.includes('submit') || contentLower.includes('validation')) {
      patterns.push('form');
    }

    // Authentication pattern
    if (contentLower.includes('auth') || contentLower.includes('login') || 
        contentLower.includes('signup') || contentLower.includes('session')) {
      patterns.push('authentication');
    }

    // Error handling pattern
    if (contentLower.includes('try') && contentLower.includes('catch')) {
      patterns.push('error-handling');
    }

    // Async pattern
    if (contentLower.includes('async') || contentLower.includes('await') || 
        contentLower.includes('promise')) {
      patterns.push('async');
    }

    return patterns;
  }

  /**
   * Detect framework-specific code
   */
  private detectFrameworkSpecific(content: string): string[] {
    const frameworks: string[] = [];
    const contentLower = content.toLowerCase();

    // React
    if (contentLower.includes('react') || contentLower.includes('jsx') || 
        contentLower.includes('usestate') || contentLower.includes('useeffect')) {
      frameworks.push('react');
    }

    // Next.js
    if (contentLower.includes('next') || contentLower.includes('getserversideprops') || 
        contentLower.includes('getstaticprops')) {
      frameworks.push('nextjs');
    }

    // Supabase
    if (contentLower.includes('supabase') || contentLower.includes('createclient')) {
      frameworks.push('supabase');
    }

    // TypeScript
    if (contentLower.includes('interface') || contentLower.includes('type ') || 
        content.includes(': string') || content.includes(': number')) {
      frameworks.push('typescript');
    }

    // Tailwind CSS
    if (contentLower.includes('tailwind') || content.includes('className=') ||
        content.includes('bg-') || content.includes('text-') || content.includes('p-')) {
      frameworks.push('tailwindcss');
    }

    // Zod
    if (contentLower.includes('zod') || contentLower.includes('z.')) {
      frameworks.push('zod');
    }

    return frameworks;
  }

  /**
   * Calculate symbol density in the chunk
   */
  private calculateSymbolDensity(chunk: CodeChunk): number {
    const content = chunk.content;
    let symbolCount = 0;
    const totalLines = content.split('\n').length;

    // Count function definitions
    symbolCount += (content.match(/function\s+\w+/g) || []).length;
    symbolCount += (content.match(/const\s+\w+\s*=/g) || []).length;
    symbolCount += (content.match(/class\s+\w+/g) || []).length;
    symbolCount += (content.match(/interface\s+\w+/g) || []).length;
    symbolCount += (content.match(/type\s+\w+/g) || []).length;

    // Count imports/exports
    symbolCount += (content.match(/import\s+/g) || []).length;
    symbolCount += (content.match(/export\s+/g) || []).length;

    return totalLines > 0 ? symbolCount / totalLines : 0;
  }

  /**
   * Assess code quality
   */
  private assessCodeQuality(content: string): number {
    let quality = 0.5; // Base quality

    // Documentation presence
    const hasComments = content.includes('//') || content.includes('/*');
    if (hasComments) quality += 0.2;

    // Type annotations
    const hasTypes = content.includes(': string') || content.includes(': number') || 
                    content.includes('interface') || content.includes('type ');
    if (hasTypes) quality += 0.15;

    // Export statements
    if (content.includes('export default')) quality += 0.15;
    else if (content.includes('export')) quality += 0.1;

    // Error handling
    if (content.includes('try') && content.includes('catch')) {
      quality += 0.1;
    }

    // Reasonable length
    const lines = content.split('\n').length;
    if (lines >= 5 && lines <= 100) {
      quality += 0.1;
    } else if (lines > 200) {
      quality -= 0.1;
    }

    // Avoid very short chunks
    if (content.trim().length < 50) {
      quality -= 0.2;
    }

    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Calculate documentation ratio
   */
  private calculateDocumentationRatio(content: string): number {
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
}
