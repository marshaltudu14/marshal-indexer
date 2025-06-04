import * as esprima from 'esprima';
import { SymbolInfo, DependencyInfo } from './types.js';

/**
 * Parse JavaScript/TypeScript code to extract symbols and dependencies
 */
export class CodeParser {
  /**
   * Parse code and extract symbols
   */
  static parseSymbols(code: string, language: string): SymbolInfo[] {
    try {
      if (language === 'javascript' || language === 'typescript') {
        return this.parseJavaScriptSymbols(code);
      }

      // For other languages, use simple regex-based parsing
      return this.parseGenericSymbols(code, language);
    } catch (error) {
      console.warn(`Failed to parse symbols: ${error}`);
      return [];
    }
  }
  
  /**
   * Parse JavaScript/TypeScript using esprima
   */
  private static parseJavaScriptSymbols(code: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    
    try {
      const ast = esprima.parseScript(code, {
        loc: true,
        tolerant: true,
        range: true
      });
      
      this.traverseAST(ast, symbols);
    } catch (_error) {
      // If parsing as script fails, try as module
      try {
        const ast = esprima.parseModule(code, {
          loc: true,
          tolerant: true,
          range: true
        });
        
        this.traverseAST(ast, symbols);
      } catch (_moduleError) {
        console.warn('Failed to parse JavaScript code');
      }
    }
    
    return symbols;
  }
  
  /**
   * Traverse AST and extract symbols
   */
  private static traverseAST(node: unknown, symbols: SymbolInfo[]): void {
    if (!node || typeof node !== 'object') return;

    const astNode = node as any;
    const nodeType = astNode.type as string;

    switch (nodeType) {
      case 'FunctionDeclaration':
        if (astNode.id && astNode.loc) {
          symbols.push({
            name: astNode.id.name,
            type: 'function',
            line: astNode.loc.start.line,
            column: astNode.loc.start.column,
            endLine: astNode.loc.end.line,
            endColumn: astNode.loc.end.column
          });
        }
        break;
        
      case 'ClassDeclaration':
        if (astNode.id && astNode.loc) {
          symbols.push({
            name: astNode.id.name,
            type: 'class',
            line: astNode.loc.start.line,
            column: astNode.loc.start.column,
            endLine: astNode.loc.end.line,
            endColumn: astNode.loc.end.column
          });
        }
        break;

      case 'VariableDeclarator':
        if (astNode.id && astNode.id.name && astNode.loc) {
          symbols.push({
            name: astNode.id.name,
            type: 'variable',
            line: astNode.loc.start.line,
            column: astNode.loc.start.column,
            endLine: astNode.loc.end.line,
            endColumn: astNode.loc.end.column
          });
        }
        break;

      case 'ImportDeclaration':
        if (astNode.loc) {
          const importName = astNode.source.value;
          symbols.push({
            name: importName,
            type: 'import',
            line: astNode.loc.start.line,
            column: astNode.loc.start.column,
            endLine: astNode.loc.end.line,
            endColumn: astNode.loc.end.column
          });
        }
        break;

      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        if (astNode.loc) {
          const exportName = astNode.declaration?.id?.name || 'default';
          symbols.push({
            name: exportName,
            type: 'export',
            line: astNode.loc.start.line,
            column: astNode.loc.start.column,
            endLine: astNode.loc.end.line,
            endColumn: astNode.loc.end.column
          });
        }
        break;
    }
    
    // Recursively traverse child nodes
    for (const key in astNode) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') {
        continue;
      }

      const child = astNode[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverseAST(item, symbols));
      } else if (child && typeof child === 'object') {
        this.traverseAST(child, symbols);
      }
    }
  }
  
  /**
   * Parse symbols using regex for non-JavaScript languages
   */
  private static parseGenericSymbols(code: string, language: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = code.split('\n');
    
    const patterns = this.getLanguagePatterns(language);
    
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        const matches = line.matchAll(pattern.regex);
        for (const match of matches) {
          if (match.groups?.['name']) {
            symbols.push({
              name: match.groups['name'],
              type: pattern.type,
              line: index + 1,
              column: match.index || 0
            });
          }
        }
      });
    });
    
    return symbols;
  }
  
  /**
   * Get regex patterns for different languages
   */
  private static getLanguagePatterns(language: string) {
    const patterns: Array<{ regex: RegExp; type: SymbolInfo['type'] }> = [];
    
    switch (language) {
      case 'python':
        patterns.push(
          { regex: /^def\s+(?<name>\w+)/gm, type: 'function' },
          { regex: /^class\s+(?<name>\w+)/gm, type: 'class' },
          { regex: /^(?<name>\w+)\s*=/gm, type: 'variable' },
          { regex: /^from\s+[\w.]+\s+import\s+(?<name>\w+)/gm, type: 'import' },
          { regex: /^import\s+(?<name>[\w.]+)/gm, type: 'import' }
        );
        break;
        
      case 'java':
        patterns.push(
          { regex: /public\s+(?:static\s+)?(?:void|[\w<>]+)\s+(?<name>\w+)\s*\(/gm, type: 'function' },
          { regex: /(?:public\s+)?class\s+(?<name>\w+)/gm, type: 'class' },
          { regex: /interface\s+(?<name>\w+)/gm, type: 'interface' },
          { regex: /import\s+(?<name>[\w.]+)/gm, type: 'import' }
        );
        break;
        
      case 'go':
        patterns.push(
          { regex: /func\s+(?<name>\w+)\s*\(/gm, type: 'function' },
          { regex: /type\s+(?<name>\w+)\s+struct/gm, type: 'class' },
          { regex: /type\s+(?<name>\w+)\s+interface/gm, type: 'interface' },
          { regex: /import\s+"(?<name>[^"]+)"/gm, type: 'import' }
        );
        break;
        
      case 'rust':
        patterns.push(
          { regex: /fn\s+(?<name>\w+)\s*\(/gm, type: 'function' },
          { regex: /struct\s+(?<name>\w+)/gm, type: 'class' },
          { regex: /trait\s+(?<name>\w+)/gm, type: 'interface' },
          { regex: /use\s+(?<name>[\w:]+)/gm, type: 'import' }
        );
        break;
        
      default:
        // Generic patterns for unknown languages
        patterns.push(
          { regex: /function\s+(?<name>\w+)/gm, type: 'function' },
          { regex: /class\s+(?<name>\w+)/gm, type: 'class' },
          { regex: /interface\s+(?<name>\w+)/gm, type: 'interface' }
        );
    }
    
    return patterns;
  }
  
  /**
   * Parse dependencies from code
   */
  static parseDependencies(code: string, language: string): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      if (language === 'javascript' || language === 'typescript') {
        // ES6 imports
        const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch && importMatch[1]) {
          const moduleName = importMatch[1];
          dependencies.push({
            name: moduleName,
            type: 'import',
            source: line.trim(),
            line: lineNumber,
            isLocal: moduleName.startsWith('.') || moduleName.startsWith('/')
          });
        }
        
        // CommonJS requires
        const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch && requireMatch[1]) {
          const moduleName = requireMatch[1];
          dependencies.push({
            name: moduleName,
            type: 'require',
            source: line.trim(),
            line: lineNumber,
            isLocal: moduleName.startsWith('.') || moduleName.startsWith('/')
          });
        }
      }
      
      // Add patterns for other languages as needed
    });
    
    return dependencies;
  }
}
