import { QueryIntent } from '../common/types.js';
import { extractKeywords } from './utils.js';

export class QueryAnalysis {
  /**
   * Analyze query intent using pattern matching and ML techniques
   */
  public async analyzeQueryIntent(query: string): Promise<QueryIntent> {
    const queryLower = query.toLowerCase();
    // const words = queryLower.split(/\s+/);
    
    // Pattern-based intent detection
    const patterns = {
      function_search: [
        /\b(function|method|func|def)\b/,
        /\b(how to|implement|create)\b.*\b(function|method)\b/,
        /\b\w+\(\)/,  // function call pattern
        /\b(call|invoke|execute)\b/
      ],
      class_search: [
        /\b(class|interface|struct|type)\b/,
        /\b(extends|implements|inherits)\b/,
        /\bclass\s+\w+/
      ],
      debug_search: [
        /\b(error|bug|issue|problem|fix|debug)\b/,
        /\b(why|what's wrong|not working)\b/,
        /\b(exception|crash|fail)\b/
      ],
      implementation_search: [
        /\b(how to|how do|implement|create|build|make)\b/,
        /\b(example|sample|demo)\b/,
        /\b(pattern|approach|solution)\b/
      ],
      concept_search: [
        /\b(what is|explain|understand|concept)\b/,
        /\b(architecture|design|pattern)\b/,
        /\b(overview|summary)\b/
      ]
    };

    let bestMatch = { type: 'general' as QueryIntent['type'], confidence: 0.1 };
    
    for (const [intentType, patternList] of Object.entries(patterns)) {
      let matches = 0;
      for (const pattern of patternList) {
        if (pattern.test(queryLower)) {
          matches++;
        }
      }
      const confidence = matches / patternList.length;
      if (confidence > bestMatch.confidence) {
        bestMatch = { type: intentType as QueryIntent['type'], confidence };
      }
    }

    // Extract entities and keywords
    const entities = this.extractEntities(query);
    const keywords = extractKeywords(query); // Using the extracted utility function
    const context = this.extractContext(query);

    return {
      type: bestMatch.type,
      confidence: bestMatch.confidence,
      keywords,
      entities,
      context
    };
  }

  /**
   * Expand query with related terms, synonyms, and context
   */
  public async expandQuery(query: string, intent: QueryIntent): Promise<string[]> {
    const expansions = [query]; // Always include original

    // Add keyword variations
    for (const keyword of intent.keywords) {
      const variations = this.generateKeywordVariations(keyword);
      expansions.push(...variations.map(v => query.replace(keyword, v)));
    }

    // Add concept-based expansions
    if (intent.type === 'concept_search') {
      const concepts = await this.getRelatedConcepts(query);
      expansions.push(...concepts);
    }

    // Add entity-focused queries
    for (const entity of intent.entities) {
      expansions.push(entity);
      expansions.push(`${entity} implementation`);
      expansions.push(`${entity} usage`);
    }

    // Add intent-specific expansions
    switch (intent.type) {
      case 'function_search':
        expansions.push(`${query} function`);
        expansions.push(`${query} method`);
        expansions.push(`${query} implementation`);
        break;
      case 'class_search':
        expansions.push(`${query} class`);
        expansions.push(`${query} interface`);
        expansions.push(`${query} type`);
        break;
      case 'debug_search':
        expansions.push(`${query} error`);
        expansions.push(`${query} fix`);
        expansions.push(`${query} solution`);
        break;
    }

    // Remove duplicates and return unique expansions
    return [...new Set(expansions)].slice(0, 10); // Limit to 10 variations
  }

  /**
   * Extract entities (function names, class names, etc.) from query
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];
    
    // CamelCase/PascalCase entities
    const camelCaseMatches = query.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g);
    if (camelCaseMatches) entities.push(...camelCaseMatches);
    
    // snake_case entities
    const snakeCaseMatches = query.match(/\b[a-z]+(?:_[a-z]+)+\b/g);
    if (snakeCaseMatches) entities.push(...snakeCaseMatches);
    
    // Function call patterns
    const functionMatches = query.match(/\b\w+\(\)/g);
    if (functionMatches) entities.push(...functionMatches.map(f => f.replace('()', '')));
    
    return [...new Set(entities)];
  }

  /**
   * Extract context from query
   */
  private extractContext(query: string): string[] {
    const context: string[] = [];
    
    // Programming language context
    const langPatterns = {
      'javascript': /\b(js|javascript|node|npm|react|vue|angular)\b/i,
      'typescript': /\b(ts|typescript|tsx)\b/i,
      'python': /\b(py|python|django|flask|pandas)\b/i,
      'java': /\b(java|spring|maven|gradle)\b/i,
      'cpp': /\b(c\+\+|cpp|cmake)\b/i
    };
    
    for (const [lang, pattern] of Object.entries(langPatterns)) {
      if (pattern.test(query)) {
        context.push(lang);
      }
    }
    
    return context;
  }

  /**
   * Generate keyword variations (synonyms, related terms)
   */
  private generateKeywordVariations(keyword: string): string[] {
    const variations = [keyword];
    
    // Common programming synonyms
    const synonyms: Record<string, string[]> = {
      'function': ['method', 'func', 'procedure', 'routine'],
      'class': ['interface', 'type', 'struct', 'object'],
      'variable': ['var', 'field', 'property', 'attribute'],
      'error': ['exception', 'bug', 'issue', 'problem'],
      'create': ['make', 'build', 'generate', 'construct'],
      'get': ['fetch', 'retrieve', 'obtain', 'acquire'],
      'set': ['assign', 'update', 'modify', 'change'],
      'delete': ['remove', 'destroy', 'clear', 'erase']
    };
    
    if (synonyms[keyword]) {
      variations.push(...synonyms[keyword]);
    }
    
    return variations;
  }

  /**
   * Get related concepts for concept-based search
   */
  private async getRelatedConcepts(query: string): Promise<string[]> {
    // This would typically use a knowledge graph or concept database
    // For now, implement basic concept relationships
    const conceptMap: Record<string, string[]> = {
      'authentication': ['login', 'auth', 'security', 'user verification', 'credentials'],
      'database': ['db', 'storage', 'persistence', 'data layer', 'repository'],
      'api': ['endpoint', 'service', 'interface', 'rest', 'graphql'],
      'component': ['widget', 'element', 'module', 'part', 'piece'],
      'state': ['data', 'store', 'model', 'context', 'memory']
    };
    
    const concepts: string[] = [];
    const queryLower = query.toLowerCase();
    
    for (const [concept, related] of Object.entries(conceptMap)) {
      if (queryLower.includes(concept)) {
        concepts.push(...related);
      }
    }
    
    return concepts;
  }
}