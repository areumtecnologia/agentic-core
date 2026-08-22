/**
 * Example of tool marketplace usage
 */

const { ToolMarketplace } = require('../ToolMarketplace');
const { ToolRegistry } = require('../index');

async function example() {
  const marketplace = new ToolMarketplace();
  const registry = new ToolRegistry();

  // Register tools from registry
  registry.listTools().forEach(tool => {
    marketplace.registerTool(tool, {
      author: 'Agentic Core',
      version: '1.0.0',
      tags: [tool.category, 'builtin']
    });
  });

  // Discover tools
  console.log('Web tools:', marketplace.discoverByCategory('web').map(t => t.name));
  console.log('File tools:', marketplace.discoverByTag('file').map(t => t.name));

  // Search tools
  console.log('Search results for "read":', marketplace.search('read').map(t => t.name));

  // Rate a tool
  const toolId = Array.from(marketplace.tools.keys())[0];
  marketplace.rateTool(toolId, 5, 'Great tool!');
  
  console.log('Tool rating:', marketplace.getTool(toolId).rating);
}

module.exports = { example };
