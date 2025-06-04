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
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  distance: number;
  relevance: number;
}

export interface IndexMetadata {
  version: string;
  totalChunks: number;
  totalFiles: number;
  lastIndexed: number;
  projectPath: string;
  fileHashes: Record<string, string>;
  chunkCount: number;
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

export interface SearchOptions {
  topK: number;
  minScore: number;
  includeContent: boolean;
  filterByLanguage?: string;
  filterByPath?: string;
  contextLines: number;
}

export interface FileInfo {
  path: string;
  hash: string;
  lastModified: number;
  size: number;
  language: string;
}

export interface EmbeddingModel {
  name: string;
  dimension: number;
  maxTokens: number;
}

export interface MCPRequest {
  method: string;
  params?: any;
  id?: string | number;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id?: string | number;
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

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'import' | 'export';
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface DependencyInfo {
  name: string;
  type: 'import' | 'require';
  source: string;
  line: number;
  isLocal: boolean;
}

export const DEFAULT_INDEXING_OPTIONS: IndexingOptions = {
  chunkSize: 1024, // Increased for better performance
  chunkOverlap: 100, // Proportionally increased
  maxFileSize: 2 * 1024 * 1024, // 2MB - increased limit
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
    'node_modules/**',
    'dist/**',
    'build/**',
    '.next/**',
    '.nuxt/**',
    'coverage/**',
    '.git/**',
    '.vscode/**',
    '.idea/**',
    '*.min.js',
    '*.min.css',
    '*.map',
    '*.log',
    '.env*',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'custom-indexer/embeddings/**', // Ignore indexer's own files
    '.indexer-metadata.json' // Ignore metadata file
  ],
  includeSymbols: true,
  includeDependencies: true
};

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  topK: 10,
  minScore: 0.1,
  includeContent: true,
  contextLines: 3
};

export const EMBEDDING_MODEL: EmbeddingModel = {
  name: 'sentence-transformers/all-MiniLM-L6-v2',
  dimension: 384,
  maxTokens: 512
};
