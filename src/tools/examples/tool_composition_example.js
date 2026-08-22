/**
 * Example of tool composition and chaining
 */

const { ToolRegistry } = require('../index');
const { ToolComposer } = require('../ToolComposer');

async function example() {
  const registry = new ToolRegistry();
  const composer = new ToolComposer(registry);

  // Example 1: Chain file read -> web search -> file write
  const researchWorkflow = composer.compose(
    'research_and_save',
    [
      {
        name: 'web_search',
        transform: (result, initialArgs) => ({
          query: initialArgs.topic,
          maxResults: 5
        })
      },
      {
        name: 'write_file',
        transform: (searchResults) => ({
          filePath: `research_${Date.now()}.md`,
          content: `# Research: ${searchResults.query}\n\n${JSON.stringify(searchResults, null, 2)}`
        })
      }
    ],
    'Research a topic and save results to file'
  );

  // Example 2: Parallel execution
  const parallelTools = composer.parallel(
    'system_check',
    [
      { name: 'system_info' },
      { name: 'current_datetime' }
    ],
    'Get system info and current time in parallel'
  );

  // Example 3: Conditional execution
  const conditionalTool = composer.conditional(
    'smart_file_operation',
    [
      {
        when: (args) => args.operation === 'read',
        tool: 'read_file',
        args: (args) => ({ filePath: args.path })
      },
      {
        when: (args) => args.operation === 'write',
        tool: 'write_file',
        args: (args) => ({ filePath: args.path, content: args.content })
      }
    ]
  );

  console.log('Composed tools created successfully');
  console.log('Available tools:', registry.listTools().map(t => t.name));
}

module.exports = { example };
