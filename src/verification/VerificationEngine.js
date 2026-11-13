'use strict';

const EventEmitter = require('events');

class VerificationEngine extends EventEmitter {
    #sandboxRunner;
    #customVerifier;
    #criticProvider;

    /**
     * @param {object} [options={}]
     * @param {boolean} [options.enabled=true]
     * @param {Array<string>} [options.modes=['code', 'schema']] 'code' | 'schema' | 'custom'
     * @param {number} [options.maxRetries=2]
     * @param {import('../sandbox/BaseSandboxRunner').BaseSandboxRunner} [options.sandboxRunner]
     * @param {function} [options.customVerifier]
     * @param {import('../providers/BaseProvider').BaseProvider} [options.criticProvider]
     */
    constructor(options = {}) {
        super();
        this.enabled = options.enabled !== false;
        this.modes = Array.isArray(options.modes) ? options.modes : ['code', 'schema'];
        this.maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 2;
        this.#sandboxRunner = options.sandboxRunner || null;
        this.#customVerifier = typeof options.customVerifier === 'function' ? options.customVerifier : null;
        this.#criticProvider = options.criticProvider || null;
    }

    get sandboxRunner() {
        return this.#sandboxRunner;
    }

    setSandboxRunner(runner) {
        this.#sandboxRunner = runner;
    }

    /**
     * Extrai blocos de código markdown do texto (ex: ```js ... ``` ou ```json ... ```).
     * @param {string} text
     * @returns {Array<{ language: string, code: string }>}
     */
    extractCodeBlocks(text) {
        if (!text || typeof text !== 'string') return [];
        const blocks = [];
        const regex = /```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const language = (match[1] || 'javascript').toLowerCase().trim();
            const code = (match[2] || '').trim();
            if (code) {
                blocks.push({ language, code });
            }
        }

        return blocks;
    }

    /**
     * Valida sintaticamente blocos de código extraídos no sandbox.
     * @param {string} text
     * @returns {Promise<{ valid: boolean, feedback?: string, error?: string }>}
     */
    async verifyCodeBlocks(text) {
        if (!this.#sandboxRunner) return { valid: true };

        const blocks = this.extractCodeBlocks(text);
        if (blocks.length === 0) return { valid: true };

        for (const block of blocks) {
            // Valida apenas blocos em JS ou JSON (outras linguagens são ignoradas se não suportadas no runner)
            if (['javascript', 'js', 'node'].includes(block.language)) {
                const exec = typeof this.#sandboxRunner.runCodeSync === 'function'
                    ? this.#sandboxRunner.runCodeSync({ code: block.code })
                    : await this.#sandboxRunner.runCode({ code: block.code });

                if (!exec.success) {
                    return {
                        valid: false,
                        error: exec.error,
                        feedback: `O bloco de código JavaScript gerado na sua resposta falhou na validação de sintaxe/execução:\nErro: ${exec.error}\nPor favor, corrija o código gerado.`
                    };
                }
            } else if (['json'].includes(block.language)) {
                try {
                    JSON.parse(block.code);
                } catch (err) {
                    return {
                        valid: false,
                        error: err.message,
                        feedback: `O bloco JSON gerado na sua resposta possui erro de sintaxe:\nErro: ${err.message}\nPor favor, retorne um JSON válido e estrito.`
                    };
                }
            }
        }

        return { valid: true };
    }

    /**
     * Executa a bateria de verificação configurada sobre o texto gerado.
     * 
     * @param {string} candidateText Texto de resposta proposto pelo modelo (Actor)
     * @param {object} [context={}] Contexto do turno (session, depth, turnHistory)
     * @returns {Promise<{ valid: boolean, score: number, mode: string, feedback?: string, violations: string[], durationMs: number }>}
     */
    async verify(candidateText, context = {}) {
        const start = Date.now();
        const violations = [];

        if (!this.enabled || !candidateText || typeof candidateText !== 'string') {
            return {
                valid: true,
                score: 1.0,
                mode: 'skipped',
                violations: [],
                durationMs: Date.now() - start
            };
        }

        // 1. Verificação de Código e Sintaxe
        if (this.modes.includes('code') || this.modes.includes('all')) {
            const codeCheck = await this.verifyCodeBlocks(candidateText);
            if (!codeCheck.valid) {
                violations.push(codeCheck.error || 'Syntax error in code block');
                return {
                    valid: false,
                    score: 0.0,
                    mode: 'code',
                    feedback: codeCheck.feedback,
                    violations,
                    durationMs: Date.now() - start
                };
            }
        }

        // 2. Verificação Customizada do Desenvolvedor
        if ((this.modes.includes('custom') || this.modes.includes('all') || this.#customVerifier) && this.#customVerifier) {
            try {
                const customRes = await this.#customVerifier(candidateText, context);
                if (customRes && customRes.valid === false) {
                    const feedback = customRes.feedback || 'A resposta foi rejeitada pelo validador customizado.';
                    violations.push(feedback);
                    return {
                        valid: false,
                        score: typeof customRes.score === 'number' ? customRes.score : 0.0,
                        mode: 'custom',
                        feedback,
                        violations,
                        durationMs: Date.now() - start
                    };
                }
            } catch (err) {
                violations.push(`Custom verifier error: ${err.message}`);
                return {
                    valid: false,
                    score: 0.0,
                    mode: 'custom',
                    feedback: `Erro no verificador customizado: ${err.message}`,
                    violations,
                    durationMs: Date.now() - start
                };
            }
        }

        return {
            valid: true,
            score: 1.0,
            mode: 'passed',
            violations: [],
            durationMs: Date.now() - start
        };
    }
}

module.exports = { VerificationEngine };

