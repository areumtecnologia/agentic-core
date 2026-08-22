/**
 * Complete example demonstrating all tools features
 */

const { ToolRegistry } = require('../index');
const { ToolComposer } = require('../ToolComposer');
const { ToolValidator } = require('../ToolValidator');
const { ToolMarketplace } = require('../ToolMarketplace');

const registry = new ToolRegistry();
const composer = new ToolComposer(registry);
const validator = new ToolValidator();
const marketplace = new ToolMarketplace();

async function completeExample() {
  console.log('=== Agentic Core Tools Demo ===\n');

  // 1. List all tools
  console.log('1. Available Tools:');
  const allTools = registry.listTools();
  console.log(`   Total tools: ${allTools.length}`);
  const categories = registry.getCategories();
  categories.forEach(cat => {
    const tools = registry.listTools(cat);
    console.log(`   ${cat}: ${tools.length} tools`);
  });

  // 2. Tool validation
  console.log('\n2. Tool Validation:');
  const webSearchTool = registry.getTool('web_search');
  const validArgs = { query: 'artificial intelligence' };
  const invalidArgs = { query: 123 };
  
  console.log('   Valid args:', validator.validate(webSearchTool, validArgs).valid);
  console.log('   Invalid args:', validator.validate(webSearchTool, invalidArgs).valid);

  // 3. Tool composition
  console.log('\n3. Tool Composition:');
  const researchWorkflow = composer.compose(
    'research_workflow',
    [
      {
        name: 'web_search',
        transform: (args) => ({ query: args.topic, maxResults: 5 })
      },
      {
        name: 'write_file',
        transform: (searchResults) => ({
          filePath: `research_${Date.now()}.md`,
          content: `# Research: ${searchResults.query}\n\n${JSON.stringify(searchResults, null, 2)}`
        })
      }
    ],
    'Research topic and save results'
  );
  console.log('   Created workflow:', researchWorkflow.name);

  // 4. Marketplace
  console.log('\n4. Tool Marketplace:');
  allTools.slice(0, 3).forEach(tool => {
    marketplace.registerTool(tool, {
      author: 'Agentic Core',
      version: '1.0.0',
      tags: [tool.category]
    });
  });
  
  console.log('   Registered tools in marketplace');
  console.log('   Categories:', marketplace.getCategories());
  console.log('   Web tools:', marketplace.discoverByCategory('web').length);

  // 5. Parallel execution
  console.log('\n5. Parallel Execution:');
  const parallelTools = composer.parallel(
    'system_check',
    [
      { name: 'system_info' },
      { name: 'current_datetime' }
    ],
    'Check system and time'
  );
  console.log('   Created parallel tool:', parallelTools.name);

  console.log('\n=== Demo Complete ===');
  console.log('\nAll tools are ready to use!');
  console.log('See README.md for detailed documentation.');
}

if (require.main === module) {
  completeExample().catch(console.error);
}

module.exports = { completeExample };
