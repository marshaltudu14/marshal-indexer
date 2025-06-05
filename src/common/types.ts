// Core types for the Marshal Context Engine

export interface QueryIntent {
  type: 'function_search' | 'class_search' | 'concept_search' | 'debug_search' | 'implementation_search' | 'pattern_search' | 'architecture_search' | 'usage_search' | 'general';
  confidence: number;
  keywords: string[];
  entities: string[];
  context: string[];
}

export interface ProcessedQuery {
  original: string;
  normalized: string;
  intent: QueryIntent;
  entities: string[];
  keywords: string[];
  expandedQueries: string[];
  context: QueryContext;
  processingTime: number;
}

export interface QueryContext {
  originalQuery: string;
  normalizedQuery: string;
  timestamp: number;
  sessionId: string;
  previousQueries: QueryContext[];
  codebaseContext?: any;
}

export interface IntentFeatures {
  // Lexical features
  queryLength: number;
  wordCount: number;
  avgWordLength: number;

  // Syntactic features
  hasQuestionWords: boolean;
  hasCodePatterns: boolean;
  hasSpecialChars: boolean;

  // Semantic features
  keywords: string[];
  entities: string[];
  concepts: string[];

  // Intent-specific patterns
  actionWords: string[];
  targetWords: string[];
  modifierWords: string[];

  // Contextual features
  contextSimilarity: number;
  previousIntents: string[];

  // Technical features
  programmingLanguage?: string | undefined;
  codeComplexity: number;
  domainSpecificity: number;
}

export interface FusedResult extends SearchResult {
  fusionScore: number;
  rankingFactors: RankingFactor[];
  explanation: string;
  confidence: number;
  source: 'vector' | 'lexical' | 'graph' | 'hybrid';
}

export interface RankingFactor {
  name: string;
  value: number;
  weight: number;
  explanation: string;
}

export interface CodebaseMetadata {
  totalFiles: number;
  totalChunks: number;
  languages: string[];
  commonSymbols?: string[];
  commonPatterns?: string[];
  technologies?: string[];
  architecturalPatterns?: string[];
  frameworksUsed?: string[];
}

export interface CodeRelationship {
  sourceChunkId: string;
  targetChunkId: string;
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'references' | 'similar';
  strength: number;
  context?: string | undefined; // Added context as optional based on marshal-chunker.ts
}

export interface FeedbackData {
  resultId: string;
  feedbackType: 'click' | 'like' | 'dislike' | 'copy' | 'ignore';
  relevanceScore?: number;
  timestamp: number;
}

export interface ClickData {
  resultId: string;
  position: number;
  dwellTime?: number;
  timestamp: number;
}

export interface HierarchicalChunk {
  id: string;
  content: string;
  level: 'line' | 'block' | 'function' | 'class' | 'file';
  parentId?: string;
  childIds: string[];
  metadata: {
    filePath: string;
    startLine: number;
    endLine: number;
    language: string;
    symbols: string[];
    concepts: string[];
    complexity: number;
    importance: number;
    dependencies?: string[]; // Added dependencies as optional based on marshal-chunker.ts
    exports?: string[]; // Added exports as optional based on marshal-chunker.ts
  };
}

export interface MarshalChunk {
  id: string;
  content: string;
  level: 'line' | 'block' | 'function' | 'class' | 'file';
  parentId?: string;
  childIds: string[];
  metadata: {
    filePath: string;
    startLine: number;
    endLine: number;
    language: string;
    symbols: string[];
    concepts: string[];
    complexity: number;
    importance: number;
    dependencies: string[];
    exports: string[];
  };
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  fileHash: string;
  lastModified: number;
  language: string;
  symbols?: string[];
  imports?: string[];
  exports?: string[];
  functions?: FunctionDefinition[];
  classes?: ClassDefinition[];
  interfaces?: InterfaceDefinition[];
  types?: TypeDefinition[];
  concepts?: string[]; // Added concepts
  dependencies?: string[]; // Added dependencies
  metadata?: {
    fileType?: string;
    exports?: string[];
    functions?: string[];
    components?: string[];
    keywords?: string[];
    complexity?: number;
    importance?: number;
    // Enhanced symbol indexing metadata
    symbolDensity?: number;
    codeQuality?: number;
    usageFrequency?: number;
    // Semantic enhancements
    semanticKeywords?: string[];
    codePatterns?: string[];
    frameworkSpecific?: string[];
    // Ranking improvements
    fileImportance?: number;
    codeComplexityScore?: number;
    documentationRatio?: number;
  };
}

// Enhanced symbol definitions for better indexing
export interface FunctionDefinition {
  name: string;
  signature: string;
  parameters: Parameter[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  startLine: number;
  endLine: number;
  complexity: number;
  documentation?: string;
}

export interface ClassDefinition {
  name: string;
  extends?: string;
  implements?: string[];
  methods: FunctionDefinition[];
  properties: PropertyDefinition[];
  isExported: boolean;
  startLine: number;
  endLine: number;
  complexity: number;
  documentation?: string;
}

export interface InterfaceDefinition {
  name: string;
  extends?: string[];
  properties: PropertyDefinition[];
  methods: MethodSignature[];
  isExported: boolean;
  startLine: number;
  endLine: number;
  documentation?: string;
}

export interface TypeDefinition {
  name: string;
  definition: string;
  isExported: boolean;
  startLine: number;
  endLine: number;
  documentation?: string;
}

export interface Parameter {
  name: string;
  type?: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface PropertyDefinition {
  name: string;
  type?: string;
  isOptional: boolean;
  isStatic: boolean;
  visibility: 'public' | 'private' | 'protected';
  documentation?: string;
}

export interface MethodSignature {
  name: string;
  parameters: Parameter[];
  returnType?: string;
  isOptional: boolean;
  documentation?: string;
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  distance: number;
  relevance: number;
  marshalMetadata?: { // Added marshalMetadata
    level?: 'line' | 'block' | 'function' | 'class' | 'file';
    concepts: string[];
    complexity: number;
    importance: number;
    relationships: Array<{
      type: 'calls' | 'imports' | 'extends' | 'implements' | 'references' | 'similar';
      target: string;
      strength: number;
      context: string;
    }>;
  };
}

export interface IndexMetadata {
  version: string;
  totalChunks: number;
  totalFiles: number;
  lastIndexed: number;
  projectPath: string;
  fileHashes?: Record<string, string>; // Made optional as it's not always present
  chunkCount?: number; // Made optional as it's not always present
  indexingTime?: number; // Added indexingTime
  options?: IndexingOptions; // Added options
}

export interface IndexingOptions {
  chunkSize: number;
  maxFileSize: number;
  enableWatching?: boolean;
  excludePatterns?: string[];
}

export interface IndexingProgress {
  phase: 'scanning' | 'parsing' | 'embedding' | 'storing' | 'complete';
  filesProcessed: number;
  totalFiles: number;
  chunksProcessed: number;
  totalChunks: number;
  currentFile?: string;
  errors: string[];
}

export interface FileInfo {
  path: string;
  hash: string;
  lastModified: number;
  size: number;
  language: string;
}

export const DEFAULT_INDEXING_OPTIONS: IndexingOptions = {
  chunkSize: 30,
  maxFileSize: 1024 * 1024, // 1MB
  enableWatching: true,
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**'
  ]
};