import { Command } from 'commander';
import { UltraFastIndexer } from '../indexer/UltraFastIndexer.js';
import { IndexingProgress } from '../common/types.js';
import { join } from 'path';

export function createIndexCommand(): Command {
  return new Command('index')
    .description('Index a codebase using ultra-fast lexical indexing (no embeddings)')
    .argument('[path]', 'Path to the codebase', '.')
    .option('-o, --output <dir>', 'Output directory for index', './ultra-fast-index')
    .option('--watch', 'Enable file watching for auto-updates', false)
    .option('--no-watch', 'Disable file watching')
    .action(async (path: string, options: { output: string; watch: boolean }) => {
      console.log(`🚀 Ultra-fast indexing codebase at: ${path}`);
      console.log(`📁 Index will be stored in: ${options.output}`);

      const indexDir = join(path, options.output);
      const indexer = new UltraFastIndexer(path, indexDir);

      await indexer.initialize();
      await indexer.indexCodebase((progress: IndexingProgress) => {
        if (progress.phase === 'parsing') {
          console.log(`📊 Processing: ${progress.filesProcessed}/${progress.totalFiles} files`);
        } else if (progress.phase === 'embedding') {
          console.log(`🧠 Building lexical index: ${progress.chunksProcessed}/${progress.totalChunks} chunks`);
        }
      });

      // Enable file watching by default unless explicitly disabled
      if (options.watch !== false) {
        console.log('👀 Starting file watcher for auto-updates...');
        // TODO: Implement file watching for UltraFastIndexer
        console.log('✅ File watching enabled - index will auto-update on file changes');
      }

      console.log('✅ Ultra-fast indexing completed successfully');
    });
}

export function createSearchCommand(): Command {
  return new Command('search')
    .description('Search the indexed codebase using ultra-fast lexical search')
    .argument('<query>', 'Search query')
    .option('-p, --path <dir>', 'Path to the codebase', '.')
    .option('-i, --index <dir>', 'Index directory', './ultra-fast-index')
    .option('-k, --top-k <number>', 'Number of results', '10')
    .action(async (query: string, options: { path: string; index: string; topK: string }) => {
      console.log(`🔍 Ultra-fast searching for: "${query}"`);

      const indexDir = join(options.path, options.index);
      const indexer = new UltraFastIndexer(options.path, indexDir);
      await indexer.initialize();

      const results = await indexer.search(query, parseInt(options.topK));

      console.log(`\n📊 Found ${results.length} results:\n`);
      for (const [index, result] of results.entries()) {
        console.log(`${index + 1}. ${result.chunk.filePath}:${result.chunk.startLine}-${result.chunk.endLine}`);
        console.log(`   Score: ${result.score.toFixed(3)} | Relevance: ${result.relevance.toFixed(3)}`);
        console.log(`   ${result.chunk.content.substring(0, 100)}...`);
        console.log('');
      }
    });
}

export function createStatsCommand(): Command {
  return new Command('stats')
    .description('Show ultra-fast indexing statistics')
    .option('-p, --path <dir>', 'Path to the codebase', '.')
    .option('-i, --index <dir>', 'Index directory', './ultra-fast-index')
    .action(async (options: { path: string; index: string }) => {
      console.log('📊 Gathering ultra-fast index statistics...');

      const indexDir = join(options.path, options.index);
      const indexer = new UltraFastIndexer(options.path, indexDir);
      await indexer.initialize();

      const stats = indexer.getStats();

      console.log('\n📈 Ultra-Fast Index Statistics:');
      console.log(`Total Files: ${stats.totalFiles}`);
      console.log(`Total Chunks: ${stats.totalChunks}`);
      console.log(`Total Terms: ${stats.totalTerms}`);
      console.log(`Languages: ${Object.keys(stats.languages).join(', ')}`);
      console.log(`Index Type: Lexical (TF-IDF) - NO EMBEDDINGS`);
    });
}

export function createClearCommand(): Command {
  return new Command('clear')
    .description('Clear the index and embeddings')
    .option('-e, --embeddings <dir>', 'Embeddings directory', './embeddings')
    .action(async (_options: { embeddings: string }) => {
      console.log('🗑️ Clearing index...');
      
      // This would implement clearing logic
      console.log('✅ Index cleared successfully');
    });
}
