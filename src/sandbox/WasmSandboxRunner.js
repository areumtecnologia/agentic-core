'use strict';

const { BaseSandboxRunner } = require('./BaseSandboxRunner');
const { SafeSandboxRunner } = require('./SafeSandboxRunner');

class WasmSandboxRunner extends BaseSandboxRunner {
    #fallbackRunner;

    /**
     * @param {object} [options={}]
     * @param {number} [options.timeoutMs=2000]
     * @param {number} [options.memoryLimitMb=64]
     * @param {number} [options.maxMemoryPages=1024]
     */
    constructor(options = {}) {
        super(options);
        this.maxMemoryPages = options.maxMemoryPages || 1024; // 1024 páginas = 64MB (64KB por página)
        this.#fallbackRunner = new SafeSandboxRunner(options);
    }

    /**
     * Executa código em ambiente isolado.
     * Suporta JavaScript isolado e binários WebAssembly (Wasm).
     * 
     * @param {object} params
     * @param {string|Buffer|Uint8Array} params.code Código JS ou bytecode WASM
     * @param {string} [params.language='javascript'] 'javascript' | 'wasm'
     * @param {string} [params.entrypoint='main'] Função de entrada para binários WASM
     * @param {Array<any>} [params.args=[]] Argumentos para a função WASM
     * @param {Record<string, any>} [params.globals={}] Globais para JS
     * @returns {Promise<{ success: boolean, result?: any, error?: string, durationMs: number }>}
     */
    async runCode({ code, language = 'javascript', entrypoint = 'main', args = [], globals = {} }) {
        const start = Date.now();

        if (language === 'wasm' || Buffer.isBuffer(code) || code instanceof Uint8Array) {
            return this.runWasmBytecode(code, entrypoint, args);
        }

        // Execução de JavaScript via sandbox com proteção total de memória
        return this.#fallbackRunner.runCode({ code, globals });
    }

    /**
     * Executa diretamente um buffer ou módulo WebAssembly com restrição estrita de páginas de memória.
     * @param {Buffer|Uint8Array} wasmBinary
     * @param {string} entrypoint
     * @param {Array<any>} args
     * @returns {Promise<{ success: boolean, result?: any, error?: string, durationMs: number }>}
     */
    async runWasmBytecode(wasmBinary, entrypoint = 'main', args = []) {
        const start = Date.now();
        try {
            if (!wasmBinary || (typeof wasmBinary !== 'object')) {
                throw new Error('Bytecode WebAssembly inválido.');
            }

            // Aloca memória WebAssembly controlada com teto máximo
            const memory = new WebAssembly.Memory({
                initial: 1,
                maximum: this.maxMemoryPages
            });

            const importObject = {
                env: {
                    memory,
                    abort: () => { throw new Error('WASM execution aborted'); }
                }
            };

            const module = await WebAssembly.compile(wasmBinary);
            const instance = await WebAssembly.instantiate(module, importObject);

            const fn = instance.exports[entrypoint];
            if (typeof fn !== 'function') {
                throw new Error(`Entrypoint "${entrypoint}" não encontrado nas exportações do módulo WASM.`);
            }

            const result = fn(...args);

            return {
                success: true,
                result,
                durationMs: Date.now() - start
            };
        } catch (err) {
            return {
                success: false,
                error: `Wasm Execution Error: ${err.message}`,
                durationMs: Date.now() - start
            };
        }
    }
}

module.exports = { WasmSandboxRunner };
