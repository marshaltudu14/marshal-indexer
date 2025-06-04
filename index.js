const fs = require('fs').promises;
const path = require('path');
const esprima = require('esprima');
const { FlagEmbedding } = require('fastembed');
const faiss = require('faiss-node');

// Initialize FastEmbed
const model = new FlagEmbedding({ model: 'sentence-transformers/all-MiniLM-L6-v2' });

// Initialize FAISS index
const dimension = 384; // Dimension of all-MiniLM-L6-v2 embeddings
let index;
let metadata = []; // Store file paths and chunk info

// Ensure embeddings directory exists
const embeddingsDir = path.join(__dirname, 'embeddings');
fs.mkdir(embeddingsDir, { recursive: true }).catch(console.error);

// Load existing index and metadata if they exist
async function loadIndex() {
  try {
    index = new faiss.IndexFlatL2(dimension);
    await index.read(path.join(embeddingsDir, 'index.faiss'));
    const metadataContent = await fs.readFile(path.join(embeddingsDir, 'metadata.json'), 'utf-8');
    metadata = JSON.parse(metadataContent);
    console.log('Loaded existing FAISS index and metadata.');
  } catch (e) {
    console.log('No existing FAISS index or metadata found. Creating new ones.');
    index = new faiss.IndexFlatL2(dimension);
    metadata = [];
  }
}

// Index the codebase
async function indexCodebase(projectPath) {
  await loadIndex(); // Load existing index before indexing
  const files = await getFiles(projectPath, ['.js', '.ts', '.tsx']);
  let chunkId = metadata.length > 0 ? Math.max(...metadata.map(m => m.chunkId)) + 1 : 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const chunks = splitIntoChunks(content, 512); // ~512-token chunks
    for (const chunk of chunks) {
      try {
        // Parse for AST (optional, for metadata)
        const ast = esprima.parseScript(chunk, { loc: true });
        const embedding = await model.embed([chunk]);
        index.add(embedding[0]);
        metadata.push({ file, chunkId, chunk, loc: ast.loc });
        chunkId++;
      } catch (e) {
        console.error(`Error processing ${file}:`, e);
      }
    }
  }
  // Save FAISS index and metadata
  await index.write(path.join(embeddingsDir, 'index.faiss'));
  await fs.writeFile(path.join(embeddingsDir, 'metadata.json'), JSON.stringify(metadata));
  console.log('Indexing complete. Index and metadata saved.');
}

// Recursive file walker
async function getFiles(dir, extensions) {
  let results = [];
  const list = await fs.readdir(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(await getFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(fullPath))) {
      results.push(fullPath);
    }
  }
  return results;
}

// Split file content into chunks
function splitIntoChunks(content, maxTokens) {
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const line of lines) {
    const tokenCount = line.split(/\s+/).length; // Rough token estimate
    if (currentTokens + tokenCount > maxTokens) {
      chunks.push(currentChunk);
      currentChunk = line;
      currentTokens = tokenCount;
    } else {
      currentChunk += '\n' + line;
      currentTokens += tokenCount;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// Search for relevant chunks
async function search(query, topK = 10) {
  await loadIndex(); // Ensure index is loaded before searching
  const queryEmbedding = await model.embed([query]);
  const { distances, indices } = index.search(queryEmbedding[0], topK);
  return indices.map((i, idx) => ({
    ...metadata[i],
    distance: distances[idx]
  }));
}

// MCP server interface
process.stdin.on('data', async (data) => {
  const request = JSON.parse(data.toString());
  if (request.command === 'index') {
    console.log(`Indexing project path: ${request.projectPath}`);
    await indexCodebase(request.projectPath || process.env.PROJECT_PATH);
    process.stdout.write(JSON.stringify({ status: 'indexed' }));
  } else if (request.command === 'search') {
    console.log(`Searching for query: ${request.query}`);
    const results = await search(request.query, request.topK || 10);
    process.stdout.write(JSON.stringify(results));
  }
});