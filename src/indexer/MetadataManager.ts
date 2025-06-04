import { promises as fs } from 'fs';
import { join } from 'path';
import { IndexMetadata, IndexingOptions } from '../common/types.js';
import { fileExists } from '../utils.js';

export class MetadataManager {
  private projectPath: string;
  private options: IndexingOptions;

  constructor(projectPath: string, options: IndexingOptions) {
    this.projectPath = projectPath;
    this.options = options;
  }

  createDefaultMetadata(): IndexMetadata {
    return {
      version: '2.0.0',
      projectPath: this.projectPath,
      lastIndexed: 0,
      totalFiles: 0,
      totalChunks: 0,
      indexingTime: 0,
      options: this.options
    };
  }

  async loadMetadata(): Promise<IndexMetadata> {
    const metadataPath = join(this.projectPath, '.marshal-metadata.json');
    let metadata: IndexMetadata = this.createDefaultMetadata();

    try {
      if (await fileExists(metadataPath)) {
        const content = await fs.readFile(metadataPath, 'utf-8');
        metadata = { ...metadata, ...JSON.parse(content) };
      }
    } catch (error) {
      console.warn(`⚠️ Could not load metadata: ${error}`);
      metadata = this.createDefaultMetadata();
    }
    return metadata;
  }

  async saveMetadata(metadata: IndexMetadata): Promise<void> {
    const metadataPath = join(this.projectPath, '.marshal-metadata.json');
    
    try {
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.warn(`⚠️ Could not save metadata: ${error}`);
    }
  }
}