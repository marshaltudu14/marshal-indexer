import { MarshalChunk } from '../common/types.js';
import { generateId } from './utils.js';
import { 
  extractSymbols, 
  extractConcepts, 
  calculateComplexity, 
  calculateImportance, 
  extractDependencies, 
  extractExports,
  detectClass,
  detectFunction,
  findBlockEnd
} from './CodeAnalysis.js';

export function createFileChunk(filePath: string, content: string, language: string): MarshalChunk {
  const lines = content.split('\n');
  const symbols = extractSymbols(content, language);
  const concepts = extractConcepts(content, language);
  const complexity = calculateComplexity(content, language);
  
  return {
    id: `file_${generateId(filePath)}`,
    content: content.length > 2000 ? content.substring(0, 2000) + '...' : content,
    level: 'file',
    childIds: [],
    metadata: {
      filePath,
      startLine: 1,
      endLine: lines.length,
      language,
      symbols,
      concepts,
      complexity,
      importance: calculateImportance(symbols, concepts, complexity),
      dependencies: extractDependencies(content, language),
      exports: extractExports(content, language)
    }
  };
}

export function parseCodeStructure(lines: string[], language: string): Array<{
  type: 'class' | 'function' | 'method' | 'block';
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  symbols: string[];
  parentType?: string;
  parentName?: string;
}> {
  const structures: Array<{
    type: 'class' | 'function' | 'method' | 'block';
    name: string;
    startLine: number;
    endLine: number;
    content: string;
    symbols: string[];
    parentType?: string;
    parentName?: string;
  }> = [];

  let currentClass: string | null = null;
  let braceStack: Array<{ type: string; name: string; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    const lineNumber = i + 1;

    // Detect classes
    const classMatch = detectClass(line, language);
    if (classMatch) {
      const endLine = findBlockEnd(lines, i, language);
      const content = lines.slice(i, endLine + 1).join('\n');
      
      structures.push({
        type: 'class',
        name: classMatch.name,
        startLine: lineNumber,
        endLine: endLine + 1,
        content,
        symbols: extractSymbols(content, language)
      });
      
      currentClass = classMatch.name;
      braceStack.push({ type: 'class', name: classMatch.name, line: lineNumber });
      continue;
    }

    // Detect functions/methods
    const functionMatch = detectFunction(line, language);
    if (functionMatch) {
      const endLine = findBlockEnd(lines, i, language);
      const content = lines.slice(i, endLine + 1).join('\n');
      
      if (currentClass) {
        structures.push({
          type: 'method' as const,
          name: functionMatch.name,
          startLine: lineNumber,
          endLine: endLine + 1,
          content,
          symbols: extractSymbols(content, language),
          parentType: 'class',
          parentName: currentClass
        });
      } else {
        structures.push({
          type: 'function' as const,
          name: functionMatch.name,
          startLine: lineNumber,
          endLine: endLine + 1,
          content,
          symbols: extractSymbols(content, language)
        });
      }
      continue;
    }

    // Track brace nesting for context
    if (line.includes('{')) {
      braceStack.push({ type: 'block', name: 'anonymous', line: lineNumber });
    }
    if (line.includes('}')) {
      const closed = braceStack.pop();
      if (closed?.type === 'class') {
        currentClass = null;
      }
    }
  }

  return structures;
}

export function createHierarchicalChunks(
  structures: Array<{
    type: 'class' | 'function' | 'method' | 'block';
    name: string;
    startLine: number;
    endLine: number;
    content: string;
    symbols: string[];
    parentType?: string;
    parentName?: string;
  }>,
  filePath: string,
  language: string,
  fileChunkId: string
): MarshalChunk[] {
  const chunks: MarshalChunk[] = [];
  const chunkMap = new Map<string, MarshalChunk>();

  for (const structure of structures) {
    const chunkId = `${structure.type}_${generateId(filePath + structure.name + structure.startLine)}`;
    const concepts = extractConcepts(structure.content, language);
    const complexity = calculateComplexity(structure.content, language);

    const chunk: MarshalChunk = {
      id: chunkId,
      content: structure.content,
      level: structure.type === 'method' ? 'function' : structure.type,
      childIds: [],
      metadata: {
        filePath,
        startLine: structure.startLine,
        endLine: structure.endLine,
        language,
        symbols: structure.symbols,
        concepts,
        complexity,
        importance: calculateImportance(structure.symbols, concepts, complexity),
        dependencies: extractDependencies(structure.content, language),
        exports: extractExports(structure.content, language)
      }
    };

    // Set parent relationship
    if (structure.parentName) {
      const parentId = `class_${generateId(filePath + structure.parentName)}`;
      chunk.parentId = parentId;
      
      const parent = chunkMap.get(parentId);
      if (parent) {
        parent.childIds.push(chunkId);
      }
    } else {
      chunk.parentId = fileChunkId;
      // File chunk will have its children set later
    }

    chunks.push(chunk);
    chunkMap.set(chunkId, chunk);
  }

  // Create block-level chunks for large functions
  for (const chunk of chunks) {
    if (chunk.level === 'function' && chunk.content.length > 1000) {
      const blockChunks = createBlockChunks(chunk, filePath, language);
      chunks.push(...blockChunks);
    }
  }

  return chunks;
}

export function createBlockChunks(functionChunk: MarshalChunk, filePath: string, language: string): MarshalChunk[] {
  const blocks: MarshalChunk[] = [];
  const lines = functionChunk.content.split('\n');
  const chunkSize = 20; // lines per block
  
  for (let i = 0; i < lines.length; i += chunkSize) {
    const blockLines = lines.slice(i, i + chunkSize);
    const blockContent = blockLines.join('\n');
    
    if (blockContent.trim().length < 50) continue; // Skip tiny blocks
    
    const blockId = `block_${generateId(functionChunk.id + i)}`;
    const symbols = extractSymbols(blockContent, language);
    const concepts = extractConcepts(blockContent, language);
    
    const blockChunk: MarshalChunk = {
      id: blockId,
      content: blockContent,
      level: 'block',
      parentId: functionChunk.id,
      childIds: [],
      metadata: {
        filePath,
        startLine: functionChunk.metadata.startLine + i,
        endLine: functionChunk.metadata.startLine + i + blockLines.length - 1,
        language,
        symbols,
        concepts,
        complexity: calculateComplexity(blockContent, language),
        importance: calculateImportance(symbols, concepts, 1),
        dependencies: extractDependencies(blockContent, language),
        exports: []
      }
    };
    
    blocks.push(blockChunk);
    functionChunk.childIds.push(blockId);
  }
  
  return blocks;
}