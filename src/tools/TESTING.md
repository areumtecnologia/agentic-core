# Tools Testing Guide

## Running Tests

```bash
# Run all tests
npm test

# Run tools-specific tests
npm test -- tests/tools

# Run with coverage
npm run test:coverage
```

## Test Structure

```
tests/
├── tools/
│   ├── test_tool_registry.js
│   ├── test_tool_composer.js
│   ├── test_tool_validator.js
│   ├── test_tool_marketplace.js
│   └── categories/
│       ├── test_web_tools.js
│       ├── test_file_tools.js
│       ├── test_database_tools.js
│       ├── test_system_tools.js
│       └── test_communication_tools.js
```

## Writing Tests

### Example Tool Test
```javascript
const { ToolRegistry } = require('../../src/tools');

describe('Tool Registry', () => {
  let registry;
  
  beforeEach(() => {
    registry = new ToolRegistry();
  });
  
  test('should register and retrieve tools', () => {
    const tool = registry.getTool('web_search');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('web_search');
  });
  
  test('should list tools by category', () => {
    const webTools = registry.listTools('web');
    expect(webTools.length).toBeGreaterThan(0);
    expect(webTools.every(t => t.category === 'web')).toBe(true);
  });
});
```

## Manual Testing

### Test Tool Execution
```javascript
const { registry } = require('./src/tools');

// Test web search
const result = await registry.executeTool('web_search', {
  query: 'artificial intelligence'
});
console.log(result);

// Test file operations
const fileResult = await registry.executeTool('read_file', {
  filePath: './test.txt'
});
```

## Integration Tests

Test tool composition:
```javascript
const { registry, composer } = require('./src/tools');

const workflow = composer.compose('research_workflow', [
  { name: 'web_search', transform: args => ({ query: args.topic }) },
  { name: 'write_file', transform: (result) => ({
    filePath: 'research.md',
    content: JSON.stringify(result, null, 2)
  })}
]);

const result = await workflow.execute({ topic: 'AI' });
```

## Performance Testing

```javascript
const { registry } = require('./src/tools');

async function benchmarkTool(toolName, args, iterations = 100) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await registry.executeTool(toolName, args);
    times.push(Date.now() - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`${toolName}: ${avg.toFixed(2)}ms avg`);
}
```

## Debugging

Enable debug logging:
```javascript
process.env.DEBUG = 'tools:*';
```

Check tool validation:
```javascript
const { validator } = require('./src/tools');
const validation = validator.validate(tool, args);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```
