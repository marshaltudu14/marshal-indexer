// Remove unused import

/**
 * Contextual analyzer that mimics Augment's understanding of code relationships
 */
export class ContextualAnalyzer {
  
  /**
   * Analyze code structure and extract semantic information
   */
  analyzeCodeStructure(content: string, filePath: string): CodeStructureInfo {
    const structure: CodeStructureInfo = {
      fileType: this.determineFileType(filePath),
      exports: this.extractExports(content),
      imports: this.extractImports(content),
      functions: this.extractFunctions(content),
      classes: this.extractClasses(content),
      interfaces: this.extractInterfaces(content),
      types: this.extractTypes(content),
      components: this.extractReactComponents(content),
      routes: this.extractRoutes(content, filePath),
      schemas: this.extractSchemas(content),
      hooks: this.extractHooks(content),
      apis: this.extractApiEndpoints(content, filePath),
      keywords: this.extractSemanticKeywords(content, filePath),
      complexity: this.calculateComplexity(content),
      importance: this.calculateImportance(content, filePath)
    };

    return structure;
  }

  /**
   * Determine file type and purpose
   */
  private determineFileType(filePath: string): FileType {
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

  /**
   * Extract export statements and their types
   */
  private extractExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    
    // Default exports
    const defaultExportMatches = content.match(/export\s+default\s+(?:function\s+)?(\w+)/g) || [];
    for (const match of defaultExportMatches) {
      const name = match.match(/(\w+)$/)?.[1];
      if (name) {
        exports.push({ name, type: 'default', isFunction: match.includes('function') });
      }
    }

    // Named exports
    const namedExportMatches = content.match(/export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g) || [];
    for (const match of namedExportMatches) {
      const name = match.match(/(\w+)$/)?.[1];
      const type = match.includes('function') ? 'function' : 
                   match.includes('class') ? 'class' :
                   match.includes('interface') ? 'interface' :
                   match.includes('type') ? 'type' : 'variable';
      if (name) {
        exports.push({ name, type, isFunction: type === 'function' });
      }
    }

    // Export lists
    const exportListMatches = content.match(/export\s*\{\s*([^}]+)\s*\}/g) || [];
    for (const match of exportListMatches) {
      const namesMatch = match.match(/\{\s*([^}]+)\s*\}/);
      if (namesMatch && namesMatch[1]) {
        const names = namesMatch[1]
          .split(',')
          .map(n => {
            const parts = n.trim().split(/\s+as\s+/);
            return parts[0]?.trim() || '';
          })
          .filter(n => n);

        for (const name of names) {
          exports.push({ name, type: 'named', isFunction: false });
        }
      }
    }

    return exports;
  }

  /**
   * Extract import statements
   */
  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    
    const importMatches = content.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g) || [];
    for (const match of importMatches) {
      const source = match.match(/from\s+['"`]([^'"`]+)['"`]/)?.[1];
      const importedItems = match.match(/import\s+(.+?)\s+from/)?.[1];
      
      if (source && importedItems) {
        let items: string[] = [];
        if (importedItems.includes('{')) {
          const match = importedItems.match(/\{([^}]+)\}/);
          if (match && match[1]) {
            items = match[1].split(',').map(s => s.trim());
          }
        } else {
          items = [importedItems.trim()];
        }

        imports.push({
          source,
          items,
          isDefault: !importedItems.includes('{')
        });
      }
    }

    return imports;
  }

  /**
   * Extract function definitions
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    
    // Regular functions
    const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g) || [];
    for (const match of functionMatches) {
      const name = match.match(/function\s+(\w+)/)?.[1];
      if (name) {
        functions.push({
          name,
          isAsync: match.includes('async'),
          isExported: match.includes('export')
        });
      }
    }

    // Arrow functions
    const arrowMatches = content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g) || [];
    for (const match of arrowMatches) {
      const name = match.match(/const\s+(\w+)/)?.[1];
      if (name) {
        functions.push({
          name,
          isAsync: match.includes('async'),
          isExported: match.includes('export')
        });
      }
    }

    return functions;
  }

  /**
   * Extract class definitions
   */
  private extractClasses(content: string): ClassInfo[] {
    const classes: ClassInfo[] = [];
    
    const classMatches = content.match(/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g) || [];
    for (const match of classMatches) {
      const name = match.match(/class\s+(\w+)/)?.[1];
      const extends_ = match.match(/extends\s+(\w+)/)?.[1];
      
      if (name) {
        const classInfo: ClassInfo = {
          name,
          isExported: match.includes('export')
        };
        if (extends_) {
          classInfo.extends = extends_;
        }
        classes.push(classInfo);
      }
    }

    return classes;
  }

  /**
   * Extract interface definitions
   */
  private extractInterfaces(content: string): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];
    
    const interfaceMatches = content.match(/(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?/g) || [];
    for (const match of interfaceMatches) {
      const name = match.match(/interface\s+(\w+)/)?.[1];
      const extends_ = match.match(/extends\s+([^{]+)/)?.[1]?.trim();
      
      if (name) {
        const interfaceInfo: InterfaceInfo = {
          name,
          isExported: match.includes('export')
        };
        if (extends_) {
          interfaceInfo.extends = extends_;
        }
        interfaces.push(interfaceInfo);
      }
    }

    return interfaces;
  }

  /**
   * Extract type definitions
   */
  private extractTypes(content: string): TypeInfo[] {
    const types: TypeInfo[] = [];
    
    const typeMatches = content.match(/(?:export\s+)?type\s+(\w+)\s*=/g) || [];
    for (const match of typeMatches) {
      const name = match.match(/type\s+(\w+)/)?.[1];
      if (name) {
        types.push({
          name,
          isExported: match.includes('export')
        });
      }
    }

    return types;
  }

  /**
   * Extract React components
   */
  private extractReactComponents(content: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    
    // Function components
    const funcComponentMatches = content.match(/(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/g) || [];
    for (const match of funcComponentMatches) {
      const name = match.match(/function\s+([A-Z]\w+)/)?.[1];
      if (name) {
        components.push({
          name,
          type: 'function',
          isExported: match.includes('export')
        });
      }
    }

    // Arrow function components
    const arrowComponentMatches = content.match(/(?:export\s+)?const\s+([A-Z]\w+)\s*[=:][^=]*=>\s*[({]/g) || [];
    for (const match of arrowComponentMatches) {
      const name = match.match(/const\s+([A-Z]\w+)/)?.[1];
      if (name) {
        components.push({
          name,
          type: 'arrow',
          isExported: match.includes('export')
        });
      }
    }

    return components;
  }

  /**
   * Extract route definitions (Next.js specific)
   */
  private extractRoutes(content: string, filePath: string): RouteInfo[] {
    const routes: RouteInfo[] = [];
    
    // Next.js API routes
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        if (content.includes(`export async function ${method}`) || content.includes(`export function ${method}`)) {
          routes.push({
            method,
            path: filePath,
            isApi: true
          });
        }
      }
    }

    // Next.js page routes
    if (filePath.includes('/page.') || filePath.includes('\\page.')) {
      routes.push({
        method: 'GET',
        path: filePath,
        isApi: false
      });
    }

    return routes;
  }

  /**
   * Extract schema definitions (Zod, Joi, etc.)
   */
  private extractSchemas(content: string): SchemaInfo[] {
    const schemas: SchemaInfo[] = [];
    
    // Zod schemas
    const zodMatches = content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*z\./g) || [];
    for (const match of zodMatches) {
      const name = match.match(/const\s+(\w+)/)?.[1];
      if (name) {
        schemas.push({
          name,
          type: 'zod',
          isExported: match.includes('export')
        });
      }
    }

    return schemas;
  }

  /**
   * Extract React hooks
   */
  private extractHooks(content: string): HookInfo[] {
    const hooks: HookInfo[] = [];
    
    const hookMatches = content.match(/(?:export\s+)?(?:const|function)\s+(use[A-Z]\w*)/g) || [];
    for (const match of hookMatches) {
      const name = match.match(/(use[A-Z]\w*)/)?.[1];
      if (name) {
        hooks.push({
          name,
          isExported: match.includes('export')
        });
      }
    }

    return hooks;
  }

  /**
   * Extract API endpoint information
   */
  private extractApiEndpoints(content: string, _filePath: string): ApiInfo[] {
    const apis: ApiInfo[] = [];
    
    // Look for fetch calls, axios calls, etc.
    const fetchMatches = content.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
    for (const match of fetchMatches) {
      const url = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
      if (url) {
        apis.push({
          url,
          method: 'unknown',
          type: 'fetch'
        });
      }
    }

    return apis;
  }

  /**
   * Extract semantic keywords based on content and context
   */
  private extractSemanticKeywords(content: string, filePath: string): string[] {
    const keywords = new Set<string>();
    
    // Add file type keywords
    const fileType = this.determineFileType(filePath);
    keywords.add(fileType);
    
    // Add framework keywords
    if (content.includes('React') || content.includes('jsx') || content.includes('tsx')) {
      keywords.add('react');
    }
    if (content.includes('Next') || filePath.includes('next')) {
      keywords.add('nextjs');
    }
    if (content.includes('Supabase') || content.includes('supabase')) {
      keywords.add('supabase');
    }
    
    // Add domain keywords
    if (content.includes('auth') || content.includes('login') || content.includes('signup')) {
      keywords.add('authentication');
    }
    if (content.includes('database') || content.includes('sql') || content.includes('query')) {
      keywords.add('database');
    }
    if (content.includes('api') || content.includes('endpoint') || content.includes('route')) {
      keywords.add('api');
    }
    
    return Array.from(keywords);
  }

  /**
   * Calculate code complexity score
   */
  private calculateComplexity(content: string): number {
    let complexity = 0;
    
    // Count control structures
    complexity += (content.match(/\b(if|else|for|while|switch|case)\b/g) || []).length;
    
    // Count functions
    complexity += (content.match(/\bfunction\b/g) || []).length;
    complexity += (content.match(/=>\s*[{(]/g) || []).length;
    
    // Count classes and interfaces
    complexity += (content.match(/\b(class|interface)\b/g) || []).length;
    
    return complexity;
  }

  /**
   * Calculate importance score based on various factors
   */
  private calculateImportance(content: string, filePath: string): number {
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
    
    return importance;
  }
}

// Type definitions
export type FileType = 'api' | 'component' | 'page' | 'utility' | 'types' | 'hook' | 'action' | 'middleware' | 'schema' | 'config' | 'test' | 'other';

export interface CodeStructureInfo {
  fileType: FileType;
  exports: ExportInfo[];
  imports: ImportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  components: ComponentInfo[];
  routes: RouteInfo[];
  schemas: SchemaInfo[];
  hooks: HookInfo[];
  apis: ApiInfo[];
  keywords: string[];
  complexity: number;
  importance: number;
}

export interface ExportInfo {
  name: string;
  type: string;
  isFunction: boolean;
}

export interface ImportInfo {
  source: string;
  items: string[];
  isDefault: boolean;
}

export interface FunctionInfo {
  name: string;
  isAsync: boolean;
  isExported: boolean;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  isExported: boolean;
}

export interface InterfaceInfo {
  name: string;
  extends?: string;
  isExported: boolean;
}

export interface TypeInfo {
  name: string;
  isExported: boolean;
}

export interface ComponentInfo {
  name: string;
  type: 'function' | 'arrow' | 'class';
  isExported: boolean;
}

export interface RouteInfo {
  method: string;
  path: string;
  isApi: boolean;
}

export interface SchemaInfo {
  name: string;
  type: string;
  isExported: boolean;
}

export interface HookInfo {
  name: string;
  isExported: boolean;
}

export interface ApiInfo {
  url: string;
  method: string;
  type: string;
}
