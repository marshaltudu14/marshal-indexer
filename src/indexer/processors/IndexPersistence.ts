import { promises as fs } from 'fs';
import { join } from 'path';
import { CodeChunk } from '../../common/types.js';
import { CodeStructureInfo } from '../ContextualAnalyzerNew.js';

export interface IndexData {
  chunks: CodeChunk[];
  codeStructures: Map<string, CodeStructureInfo>;
  termFrequency: Map<string, Map<string, number>>;
  documentFrequency: Map<string, number>;
  chunkTerms: Map<string, Set<string>>;
  metadata: {
    version: string;
    createdAt: number;
    totalFiles: number;
    totalChunks: number;
  };
}

/**
 * Index persistence manager for saving and loading index data
 */
export class IndexPersistence {
  private indexDir: string;

  constructor(indexDir: string) {
    this.indexDir = indexDir;
  }

  /**
   * Save index data to disk
   */
  async saveIndex(data: IndexData): Promise<void> {
    console.log('💾 Saving index to disk...');
    const startTime = Date.now();

    await fs.mkdir(this.indexDir, { recursive: true });

    // Convert Maps and Sets to serializable format
    const serializable = {
      chunks: data.chunks,
      codeStructures: this.mapToObject(data.codeStructures),
      termFrequency: this.nestedMapToObject(data.termFrequency),
      documentFrequency: this.mapToObject(data.documentFrequency),
      chunkTerms: this.mapSetToObject(data.chunkTerms),
      metadata: data.metadata
    };

    const indexPath = join(this.indexDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(serializable, null, 2));

    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ Index saved in ${duration.toFixed(1)}s`);
  }

  /**
   * Load index data from disk
   */
  async loadIndex(): Promise<IndexData | null> {
    try {
      console.log('📂 Loading index from disk...');
      const startTime = Date.now();

      const indexPath = join(this.indexDir, 'index.json');
      const content = await fs.readFile(indexPath, 'utf-8');
      const serialized = JSON.parse(content);

      // Convert back to Maps and Sets
      const data: IndexData = {
        chunks: serialized.chunks,
        codeStructures: this.objectToMap(serialized.codeStructures),
        termFrequency: this.objectToNestedMap(serialized.termFrequency),
        documentFrequency: this.objectToMap(serialized.documentFrequency),
        chunkTerms: this.objectToMapSet(serialized.chunkTerms),
        metadata: serialized.metadata
      };

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Index loaded in ${duration.toFixed(1)}s`);

      return data;
    } catch (error) {
      console.log('📂 No existing index found or failed to load');
      return null;
    }
  }

  /**
   * Check if index exists
   */
  async indexExists(): Promise<boolean> {
    try {
      const indexPath = join(this.indexDir, 'index.json');
      await fs.access(indexPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete index
   */
  async deleteIndex(): Promise<void> {
    try {
      const indexPath = join(this.indexDir, 'index.json');
      await fs.unlink(indexPath);
      console.log('🗑️ Index deleted');
    } catch (error) {
      console.log('🗑️ No index to delete');
    }
  }

  /**
   * Get index metadata
   */
  async getIndexMetadata(): Promise<any | null> {
    try {
      const indexPath = join(this.indexDir, 'index.json');
      const content = await fs.readFile(indexPath, 'utf-8');
      const data = JSON.parse(content);
      return data.metadata;
    } catch {
      return null;
    }
  }

  /**
   * Convert Map to plain object
   */
  private mapToObject<T>(map: Map<string, T>): Record<string, T> {
    const obj: Record<string, T> = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Convert nested Map to plain object
   */
  private nestedMapToObject(map: Map<string, Map<string, number>>): Record<string, Record<string, number>> {
    const obj: Record<string, Record<string, number>> = {};
    for (const [key, innerMap] of map) {
      obj[key] = this.mapToObject(innerMap);
    }
    return obj;
  }

  /**
   * Convert Map<string, Set<string>> to plain object
   */
  private mapSetToObject(map: Map<string, Set<string>>): Record<string, string[]> {
    const obj: Record<string, string[]> = {};
    for (const [key, set] of map) {
      obj[key] = Array.from(set);
    }
    return obj;
  }

  /**
   * Convert plain object to Map
   */
  private objectToMap<T>(obj: Record<string, T>): Map<string, T> {
    const map = new Map<string, T>();
    for (const [key, value] of Object.entries(obj)) {
      map.set(key, value);
    }
    return map;
  }

  /**
   * Convert plain object to nested Map
   */
  private objectToNestedMap(obj: Record<string, Record<string, number>>): Map<string, Map<string, number>> {
    const map = new Map<string, Map<string, number>>();
    for (const [key, innerObj] of Object.entries(obj)) {
      map.set(key, this.objectToMap(innerObj));
    }
    return map;
  }

  /**
   * Convert plain object to Map<string, Set<string>>
   */
  private objectToMapSet(obj: Record<string, string[]>): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const [key, array] of Object.entries(obj)) {
      map.set(key, new Set(array));
    }
    return map;
  }
}
