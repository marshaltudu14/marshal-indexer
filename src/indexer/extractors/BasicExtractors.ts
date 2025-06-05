import { 
  ExportInfo, 
  ImportInfo, 
  FunctionInfo, 
  ClassInfo, 
  InterfaceInfo, 
  TypeInfo,
  FileType 
} from '../types/AnalyzerTypes.js';

/**
 * Basic code element extractors
 */
export class BasicExtractors {

  /**
   * Determine file type and purpose
   */
  static determineFileType(filePath: string): FileType {
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
  static extractExports(content: string): ExportInfo[] {
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
  static extractImports(content: string): ImportInfo[] {
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
  static extractFunctions(content: string): FunctionInfo[] {
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
  static extractClasses(content: string): ClassInfo[] {
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
  static extractInterfaces(content: string): InterfaceInfo[] {
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
  static extractTypes(content: string): TypeInfo[] {
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
}
