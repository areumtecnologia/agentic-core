/**
 * Math Tools Category
 * Provides a secure, sandboxed environment for evaluating mathematical expressions and code.
 * Follows the Program-Aided Language Models (PAL) pattern.
 */

'use strict';

const vm = require('node:vm');

class MathTools {
  /**
   * @param {object} [options={}]
   * @param {string} [options.toolName='calculate_expression'] Nome da ferramenta no catálogo
   * @param {number} [options.timeoutMs=1500] Timeout de execução em milissegundos
   */
  constructor(options = {}) {
    this.toolName = options.toolName || 'calculate_expression';
    this.timeoutMs = options.timeoutMs || 1500;
    this.tools = new Map();

    this.initializeTools();
  }

  initializeTools() {
    this.tools.set(this.toolName, {
      name: this.toolName,
      category: 'math',
      description: 'Executa e avalia expressões matemáticas ou código JavaScript aritmético de forma exata e segura (sandbox). Suporta operadores +, -, *, /, %, parênteses e funções Math (Math.pow, Math.sqrt, Math.round, Math.sin, etc.). Use sempre para calcular números, porcentagens ou fórmulas exatas.',
      schema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'A expressão matemática ou código aritmético a ser calculado (ex: "200 * (1 - 0.15)", "1000 * Math.pow(1.02, 12)", "Math.sqrt(144) + 10").'
          }
        },
        required: ['expression']
      },
      execute: async (args) => {
        return this.evaluate(args);
      }
    });
  }

  /**
   * Corrige e normaliza expressões matemáticas incompletas, com porcentagens ou parênteses desbalanceados.
   * @param {string} expr
   * @returns {string}
   */
  repairExpression(expr) {
    if (!expr || typeof expr !== 'string') return '';
    let repaired = expr.trim();

    // 1. Substitui "x", "X" ou "÷" por operadores válidos
    repaired = repaired.replace(/(\d)\s*[xX]\s*(\d)/g, '$1 * $2');
    repaired = repaired.replace(/(\d)\s*÷\s*(\d)/g, '$1 / $2');

    // 2. Normaliza sintaxe de porcentagens comerciais
    // "200 - 15%" -> "200 * (1 - 0.15)"
    repaired = repaired.replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%/g, '($1 * (1 - $2 / 100))');
    // "200 + 15%" -> "200 * (1 + 0.15)"
    repaired = repaired.replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*%/g, '($1 * (1 + $2 / 100))');
    // "200 * 15%" -> "200 * ($2 / 100)"
    repaired = repaired.replace(/(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)\s*%/g, '($1 * ($2 / 100))');
    // "15% de 200" -> "200 * (15 / 100)"
    repaired = repaired.replace(/(\d+(?:\.\d+)?)\s*%\s*(?:de|of)\s*(\d+(?:\.\d+)?)/gi, '($2 * ($1 / 100))');
    // "15%" isolado -> "(15 / 100)"
    repaired = repaired.replace(/(?<![\d\.])(\d+(?:\.\d+)?)\s*%/g, '($1 / 100)');

    // 3. Remove operadores pendentes no final (ex: "200 *" ou "200 +")
    repaired = repaired.replace(/[\+\-\*\/%]+\s*$/, '').trim();

    // 4. Auto-balanceamento de parênteses não fechados
    const openParens = (repaired.match(/\(/g) || []).length;
    const closeParens = (repaired.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      repaired += ')'.repeat(openParens - closeParens);
    }

    return repaired;
  }

  /**
   * Executa a expressão dentro de um sandbox seguro isolado.
   *
   * @param {object|string} rawArgs
   * @returns {object}
   */
  evaluate(rawArgs) {
    let expression = '';

    if (typeof rawArgs === 'string' || typeof rawArgs === 'number') {
      expression = String(rawArgs);
    } else if (rawArgs && typeof rawArgs === 'object') {
      const val = rawArgs.expression ?? rawArgs.code ?? rawArgs.calc ?? rawArgs.formula ?? rawArgs.exp ?? rawArgs.input ?? rawArgs.query;
      expression = val != null ? String(val) : '';
    }

    const cleanExpr = this.repairExpression(expression);

    if (!cleanExpr) {
      return {
        success: false,
        error: 'Nenhuma expressão matemática válida fornecida.'
      };
    }

    // ── Barreira 1: Bloqueio Estrito de Segurança contra RCE & Prototype Pollution ──
    const forbiddenPatterns = [
      /\bprocess\b/i,
      /\brequire\b/i,
      /\bimport\b/i,
      /\bglobal\b/i,
      /\bglobalThis\b/i,
      /\bconstructor\b/i,
      /__proto__/i,
      /\bprototype\b/i,
      /\bFunction\b/i,
      /\beval\b/i,
      /\bchild_process\b/i,
      /\bfs\b/i,
      /\bwindow\b/i,
      /\bdocument\b/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(cleanExpr)) {
        return {
          success: false,
          error: `Security Violation: O uso de "${pattern.source}" é estritamente proibido no ambiente matemático.`
        };
      }
    }

    // ── Barreira 2: Sandbox Isolado ──
    const sandbox = Object.create(null);
    sandbox.Math = Math;
    sandbox.Number = Number;
    sandbox.parseInt = parseInt;
    sandbox.parseFloat = parseFloat;
    sandbox.isNaN = isNaN;
    sandbox.isFinite = isFinite;

    try {
      // Se for apenas uma expressão simples, envolve para retorno direto
      const wrappedCode = cleanExpr.includes(';') || cleanExpr.includes('return')
        ? `"use strict"; (function() { ${cleanExpr} })()`
        : `"use strict"; (${cleanExpr})`;

      const result = vm.runInNewContext(wrappedCode, sandbox, {
        timeout: this.timeoutMs,
        microtaskMode: 'afterEvaluate',
      });

      // Valida que o resultado é seguro e serializável
      if (typeof result === 'function' || (typeof result === 'object' && result !== null && !(result instanceof Number))) {
        return {
          success: false,
          error: 'A expressão não retornou um valor numérico ou primitivo válido.'
        };
      }

      return {
        success: true,
        expression: cleanExpr,
        result: typeof result === 'number' ? Number(result.toFixed(10).replace(/\.?0+$/, '')) : result
      };
    } catch (err) {
      return {
        success: false,
        expression: cleanExpr,
        error: `Erro ao calcular expressão: ${err.message}`
      };
    }
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  getTool(name) {
    return this.tools.get(name);
  }
}

module.exports = { MathTools };
