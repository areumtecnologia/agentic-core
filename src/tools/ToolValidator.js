/**
 * Tool Validator - Advanced validation for tools
 * Provides schema validation, type checking, and security validation
 */

class ToolValidator {
  constructor() {
    this.customValidators = new Map();
    this.securityRules = new Map();
    this.initializeSecurityRules();
  }

  initializeSecurityRules() {
    // Block dangerous file operations
    this.securityRules.set('file', [
      {
        name: 'block_system_files',
        check: (args) => {
          const dangerousPaths = [
            '/etc/passwd',
            '/etc/shadow',
            'C:\\Windows\\System32',
            'C:\\Windows\\',
            '/root/',
            '/home/'
          ];
          const path = args.filePath || args.dirPath || args.path;
          if (path && dangerousPaths.some(danger => path.includes(danger))) {
            return { valid: false, reason: 'Access to system files is blocked' };
          }
          return { valid: true };
        }
      },
      {
        name: 'block_command_injection',
        check: (args) => {
          const command = args.command;
          if (command) {
            const dangerousPatterns = [
              /;\s*rm\s+-rf/i,
              /;\s*format/i,
              /\|\s*cat\s+/i,
              /&&\s*rm/i
            ];
            if (dangerousPatterns.some(pattern => pattern.test(command))) {
              return { valid: false, reason: 'Command injection detected' };
            }
          }
          return { valid: true };
        }
      }
    ]);

    // Block dangerous web operations
    this.securityRules.set('web', [
      {
        name: 'block_internal_ips',
        check: (args) => {
          const url = args.url;
          if (url) {
            try {
              const urlObj = new URL(url);
              const hostname = urlObj.hostname;
              // Block private IP ranges
              if (hostname.match(/^(127|10|192\.168|172\.(1[6-9]|2[0-9]|3[01])|localhost)/)) {
                return { valid: false, reason: 'Access to internal IPs is blocked' };
              }
            } catch (e) {
              return { valid: false, reason: 'Invalid URL' };
            }
          }
          return { valid: true };
        }
      }
    ]);
  }

  /**
   * Validate tool arguments against schema
   */
  validateSchema(schema, args) {
    const errors = [];
    
    if (!schema || !schema.type) {
      return { valid: true, errors: [] };
    }

    if (schema.type === 'object') {
      // Check required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in args)) {
            errors.push(`Required property '${prop}' is missing`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (prop in args) {
            const validation = this.validateType(propSchema, args[prop], prop);
            if (!validation.valid) {
              errors.push(...validation.errors);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateType(schema, value, path) {
    const errors = [];
    
    if (schema.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${path} must be a string`);
      } else {
        if (schema.minLength && value.length < schema.minLength) {
          errors.push(`${path} must be at least ${schema.minLength} characters`);
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          errors.push(`${path} must be at most ${schema.maxLength} characters`);
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          errors.push(`${path} does not match required pattern`);
        }
      }
    } else if (schema.type === 'number') {
      if (typeof value !== 'number') {
        errors.push(`${path} must be a number`);
      } else {
        if (schema.minimum !== undefined && value < schema.minimum) {
          errors.push(`${path} must be at least ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          errors.push(`${path} must be at most ${schema.maximum}`);
        }
      }
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${path} must be a boolean`);
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`);
      } else if (schema.items) {
        value.forEach((item, index) => {
          const validation = this.validateType(schema.items, item, `${path}[${index}]`);
          if (!validation.valid) {
            errors.push(...validation.errors);
          }
        });
      }
    } else if (schema.type === 'object') {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path} must be an object`);
      } else if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (prop in value) {
            const validation = this.validateType(propSchema, value[prop], `${path}.${prop}`);
            if (!validation.valid) {
              errors.push(...validation.errors);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate security rules for tool
   */
  validateSecurity(category, args) {
    const rules = this.securityRules.get(category) || [];
    const violations = [];

    for (const rule of rules) {
      const result = rule.check(args);
      if (!result.valid) {
        violations.push({
          rule: rule.name,
          reason: result.reason
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Full validation: schema + security
   */
  validate(tool, args) {
    const schemaValidation = this.validateSchema(tool.schema, args);
    const securityValidation = this.validateSecurity(tool.category, args);

    return {
      valid: schemaValidation.valid && securityValidation.valid,
      schemaErrors: schemaValidation.errors,
      securityViolations: securityValidation.violations
    };
  }

  /**
   * Register custom validator
   */
  registerValidator(toolName, validatorFn) {
    this.customValidators.set(toolName, validatorFn);
  }

  /**
   * Validate with custom validator
   */
  validateCustom(toolName, args) {
    const validator = this.customValidators.get(toolName);
    if (validator) {
      return validator(args);
    }
    return { valid: true };
  }
}

module.exports = { ToolValidator };
