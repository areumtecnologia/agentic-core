/**
 * Built-in Tools Categories for Agentic Core
 * 
 * Provides a structured registry of common tools organized by category
 * with validation, composition, and marketplace capabilities.
 */

const { WebTools } = require('./categories/web');
const { FileTools } = require('./categories/file');
const { DatabaseTools } = require('./categories/database');
const { SystemTools } = require('./categories/system');
const { CommunicationTools } = require('./categories/communication');

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
  }

  registerCategory(name, category) {
    this.categories.set(name, category);
    const tools = category.getTools();
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
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
      return cat ? cat.getTools() : [];
    }
    return Array.from(this.tools.values());
  }

  validateTool(toolName, args) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    
    const validator = this.validators.get(toolName);
    if (validator) {
      return validator.validate(args);
    }
    
    // Default validation based on schema
    return this.validateSchema(tool.schema, args);
  }

  validateSchema(schema, args) {
    // Basic schema validation
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
    // Create a composed tool that chains multiple tools
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

// Default singleton instances for out-of-the-box usage
const registry = new ToolRegistry();
const { ToolComposer } = require('./ToolComposer');
const composer = new ToolComposer(registry);

module.exports = {
  registry,
  composer,
  ToolRegistry,
  WebTools,
  FileTools,
  DatabaseTools,
  SystemTools,
  CommunicationTools,
  ToolComposer,
  ToolValidator: require('./ToolValidator').ToolValidator,
  ToolMarketplace: require('./ToolMarketplace').ToolMarketplace
};

