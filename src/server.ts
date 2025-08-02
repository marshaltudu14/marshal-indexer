#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { join } from 'path';
import { UltraFastIndexer } from './indexer/UltraFastIndexer.js';

/**
 * Custom MCP Server for Ultra-Fast Lexical Codebase Indexing (NO EMBEDDINGS)
 */
class CodebaseIndexerMCPServer {
  private server: Server;
  private indexer: UltraFastIndexer | null = null;
  private projectPaths: string[];
  private indexDir: string;

  constructor() {
    this.projectPaths = (process.env['PROJECT_PATHS'] || process.cwd()).split(',');
    this.indexDir = join(process.cwd(), 'custom-indexer', 'ultra-fast-index');
    
    this.server = new Server(
      {
        name: 'ultra-fast-codebase-indexer',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'index_codebase',
            description: 'Index the entire codebase using ultra-fast lexical indexing (NO EMBEDDINGS) for lightning-fast search',
            inputSchema: {
              type: 'object',
              properties: {
                force: {
                  type: 'boolean',
                  description: 'Force re-indexing even if files haven\'t changed',
                  default: false
                },
                noWatch: {
                  type: 'boolean',
                  description: 'Disable file watching (watching is enabled by default)',
                  default: false
                }
              }
            }
          },
          {
            name: 'search_code',
            description: 'Search the indexed codebase using ultra-fast lexical search with TF-IDF scoring and fuzzy matching',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (natural language, code snippet, or fuzzy terms like "login page action")'
                },
                topK: {
                  type: 'number',
                  description: 'Number of results to return',
                  default: 10,
                  minimum: 1,
                  maximum: 50
                },
                minScore: {
                  type: 'number',
                  description: 'Minimum similarity score (0-1)',
                  default: 0.1,
                  minimum: 0,
                  maximum: 1
                },
                language: {
                  type: 'string',
                  description: 'Filter by programming language'
                },
                filePath: {
                  type: 'string',
                  description: 'Filter by file path pattern'
                },
                includeContent: {
                  type: 'boolean',
                  description: 'Include full chunk content in results',
                  default: true
                },
                fuzzySearch: {
                  type: 'boolean',
                  description: 'Enable fuzzy matching for partial terms',
                  default: true
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_index_stats',
            description: 'Get statistics about the current index',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'clear_index',
            description: 'Clear all indexed data',
            inputSchema: {
              type: 'object',
              properties: {
                confirm: {
                  type: 'boolean',
                  description: 'Confirmation to clear the index',
                  default: false
                }
              }
            }
          },
          {
            name: 'start_watching',
            description: 'Start watching for file changes to keep index updated',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'stop_watching',
            description: 'Stop watching for file changes',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ] as Tool[]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.ensureIndexer();

        switch (name) {
          case 'index_codebase':
            return await this.handleIndexCodebase(args);
          
          case 'search_code':
            return await this.handleSearchCode(args);
          
          case 'get_index_stats':
            return await this.handleGetStats();
          
          case 'clear_index':
            return await this.handleClearIndex(args);
          
          case 'start_watching':
            return await this.handleStartWatching();
          
          case 'stop_watching':
            return await this.handleStopWatching();
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async ensureIndexer(): Promise<void> {
    if (!this.indexer) {
      this.indexer = new UltraFastIndexer(this.projectPaths, this.indexDir);
      await this.indexer.initialize();
    }
  }

  private async handleIndexCodebase(args: any) {
    if (!this.indexer) throw new Error('Indexer not initialized');

    const { noWatch = false } = args;
    const watch = !noWatch; // Default to watching unless explicitly disabled
    
    let progressText = '';
    
    await this.indexer.indexCodebase((progress) => {
      const { phase, filesProcessed, totalFiles, chunksProcessed, totalChunks, currentFile, errors } = progress;
      
      switch (phase) {
        case 'scanning':
          progressText = 'Scanning files...';
          break;
        case 'parsing':
          progressText = `Processing files: ${filesProcessed}/${totalFiles}${currentFile ? ` (${currentFile})` : ''}`;
          break;
        case 'embedding':
          progressText = `Building lexical index: ${chunksProcessed}/${totalChunks}`;
          break;
        case 'storing':
          progressText = 'Saving index...';
          break;
        case 'complete':
          progressText = `Indexing complete! Processed ${totalFiles} files, ${totalChunks} chunks.`;
          if (errors.length > 0) {
            progressText += ` (${errors.length} errors)`;
          }
          break;
      }
    });

    if (watch) {
      progressText += '\nNote: File watching not yet implemented for ultra-fast indexer.';
    }

    const stats = this.indexer.getStats();
    const languages = (stats as any).languages || {};

    return {
      content: [
        {
          type: 'text',
          text: `${progressText}\n\nIndex Statistics:\n- Total files: ${stats.totalFiles}\n- Total chunks: ${stats.totalChunks}\n- Languages: ${Object.entries(languages).map(([lang, count]) => `${lang} (${count})`).join(', ')}`
        }
      ]
    };
  }

  private async handleSearchCode(args: any) {
    if (!this.indexer) throw new Error('Indexer not initialized');

    const {
      query,
      topK = 10,
      minScore = 0.1,
      language,
      filePath,
      includeContent = true,
      fuzzySearch = true
    } = args;

    if (!query) {
      throw new Error('Query is required');
    }

    console.log(`🔍 Marshal Search Query: "${query}" (fuzzy: ${fuzzySearch}, topK: ${topK})`);
    const results = await this.indexer.search(query, topK);
    
    // Filter results
    const filteredResults = results.filter(result => {
      if (result.score < minScore) return false;
      if (language && result.chunk.language !== language) return false;
      if (filePath && !result.chunk.filePath.includes(filePath)) return false;
      return true;
    });

    if (filteredResults.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No results found for query: "${query}"`
          }
        ]
      };
    }

    const resultText = filteredResults.map((result, index) => {
      const { chunk, score, relevance } = result;
      const absolutePath = chunk.filePath; // Use absolute path for easy file location

      let text = `## Result ${index + 1} (Score: ${score.toFixed(3)}, Relevance: ${relevance.toFixed(3)})\n`;
      text += `**File:** ${absolutePath}\n`;
      text += `**Language:** ${chunk.language}\n`;
      text += `**Lines:** ${chunk.startLine}-${chunk.endLine}\n`;

      if (chunk.symbols && chunk.symbols.length > 0) {
        text += `**Symbols:** ${chunk.symbols.join(', ')}\n`;
      }

      // Add Marshal metadata if available
      if ((result as any).marshalMetadata) {
        const metadata = (result as any).marshalMetadata;
        if (metadata.concepts && metadata.concepts.length > 0) {
          text += `**Concepts:** ${metadata.concepts.join(', ')}\n`;
        }
        if (metadata.complexity !== undefined) {
          text += `**Complexity:** ${metadata.complexity.toFixed(2)}\n`;
        }
        if (metadata.importance !== undefined) {
          text += `**Importance:** ${metadata.importance.toFixed(2)}\n`;
        }
      }

      if (includeContent) {
        text += `\n\`\`\`${chunk.language}\n${chunk.content}\n\`\`\`\n`;
      }

      return text;
    }).join('\n---\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${filteredResults.length} results for query: "${query}"\n\n${resultText}`
        }
      ]
    };
  }

  private async handleGetStats() {
    if (!this.indexer) throw new Error('Indexer not initialized');

    const stats = this.indexer.getStats();
    const languages = (stats as any).languages || {};

    const statsText = `# Ultra-Fast Index Statistics (NO EMBEDDINGS)

**Index Type:** Lexical (TF-IDF)
**Total Files:** ${stats.totalFiles}
**Total Chunks:** ${stats.totalChunks}
**Total Terms:** ${(stats as any).totalTerms || 'N/A'}
**Project Paths:** ${stats.projectPaths.join(', ')}
**Index Directory:** ${this.indexDir}

## Languages:
${Object.entries(languages).map(([lang, count]) => `- ${lang}: ${count} chunks`).join('\n')}

## Performance Benefits:
- ⚡ **NO MODEL DOWNLOADS** - No embedding models required
- 🚀 **ULTRA-FAST INDEXING** - Pure lexical approach
- 💾 **MINIMAL STORAGE** - Only stores text indices
- 🔍 **INSTANT SEARCH** - TF-IDF scoring for fast results`;

    return {
      content: [
        {
          type: 'text',
          text: statsText
        }
      ]
    };
  }

  private async handleClearIndex(args: any) {
    if (!this.indexer) throw new Error('Indexer not initialized');

    const { confirm = false } = args;
    
    if (!confirm) {
      return {
        content: [
          {
            type: 'text',
            text: 'Index clearing cancelled. Set confirm=true to proceed with clearing the index.'
          }
        ]
      };
    }

    await this.indexer.clear();
    
    return {
      content: [
        {
          type: 'text',
          text: 'Index cleared successfully. Run index_codebase to rebuild the index.'
        }
      ]
    };
  }

  private async handleStartWatching() {
    return {
      content: [
        {
          type: 'text',
          text: 'File watching not yet implemented for ultra-fast indexer. Please re-run indexing manually when files change.'
        }
      ]
    };
  }

  private async handleStopWatching() {
    return {
      content: [
        {
          type: 'text',
          text: 'File watching not active for ultra-fast indexer.'
        }
      ]
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Marshal Codebase Indexer MCP Server running on stdio');
  }
}

// Start the server
const server = new CodebaseIndexerMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
