/**
 * Symbol indexer for tracking functions, classes, and other symbols across the codebase
 */
export class SymbolIndexer {
  private symbols: Map<string, SymbolInfo[]> = new Map();
  
  /**
   * Index symbols from code content
   */
  indexSymbols(content: string, filePath: string): void {
    const symbols = this.extractSymbols(content, filePath);
    
    for (const symbol of symbols) {
      const existing = this.symbols.get(symbol.name) || [];
      existing.push(symbol);
      this.symbols.set(symbol.name, existing);
    }
  }
  
  /**
   * Find symbol definitions
   */
  findSymbol(name: string): SymbolInfo[] {
    return this.symbols.get(name) || [];
  }
  
  /**
   * Get all symbols
   */
  getAllSymbols(): Map<string, SymbolInfo[]> {
    return this.symbols;
  }
  
  /**
   * Clear all symbols
   */
  clear(): void {
    this.symbols.clear();
  }
  
  /**
   * Extract symbols from code content
   */
  private extractSymbols(content: string, filePath: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    
    // Extract function declarations
    const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g);
    if (functionMatches) {
      for (const match of functionMatches) {
        const nameMatch = match.match(/function\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          symbols.push({
            name: nameMatch[1],
            type: 'function',
            filePath,
            isExported: match.includes('export'),
            line: this.getLineNumber(content, match)
          });
        }
      }
    }
    
    // Extract arrow function declarations
    const arrowFunctionMatches = content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g);
    if (arrowFunctionMatches) {
      for (const match of arrowFunctionMatches) {
        const nameMatch = match.match(/const\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          symbols.push({
            name: nameMatch[1],
            type: 'function',
            filePath,
            isExported: match.includes('export'),
            line: this.getLineNumber(content, match)
          });
        }
      }
    }

    // Extract class declarations
    const classMatches = content.match(/(?:export\s+)?class\s+(\w+)/g);
    if (classMatches) {
      for (const match of classMatches) {
        const nameMatch = match.match(/class\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          symbols.push({
            name: nameMatch[1],
            type: 'class',
            filePath,
            isExported: match.includes('export'),
            line: this.getLineNumber(content, match)
          });
        }
      }
    }

    // Extract interface declarations
    const interfaceMatches = content.match(/(?:export\s+)?interface\s+(\w+)/g);
    if (interfaceMatches) {
      for (const match of interfaceMatches) {
        const nameMatch = match.match(/interface\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          symbols.push({
            name: nameMatch[1],
            type: 'interface',
            filePath,
            isExported: match.includes('export'),
            line: this.getLineNumber(content, match)
          });
        }
      }
    }

    // Extract type declarations
    const typeMatches = content.match(/(?:export\s+)?type\s+(\w+)/g);
    if (typeMatches) {
      for (const match of typeMatches) {
        const nameMatch = match.match(/type\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          symbols.push({
            name: nameMatch[1],
            type: 'type',
            filePath,
            isExported: match.includes('export'),
            line: this.getLineNumber(content, match)
          });
        }
      }
    }

    // Extract variable declarations
    const varMatches = content.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)/g);
    if (varMatches) {
      for (const match of varMatches) {
        const nameMatch = match.match(/(?:const|let|var)\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          symbols.push({
            name: nameMatch[1],
            type: 'variable',
            filePath,
            isExported: match.includes('export'),
            line: this.getLineNumber(content, match)
          });
        }
      }
    }
    
    return symbols;
  }
  
  /**
   * Get line number for a match in content
   */
  private getLineNumber(content: string, match: string): number {
    const index = content.indexOf(match);
    if (index === -1) return 1;

    const beforeMatch = content.substring(0, index);
    return beforeMatch.split('\n').length;
  }

  /**
   * Create symbol-aware chunks for better code structure understanding
   */
  static createSymbolAwareChunks(content: string, filePath: string, language: string, chunkSize: number): any[] {
    const lines = content.split('\n');
    const chunks: any[] = [];

    // Simple chunking for now - can be enhanced later
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkLines = lines.slice(i, Math.min(i + chunkSize, lines.length));
      const chunkContent = chunkLines.join('\n');

      if (chunkContent.trim().length > 10) {
        const chunk = {
          id: `${filePath}:${i}:${Math.min(i + chunkSize, lines.length)}`,
          filePath,
          content: chunkContent,
          startLine: i + 1,
          endLine: Math.min(i + chunkSize, lines.length),
          chunkIndex: Math.floor(i / chunkSize),
          fileHash: this.calculateContentHash(chunkContent),
          lastModified: Date.now(),
          language,
          symbols: [],
          metadata: {
            complexity: 1,
            importance: 1
          }
        };
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Calculate content hash
   */
  private static calculateContentHash(content: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }
}

/**
 * Symbol information interface
 */
export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'component';
  filePath: string;
  isExported: boolean;
  line: number;
}
