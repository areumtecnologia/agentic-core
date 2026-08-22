/**
 * Example of tool validation
 */

const { ToolRegistry } = require('../index');
const { ToolValidator } = require('../ToolValidator');

async function example() {
  const registry = new ToolRegistry();
  const validator = new ToolValidator();

  // Get a tool
  const readFileTool = registry.getTool('read_file');
  
  // Validate arguments
  const validArgs = {
    filePath: '/path/to/file.txt',
    encoding: 'utf8'
  };

  const invalidArgs = {
    filePath: 123, // Should be string
    encoding: 'utf8'
  };

  console.log('Valid args validation:', validator.validate(readFileTool, validArgs));
  console.log('Invalid args validation:', validator.validate(readFileTool, invalidArgs));

  // Security validation example
  const dangerousArgs = {
    filePath: '/etc/passwd'
  };

  console.log('Security validation:', validator.validateSecurity('file', dangerousArgs));
}

module.exports = { example };
