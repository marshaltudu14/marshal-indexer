/**
 * Term extractor for enhanced code-specific tokenization
 */
export class TermExtractor {

  /**
   * Extract terms from content for lexical search with enhanced code-specific tokenization
   */
  static extractTerms(content: string): Set<string> {
    const terms = new Set<string>();

    // 1. Extract camelCase and PascalCase identifiers
    const camelCaseMatches = content.match(/\b[a-z]+(?:[A-Z][a-z]*)*\b/g) || [];
    const pascalCaseMatches = content.match(/\b[A-Z][a-z]*(?:[A-Z][a-z]*)*\b/g) || [];

    for (const match of [...camelCaseMatches, ...pascalCaseMatches]) {
      terms.add(match.toLowerCase());
      // Also add individual words from camelCase/PascalCase
      const words = match.split(/(?=[A-Z])/).filter(w => w.length > 1);
      for (const word of words) {
        terms.add(word.toLowerCase());
      }
    }

    // 2. Extract snake_case identifiers
    const snakeCaseMatches = content.match(/\b[a-z]+(?:_[a-z]+)+\b/g) || [];
    for (const match of snakeCaseMatches) {
      terms.add(match.toLowerCase());
      // Also add individual words
      const words = match.split('_').filter(w => w.length > 1);
      for (const word of words) {
        terms.add(word.toLowerCase());
      }
    }

    // 3. Extract kebab-case identifiers
    const kebabCaseMatches = content.match(/\b[a-z]+(?:-[a-z]+)+\b/g) || [];
    for (const match of kebabCaseMatches) {
      terms.add(match.toLowerCase());
      // Also add individual words
      const words = match.split('-').filter(w => w.length > 1);
      for (const word of words) {
        terms.add(word.toLowerCase());
      }
    }

    // 4. Extract function names and method calls
    const functionMatches = content.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g) || [];
    for (const match of functionMatches) {
      const funcName = match.replace(/\s*\($/, '').toLowerCase();
      if (funcName.length > 2) {
        terms.add(funcName);
      }
    }

    // 5. Extract class names and types
    const classMatches = content.match(/\b(?:class|interface|type|enum)\s+([A-Z][a-zA-Z0-9_]*)/g) || [];
    for (const match of classMatches) {
      const className = match.split(/\s+/)[1];
      if (className) {
        terms.add(className.toLowerCase());
      }
    }

    // 6. Extract import/export names
    const importMatches = content.match(/\b(?:import|export)\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)/g) || [];
    for (const match of importMatches) {
      const names = match.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
      for (const name of names) {
        if (name !== 'import' && name !== 'export' && name !== 'as' && name !== 'from') {
          terms.add(name.toLowerCase());
        }
      }
    }

    // 7. Extract string literals (for API endpoints, routes, etc.)
    const stringMatches = content.match(/["'`]([^"'`\n]{3,50})["'`]/g) || [];
    for (const match of stringMatches) {
      const str = match.slice(1, -1).toLowerCase();
      // Extract words from strings
      const words = str.split(/[^\w]+/).filter(w => w.length > 2);
      for (const word of words) {
        terms.add(word);
      }
    }

    // 8. Extract regular words and identifiers (fallback)
    const regularTokens = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && token.length < 50);

    for (const token of regularTokens) {
      terms.add(token);
    }

    // 9. Add file path terms for better file-based searching
    const pathTerms = this.extractPathTerms(content);
    for (const term of pathTerms) {
      terms.add(term);
    }

    return terms;
  }

  /**
   * Extract terms from file paths and URLs
   */
  private static extractPathTerms(content: string): Set<string> {
    const terms = new Set<string>();

    // Extract file paths and URLs
    const pathMatches = content.match(/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.\/-]+/g) || [];
    for (const path of pathMatches) {
      const parts = path.split(/[\/\\.]/).filter(p => p.length > 1);
      for (const part of parts) {
        terms.add(part.toLowerCase());
      }
    }

    return terms;
  }
}
