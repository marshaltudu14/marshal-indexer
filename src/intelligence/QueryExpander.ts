import { QueryIntent, CodebaseMetadata } from '../common/types.js';

/**
 * Advanced query expansion with contextual understanding
 * Generates semantically related query variations for better recall
 */
export class QueryExpander {
  private synonymMap: Map<string, string[]> = new Map();
  private conceptGraph: Map<string, string[]> = new Map();
  private expansionHistory: Map<string, string[]> = new Map();

  constructor() {
    this.initializeSynonymMap();
    this.initializeConceptGraph();
  }

  /**
   * Expand query with contextual variations and semantic alternatives
   */
  async expandQuery(
    query: string,
    intent: QueryIntent,
    codebaseMetadata?: CodebaseMetadata
  ): Promise<string[]> {
    const expansions = new Set<string>([query]); // Always include original

    // 1. Synonym-based expansion
    const synonymExpansions = this.generateSynonymExpansions(query);
    synonymExpansions.forEach(exp => expansions.add(exp));

    // 2. Intent-specific expansion
    const intentExpansions = this.generateIntentSpecificExpansions(query, intent);
    intentExpansions.forEach(exp => expansions.add(exp));

    // 3. Concept-based expansion
    const conceptExpansions = await this.generateConceptExpansions(query, intent);
    conceptExpansions.forEach(exp => expansions.add(exp));

    // 4. Codebase-specific expansion
    if (codebaseMetadata) {
      const codebaseExpansions = this.generateCodebaseSpecificExpansions(query, codebaseMetadata);
      codebaseExpansions.forEach(exp => expansions.add(exp));
    }

    // 5. Linguistic variations
    const linguisticExpansions = this.generateLinguisticVariations(query);
    linguisticExpansions.forEach(exp => expansions.add(exp));

    // 6. Technical variations
    const technicalExpansions = this.generateTechnicalVariations(query, intent);
    technicalExpansions.forEach(exp => expansions.add(exp));

    // Store for learning
    const finalExpansions = Array.from(expansions).slice(0, 15); // Limit to 15 variations
    this.storeExpansionHistory(query, finalExpansions);

    console.log(`🔄 Expanded "${query}" to ${finalExpansions.length} variations`);
    
    return finalExpansions;
  }

  /**
   * Generate synonym-based expansions
   */
  private generateSynonymExpansions(query: string): string[] {
    const expansions: string[] = [];
    const words = query.toLowerCase().split(/\s+/);

    for (const word of words) {
      const synonyms = this.synonymMap.get(word);
      if (synonyms) {
        for (const synonym of synonyms) {
          const expandedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
          if (expandedQuery !== query) {
            expansions.push(expandedQuery);
          }
        }
      }
    }

    return expansions;
  }

  /**
   * Generate intent-specific expansions
   */
  private generateIntentSpecificExpansions(query: string, intent: QueryIntent): string[] {
    const expansions: string[] = [];

    switch (intent.type) {
      case 'function_search':
        expansions.push(
          `${query} function`,
          `${query} method`,
          `${query} procedure`,
          `${query} implementation`,
          `function ${query}`,
          `method ${query}`
        );
        break;

      case 'class_search':
        expansions.push(
          `${query} class`,
          `${query} interface`,
          `${query} type`,
          `${query} object`,
          `class ${query}`,
          `interface ${query}`
        );
        break;

      case 'debug_search':
        expansions.push(
          `${query} error`,
          `${query} exception`,
          `${query} bug`,
          `${query} issue`,
          `${query} problem`,
          `fix ${query}`,
          `debug ${query}`,
          `solve ${query}`
        );
        break;

      case 'implementation_search':
        expansions.push(
          `how to ${query}`,
          `${query} example`,
          `${query} sample`,
          `${query} implementation`,
          `${query} tutorial`,
          `implement ${query}`,
          `create ${query}`
        );
        break;

      case 'concept_search':
        expansions.push(
          `what is ${query}`,
          `${query} concept`,
          `${query} explanation`,
          `${query} overview`,
          `understand ${query}`,
          `explain ${query}`
        );
        break;

      case 'pattern_search':
        expansions.push(
          `${query} pattern`,
          `${query} similar`,
          `${query} like`,
          `pattern ${query}`,
          `similar to ${query}`,
          `examples like ${query}`
        );
        break;

      case 'architecture_search':
        expansions.push(
          `${query} architecture`,
          `${query} structure`,
          `${query} design`,
          `${query} organization`,
          `architecture ${query}`,
          `design ${query}`
        );
        break;

      case 'usage_search':
        expansions.push(
          `how to use ${query}`,
          `${query} usage`,
          `${query} example`,
          `using ${query}`,
          `${query} tutorial`,
          `${query} guide`
        );
        break;
    }

    return expansions.filter(exp => exp !== query);
  }

  /**
   * Generate concept-based expansions using concept graph
   */
  private async generateConceptExpansions(query: string, _intent: QueryIntent): Promise<string[]> {
    const expansions: string[] = [];
    const queryLower = query.toLowerCase();

    // Find related concepts
    for (const [concept, related] of this.conceptGraph) {
      if (queryLower.includes(concept)) {
        for (const relatedConcept of related) {
          const expandedQuery = query.replace(
            new RegExp(`\\b${concept}\\b`, 'gi'), 
            relatedConcept
          );
          if (expandedQuery !== query) {
            expansions.push(expandedQuery);
          }
        }
      }
    }

    return expansions;
  }

  /**
   * Generate codebase-specific expansions
   */
  private generateCodebaseSpecificExpansions(
    query: string, 
    metadata: CodebaseMetadata
  ): string[] {
    const expansions: string[] = [];

    // Use common symbols and patterns from the codebase
    if (metadata.commonSymbols) {
      for (const symbol of metadata.commonSymbols) {
        if (this.isRelatedSymbol(query, symbol)) {
          expansions.push(`${query} ${symbol}`);
          expansions.push(`${symbol} ${query}`);
        }
      }
    }

    // Use common patterns
    if (metadata.commonPatterns) {
      for (const pattern of metadata.commonPatterns) {
        if (this.isRelatedPattern(query, pattern)) {
          expansions.push(`${query} ${pattern}`);
        }
      }
    }

    // Use technology stack information
    if (metadata.technologies) {
      for (const tech of metadata.technologies) {
        if (this.isRelatedTechnology(query, tech)) {
          expansions.push(`${query} ${tech}`);
          expansions.push(`${tech} ${query}`);
        }
      }
    }

    return expansions;
  }

  /**
   * Generate linguistic variations
   */
  private generateLinguisticVariations(query: string): string[] {
    const expansions: string[] = [];

    // Plural/singular variations
    const words = query.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word) {
        const variations = this.generateWordVariations(word);

        for (const variation of variations) {
          const newWords = [...words];
          newWords[i] = variation;
          const newQuery = newWords.join(' ');
          if (newQuery !== query) {
            expansions.push(newQuery);
          }
        }
      }
    }

    // Case variations
    expansions.push(query.toLowerCase());
    expansions.push(this.toCamelCase(query));
    expansions.push(this.toPascalCase(query));
    expansions.push(this.toSnakeCase(query));
    expansions.push(this.toKebabCase(query));

    return expansions.filter(exp => exp !== query);
  }

  /**
   * Generate technical variations
   */
  private generateTechnicalVariations(query: string, _intent: QueryIntent): string[] {
    const expansions: string[] = [];

    // Programming language specific variations
    const langVariations = this.generateLanguageSpecificVariations(query);
    expansions.push(...langVariations);

    // Framework specific variations
    const frameworkVariations = this.generateFrameworkSpecificVariations(query);
    expansions.push(...frameworkVariations);

    // Acronym expansions
    const acronymVariations = this.generateAcronymVariations(query);
    expansions.push(...acronymVariations);

    return expansions.filter(exp => exp !== query);
  }

  /**
   * Generate word variations (plural/singular, etc.)
   */
  private generateWordVariations(word: string): string[] {
    const variations: string[] = [];

    // Simple plural/singular rules
    if (word.endsWith('s') && word.length > 3) {
      variations.push(word.slice(0, -1)); // Remove 's'
    } else {
      variations.push(word + 's'); // Add 's'
    }

    // Common irregular plurals
    const irregularPlurals = new Map([
      ['child', 'children'],
      ['children', 'child'],
      ['person', 'people'],
      ['people', 'person'],
      ['data', 'datum'],
      ['datum', 'data']
    ]);

    const irregular = irregularPlurals.get(word.toLowerCase());
    if (irregular) {
      variations.push(irregular);
    }

    return variations;
  }

  /**
   * Convert to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, word => {
      return word.toUpperCase();
    }).replace(/\s+/g, '');
  }

  /**
   * Convert to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('_');
  }

  /**
   * Convert to kebab-case
   */
  private toKebabCase(str: string): string {
    return str.replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('-');
  }

  /**
   * Generate language-specific variations
   */
  private generateLanguageSpecificVariations(query: string): string[] {
    const variations: string[] = [];

    const langMappings = new Map([
      ['function', ['func', 'method', 'def', 'procedure']],
      ['variable', ['var', 'let', 'const', 'field']],
      ['class', ['interface', 'struct', 'type', 'object']],
      ['import', ['require', 'include', 'using', 'from']],
      ['export', ['module.exports', 'exports', 'public']]
    ]);

    for (const [term, alternatives] of langMappings) {
      if (query.toLowerCase().includes(term)) {
        for (const alt of alternatives) {
          variations.push(query.replace(new RegExp(`\\b${term}\\b`, 'gi'), alt));
        }
      }
    }

    return variations;
  }

  /**
   * Generate framework-specific variations
   */
  private generateFrameworkSpecificVariations(query: string): string[] {
    const variations: string[] = [];

    const frameworkMappings = new Map([
      ['component', ['widget', 'element', 'view', 'control']],
      ['service', ['provider', 'factory', 'helper', 'utility']],
      ['controller', ['handler', 'action', 'endpoint', 'route']],
      ['model', ['entity', 'schema', 'data', 'record']],
      ['middleware', ['interceptor', 'filter', 'guard', 'plugin']]
    ]);

    for (const [term, alternatives] of frameworkMappings) {
      if (query.toLowerCase().includes(term)) {
        for (const alt of alternatives) {
          variations.push(query.replace(new RegExp(`\\b${term}\\b`, 'gi'), alt));
        }
      }
    }

    return variations;
  }

  /**
   * Generate acronym variations
   */
  private generateAcronymVariations(query: string): string[] {
    const variations: string[] = [];

    const acronymMappings = new Map([
      ['API', 'Application Programming Interface'],
      ['UI', 'User Interface'],
      ['DB', 'Database'],
      ['HTTP', 'HyperText Transfer Protocol'],
      ['JSON', 'JavaScript Object Notation'],
      ['XML', 'eXtensible Markup Language'],
      ['CSS', 'Cascading Style Sheets'],
      ['HTML', 'HyperText Markup Language'],
      ['SQL', 'Structured Query Language'],
      ['REST', 'Representational State Transfer']
    ]);

    for (const [acronym, fullForm] of acronymMappings) {
      if (query.includes(acronym)) {
        variations.push(query.replace(acronym, fullForm));
      }
      if (query.includes(fullForm)) {
        variations.push(query.replace(fullForm, acronym));
      }
    }

    return variations;
  }

  /**
   * Check if symbol is related to query
   */
  private isRelatedSymbol(query: string, symbol: string): boolean {
    const queryLower = query.toLowerCase();
    const symbolLower = symbol.toLowerCase();
    
    return queryLower.includes(symbolLower) || 
           symbolLower.includes(queryLower) ||
           this.calculateEditDistance(queryLower, symbolLower) <= 2;
  }

  /**
   * Check if pattern is related to query
   */
  private isRelatedPattern(query: string, pattern: string): boolean {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const patternWords = new Set(pattern.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...queryWords].filter(w => patternWords.has(w)));
    return intersection.size > 0;
  }

  /**
   * Check if technology is related to query
   */
  private isRelatedTechnology(query: string, tech: string): boolean {
    return query.toLowerCase().includes(tech.toLowerCase()) ||
           tech.toLowerCase().includes(query.toLowerCase());
  }

  /**
   * Calculate edit distance between two strings
   */
  private calculateEditDistance(str1: string, str2: string): number {
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
   * Store expansion history for learning
   */
  private storeExpansionHistory(query: string, expansions: string[]): void {
    this.expansionHistory.set(query, expansions);
    
    // Keep only recent history
    if (this.expansionHistory.size > 1000) {
      const oldestKey = Array.from(this.expansionHistory.keys())[0];
      if (oldestKey) {
        this.expansionHistory.delete(oldestKey);
      }
    }
  }

  /**
   * Initialize synonym map
   */
  private initializeSynonymMap(): void {
    this.synonymMap.set('function', ['method', 'func', 'procedure', 'routine']);
    this.synonymMap.set('class', ['interface', 'type', 'struct', 'object']);
    this.synonymMap.set('variable', ['var', 'field', 'property', 'attribute']);
    this.synonymMap.set('error', ['exception', 'bug', 'issue', 'problem']);
    this.synonymMap.set('create', ['make', 'build', 'generate', 'construct']);
    this.synonymMap.set('get', ['fetch', 'retrieve', 'obtain', 'acquire']);
    this.synonymMap.set('set', ['assign', 'update', 'modify', 'change']);
    this.synonymMap.set('delete', ['remove', 'destroy', 'clear', 'erase']);
    this.synonymMap.set('find', ['search', 'locate', 'discover', 'identify']);
    this.synonymMap.set('show', ['display', 'present', 'reveal', 'exhibit']);
  }

  /**
   * Initialize concept graph
   */
  private initializeConceptGraph(): void {
    this.conceptGraph.set('authentication', ['login', 'auth', 'security', 'credentials', 'verification']);
    this.conceptGraph.set('database', ['storage', 'persistence', 'data', 'repository', 'store']);
    this.conceptGraph.set('api', ['endpoint', 'service', 'interface', 'rest', 'graphql']);
    this.conceptGraph.set('component', ['widget', 'element', 'module', 'part', 'piece']);
    this.conceptGraph.set('state', ['data', 'store', 'model', 'context', 'memory']);
    this.conceptGraph.set('routing', ['navigation', 'path', 'url', 'route', 'link']);
    this.conceptGraph.set('testing', ['test', 'spec', 'assertion', 'mock', 'stub']);
    this.conceptGraph.set('configuration', ['config', 'settings', 'options', 'preferences']);
  }
}
