'use strict';

const { OpenAIProvider } = require('./OpenAIProvider');

// ─────────────────────────────────────────────────────────────────────────────
// AnthropicProvider — implementação usando o pacote oficial 'openai'
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

class AnthropicProvider extends OpenAIProvider {
    /**
     * @param {object} options
     * @param {string} options.apiKey             Chave de API da Anthropic
     * @param {string} [options.model='claude-sonnet-4-20250514']  Nome do modelo
     * @param {string} [options.baseURL]          URL base da API
     * @param {string} [options.anthropicVersion] Versão da API Anthropic
     */
    constructor({
        apiKey,
        model = 'claude-sonnet-4-20250514',
        baseURL = DEFAULT_BASE_URL,
        anthropicVersion = DEFAULT_ANTHROPIC_VERSION,
    } = {}) {
        if (!apiKey) throw new TypeError('[AnthropicProvider] apiKey is required.');
        super({
            apiKey,
            model,
            baseURL,
            openAIOptions: {
                defaultHeaders: {
                    'x-api-key': apiKey,
                    'anthropic-version': anthropicVersion,
                },
            },
        });
    }

    getName() {
        return 'anthropic';
    }
}

module.exports = { AnthropicProvider };
