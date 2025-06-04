import { MarshalChunk, CodeRelationship } from '../common/types.js';
import { findFunctionCalls } from './CodeAnalysis.js';
// import { generateId } from './utils.js';

export function buildRelationships(
  chunks: MarshalChunk[],
  symbolIndex: Map<string, string[]>,
  conceptIndex: Map<string, string[]>
): CodeRelationship[] {
  const relationships: CodeRelationship[] = [];

  for (const chunk of chunks) {
    // Find function calls and link to their definitions via symbolIndex
    const calls = findFunctionCalls(chunk.content);
    for (const call of calls) {
      const targetChunkIds = symbolIndex.get(call) || [];
      for (const targetId of targetChunkIds) {
        if (targetId !== chunk.id) {
          relationships.push({
            sourceChunkId: chunk.id,
            targetChunkId: targetId,
            type: 'calls',
            strength: 0.8,
            context: `calls ${call}`
          });
        }
      }
    }

    // Find imports/dependencies and link to their definitions via symbolIndex
    for (const dep of chunk.metadata.dependencies) {
      const targetChunkIds = symbolIndex.get(dep) || [];
      for (const targetId of targetChunkIds) {
        relationships.push({
          sourceChunkId: chunk.id,
          targetChunkId: targetId,
          type: 'imports',
          strength: 0.6,
          context: `imports ${dep}`
        });
      }
    }

    // Find similar chunks based on concept overlap
    const similarChunks = findSimilarChunksByConcept(chunk, conceptIndex);
    for (const { chunkId, similarity } of similarChunks) {
      if (similarity > 0.5) {
        relationships.push({
          sourceChunkId: chunk.id,
          targetChunkId: chunkId,
          type: 'similar',
          strength: similarity,
          context: 'conceptual similarity'
        });
      }
    }
  }

  return relationships;
}

function findSimilarChunksByConcept(
  sourceChunk: MarshalChunk,
  conceptIndex: Map<string, string[]>
): Array<{ chunkId: string; similarity: number }> {
  const similar: Array<{ chunkId: string; similarity: number }> = [];
  const candidateChunkIds = new Set<string>();

  // Collect all chunks that share at least one concept with the source chunk
  for (const concept of sourceChunk.metadata.concepts) {
    const chunkIdsWithConcept = conceptIndex.get(concept) || [];
    for (const chunkId of chunkIdsWithConcept) {
      if (chunkId !== sourceChunk.id) {
        candidateChunkIds.add(chunkId);
      }
    }
  }

  // Calculate similarity for candidate chunks
  for (const chunkId of candidateChunkIds) {
    // Reconstruct the chunk from the concept index (this is a simplification, in a real scenario
    // you'd fetch the full chunk from a global chunk store)
    // For now, we'll just use the concept overlap as a proxy for similarity
    const targetChunkConcepts = Array.from(conceptIndex.entries())
      .filter(([_concept, ids]) => ids.includes(chunkId))
      .map(([concept, _ids]) => concept);

    const conceptOverlap = sourceChunk.metadata.concepts.filter(c =>
      targetChunkConcepts.includes(c)
    ).length;

    const totalConcepts = new Set([
      ...sourceChunk.metadata.concepts,
      ...targetChunkConcepts
    ]).size;

    let similarity = 0;
    if (totalConcepts > 0) {
      similarity = conceptOverlap / totalConcepts;
    }

    if (similarity > 0.2) {
      similar.push({ chunkId, similarity });
    }
  }

  return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}