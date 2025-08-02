# 🚀 Marshal Indexer - MCP Setup Guide

## Quick Setup for Any System

### Step 1: Clone and Build
```bash
git clone https://github.com/marshaltudu14/marshal-indexer.git
cd marshal-indexer
npm install
npm run build
npm pack
```

This creates `marshal-indexer-2.0.0.tgz` - a portable package that works anywhere.

### Step 2: Configure MCP

**Method 1: NPX (Recommended)**
```json
{
  "mcpServers": {
    "marshal-indexer": {
      "command": "npx",
      "args": ["-y", "/absolute/path/to/marshal-indexer-2.0.0.tgz"],
      "env": {
        "PROJECT_PATHS": "/path/to/project1,/path/to/project2"
      }
    }
  }
}
```

**Method 2: NPM Run**
```json
{
  "mcpServers": {
    "marshal-indexer": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/marshal-indexer",
      "env": {
        "PROJECT_PATHS": "/path/to/project1,/path/to/project2"
      }
    }
  }
}
```

**Method 3: Direct Node**
```json
{
  "mcpServers": {
    "marshal-indexer": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/absolute/path/to/marshal-indexer",
      "env": {
        "PROJECT_PATHS": "/path/to/project1,/path/to/project2"
      }
    }
  }
}
```

## Platform-Specific Examples

### Windows
```json
{
  "mcpServers": {
    "marshal-indexer": {
      "command": "npx",
      "args": ["-y", "C:/tools/marshal-indexer/marshal-indexer-2.0.0.tgz"],
      "env": {
        "PROJECT_PATHS": "C:/projects/myapp,C:/projects/another-app"
      }
    }
  }
}
```

### macOS/Linux
```json
{
  "mcpServers": {
    "marshal-indexer": {
      "command": "npx",
      "args": ["-y", "/home/user/tools/marshal-indexer/marshal-indexer-2.0.0.tgz"],
      "env": {
        "PROJECT_PATHS": "/home/user/projects/myapp,/home/user/projects/another-app"
      }
    }
  }
}
```

## Available MCP Tools

1. **index_codebase** - Index your projects
2. **search_code** - Search with TF-IDF scoring
3. **get_index_stats** - View index statistics
4. **clear_index** - Clear index data
5. **start_watching** / **stop_watching** - File monitoring

## Benefits

✅ **No npm registry dependency**
✅ **Works on any system with Node.js**
✅ **Full file watching capabilities**
✅ **6x faster than embedding-based solutions**
✅ **Zero AI model downloads**
✅ **Portable .tgz package**

## Troubleshooting

- Ensure Node.js 18+ is installed
- Use absolute paths for PROJECT_PATHS
- Restart your AI client after configuration
- Check console for startup errors
