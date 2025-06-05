/**
 * Analyzer for calculating code quality metrics
 */
export class QualityAnalyzer {
  
  /**
   * Calculate cyclomatic complexity of code
   */
  static calculateCyclomaticComplexity(content: string): number {
    let complexity = 1; // Base complexity
    
    // Count decision points that increase complexity
    const complexityPatterns = [
      /if\s*\(/g,           // if statements
      /else\s+if\s*\(/g,    // else if statements
      /while\s*\(/g,        // while loops
      /for\s*\(/g,          // for loops
      /switch\s*\(/g,       // switch statements
      /case\s+/g,           // case statements
      /catch\s*\(/g,        // catch blocks
      /\?\s*:/g,            // ternary operators
      /&&/g,                // logical AND
      /\|\|/g               // logical OR
    ];
    
    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
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
    // Based on lines of code, complexity, and comment ratio
    let maintainability = 100;
    
    // Penalize for high complexity
    maintainability -= Math.min(complexity * 2, 40);
    
    // Penalize for long files
    if (lines > 200) {
      maintainability -= Math.min((lines - 200) * 0.1, 20);
    }
    
    // Reward for good commenting
    maintainability += commentRatio * 10;
    
    return Math.max(0, Math.min(100, maintainability));
  }
  
  /**
   * Estimate test coverage based on file patterns
   */
  static estimateTestCoverage(content: string, filePath: string): number {
    const path = filePath.toLowerCase();
    
    // If it's a test file, return 100%
    if (path.includes('test') || path.includes('spec') || 
        path.includes('__tests__') || path.includes('.test.') || 
        path.includes('.spec.')) {
      return 100;
    }
    
    // Check if there are corresponding test files (simplified estimation)
    const hasTestKeywords = content.toLowerCase().includes('test') ||
                           content.toLowerCase().includes('spec') ||
                           content.toLowerCase().includes('jest') ||
                           content.toLowerCase().includes('vitest');
    
    if (hasTestKeywords) {
      return 80; // Assume good coverage if test-related keywords found
    }
    
    // Estimate based on function count vs complexity
    const functionCount = this.countFunctions(content);
    const complexity = this.calculateCyclomaticComplexity(content);
    
    if (functionCount === 0) {
      return 50; // Configuration or simple files
    }
    
    // Simple heuristic: lower complexity suggests easier to test
    const coverageEstimate = Math.max(20, 100 - (complexity / functionCount) * 10);
    return Math.min(100, coverageEstimate);
  }
  
  /**
   * Calculate documentation coverage (0-100 scale)
   */
  static calculateDocumentationCoverage(content: string): number {
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    if (totalLines === 0) return 0;
    
    let commentLines = 0;
    let docCommentLines = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Count comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || 
          trimmed.startsWith('*') || trimmed.startsWith('*/')) {
        commentLines++;
        
        // Count documentation-style comments
        if (trimmed.startsWith('/**') || trimmed.startsWith('* @') ||
            trimmed.includes('@param') || trimmed.includes('@returns') ||
            trimmed.includes('@description')) {
          docCommentLines++;
        }
      }
    }
    
    const commentRatio = commentLines / totalLines;
    const docRatio = docCommentLines / totalLines;
    
    // Weight documentation comments more heavily
    const coverage = (commentRatio * 50) + (docRatio * 50);
    return Math.min(100, coverage * 100);
  }
  
  /**
   * Detect code smells
   */
  static detectCodeSmells(content: string): string[] {
    const smells: string[] = [];
    const lines = content.split('\n');
    
    // Long method smell
    const functionMatches = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)/g);
    if (functionMatches) {
      for (const match of functionMatches) {
        const functionStart = content.indexOf(match);
        const functionEnd = this.findFunctionEnd(content, functionStart);
        const functionLines = content.slice(functionStart, functionEnd).split('\n').length;
        
        if (functionLines > 50) {
          smells.push('long-method');
          break;
        }
      }
    }
    
    // Large class smell
    if (lines.length > 500) {
      smells.push('large-class');
    }
    
    // Duplicate code smell (simplified detection)
    const duplicateLines = this.findDuplicateLines(lines);
    if (duplicateLines > 5) {
      smells.push('duplicate-code');
    }
    
    // Long parameter list smell
    const longParameterMatches = content.match(/\([^)]{50,}\)/g);
    if (longParameterMatches && longParameterMatches.length > 0) {
      smells.push('long-parameter-list');
    }
    
    // Dead code smell (unused variables/functions)
    const unusedVariables = this.findUnusedVariables(content);
    if (unusedVariables.length > 0) {
      smells.push('dead-code');
    }
    
    // Magic numbers smell
    const magicNumbers = content.match(/\b\d{2,}\b/g);
    if (magicNumbers && magicNumbers.length > 5) {
      smells.push('magic-numbers');
    }
    
    // Deeply nested code smell
    const maxNesting = this.calculateMaxNesting(content);
    if (maxNesting > 4) {
      smells.push('deeply-nested-code');
    }
    
    return smells;
  }
  
  /**
   * Calculate technical debt score (0-100 scale, higher is worse)
   */
  static calculateTechnicalDebt(content: string, filePath: string): number {
    let debt = 0;
    
    const complexity = this.calculateCyclomaticComplexity(content);
    const maintainability = this.calculateMaintainabilityIndex(content);
    const smells = this.detectCodeSmells(content);
    const testCoverage = this.estimateTestCoverage(content, filePath);
    
    // High complexity increases debt
    debt += Math.min(complexity * 2, 30);
    
    // Low maintainability increases debt
    debt += Math.max(0, 50 - maintainability) * 0.5;
    
    // Code smells increase debt
    debt += smells.length * 5;
    
    // Low test coverage increases debt
    debt += Math.max(0, 80 - testCoverage) * 0.3;
    
    // TODO comments indicate debt
    const todoMatches = content.match(/\/\/\s*TODO|\/\*\s*TODO|\*\s*TODO/gi);
    if (todoMatches) {
      debt += todoMatches.length * 2;
    }
    
    // FIXME comments indicate debt
    const fixmeMatches = content.match(/\/\/\s*FIXME|\/\*\s*FIXME|\*\s*FIXME/gi);
    if (fixmeMatches) {
      debt += fixmeMatches.length * 3;
    }
    
    return Math.min(100, debt);
  }
  
  /**
   * Calculate comment ratio
   */
  private static calculateCommentRatio(content: string): number {
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    if (totalLines === 0) return 0;
    
    let commentLines = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || 
          trimmed.startsWith('*') || trimmed.startsWith('*/')) {
        commentLines++;
      }
    }
    
    return commentLines / totalLines;
  }
  
  /**
   * Count functions in code
   */
  private static countFunctions(content: string): number {
    const functionPatterns = [
      /function\s+\w+/g,
      /const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
      /\w+\s*:\s*(?:async\s+)?\([^)]*\)\s*=>/g
    ];
    
    let count = 0;
    for (const pattern of functionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    
    return count;
  }
  
  /**
   * Find duplicate lines (simplified)
   */
  private static findDuplicateLines(lines: string[]): number {
    const lineMap = new Map<string, number>();
    let duplicates = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10) { // Only consider substantial lines
        const count = lineMap.get(trimmed) || 0;
        lineMap.set(trimmed, count + 1);
        if (count === 1) { // First duplicate
          duplicates++;
        }
      }
    }
    
    return duplicates;
  }
  
  /**
   * Find unused variables (simplified detection)
   */
  private static findUnusedVariables(content: string): string[] {
    const unused: string[] = [];
    
    // Extract variable declarations
    const varMatches = content.match(/(?:const|let|var)\s+(\w+)/g);
    if (varMatches) {
      for (const match of varMatches) {
        const parts = match.split(/\s+/);
        const varName = parts[1];

        if (varName) {
          // Check if variable is used elsewhere
          const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
          const usages = content.match(usageRegex);

          if (usages && usages.length === 1) { // Only declaration, no usage
            unused.push(varName);
          }
        }
      }
    }
    
    return unused;
  }
  
  /**
   * Calculate maximum nesting level
   */
  private static calculateMaxNesting(content: string): number {
    let maxNesting = 0;
    let currentNesting = 0;
    
    for (const char of content) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting--;
      }
    }
    
    return maxNesting;
  }
  
  /**
   * Find function end (helper method)
   */
  private static findFunctionEnd(content: string, start: number): number {
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = start; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
          return i + 1;
        }
      }
    }
    
    return content.length;
  }
}
