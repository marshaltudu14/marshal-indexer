import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { extname, relative, resolve } from 'path';
import ignore from 'ignore';
import { FileInfo } from './types.js';

/**
 * Calculate MD5 hash of file content
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return createHash('md5').update(content).digest('hex');
  } catch (error) {
    throw new Error(`Failed to calculate hash for ${filePath}: ${error}`);
  }
}

/**
 * Calculate hash of string content
 */
export function calculateContentHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Get file language based on extension
 */
export function getFileLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.clj': 'clojure',
    '.hs': 'haskell',
    '.ml': 'ocaml',
    '.fs': 'fsharp',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.styl': 'stylus',
    '.html': 'html',
    '.htm': 'html',
    '.xml': 'xml',
    '.svg': 'svg',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.md': 'markdown',
    '.mdx': 'markdown',
    '.txt': 'text',
    '.rst': 'restructuredtext',
    '.adoc': 'asciidoc',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.proto': 'protobuf',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.fish': 'shell',
    '.ps1': 'powershell',
    '.dockerfile': 'dockerfile',
    '.docker': 'dockerfile'
  };
  
  return languageMap[ext] || 'text';
}

/**
 * Check if file should be processed based on extension and ignore patterns
 */
export function shouldProcessFile(
  filePath: string, 
  supportedExtensions: string[], 
  ignorePatterns: string[],
  projectRoot: string
): boolean {
  const ext = extname(filePath).toLowerCase();
  if (!supportedExtensions.includes(ext)) {
    return false;
  }

  const relativePath = relative(projectRoot, filePath);
  const ig = ignore().add(ignorePatterns);
  
  return !ig.ignores(relativePath);
}

/**
 * Recursively get all files in directory
 */
export async function getAllFiles(
  dirPath: string,
  supportedExtensions: string[],
  ignorePatterns: string[]
): Promise<string[]> {
  const files: string[] = [];
  const resolvedPath = resolve(dirPath);
  
  async function walkDir(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = resolve(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          if (shouldProcessFile(fullPath, ['.dir'], ignorePatterns, resolvedPath)) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile()) {
          if (shouldProcessFile(fullPath, supportedExtensions, ignorePatterns, resolvedPath)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${currentPath}: ${error}`);
    }
  }
  
  await walkDir(resolvedPath);
  return files;
}

/**
 * Get file information
 */
export async function getFileInfo(filePath: string): Promise<FileInfo> {
  const stats = await fs.stat(filePath);
  const hash = await calculateFileHash(filePath);
  const language = getFileLanguage(filePath);
  
  return {
    path: filePath,
    hash,
    lastModified: stats.mtime.getTime(),
    size: stats.size,
    language
  };
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  // For code, it's usually less dense, so we use 3 characters per token
  return Math.ceil(text.length / 3);
}

/**
 * Split text into chunks with overlap
 */
export function splitTextIntoChunks(
  text: string,
  maxTokens: number,
  overlap: number = 50
): Array<{ content: string; startLine: number; endLine: number }> {
  const lines = text.split('\n');
  const chunks: Array<{ content: string; startLine: number; endLine: number }> = [];
  
  let currentChunk: string[] = [];
  let currentTokens = 0;
  let chunkStartLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const lineTokens = estimateTokenCount(line);

    if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.join('\n'),
        startLine: chunkStartLine,
        endLine: chunkStartLine + currentChunk.length - 1
      });

      // Start new chunk with overlap
      const overlapLines = Math.min(overlap, currentChunk.length);
      currentChunk = currentChunk.slice(-overlapLines);
      chunkStartLine = chunkStartLine + currentChunk.length - overlapLines;
      currentTokens = currentChunk.reduce((sum, l) => sum + estimateTokenCount(l || ''), 0);
    }

    currentChunk.push(line);
    currentTokens += lineTokens;
  }
  
  // Add final chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      startLine: chunkStartLine,
      endLine: chunkStartLine + currentChunk.length - 1
    });
  }
  
  return chunks;
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex] || 'B'}`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
