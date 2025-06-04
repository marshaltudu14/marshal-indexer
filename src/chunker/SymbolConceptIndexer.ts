import { MarshalChunk } from '../common/types.js';

export function indexSymbolsAndConcepts(
  chunks: MarshalChunk[], 
  symbolIndex: Map<string, string[]>, 
  conceptIndex: Map<string, string[]>
): void {
  for (const chunk of chunks) {
    // Index symbols
    for (const symbol of chunk.metadata.symbols) {
      if (!symbolIndex.has(symbol)) {
        symbolIndex.set(symbol, []);
      }
      symbolIndex.get(symbol)!.push(chunk.id);
    }

    // Index concepts
    for (const concept of chunk.metadata.concepts) {
      if (!conceptIndex.has(concept)) {
        conceptIndex.set(concept, []);
      }
      conceptIndex.get(concept)!.push(chunk.id);
    }
  }
}