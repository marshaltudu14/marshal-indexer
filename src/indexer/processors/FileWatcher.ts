import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { isCodeFile } from '../../utils.js';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
}

/**
 * File watcher for auto-updating the index when files change
 */
export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private isWatching = false;
  private projectPath: string;
  private debounceMap: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceDelay = 500; // 500ms debounce

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
  }

  /**
   * Start watching for file changes
   */
  startWatching(): void {
    if (this.isWatching) {
      console.log('📁 File watcher is already running');
      return;
    }

    console.log('👀 Starting file watcher...');

    this.watcher = watch(this.projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/.nyc_output/**',
        '**/tmp/**',
        '**/temp/**',
        '**/*.log',
        '**/.DS_Store',
        '**/Thumbs.db',
        // Ignore the indexer directory itself to prevent infinite loops
        '**/custom-indexer/**'
      ],
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('add', (filePath: string) => {
      if (isCodeFile(filePath)) {
        this.debounceFileChange('add', filePath);
      }
    });

    this.watcher.on('change', (filePath: string) => {
      if (isCodeFile(filePath)) {
        this.debounceFileChange('change', filePath);
      }
    });

    this.watcher.on('unlink', (filePath: string) => {
      if (isCodeFile(filePath)) {
        this.debounceFileChange('unlink', filePath);
      }
    });

    this.watcher.on('error', (error) => {
      console.error('❌ File watcher error:', error);
      this.emit('error', error);
    });

    this.watcher.on('ready', () => {
      console.log('✅ File watcher ready');
      this.isWatching = true;
      this.emit('ready');
    });
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      return;
    }

    console.log('🛑 Stopping file watcher...');

    // Clear all pending debounced operations
    for (const timeout of this.debounceMap.values()) {
      clearTimeout(timeout);
    }
    this.debounceMap.clear();

    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;

    console.log('✅ File watcher stopped');
  }

  /**
   * Check if currently watching
   */
  getIsWatching(): boolean {
    return this.isWatching;
  }

  /**
   * Debounce file changes to avoid excessive processing
   */
  private debounceFileChange(type: 'add' | 'change' | 'unlink', filePath: string): void {
    // Clear existing timeout for this file
    const existingTimeout = this.debounceMap.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.debounceMap.delete(filePath);
      this.emit('fileChange', { type, filePath } as FileChangeEvent);
    }, this.debounceDelay);

    this.debounceMap.set(filePath, timeout);
  }

  /**
   * Get watcher statistics
   */
  getStats(): {
    isWatching: boolean;
    pendingChanges: number;
    watchedPath: string;
  } {
    return {
      isWatching: this.isWatching,
      pendingChanges: this.debounceMap.size,
      watchedPath: this.projectPath
    };
  }
}
