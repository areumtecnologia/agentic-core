# Built-in Tools for Agentic Core

This module provides a comprehensive set of built-in tools organized by categories with support for composition, validation, and marketplace features.

## Categories

### Web Tools
- `web_search` - Search the web using DuckDuckGo
- `http_fetch` - Fetch content from URLs
- `validate_url` - Validate URL accessibility

### File Tools
- `read_file` - Read file contents
- `write_file` - Write to files
- `list_directory` - List directory contents
- `file_exists` - Check file existence

### Database Tools
- `sql_query` - Execute SQL queries
- `db_schema` - Get database schema
- `db_health` - Check database health

### System Tools
- `system_info` - Get system information
- `execute_command` - Execute shell commands
- `get_env` - Get environment variables
- `current_datetime` - Get current date/time

### Communication Tools
- `send_email` - Send emails
- `send_sms` - Send SMS messages
- `send_notification` - Send notifications
- `trigger_webhook` - Trigger webhooks

## Features

### Tool Composition
Chain multiple tools together to create complex workflows:
```javascript
const composer = new ToolComposer(registry);
const workflow = composer.compose('my_workflow', [
  { name: 'web_search', transform: ... },
  { name: 'write_file', transform: ... }
]);
```

### Tool Validation
Validate tool arguments against schemas and security rules:
```javascript
const validator = new ToolValidator();
const result = validator.validate(tool, args);
```

### Tool Marketplace
Discover, rate, and track tools:
```javascript
const marketplace = new ToolMarketplace();
marketplace.registerTool(tool, metadata);
const tools = marketplace.discoverByCategory('web');
```

## Usage

```javascript
const { ToolRegistry } = require('./tools');
const registry = new ToolRegistry();

// Get a tool
const tool = registry.getTool('read_file');

// Execute with validation
const result = await tool.execute({ filePath: '/path/to/file.txt' });

// List all tools
const tools = registry.listTools();
const webTools = registry.listTools('web');
```

## Examples

See the `examples/` directory for usage examples:
- `tool_composition_example.js` - Tool chaining and composition
- `validation_example.js` - Schema and security validation
- `marketplace_example.js` - Tool discovery and rating
