/**
 * Type definitions for code analysis
 */

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
  // Enhanced semantic analysis
  semanticContext: SemanticContext;
  codeRelationships: CodeRelationshipMap;
  qualityMetrics: CodeQualityMetrics;
}

// Enhanced semantic context for better understanding
export interface SemanticContext {
  domain: string; // e.g., 'authentication', 'database', 'ui', 'api'
  framework: string[]; // e.g., ['react', 'nextjs', 'supabase']
  patterns: string[]; // e.g., ['hook', 'component', 'service', 'utility']
  concepts: string[]; // e.g., ['user-management', 'data-fetching', 'form-handling']
  businessLogic: string[]; // e.g., ['payment', 'user-registration', 'content-management']
}

// Enhanced code relationship mapping
export interface CodeRelationshipMap {
  dependencies: DependencyInfo[];
  dependents: DependencyInfo[];
  similarFiles: SimilarityInfo[];
  callGraph: CallGraphNode[];
  importGraph: ImportGraphNode[];
}

export interface DependencyInfo {
  filePath: string;
  type: 'import' | 'call' | 'reference' | 'inheritance';
  strength: number; // 0-1 indicating relationship strength
  symbols: string[]; // specific symbols involved
  context: string; // description of the relationship
}

export interface SimilarityInfo {
  filePath: string;
  similarity: number; // 0-1 similarity score
  sharedConcepts: string[];
  sharedPatterns: string[];
}

export interface CallGraphNode {
  function: string;
  calls: string[];
  calledBy: string[];
  complexity: number;
}

export interface ImportGraphNode {
  module: string;
  imports: string[];
  importedBy: string[];
  isExternal: boolean;
}

// Code quality metrics for ranking
export interface CodeQualityMetrics {
  complexity: number; // Cyclomatic complexity
  maintainability: number; // 0-100 maintainability index
  testCoverage: number; // 0-100 test coverage percentage
  documentation: number; // 0-100 documentation coverage
  codeSmells: string[]; // List of detected code smells
  technicalDebt: number; // 0-100 technical debt score
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
  isExported: boolean;
  extends?: string;
}

export interface InterfaceInfo {
  name: string;
  isExported: boolean;
  extends?: string;
}

export interface TypeInfo {
  name: string;
  isExported: boolean;
}

export interface ComponentInfo {
  name: string;
  type: string;
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
