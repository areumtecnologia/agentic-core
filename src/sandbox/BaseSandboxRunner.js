'use strict';

/**
 * Interface base para runners de sandbox isolados.
 */
class BaseSandboxRunner {
    /**
     * @param {object} [options={}]
     * @param {number} [options.timeoutMs=2000] Timeout máximo de execução em ms
     * @param {number} [options.memoryLimitMb=64] Limite de memória em megabytes
     * @param {boolean} [options.allowNetwork=false] Se permite acesso a rede
     */
    constructor(options = {}) {
        this.timeoutMs = options.timeoutMs || 2000;
        this.memoryLimitMb = options.memoryLimitMb || 64;
        this.allowNetwork = Boolean(options.allowNetwork);
    }

    /**
     * Executa um trecho de código em ambiente seguro e isolado.
     * @param {object} params
     * @param {string} params.code
     * @param {string} [params.language='javascript']
     * @param {Record<string, any>} [params.globals={}]
     * @returns {Promise<{ success: boolean, result?: any, error?: string, durationMs: number }>}
     */
    async runCode({ code, language = 'javascript', globals = {} }) {
        throw new Error('Method runCode() must be implemented by subclass.');
    }

    /**
     * Valida sintaxe antes de despachar para o runner.
     * @param {string} code
     * @returns {boolean}
     */
    validateSyntax(code) {
        if (!code || typeof code !== 'string') return false;
        return true;
    }
}

module.exports = { BaseSandboxRunner };
