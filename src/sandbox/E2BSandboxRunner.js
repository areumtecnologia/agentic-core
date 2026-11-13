'use strict';

const { BaseSandboxRunner } = require('./BaseSandboxRunner');

class E2BSandboxRunner extends BaseSandboxRunner {
    #apiKey;
    #template;

    /**
     * @param {object} [options={}]
     * @param {string} [options.apiKey] Chave de API E2B (E2B_API_KEY)
     * @param {string} [options.template='code-interpreter-v1'] Template do sandbox microVM
     * @param {number} [options.timeoutMs=30000] Timeout máximo em ms (padrão 30s para microVM)
     */
    constructor(options = {}) {
        super({ ...options, timeoutMs: options.timeoutMs || 30000 });
        this.#apiKey = options.apiKey || process.env.E2B_API_KEY || '';
        this.#template = options.template || 'code-interpreter-v1';
    }

    get isConfigured() {
        return Boolean(this.#apiKey);
    }

    /**
     * Executa código em uma MicroVM isolada na nuvem (Python, Bash, Node.js).
     * @param {object} params
     * @param {string} params.code
     * @param {string} [params.language='python'] 'python' | 'bash' | 'javascript'
     * @returns {Promise<{ success: boolean, result?: any, error?: string, durationMs: number }>}
     */
    async runCode({ code, language = 'python' }) {
        const start = Date.now();

        if (!code || typeof code !== 'string') {
            return { success: false, error: 'Código vazio ou inválido.', durationMs: 0 };
        }

        if (!this.isConfigured) {
            return {
                success: false,
                error: 'E2BSandboxRunner não configurado. Defina a variável E2B_API_KEY ou passe apiKey no construtor.',
                durationMs: Date.now() - start
            };
        }

        try {
            // Tenta importar dinamicamente o pacote @e2b/code-interpreter se instalado
            let CodeInterpreter;
            try {
                const e2b = require('@e2b/code-interpreter');
                CodeInterpreter = e2b.CodeInterpreter || e2b.default || e2b;
            } catch {
                throw new Error('O pacote "@e2b/code-interpreter" não está instalado no projeto. Instale via "npm install @e2b/code-interpreter".');
            }

            const sandbox = await CodeInterpreter.create({ apiKey: this.#apiKey });
            try {
                let execution;
                if (language === 'bash' || language === 'sh') {
                    execution = await sandbox.commands.run(code, { timeoutMs: this.timeoutMs });
                    return {
                        success: execution.exitCode === 0,
                        result: execution.stdout || execution.stderr,
                        error: execution.exitCode !== 0 ? execution.stderr : undefined,
                        durationMs: Date.now() - start
                    };
                }

                // Python ou outras linguagens
                execution = await sandbox.notebook.execCell(code);
                const outputText = execution.text || (execution.results && execution.results.length ? execution.results[0].text : '');
                const hasError = execution.error || (execution.logs && execution.logs.stderr && execution.logs.stderr.length > 0);

                return {
                    success: !hasError,
                    result: outputText,
                    error: execution.error ? execution.error.value : undefined,
                    durationMs: Date.now() - start
                };
            } finally {
                await sandbox.kill().catch(() => {});
            }
        } catch (err) {
            return {
                success: false,
                error: `E2B Execution Failed: ${err.message}`,
                durationMs: Date.now() - start
            };
        }
    }
}

module.exports = { E2BSandboxRunner };
