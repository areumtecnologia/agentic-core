/**
 * File Tools Category
 * Tools for file operations: read, write, list, etc.
 */

const fs = require('fs').promises;
const path = require('path');

class FileTools {
  constructor() {
    this.tools = new Map();
    this.initializeTools();
  }

  initializeTools() {
    // Read File Tool
    this.tools.set('read_file', {
      name: 'read_file',
      category: 'file',
      description: 'Read content from a file',
      schema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to read'
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)'
          }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const { filePath, encoding = 'utf8' } = args;
        try {
          const content = await fs.readFile(filePath, encoding);
          const stats = await fs.stat(filePath);
          
          return {
            filePath,
            content,
            size: stats.size,
            modified: stats.mtime,
            encoding
          };
        } catch (error) {
          throw new Error(`Failed to read file: ${error.message}`);
        }
      }
    });

    // Write File Tool
    this.tools.set('write_file', {
      name: 'write_file',
      category: 'file',
      description: 'Write content to a file',
      schema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to write'
          },
          content: {
            type: 'string',
            description: 'Content to write'
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)'
          },
          append: {
            type: 'boolean',
            description: 'Append to file instead of overwriting (default: false)'
          }
        },
        required: ['filePath', 'content']
      },
      execute: async (args) => {
        const { filePath, content, encoding = 'utf8', append = false } = args;
        try {
          const flag = append ? 'a' : 'w';
          await fs.writeFile(filePath, content, { encoding, flag });
          const stats = await fs.stat(filePath);
          
          return {
            filePath,
            bytesWritten: Buffer.byteLength(content, encoding),
            size: stats.size,
            modified: stats.mtime,
            appended: append
          };
        } catch (error) {
          throw new Error(`Failed to write file: ${error.message}`);
        }
      }
    });

    // List Directory Tool
    this.tools.set('list_directory', {
      name: 'list_directory',
      category: 'file',
      description: 'List files and directories in a path',
      schema: {
        type: 'object',
        properties: {
          dirPath: {
            type: 'string',
            description: 'Directory path to list'
          },
          recursive: {
            type: 'boolean',
            description: 'List recursively (default: false)'
          },
          filter: {
            type: 'string',
            description: 'File extension filter (e.g., .js)'
          }
        },
        required: ['dirPath']
      },
      execute: async (args) => {
        const { dirPath, recursive = false, filter } = args;
        try {
          const items = await this.listDirRecursive(dirPath, recursive, filter);
          
          return {
            dirPath,
            items,
            count: items.length,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          throw new Error(`Failed to list directory: ${error.message}`);
        }
      }
    });

    // File Exists Tool
    this.tools.set('file_exists', {
      name: 'file_exists',
      category: 'file',
      description: 'Check if a file or directory exists',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to check'
          }
        },
        required: ['path']
      },
      execute: async (args) => {
        const { path: filePath } = args;
        try {
          const stats = await fs.stat(filePath);
          return {
            path: filePath,
            exists: true,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime
          };
        } catch (error) {
          if (error.code === 'ENOENT') {
            return {
              path: filePath,
              exists: false
            };
          }
          throw error;
        }
      }
    });
  }

  async listDirRecursive(dirPath, recursive, filter, basePath = '') {
    const items = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      if (filter && !entry.name.endsWith(filter)) {
        if (!entry.isDirectory()) continue;
      }
      
      items.push({
        name: entry.name,
        path: relativePath,
        type: entry.isDirectory() ? 'directory' : 'file',
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
      });
      
      if (recursive && entry.isDirectory()) {
        const subItems = await this.listDirRecursive(fullPath, recursive, filter, relativePath);
        items.push(...subItems);
      }
    }
    
    return items;
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  getTool(name) {
    return this.tools.get(name);
  }
}

module.exports = { FileTools };
