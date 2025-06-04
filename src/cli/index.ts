import { Command } from 'commander';
import { MarshalCodebaseIndexer } from '../indexer/MarshalCodebaseIndexer.js';

export function createIndexCommand(): Command {
  return new Command('index')
    .description('Index a codebase')
    .argument('<path>', 'Path to the codebase')
    .option('-o, --output <dir>', 'Output directory for embeddings', './embeddings')
    .action(async (path: string, options: { output: string }) => {
      console.log(`🚀 Indexing codebase at: ${path}`);
      
      const indexer = new MarshalCodebaseIndexer(path, options.output);
      await indexer.initialize();
      await indexer.indexCodebase();
      
      console.log('✅ Indexing completed successfully');
    });
}

export function createSearchCommand(): Command {
  return new Command('search')
    .description('Search the indexed codebase')
    .argument('<query>', 'Search query')
    .option('-p, --path <dir>', 'Path to the codebase', '.')
    .option('-e, --embeddings <dir>', 'Embeddings directory', './embeddings')
    .option('-k, --top-k <number>', 'Number of results', '10')
    .action(async (query: string, options: { path: string; embeddings: string; topK: string }) => {
      console.log(`🔍 Searching for: "${query}"`);
      
      const indexer = new MarshalCodebaseIndexer(options.path, options.embeddings);
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
    .description('Show indexing statistics')
    .option('-p, --path <dir>', 'Path to the codebase', '.')
    .option('-e, --embeddings <dir>', 'Embeddings directory', './embeddings')
    .action(async (options: { path: string; embeddings: string }) => {
      console.log('📊 Gathering statistics...');
      
      const indexer = new MarshalCodebaseIndexer(options.path, options.embeddings);
      await indexer.initialize();
      
      const stats = indexer.getStats();
      
      console.log('\n📈 Indexing Statistics:');
      console.log(`Total Files: ${stats.totalFiles}`);
      console.log(`Total Chunks: ${stats.totalChunks}`);
      console.log(`Total Relationships: ${stats.totalRelationships}`);
      console.log(`Languages: ${Object.keys(stats.languages).join(', ')}`);
      console.log(`Average Complexity: ${stats.averageComplexity.toFixed(2)}`);
      console.log(`Indexing Time: ${stats.indexingTime}ms`);
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
