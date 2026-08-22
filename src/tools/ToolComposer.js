/**
 * Tool Composer - Tool composition and chaining capabilities
 * Allows creating complex workflows by chaining multiple tools together
 */

class ToolComposer {
  constructor(toolRegistry) {
    this.registry = toolRegistry;
    this.composedTools = new Map();
  }

  /**
   * Compose multiple tools into a single workflow
   * @param {string} name - Name for the composed tool
   * @param {Array} toolChain - Array of tool configurations
   * @param {string} description - Description of the composed tool
   */
  compose(name, toolChain, description = '') {
    const composedTool = {
      name,
      description: description || `Composed workflow: ${toolChain.map(t => t.name).join(' -> ')}`,
      category: 'composed',
      schema: this.inferSchema(toolChain),
      execute: async (initialArgs) => {
        let result = initialArgs;
        const executionLog = [];
        
        for (let i = 0; i < toolChain.length; i++) {
          const toolConfig = toolChain[i];
          const tool = this.registry.getTool(toolConfig.name);
          
          if (!tool) {
            throw new Error(`Tool ${toolConfig.name} not found`);
          }
          
          // Transform input if needed
          const args = typeof toolConfig.transform === 'function'
            ? toolConfig.transform(result, initialArgs)
            : toolConfig.args || result;
          
          try {
            const toolResult = await tool.execute(args);
            executionLog.push({
              tool: toolConfig.name,
              input: args,
              output: toolResult,
              success: true
            });
            result = toolResult;
          } catch (error) {
            executionLog.push({
              tool: toolConfig.name,
              input: args,
              error: error.message,
              success: false
            });
            throw new Error(`Tool chain failed at ${toolConfig.name}: ${error.message}`);
          }
        }
        
        return {
          result,
          executionLog,
          toolsUsed: toolChain.map(t => t.name)
        };
      }
    };
    
    this.composedTools.set(name, composedTool);
    return composedTool;
  }

  /**
   * Infer schema from tool chain
   */
  inferSchema(toolChain) {
    if (toolChain.length === 0) return {};
    
    const firstTool = this.registry.getTool(toolChain[0].name);
    const lastTool = this.registry.getTool(toolChain[toolChain.length - 1].name);
    
    return {
      type: 'object',
      properties: {
        ...firstTool?.schema?.properties
      },
      required: firstTool?.schema?.required || []
    };
  }

  /**
   * Create a conditional tool chain
   */
  conditional(name, conditions, description = '') {
    return {
      name,
      description: description || 'Conditional tool execution',
      category: 'composed',
      execute: async (args) => {
        for (const condition of conditions) {
          const shouldExecute = typeof condition.when === 'function'
            ? await condition.when(args)
            : condition.when;
          
          if (shouldExecute) {
            const tool = this.registry.getTool(condition.tool);
            if (!tool) {
              throw new Error(`Tool ${condition.tool} not found`);
            }
            return await tool.execute(condition.args || args);
          }
        }
        throw new Error('No conditions matched');
      }
    };
  }

  /**
   * Create a parallel tool execution
   */
  parallel(name, tools, description = '') {
    return {
      name,
      description: description || 'Parallel tool execution',
      category: 'composed',
      execute: async (args) => {
        const results = await Promise.allSettled(
          tools.map(async (toolConfig) => {
            const tool = this.registry.getTool(toolConfig.name);
            if (!tool) {
              throw new Error(`Tool ${toolConfig.name} not found`);
            }
            const toolArgs = typeof toolConfig.transform === 'function'
              ? toolConfig.transform(args)
              : toolConfig.args || args;
            return await tool.execute(toolArgs);
          })
        );
        
        return {
          results: results.map((result, index) => ({
            tool: tools[index].name,
            status: result.status,
            value: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason.message : null
          }))
        };
      }
    };
  }

  getComposedTool(name) {
    return this.composedTools.get(name);
  }

  listComposedTools() {
    return Array.from(this.composedTools.values());
  }
}

module.exports = { ToolComposer };
