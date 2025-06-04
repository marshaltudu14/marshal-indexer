#!/usr/bin/env node

import { Command } from 'commander';
import { join } from 'path';
import { CodebaseIndexer } from './indexer.js';
import { formatDuration } from './utils.js';

const program = new Command();

program
  .name('codebase-indexer')
  .description('AI-powered codebase indexer with semantic search')
  .version('2.0.0');

program
  .command('index')
  .description('Index the codebase')
  .option('-p, --project <path>', 'Project path to index', process.cwd())
  .option('-f, --force', 'Force re-indexing all files', false)
  .option('--no-watch', 'Disable file watching (watching is enabled by default)')
  .action(async (options) => {
    const { project } = options;

    const watch = options.watch !== false; // Default to true unless --no-watch is used
    const embeddingsDir = join(project, 'custom-indexer', 'embeddings');
    
    console.log(`🚀 Starting indexing of: ${project}`);
    console.log(`📁 Embeddings directory: ${embeddingsDir}`);
    
    const indexer = new CodebaseIndexer(project, embeddingsDir);
    await indexer.initialize();
    
    const startTime = Date.now();
    
    try {
      await indexer.indexCodebase((progress) => {
        const { phase, filesProcessed, totalFiles, chunksProcessed, totalChunks, currentFile, errors } = progress;
        
        switch (phase) {
          case 'scanning':
            console.log('🔍 Scanning files...');
            break;
          case 'parsing':
            const fileProgress = totalFiles > 0 ? `(${Math.round(filesProcessed / totalFiles * 100)}%)` : '';
            console.log(`📝 Processing files: ${filesProcessed}/${totalFiles} ${fileProgress}`);
            if (currentFile) {
              console.log(`   Current: ${currentFile}`);
            }
            break;
          case 'embedding':
            const chunkProgress = totalChunks > 0 ? `(${Math.round(chunksProcessed / totalChunks * 100)}%)` : '';
            console.log(`🧠 Generating embeddings: ${chunksProcessed}/${totalChunks} ${chunkProgress}`);
            break;
          case 'storing':
            console.log('💾 Saving index...');
            break;
          case 'complete':
            const duration = formatDuration(Date.now() - startTime);
            console.log(`✅ Indexing complete in ${duration}!`);
            console.log(`   📊 Processed ${totalFiles} files, ${totalChunks} chunks`);
            if (errors.length > 0) {
              console.log(`   ⚠️  ${errors.length} errors occurred`);
              errors.forEach(error => console.log(`      ${error}`));
            }
            break;
        }
      });

      console.log(`🔧 Watch mode: ${watch}`); // Debug output
      if (watch) {
        console.log('👀 Starting file watcher...');
        await indexer.startWatching();
        console.log('🔄 Watching for file changes. Press Ctrl+C to stop.');
        
        // Keep the process running
        process.on('SIGINT', async () => {
          console.log('\n🛑 Stopping file watcher...');
          await indexer.stopWatching();
          process.exit(0);
        });
        
        // Keep alive
        await new Promise(() => {});
      }
      
    } catch (error) {
      console.error('❌ Indexing failed:', error);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Search the indexed codebase')
  .argument('<query>', 'Search query')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-k, --top-k <number>', 'Number of results to return', '10')
  .option('-s, --min-score <number>', 'Minimum similarity score', '0.1')
  .option('-l, --language <lang>', 'Filter by programming language')
  .option('-f, --file-path <path>', 'Filter by file path pattern')
  .option('--no-content', 'Exclude content from results')
  .action(async (query, options) => {
    const { project, topK, minScore, language, filePath, content } = options;
    const embeddingsDir = join(project, 'custom-indexer', 'embeddings');
    
    console.log(`🔍 Searching for: "${query}"`);
    
    const indexer = new CodebaseIndexer(project, embeddingsDir);
    await indexer.initialize();
    
    try {
      const results = await indexer.search(query, parseInt(topK));
      
      // Filter results
      const filteredResults = results.filter(result => {
        if (result.score < parseFloat(minScore)) return false;
        if (language && result.chunk.language !== language) return false;
        if (filePath && !result.chunk.filePath.includes(filePath)) return false;
        return true;
      });
      
      if (filteredResults.length === 0) {
        console.log('❌ No results found');
        return;
      }
      
      console.log(`\n📊 Found ${filteredResults.length} results:\n`);
      
      filteredResults.forEach((result, index) => {
        const { chunk, score, relevance } = result;

        console.log(`${index + 1}. 📄 ${chunk.filePath}`);
        console.log(`   🎯 Score: ${score.toFixed(3)} | Relevance: ${relevance.toFixed(3)}`);
        console.log(`   🔤 Language: ${chunk.language}`);
        console.log(`   📍 Lines: ${chunk.startLine}-${chunk.endLine}`);
        
        if (chunk.symbols && chunk.symbols.length > 0) {
          console.log(`   🏷️  Symbols: ${chunk.symbols.join(', ')}`);
        }
        
        if (content && chunk.content) {
          console.log(`   📝 Content:`);
          const lines = chunk.content.split('\n');
          const preview = lines.slice(0, 5).join('\n');
          console.log(`      ${preview.replace(/\n/g, '\n      ')}`);
          if (lines.length > 5) {
            console.log(`      ... (${lines.length - 5} more lines)`);
          }
        }
        
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show index statistics')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .action(async (options) => {
    const { project } = options;
    const embeddingsDir = join(project, 'custom-indexer', 'embeddings');
    
    const indexer = new CodebaseIndexer(project, embeddingsDir);
    await indexer.initialize();
    
    try {
      const stats = indexer.getStats();
      
      console.log('📊 Index Statistics:');
      console.log(`   📁 Total files: ${stats.totalFiles}`);
      console.log(`   📄 Total chunks: ${stats.totalChunks}`);
      console.log(`   🕒 Last indexed: ${stats.metadata.lastIndexed ? new Date(stats.metadata.lastIndexed).toLocaleString() : 'Never'}`);
      console.log(`   📂 Project path: ${stats.metadata.projectPath}`);
      
      if (Object.keys(stats.languages).length > 0) {
        console.log('\n🔤 Languages:');
        Object.entries(stats.languages)
          .sort(([,a], [,b]) => b - a)
          .forEach(([lang, count]) => {
            console.log(`   ${lang}: ${count} chunks`);
          });
      }
      
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      process.exit(1);
    }
  });

program
  .command('clear')
  .description('Clear the index')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-y, --yes', 'Skip confirmation', false)
  .action(async (options) => {
    const { project, yes } = options;
    const embeddingsDir = join(project, 'custom-indexer', 'embeddings');
    
    if (!yes) {
      console.log('⚠️  This will clear all indexed data. Use --yes to confirm.');
      return;
    }
    
    const indexer = new CodebaseIndexer(project, embeddingsDir);
    await indexer.initialize();
    
    try {
      await indexer.clear();
      console.log('✅ Index cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear index:', error);
      process.exit(1);
    }
  });

program.parse();
