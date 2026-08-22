/**
 * System Tools Category
 * Tools for system operations: process, environment, etc.
 */

const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SystemTools {
  constructor() {
    this.tools = new Map();
    this.initializeTools();
  }

  initializeTools() {
    // System Info Tool
    this.tools.set('system_info', {
      name: 'system_info',
      category: 'system',
      description: 'Get system information',
      schema: {
        type: 'object',
        properties: {}
      },
      execute: async () => {
        return {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptime: os.uptime(),
          loadAvg: os.loadavg(),
          totalMem: os.totalmem(),
          freeMem: os.freemem(),
          cpus: os.cpus().length,
          nodeVersion: process.version,
          pid: process.pid
        };
      }
    });

    // Execute Command Tool
    this.tools.set('execute_command', {
      name: 'execute_command',
      category: 'system',
      description: 'Execute a shell command',
      schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command to execute'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)'
          }
        },
        required: ['command']
      },
      execute: async (args) => {
        const { command, timeout = 30000 } = args;
        
        // Security check - block dangerous commands
        const dangerousPatterns = [
          /rm\s+-rf/i,
          /format/i,
          /del\s+\/s/i,
          /mkfs/i
        ];
        
        for (const pattern of dangerousPatterns) {
          if (pattern.test(command)) {
            throw new Error('Command blocked for security reasons');
          }
        }
        
        try {
          const { stdout, stderr } = await execPromise(command, { timeout });
          return {
            command,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            success: !stderr
          };
        } catch (error) {
          return {
            command,
            stdout: error.stdout?.trim() || '',
            stderr: error.stderr?.trim() || error.message,
            success: false,
            exitCode: error.code
          };
        }
      }
    });

    // Environment Variables Tool
    this.tools.set('get_env', {
      name: 'get_env',
      category: 'system',
      description: 'Get environment variables',
      schema: {
        type: 'object',
        properties: {
          keys: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific keys to retrieve (optional)'
          }
        }
      },
      execute: async (args) => {
        const { keys } = args;
        
        if (keys && Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => {
            result[key] = process.env[key] || null;
          });
          return result;
        }
        
        // Return non-sensitive env vars only
        const safeVars = {};
        for (const [key, value] of Object.entries(process.env)) {
          if (!key.includes('KEY') && !key.includes('SECRET') && !key.includes('TOKEN') && !key.includes('PASSWORD')) {
            safeVars[key] = value;
          }
        }
        return safeVars;
      }
    });

    // Current DateTime Tool
    this.tools.set('current_datetime', {
      name: 'current_datetime',
      category: 'system',
      description: 'Get current date and time',
      schema: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (default: local)'
          },
          format: {
            type: 'string',
            description: 'Output format (iso, locale, unix)'
          }
        }
      },
      execute: async (args) => {
        const { timezone = 'local', format = 'iso' } = args;
        const now = new Date();
        
        if (format === 'unix') {
          return { timestamp: now.getTime() };
        }
        
        if (format === 'locale') {
          return {
            datetime: now.toLocaleString('pt-BR', { timeZone: timezone === 'local' ? undefined : timezone }),
            timezone
          };
        }
        
        return {
          datetime: now.toISOString(),
          timezone,
          timestamp: now.getTime()
        };
      }
    });
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  getTool(name) {
    return this.tools.get(name);
  }
}

module.exports = { SystemTools };
