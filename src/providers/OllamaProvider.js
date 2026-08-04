'use strict';

const { OpenAIProvider } = require('./OpenAIProvider');

// ─────────────────────────────────────────────────────────────────────────────
// OllamaProvider — provedor para modelos locais Ollama usando a API OpenAI (/v1)
// ─────────────────────────────────────────────────────────────────────────────

class OllamaProvider extends OpenAIProvider {
    /**
     * @param {object} options
     * @param {string} options.model    Nome do modelo local (ex: 'gemma4:e4b')
     * @param {string} [options.baseURL='http://localhost:11434/v1']  URL base do Ollama
     * @param {string} [options.apiKey] Chave de API opcional (para proxies)
     */
    constructor({ model, baseURL = 'http://localhost:11434/v1', apiKey } = {}) {
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
        });
    }

    getName() {
        return 'ollama';
    }
}

module.exports = { OllamaProvider };
