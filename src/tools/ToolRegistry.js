/**
 * Tool Registry - Central registry for all tools
 * Manages tool discovery, registration, validation, and composition.
 */

const { WebTools } = require('./categories/web');
const { FileTools } = require('./categories/file');
const { DatabaseTools } = require('./categories/database');
const { SystemTools } = require('./categories/system');
const { CommunicationTools } = require('./categories/communication');
const { ReasoningTools } = require('./categories/reasoning');
const { MathTools } = require('./categories/math');

class ToolRegistry {
  constructor() {
    this.categories = new Map();
    this.tools = new Map();
    this.validators = new Map();

    // Register default categories
    this.registerCategory('web', new WebTools());
    this.registerCategory('file', new FileTools());
    this.registerCategory('database', new DatabaseTools());
    this.registerCategory('system', new SystemTools());
    this.registerCategory('communication', new CommunicationTools());
    this.registerCategory('reasoning', new ReasoningTools());
    this.registerCategory('math', new MathTools());
  }



  registerCategory(name, category) {
    this.categories.set(name, category);
    if (typeof category.getTools === 'function') {
      const tools = category.getTools();
      tools.forEach(tool => {
        this.registerTool(tool, name);
      });
    }
  }

  registerTool(tool, categoryName = null) {
    if (!tool || !tool.name) {
      throw new Error('Tool must have a name');
    }

    this.tools.set(tool.name, tool);

    const category = categoryName || tool.category || 'uncategorized';
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    const cat = this.categories.get(category);
    if (cat instanceof Set) {
      cat.add(tool.name);
    }
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getCategory(name) {
    return this.categories.get(name);
  }

  listTools(category = null) {
    if (category) {
      const cat = this.categories.get(category);
      if (cat && typeof cat.getTools === 'function') {
        return cat.getTools();
      }
      if (cat instanceof Set) {
        return Array.from(cat).map(name => this.tools.get(name)).filter(Boolean);
      }
      return [];
    }
    return Array.from(this.tools.values());
  }

  getCategories() {
    return Array.from(this.categories.keys());
  }

  searchTools(query) {
    const results = [];
    const lowerQuery = String(query || '').toLowerCase();

    for (const tool of this.tools.values()) {
      if (
        tool.name.toLowerCase().includes(lowerQuery) ||
        (tool.description && tool.description.toLowerCase().includes(lowerQuery)) ||
        (tool.category && tool.category.toLowerCase().includes(lowerQuery))
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

  validateTool(toolName, args) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const validator = this.validators.get(toolName);
    if (validator && typeof validator.validate === 'function') {
      return validator.validate(args);
    }

    // Default validation based on schema
    return this.validateSchema(tool.schema, args);
  }

  validateSchema(schema, args) {
    if (!schema || typeof schema !== 'object') return true;
    if (schema.type === 'object' && schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (schema.required?.includes(prop) && !(prop in args)) {
          throw new Error(`Required property ${prop} missing`);
        }
        if (prop in args && propSchema.type) {
          const actualType = typeof args[prop];
          if (actualType !== propSchema.type) {
            throw new Error(`Property ${prop} must be ${propSchema.type}, got ${actualType}`);
          }
        }
      }
    }
    return true;
  }

  composeTools(toolChain) {
    return {
      name: `composed_${toolChain.map(t => t.name).join('_')}`,
      description: `Composed tool chaining: ${toolChain.map(t => t.name).join(' -> ')}`,
      execute: async (initialArgs) => {
        let result = initialArgs;
        for (const toolConfig of toolChain) {
          const tool = this.getTool(toolConfig.name);
          if (!tool) {
            throw new Error(`Tool ${toolConfig.name} not found in chain`);
          }
          const args = typeof toolConfig.transform === 'function'
            ? toolConfig.transform(result)
            : result;
          result = await tool.execute(args);
        }
        return result;
      }
    };
  }
}

module.exports = { ToolRegistry };
