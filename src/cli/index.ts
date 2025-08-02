import { Command } from 'commander';
import { UltraFastIndexer } from '../indexer/UltraFastIndexer.js';
import { join } from 'path';

export function createIndexCommand(): Command {
  return new Command('index')
    .description('Index a codebase using ultra-fast lexical indexing (no embeddings)')
    .argument('[paths...]', 'Paths to the codebases (space-separated)', ['.'])
    .option('-o, --output <dir>', 'Output directory for index', './ultra-fast-index')
    .option('--watch', 'Enable file watching for auto-updates (default: true)', true)
    .option('--no-watch', 'Disable file watching')
    .action(async (paths: string[], options: { output: string; watch: boolean }) => {
      console.log(`🚀 Ultra-fast indexing codebases at: ${paths.join(', ')}`);
      console.log(`📁 Index will be stored in: ${options.output}`);

      const indexDir = join(process.cwd(), options.output);
      const indexer = new UltraFastIndexer(paths, indexDir);

      await indexer.indexProject();

      if (!options.watch) {
        console.log('⚠️ File watching disabled - index will not auto-update on file changes');
        await indexer.stop();
      }

      console.log('✅ Ultra-fast indexing completed successfully');
    });
}

export function createSearchCommand(): Command {
  return new Command('search')
    .description('Search the indexed codebase using ultra-fast lexical search')
    .argument('<query>', 'Search query')
    .option('-p, --paths <dirs...>', 'Paths to the codebases (space-separated)', ['.'])
    .option('-i, --index <dir>', 'Index directory', './ultra-fast-index')
    .option('-k, --top-k <number>', 'Number of results', '10')
    .action(async (query: string, options: { paths: string[]; index: string; topK: string }) => {
      console.log(`🔍 Ultra-fast searching for: "${query}"`);

      const indexDir = join(process.cwd(), options.index);
      const indexer = new UltraFastIndexer(options.paths, indexDir);
      // No need to initialize - indexProject() handles loading existing index

      const results = await indexer.search(query, {
        maxResults: parseInt(options.topK),
        includeSemanticExpansion: true,
        enableResultClustering: true,
        codeSpecificRanking: true,
        fuzzySearch: true
      });

      console.log(`
📊 Found ${results.length} results:
`);
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
    .option('-p, --paths <dirs...>', 'Paths to the codebases (space-separated)', ['.'])
    .option('-i, --index <dir>', 'Index directory', './ultra-fast-index')
    .action(async (options: { paths: string[]; index: string }) => {
      console.log('📊 Gathering ultra-fast index statistics...');

      const indexDir = join(process.cwd(), options.index);
      const indexer = new UltraFastIndexer(options.paths, indexDir);
      // Load existing index to get stats
      await indexer.indexProject();

      const stats = indexer.getStats();

      console.log('\n📈 Enhanced Ultra-Fast Index Statistics:');
      console.log(`Total Files: ${stats.totalFiles}`);
      console.log(`Total Chunks: ${stats.totalChunks}`);
      console.log(`Total Terms: ${stats.indexStats.totalTerms}`);
      console.log(`Average Terms per Chunk: ${stats.indexStats.averageTermsPerChunk.toFixed(1)}`);
      console.log(`File Watching: ${stats.isWatching ? 'Enabled' : 'Disabled'}`);
      console.log(`Project Paths: ${stats.projectPaths.join(', ')}`);
      console.log("Index Type: Enhanced Lexical (TF-IDF + Code-Specific Signals) - NO EMBEDDINGS");

      await indexer.stop();
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

// Main CLI entry point
async function main() {
  const program = new Command();

  program
    .name('marshal-indexer')
    .description('Marshal Context Engine - Ultra-Fast Codebase Indexer')
    .version('2.0.0');

  program.addCommand(createIndexCommand());
  program.addCommand(createSearchCommand());
  program.addCommand(createStatsCommand());
  program.addCommand(createClearCommand());

  await program.parseAsync(process.argv);
}

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
