/**
 * Tool Registry - Central registry for all tools
 * Manages tool discovery, registration, and execution
 */

const { FileTools } = require('./categories/file');
const { DatabaseTools } = require('./categories/database');
const { SystemTools } = require('./categories/system');
const { CommunicationTools } = require('./categories/communication');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.categories = new Map();
    this.initializeBuiltInTools();
  }

  initializeBuiltInTools() {
    // Initialize file tools
    const fileTools = new FileTools();
    fileTools.getTools().forEach(tool => {
      this.registerTool(tool);
    });

    // Initialize database tools
    const dbTools = new DatabaseTools();
    dbTools.getTools().forEach(tool => {
      this.registerTool(tool);
    });

    // Initialize system tools
    const systemTools = new SystemTools();
    systemTools.getTools().forEach(tool => {
      this.registerTool(tool);
    });

    // Initialize communication tools
    const commTools = new CommunicationTools();
    commTools.getTools().forEach(tool => {
      this.registerTool(tool);
    });
  }

  registerTool(tool) {
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }

    this.tools.set(tool.name, tool);

    // Index by category
    const category = tool.category || 'uncategorized';
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category).add(tool.name);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  listTools(category = null) {
    if (category) {
      const toolNames = this.categories.get(category) || new Set();
      return Array.from(toolNames).map(name => this.tools.get(name));
    }
    return Array.from(this.tools.values());
  }

  getCategories() {
    return Array.from(this.categories.keys());
  }

  searchTools(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const tool of this.tools.values()) {
      if (
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.category.toLowerCase().includes(lowerQuery)
      ) {
        results.push(tool);
      }
    }
    
    return results;
  }

  async executeTool(name, args) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool ${name} has no execute method`);
    }

    return await tool.execute(args);
  }

  getToolInfo(name) {
    const tool = this.getTool(name);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      schema: tool.schema
    };
  }
}

module.exports = { ToolRegistry };
