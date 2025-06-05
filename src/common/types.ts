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
  functions?: string[];
  classes?: string[];
  interfaces?: string[];
  types?: string[];
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
  };
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
  chunkOverlap: number;
  maxFileSize: number;
  supportedExtensions: string[];
  ignorePatterns: string[];
  includeSymbols: boolean;
  includeDependencies: boolean;
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
  chunkSize: 1024,
  chunkOverlap: 100,
  maxFileSize: 2 * 1024 * 1024,
  supportedExtensions: [
    '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp',
    '.cs', '.php', '.rb', '.go', '.rs', '.swift',
    '.kt', '.scala', '.clj', '.hs', '.ml', '.fs',
    '.css', '.scss', '.sass', '.less', '.styl',
    '.html', '.htm', '.xml', '.svg',
    '.json', '.yaml', '.yml', '.toml', '.ini',
    '.md', '.mdx', '.txt', '.rst', '.adoc',
    '.sql', '.graphql', '.gql', '.proto',
    '.sh', '.bash', '.zsh', '.fish', '.ps1',
    '.dockerfile', '.docker', '.makefile'
  ],
  ignorePatterns: [
    // Dependencies and package managers
    'node_modules/**',
    'bower_components/**',
    'vendor/**',
    'packages/**',

    // Version control
    '.git/**',
    '.svn/**',
    '.hg/**',

    // Build outputs and generated files
    'dist/**',
    'build/**',
    'out/**',
    '.next/**',
    '.nuxt/**',
    '.vite/**',
    '.turbo/**',
    'target/**',
    'bin/**',
    'obj/**',

    // Cache and temporary files
    '.cache/**',
    '.temp/**',
    '.tmp/**',
    '.nyc_output/**',
    'coverage/**',
    '.coverage/**',
    'htmlcov/**',

    // IDE and editor files
    '.vscode/**',
    '.idea/**',
    '.vs/**',
    '*.swp',
    '*.swo',
    '*~',

    // OS files
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',

    // Logs and debugging
    '*.log',
    'logs/**',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',

    // Lock files and generated configs
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.lock',
    'Pipfile.lock',
    'poetry.lock',

    // Minified and compiled files
    '*.min.js',
    '*.min.css',
    '*.map',
    '*.d.ts', // TypeScript declaration files (usually generated)

    // Environment and secrets
    '.env*',
    '*.key',
    '*.pem',
    '*.p12',

    // Custom indexer files (don't index ourselves)
    'custom-indexer/**',
    'ultra-fast-index/**',
    '.indexer-metadata.json',

    // Large media files that don't contain searchable code
    '*.jpg',
    '*.jpeg',
    '*.png',
    '*.gif',
    '*.webp',
    '*.svg',
    '*.ico',
    '*.mp4',
    '*.mp3',
    '*.wav',
    '*.pdf',
    '*.zip',
    '*.tar.gz',
    '*.rar',

    // Documentation that's usually not code (but keep some)
    'docs/**',
    'documentation/**',
    'CHANGELOG.md',
    'LICENSE*',
    'CONTRIBUTING.md',
  ],
  includeSymbols: true,
  includeDependencies: true
};