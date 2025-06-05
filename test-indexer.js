import { UltraFastIndexer } from './dist/indexer/UltraFastIndexer.js';
import { resolve } from 'path';

async function testIndexer() {
  console.log('🚀 Starting Marshal Indexer Test...');
  
  const projectPath = resolve('..');  // Dukancard project
  const indexDir = resolve('./index');
  
  console.log(`📁 Project Path: ${projectPath}`);
  console.log(`📁 Index Directory: ${indexDir}`);
  
  try {
    // Create indexer instance
    const indexer = new UltraFastIndexer(projectPath, indexDir);
    
    // Initialize
    console.log('🔧 Initializing indexer...');
    await indexer.initialize();
    
    // Index the project
    console.log('📊 Starting indexing process...');
    const startTime = Date.now();
    
    await indexer.indexCodebase((progress) => {
      console.log(`Progress: ${JSON.stringify(progress)}`);
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Indexing completed in ${duration}ms`);
    
    // Get stats
    const stats = indexer.getStats();
    console.log('📈 Index Statistics:');
    console.log(`- Total Files: ${stats.totalFiles}`);
    console.log(`- Total Chunks: ${stats.totalChunks}`);
    
    // Test search
    console.log('🔍 Testing search...');
    const searchResults = await indexer.search('authentication login', { maxResults: 5 });
    console.log(`Found ${searchResults.length} results for "authentication login"`);
    
    for (const result of searchResults.slice(0, 3)) {
      console.log(`- ${result.chunk.filePath}:${result.chunk.startLine} (score: ${result.score.toFixed(3)})`);
    }
    
  } catch (error) {
    console.error('❌ Error during indexing:', error);
    console.error(error.stack);
  }
}

testIndexer().catch(console.error);
