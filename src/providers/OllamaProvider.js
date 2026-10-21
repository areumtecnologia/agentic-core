'use strict';

const { OpenAIProvider } = require('./OpenAIProvider');

// ─────────────────────────────────────────────────────────────────────────────
// OllamaProvider — provedor para modelos locais Ollama usando a API OpenAI (/v1)
// ─────────────────────────────────────────────────────────────────────────────

class OllamaProvider extends OpenAIProvider {
    /**
     * @param {object} options
     * @param {string} options.model    Nome do modelo local (ex: 'gemma4:e4b', 'qwen2.5:0.5b')
     * @param {string} [options.baseURL='http://localhost:11434/v1']  URL base do Ollama
     * @param {string} [options.apiKey] Chave de API opcional (para proxies)
     * @param {string[]} [options.stop] Sequências de parada customizadas
     * @param {object} [options.openAIOptions={}]
     */
    constructor({ model, baseURL = 'http://localhost:11434/v1', apiKey, stop, openAIOptions = {} } = {}) {
        if (!model) throw new TypeError('[OllamaProvider] model is required.');

        let cleanBase = (baseURL || 'http://localhost:11434').replace(/\/+$/, '');
        if (!cleanBase.endsWith('/v1')) {
            cleanBase += '/v1';
        }

        super({
            apiKey: apiKey || 'ollama',
            model,
            baseURL: cleanBase,
            allowEmptyApiKey: true,
            openAIOptions,
        });

        this.customStop = stop || null;
    }

    getName() {
        return 'ollama';
    }

    /**
     * Identifica se o modelo configurado é pequeno (geralmente <= 1.5B parâmetros).
     * @returns {boolean}
     */
    isSmallModel() {
        const m = (this.model || '').toLowerCase();
        return (
            m.includes('0.5b') ||
            m.includes('0.6b') ||
            m.includes('0.8b') ||
            m.includes('350m') ||
            m.includes('1b') ||
            m.includes('1.2b') ||
            m.includes('functiongemma') ||
            m.includes('minicpm5-1b') ||
            m.includes('drana')
        );
    }

    /**
     * Verifica se o modelo suporta a role 'system' nativamente em seu template de chat.
     * @returns {boolean}
     */
    supportsSystemRole() {
        const m = (this.model || '').toLowerCase();
        return !m.includes('functiongemma');
    }

    /**
     * Retorna os stop tokens padrão para evitar loops infinitos em modelos compactos.
     * @returns {string[]}
     */
    getDefaultStopTokens() {
        const m = (this.model || '').toLowerCase();
        if (m.includes('functiongemma')) {
            return [];
        }
        return ['<|im_end|>', '<|endoftext|>', '<end_of_turn>', '<end_function_call>', '</tool_call>'];
    }

    async generateContent({ contents, systemInstruction, tools, config, signal }) {
        const modifiedConfig = { ...config };
        if (!modifiedConfig.stop) {
            modifiedConfig.stop = this.customStop || (this.isSmallModel() ? this.getDefaultStopTokens() : undefined);
        }
        return super.generateContent({ contents, systemInstruction, tools, config: modifiedConfig, signal });
    }

    async *generateContentStream({ contents, systemInstruction, tools, config, signal }) {
        const modifiedConfig = { ...config };
        if (!modifiedConfig.stop) {
            modifiedConfig.stop = this.customStop || (this.isSmallModel() ? this.getDefaultStopTokens() : undefined);
        }
        yield* super.generateContentStream({ contents, systemInstruction, tools, config: modifiedConfig, signal });
    }
}

module.exports = { OllamaProvider };
