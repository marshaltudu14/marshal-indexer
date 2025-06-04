// import { MarshalChunk } from '../common/types.js';

export function detectClass(line: string, language: string): { name: string } | null {
  const patterns = {
    javascript: /class\s+(\w+)/,
    typescript: /class\s+(\w+)/,
    python: /class\s+(\w+)/,
    java: /class\s+(\w+)/,
    cpp: /class\s+(\w+)/,
    csharp: /class\s+(\w+)/
  };

  const pattern = patterns[language as keyof typeof patterns];
  const match = pattern?.exec(line);
  return match ? { name: match[1]! } : null;
}

export function detectFunction(line: string, language: string): { name: string } | null {
  const patterns = {
    javascript: /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\(|async))/,
    typescript: /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\(|async))/,
    python: /def\s+(\w+)/,
    java: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/,
    cpp: /(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*{/,
    csharp: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/
  };

  const pattern = patterns[language as keyof typeof patterns];
  const match = pattern?.exec(line);
  return match ? { name: match[1] || match[2] || 'unknown' } : null;
}

export function findBlockEnd(lines: string[], startLine: number, _language: string): number {
  let braceCount = 0;
  let foundOpenBrace = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i] || '';

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundOpenBrace = true;
      } else if (char === '}') {
        braceCount--;
        if (foundOpenBrace && braceCount === 0) {
          return i;
        }
      }
    }
  }

  return Math.min(startLine + 50, lines.length - 1); // Fallback
}

export function extractSymbols(content: string, language: string): string[] {
  const symbols: string[] = [];

  // Language-specific symbol extraction
  switch (language) {
    case 'javascript':
    case 'typescript':
      symbols.push(...extractJSSymbols(content));
      break;
    case 'python':
      symbols.push(...extractPythonSymbols(content));
      break;
    case 'java':
    case 'csharp':
      symbols.push(...extractJavaSymbols(content));
      break;
    default:
      symbols.push(...extractGenericSymbols(content));
  }

  return [...new Set(symbols)].filter(s => s && s.length > 1);
}

export function extractJSSymbols(content: string): string[] {
  const symbols: string[] = [];

  // Functions
  const functionMatches = content.match(/(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\(|async)|const\s+(\w+)\s*=)/g);
  if (functionMatches) {
    symbols.push(...functionMatches.map(m => {
      const match = m.match(/(\w+)/);
      return match ? match[1]! : '';
    }).filter(Boolean));
  }

  // Classes
  const classMatches = content.match(/class\s+(\w+)/g);
  if (classMatches) {
    symbols.push(...classMatches.map(m => m.replace('class ', '')));
  }

  // Variables
  const varMatches = content.match(/(?:const|let|var)\s+(\w+)/g);
  if (varMatches) {
    symbols.push(...varMatches.map(m => m.split(/\s+/)[1]!));
  }

  // Methods
  const methodMatches = content.match(/(\w+)\s*\([^)]*\)\s*{/g);
  if (methodMatches) {
    symbols.push(...methodMatches.map(m => {
      const match = m.match(/(\w+)/);
      return match ? match[1]! : '';
    }).filter(Boolean));
  }

  return symbols;
}

export function extractPythonSymbols(content: string): string[] {
  const symbols: string[] = [];

  // Functions
  const functionMatches = content.match(/def\s+(\w+)/g);
  if (functionMatches) {
    symbols.push(...functionMatches.map(m => m.replace('def ', '')));
  }

  // Classes
  const classMatches = content.match(/class\s+(\w+)/g);
  if (classMatches) {
    symbols.push(...classMatches.map(m => m.replace('class ', '')));
  }

  // Variables (simplified)
  const varMatches = content.match(/^(\w+)\s*=/gm);
  if (varMatches) {
    symbols.push(...varMatches.map(m => m.split('=')[0]!.trim()));
  }

  return symbols;
}

export function extractJavaSymbols(content: string): string[] {
  const symbols: string[] = [];

  // Methods
  const methodMatches = content.match(/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/g);
  if (methodMatches) {
    symbols.push(...methodMatches.map(m => {
      const match = m.match(/(\w+)\s*\(/);
      return match ? match[1]! : '';
    }).filter(Boolean));
  }

  // Classes
  const classMatches = content.match(/(?:public|private)?\s*class\s+(\w+)/g);
  if (classMatches) {
    symbols.push(...classMatches.map(m => {
      const match = m.match(/class\s+(\w+)/);
      return match ? match[1]! : '';
    }).filter(Boolean));
  }

  // Fields
  const fieldMatches = content.match(/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*[;=]/g);
  if (fieldMatches) {
    symbols.push(...fieldMatches.map(m => {
      const match = m.match(/(\w+)\s*[;=]/);
      return match ? match[1]! : '';
    }).filter(Boolean));
  }

  return symbols;
}

export function extractGenericSymbols(content: string): string[] {
  const symbols: string[] = [];

  // Generic function pattern
  const functionMatches = content.match(/(\w+)\(/g);
  if (functionMatches) {
    symbols.push(...functionMatches.map(m => m.replace('(', '')));
  }

  // CamelCase identifiers
  const camelCaseMatches = content.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g);
  if (camelCaseMatches) {
    symbols.push(...camelCaseMatches);
  }

  return symbols;
}

export function extractConcepts(content: string, _language: string): string[] {
  const concepts: string[] = [];
  const contentLower = content.toLowerCase();

  // Programming concepts
  const conceptPatterns = [
    'authentication', 'authorization', 'validation', 'error handling',
    'database', 'api', 'service', 'controller', 'model', 'view',
    'component', 'module', 'utility', 'helper', 'configuration',
    'middleware', 'router', 'handler', 'processor', 'manager',
    'factory', 'builder', 'observer', 'singleton', 'strategy',
    'repository', 'adapter', 'facade', 'proxy', 'decorator',
    'cache', 'session', 'cookie', 'token', 'encryption',
    'logging', 'monitoring', 'testing', 'deployment', 'security'
  ];

  for (const concept of conceptPatterns) {
    if (contentLower.includes(concept)) {
      concepts.push(concept);
    }
  }

  // Domain-specific concepts based on file path
  const filePath = contentLower;
  if (filePath.includes('auth')) concepts.push('authentication');
  if (filePath.includes('user')) concepts.push('user management');
  if (filePath.includes('admin')) concepts.push('administration');
  if (filePath.includes('api')) concepts.push('api');
  if (filePath.includes('db') || filePath.includes('database')) concepts.push('database');
  if (filePath.includes('test')) concepts.push('testing');
  if (filePath.includes('util')) concepts.push('utility');

  return [...new Set(concepts)];
}

export function calculateComplexity(content: string, _language: string): number {
  let complexity = 1;

  // Count control structures
  const controlStructures = (content.match(/\b(if|else|for|while|switch|case|try|catch|finally)\b/g) || []).length;
  complexity += controlStructures * 0.5;

  // Count function calls
  const functionCalls = (content.match(/\w+\(/g) || []).length;
  complexity += functionCalls * 0.1;

  // Count nested levels
  const lines = content.split('\n');
  const maxNesting = Math.max(...lines.map(line => {
    const leading = line.match(/^\s*/)?.[0]?.length || 0;
    return Math.floor(leading / 2);
  }));
  complexity += maxNesting * 0.3;

  // Count operators
  const operators = (content.match(/[+\-*/%=<>!&|]/g) || []).length;
  complexity += operators * 0.05;

  return Math.min(complexity, 10); // Cap at 10
}

export function calculateImportance(symbols: string[], concepts: string[], complexity: number): number {
  let importance = 1;

  // More symbols = higher importance
  importance += symbols.length * 0.2;

  // More concepts = higher importance
  importance += concepts.length * 0.3;

  // Higher complexity = higher importance
  importance += complexity * 0.1;

  // Boost for certain symbol patterns
  for (const symbol of symbols) {
    if (symbol.includes('main') || symbol.includes('init')) importance += 0.5;
    if (symbol.includes('test')) importance -= 0.2; // Tests are less important for search
  }

  return Math.min(importance, 5); // Cap at 5
}

export function extractDependencies(content: string, language: string): string[] {
  const deps: string[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
      // ES6 imports
      const importMatches = content.match(/import\s+.*?\s+from\s+['"]([\w\-\.\/]+)['"]/g);
      if (importMatches) {
        deps.push(...importMatches.map(m => {
          const match = m.match(/from\s+['"]([\w\-\.\/]+)['"]/);
          return match ? match[1]! : '';
        }).filter(Boolean));
      }

      // CommonJS requires
      const requireMatches = content.match(/require\s*\(\s*['"]([\w\-\.\/]+)['"]\s*\)/g);
      if (requireMatches) {
        deps.push(...requireMatches.map(m => {
          const match = m.match(/['"]([\w\-\.\/]+)['"]/);
          return match ? match[1]! : '';
        }).filter(Boolean));
      }
      break;

    case 'python':
      // Python imports
      const pyImportMatches = content.match(/(?:import|from)\s+([\w\.]+)/g);
      if (pyImportMatches) {
        deps.push(...pyImportMatches.map(m => {
          const match = m.match(/([\w\.]+)/);
          return match ? match[1]! : '';
        }).filter(Boolean));
      }
      break;

    case 'java':
      // Java imports
      const javaImportMatches = content.match(/import\s+([\w\.]+);/g);
      if (javaImportMatches) {
        deps.push(...javaImportMatches.map(m => {
          const match = m.match(/import\s+([\w\.]+);/);
          return match ? match[1]! : '';
        }).filter(Boolean));
      }
      break;
  }

  return [...new Set(deps)];
}

export function extractExports(content: string, language: string): string[] {
  const exports: string[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
      // ES6 exports
      const exportMatches = content.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*(\w+)/g);
      if (exportMatches) {
        exports.push(...exportMatches.map(m => {
          const match = m.match(/(\w+)$/);
          return match ? match[1]! : '';
        }).filter(Boolean));
      }
      break;

    case 'python':
      // Python __all__
      const allMatch = content.match(/__all__\s*=\s*\[(.*?)\]/s);
      if (allMatch) {
        const items = allMatch[1]!.match(/['"]([\w]+)['"]/g);
        if (items) {
          exports.push(...items.map(item => item.replace(/['"]/g, '')));
        }
      }
      break;

    case 'java':
      // Public classes/methods
      const publicMatches = content.match(/public\s+(?:class|interface)\s+(\w+)/g);
      if (publicMatches) {
        exports.push(...publicMatches.map(m => {
          const match = m.match(/(\w+)$/);
          return match ? match[1]! : '';
        }).filter(Boolean));
      }
      break;
  }

  return [...new Set(exports)];
}

export function findFunctionCalls(content: string): string[] {
  const calls = content.match(/(\w+)\(/g);
  return calls ? [...new Set(calls.map(c => c.replace('(', '')))] : [];
}