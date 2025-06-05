import { UltraFastIndexer } from './dist/indexer/UltraFastIndexer.js';
import { resolve } from 'path';

async function runBenchmark() {
  console.log('🏁 Starting Marshal vs Augment Benchmark...');
  
  const projectPath = resolve('..');  // Dukancard project
  const indexDir = resolve('./index');
  
  try {
    // Create indexer instance
    const indexer = new UltraFastIndexer(projectPath, indexDir);
    
    // Initialize and ensure index is loaded
    console.log('🔧 Initializing indexer...');
    await indexer.initialize();

    // Check if we need to rebuild the index
    const initialStats = indexer.getStats();
    if (initialStats.totalChunks === 0) {
      console.log('� No existing index found, rebuilding...');
      await indexer.indexCodebase();
    } else {
      console.log(`📊 Loaded existing index: ${initialStats.totalFiles} files, ${initialStats.totalChunks} chunks`);
    }
    
    // Test queries that Augment handled well
    const testQueries = [
      'authentication login',
      'user registration signup',
      'supabase auth',
      'OTP verification',
      'password login',
      'social login google',
      'middleware auth',
      'dashboard redirect',
      'business profile',
      'customer profile'
    ];
    
    console.log('🔍 Running search benchmarks...');
    
    for (const query of testQueries) {
      console.log(`\n📝 Testing query: "${query}"`);
      
      const startTime = Date.now();
      const results = await indexer.search(query, { maxResults: 10 });
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Search time: ${duration}ms`);
      console.log(`📊 Results found: ${results.length}`);
      
      // Show top 3 results
      console.log('🎯 Top results:');
      for (const result of results.slice(0, 3)) {
        const filePath = result.chunk.filePath.replace(/\\/g, '/');
        const fileName = filePath.split('/').pop();
        console.log(`   - ${fileName}:${result.chunk.startLine} (score: ${result.score.toFixed(3)})`);
      }
    }
    
    // Get final stats
    const stats = indexer.getStats();
    console.log('\n📈 Final Index Statistics:');
    console.log(`- Total Files: ${stats.totalFiles}`);
    console.log(`- Total Chunks: ${stats.totalChunks}`);
    
  } catch (error) {
    console.error('❌ Error during benchmark:', error);
  }
}

runBenchmark().catch(console.error);
