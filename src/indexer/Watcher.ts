import * as chokidar from 'chokidar';
import { relative } from 'path';
import { IndexingOptions } from '../common/types.js';
import { shouldProcessFile } from '../utils.js';
import { DataStore } from './DataStore.js';

export class Watcher {
  private projectPath: string;
  private options: IndexingOptions;
  private dataStore: DataStore;
  private watcher: chokidar.FSWatcher | undefined;

  constructor(projectPath: string, options: IndexingOptions, dataStore: DataStore) {
    this.projectPath = projectPath;
    this.options = options;
    this.dataStore = dataStore;
  }

  async startWatching(): Promise<void> {
    if (this.watcher) {
      return;
    }

    console.log('👀 Starting Marshal file watcher...');
    
    this.watcher = chokidar.watch(this.projectPath, {
      ignored: this.options.ignorePatterns,
      ignoreInitial: true,
      persistent: true
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'modified'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'deleted'));

    console.log('✅ Marshal watcher started');
  }

  private async handleFileChange(filePath: string, changeType: 'added' | 'modified' | 'deleted'): Promise<void> {
    const relativePath = relative(this.projectPath, filePath);
    
    if (!shouldProcessFile(filePath, this.options.supportedExtensions, this.options.ignorePatterns, this.projectPath)) {
      return;
    }

    console.log(`📝 File ${changeType}: ${relativePath}`);

    try {
      if (changeType === 'deleted') {
        await this.dataStore.removeFile(filePath);
      } else {
        await this.dataStore.updateFile(filePath);
      }
    } catch (error) {
      console.error(`❌ Error handling file change for ${relativePath}: ${error}`);
    }
  }

  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      console.log('⏹️ Marshal watcher stopped');
    }
  }
}