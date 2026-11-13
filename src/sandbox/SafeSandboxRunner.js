'use strict';

const vm = require('node:vm');
const { BaseSandboxRunner } = require('./BaseSandboxRunner');

const FORBIDDEN_PATTERNS = [
    /\bprocess\b/i,
    /\brequire\b/i,
    /\bimport\b/i,
    /\bglobal\b/i,
    /\bglobalThis\b/i,
    /\bconstructor\b/i,
    /__proto__/i,
    /\bprototype\b/i,
    /\bFunction\b/,
    /\beval\b/i,
    /\bchild_process\b/i,
    /\bfs\b/i,
    /\bwindow\b/i,
    /\bdocument\b/i,
    /\bfetch\b/i,
    /\bXMLHttpRequest\b/i,
    /\bWebSocket\b/i,
    /\bBuffer\b/i,
    /\bReflect\b/i,
    /\bProxy\b/i
];

class SafeSandboxRunner extends BaseSandboxRunner {
    /**
     * @param {object} [options={}]
     */
    constructor(options = {}) {
        super(options);
    }

    /**
     * Executa o código sincronicamente em sandbox blindado com contexto nulo.
     * @param {object} params
     * @param {string} params.code
     * @param {Record<string, any>} [params.globals={}]
     * @returns {{ success: boolean, result?: any, error?: string, durationMs: number }}
     */
    runCodeSync({ code, globals = {} }) {
        const start = Date.now();

        if (!code || typeof code !== 'string') {
            return {
                success: false,
                error: 'Código inválido ou vazio.',
                durationMs: 0
            };
        }

        const trimmed = code.trim();

        // ── 1. Análise Estática de Segurança ──
        for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(trimmed)) {
                return {
                    success: false,
                    error: `Security Violation: O uso de "${pattern.source}" é estritamente proibido no sandbox seguro.`,
                    durationMs: Date.now() - start
                };
            }
        }

        // ── 2. Contexto Hermético Isolado ──
        const contextObject = Object.create(null);
        contextObject.Math = Math;
        contextObject.Number = Number;
        contextObject.parseInt = parseInt;
        contextObject.parseFloat = parseFloat;
        contextObject.isNaN = isNaN;
        contextObject.isFinite = isFinite;
        contextObject.String = String;
        contextObject.Array = Array;
        contextObject.Boolean = Boolean;
        contextObject.Date = Date;

        // Injeta globais permitidas pelo usuário com validação
        for (const [k, v] of Object.entries(globals)) {
            if (k && !FORBIDDEN_PATTERNS.some(p => p.test(k))) {
                contextObject[k] = v;
            }
        }

        const context = vm.createContext(contextObject, {
            codeGeneration: {
                strings: false,
                wasm: false
            }
        });

        // ── 3. Execução Controlada com Timeout ──
        try {
            let wrappedCode;
            const hasStatements = trimmed.includes(';') || trimmed.includes('return') || /\b(while|for|if|let|const|var|switch|try)\b/.test(trimmed);

            if (trimmed.includes('return')) {
                wrappedCode = `"use strict"; (function() { ${trimmed} })()`;
            } else if (hasStatements) {
                if (trimmed.includes(';')) {
                    const parts = trimmed.split(';').map(s => s.trim()).filter(Boolean);
                    if (parts.length > 0) {
                        const last = parts.pop();
                        const init = parts.join('; ');
                        if (/\b(while|for|if|let|const|var)\b/.test(last)) {
                            wrappedCode = `"use strict"; (function() { ${trimmed} })()`;
                        } else {
                            wrappedCode = `"use strict"; (function() { ${init ? init + ';' : ''} return (${last}); })()`;
                        }
                    } else {
                        wrappedCode = `"use strict"; (function() { ${trimmed} })()`;
                    }
                } else {
                    wrappedCode = `"use strict"; (function() { ${trimmed} })()`;
                }
            } else {
                wrappedCode = `"use strict"; (${trimmed})`;
            }

            const script = new vm.Script(wrappedCode, {
                displayErrors: false
            });

            const rawResult = script.runInContext(context, {
                timeout: this.timeoutMs,
                breakOnSigint: true
            });

            let finalResult = rawResult;
            if (typeof rawResult === 'bigint') {
                finalResult = rawResult.toString();
            } else if (rawResult !== null && typeof rawResult === 'object') {
                // Serializa para evitar vazamento de referências do sandbox
                finalResult = JSON.parse(JSON.stringify(rawResult));
            }

            return {
                success: true,
                result: finalResult,
                durationMs: Date.now() - start
            };
        } catch (err) {
            const isTimeout = err?.message?.includes('timed out') || err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
            return {
                success: false,
                error: isTimeout ? `Timeout Execution (timed out): Código excedeu o limite de ${this.timeoutMs}ms.` : (err?.message || 'Erro durante execução no sandbox.'),
                durationMs: Date.now() - start
            };
        }
    }

    /**
     * Executa o código em sandbox blindado assincronamente.
     * @param {object} params
     * @param {string} params.code
     * @param {Record<string, any>} [params.globals={}]
     * @returns {Promise<{ success: boolean, result?: any, error?: string, durationMs: number }>}
     */
    async runCode({ code, globals = {} }) {
        return this.runCodeSync({ code, globals });
    }
}

module.exports = {
    SafeSandboxRunner,
    FORBIDDEN_PATTERNS
};
