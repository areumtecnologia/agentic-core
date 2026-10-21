/**
 * File Tools Category
 * Tools for file operations with sandbox path confinement and security policies.
 */

const fs = require('fs').promises;
const path = require('path');

class FileTools {
  constructor(options = {}) {
    this.tools = new Map();
    this.baseDir = options.baseDir ? path.resolve(options.baseDir) : null;
    this.blockedPatterns = options.blockedPatterns || [
      /(\/|\\|^)\.env(\..+)?$/i,
      /(\/|\\|^)\.git(\/|\\|$)/i,
      /\.(key|pem|crt|pfx|p12)$/i,
      /id_rsa/i,
      /(\/|\\)etc(\/|\\)(passwd|shadow)/i,
      /(\/|\\)Windows(\/|\\)System32(\/|\\)config/i,
    ];
    this.initializeTools();
  }

  _resolveSafePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Invalid file path provided.');
    }

    const resolved = this.baseDir ? path.resolve(this.baseDir, inputPath) : path.resolve(inputPath);

    if (this.baseDir) {
      const rel = path.relative(this.baseDir, resolved);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`Security Violation: Path "${inputPath}" escapes the allowed root directory.`);
      }
    }

    const normalized = resolved.replace(/\\/g, '/');
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(normalized) || pattern.test(path.basename(resolved))) {
        throw new Error(`Security Violation: Access to "${path.basename(resolved)}" is blocked.`);
      }
    }

    return resolved;
  }

  initializeTools() {
    // Read File Tool
    this.tools.set('read_file', {
      name: 'read_file',
      category: 'file',
      description: 'Read content from a file within allowed directory',
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
        const { filePath, encoding = 'utf8' } = args || {};
        const safePath = this._resolveSafePath(filePath);
        try {
          const content = await fs.readFile(safePath, encoding);
          const stats = await fs.stat(safePath);
          
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
      description: 'Write content to a file within allowed directory',
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
        const { filePath, content, encoding = 'utf8', append = false } = args || {};
        const safePath = this._resolveSafePath(filePath);
        try {
          const flag = append ? 'a' : 'w';
          await fs.writeFile(safePath, content, { encoding, flag });
          const stats = await fs.stat(safePath);
          
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
        const { dirPath, recursive = false, filter } = args || {};
        const safePath = this._resolveSafePath(dirPath);
        try {
          const items = await this.listDirRecursive(safePath, recursive, filter);
          
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
        const { path: filePath } = args || {};
        const safePath = this._resolveSafePath(filePath);
        try {
          const stats = await fs.stat(safePath);
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
