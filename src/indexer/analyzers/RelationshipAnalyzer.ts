import { DependencyInfo, CallGraphNode, ImportGraphNode } from '../types/AnalyzerTypes.js';

/**
 * Analyzer for extracting code relationships and dependencies
 */
export class RelationshipAnalyzer {
  
  /**
   * Extract dependencies from code content
   */
  static extractDependencies(content: string, _filePath: string): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    
    // Extract import dependencies
    const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    if (importMatches) {
      for (const match of importMatches) {
        const sourceMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (sourceMatch && sourceMatch[1]) {
          const source = sourceMatch[1];
          const symbolsMatch = match.match(/import\s+\{([^}]+)\}/);
          const symbols = symbolsMatch && symbolsMatch[1] ?
            symbolsMatch[1].split(',').map(s => s.trim()) :
            ['default'];

          dependencies.push({
            filePath: source,
            type: 'import',
            strength: 0.8,
            symbols,
            context: `imports from ${source}`
          });
        }
      }
    }
    
    // Extract require dependencies (CommonJS)
    const requireMatches = content.match(/require\(['"`]([^'"`]+)['"`]\)/g);
    if (requireMatches) {
      for (const match of requireMatches) {
        const sourceMatch = match.match(/require\(['"`]([^'"`]+)['"`]\)/);
        if (sourceMatch && sourceMatch[1]) {
          const source = sourceMatch[1];
          dependencies.push({
            filePath: source,
            type: 'import',
            strength: 0.7,
            symbols: ['default'],
            context: `requires ${source}`
          });
        }
      }
    }
    
    // Extract function call dependencies
    const functionCallMatches = content.match(/(\w+)\s*\(/g);
    if (functionCallMatches) {
      const uniqueCalls = [...new Set(functionCallMatches.map(match => 
        match.replace(/\s*\(/, '')))];
      
      for (const call of uniqueCalls) {
        if (call.length > 2 && !['if', 'for', 'while', 'switch', 'catch'].includes(call)) {
          dependencies.push({
            filePath: 'unknown', // Will be resolved during full codebase analysis
            type: 'call',
            strength: 0.5,
            symbols: [call],
            context: `calls function ${call}`
          });
        }
      }
    }
    
    return dependencies;
  }
  
  /**
   * Build call graph from code content
   */
  static buildCallGraph(content: string): CallGraphNode[] {
    const callGraph: CallGraphNode[] = [];
    
    // Extract function definitions
    const functionMatches = content.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)|(\w+)\s*:\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{))/g);
    
    if (functionMatches) {
      for (const match of functionMatches) {
        let functionName = '';
        
        // Extract function name from different patterns
        const patterns = [
          /function\s+(\w+)/,
          /const\s+(\w+)\s*=/,
          /(\w+)\s*:/
        ];
        
        for (const pattern of patterns) {
          const nameMatch = match.match(pattern);
          if (nameMatch && nameMatch[1]) {
            functionName = nameMatch[1];
            break;
          }
        }
        
        if (functionName) {
          // Find function calls within this function
          const functionBodyStart = content.indexOf(match);
          const functionBodyEnd = this.findFunctionEnd(content, functionBodyStart);
          const functionBody = content.slice(functionBodyStart, functionBodyEnd);
          
          const calls = this.extractFunctionCalls(functionBody);
          
          callGraph.push({
            function: functionName,
            calls,
            calledBy: [], // Will be populated in post-processing
            complexity: this.calculateFunctionComplexity(functionBody)
          });
        }
      }
    }
    
    // Populate calledBy relationships
    for (const node of callGraph) {
      for (const call of node.calls) {
        const targetNode = callGraph.find(n => n.function === call);
        if (targetNode) {
          targetNode.calledBy.push(node.function);
        }
      }
    }
    
    return callGraph;
  }
  
  /**
   * Build import graph from code content
   */
  static buildImportGraph(content: string): ImportGraphNode[] {
    const importGraph: ImportGraphNode[] = [];
    
    // Extract import statements
    const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    if (importMatches) {
      for (const match of importMatches) {
        const sourceMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (sourceMatch && sourceMatch[1]) {
          const module = sourceMatch[1];
          const symbolsMatch = match.match(/import\s+\{([^}]+)\}/);
          const defaultMatch = match.match(/import\s+(\w+)\s+from/);

          let imports: string[] = [];
          if (symbolsMatch && symbolsMatch[1]) {
            imports = symbolsMatch[1].split(',').map(s => s.trim());
          } else if (defaultMatch && defaultMatch[1]) {
            imports = [defaultMatch[1]];
          }

          importGraph.push({
            module,
            imports,
            importedBy: [], // Will be populated during full codebase analysis
            isExternal: !module.startsWith('.') && !module.startsWith('/')
          });
        }
      }
    }
    
    return importGraph;
  }
  
  /**
   * Extract function calls from code
   */
  private static extractFunctionCalls(code: string): string[] {
    const calls: string[] = [];
    const callMatches = code.match(/(\w+)\s*\(/g);
    
    if (callMatches) {
      for (const match of callMatches) {
        const functionName = match.replace(/\s*\(/, '');
        if (functionName.length > 2 && 
            !['if', 'for', 'while', 'switch', 'catch', 'console'].includes(functionName)) {
          calls.push(functionName);
        }
      }
    }
    
    return [...new Set(calls)]; // Remove duplicates
  }
  
  /**
   * Find the end of a function definition
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
  
  /**
   * Calculate basic function complexity
   */
  private static calculateFunctionComplexity(functionBody: string): number {
    let complexity = 1; // Base complexity
    
    // Count decision points
    const decisionPoints = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*:/g, // Ternary operator
      /&&/g,
      /\|\|/g
    ];
    
    for (const pattern of decisionPoints) {
      const matches = functionBody.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }
}
