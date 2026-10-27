'use strict';

const EventEmitter = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// BaseTTSProvider — Contrato base para Provedores de Text-to-Speech (TTS)
// Segue o mesmo padrão arquitetural de BaseProvider da biblioteca
// ─────────────────────────────────────────────────────────────────────────────

class BaseTTSProvider extends EventEmitter {
    /** @type {string} Nome ou identificador do modelo */
    model;

    /** @type {string} Identificador da voz padrão */
    voice;

    /** @type {string} Chave de API opcional para serviços externos de TTS */
    apiKey;

    /** @type {string} URL base ou endpoint customizado para o serviço de TTS */
    url;

    /**
     * @param {object} [options]
     * @param {string} [options.model]
     * @param {string} [options.voice]
     * @param {string} [options.apiKey]
     * @param {string} [options.url]
     */
    constructor({ model = 'default', voice = 'default', apiKey = '', url = '' } = {}) {
        super();
        if (new.target === BaseTTSProvider) {
            throw new TypeError('[BaseTTSProvider] Cannot instantiate BaseTTSProvider directly. Use a concrete implementation.');
        }
        this.model = model;
        this.voice = voice;
        this.apiKey = apiKey;
        this.url = url;
    }

    /**
     * Sintetiza texto em áudio binário (Buffer).
     *
     * @param {string} text Texto para sintetizar
     * @param {object} [options] Opções pontuais de síntese (voice, speed, etc.)
     * @returns {Promise<Buffer>}
     */
    async synthesize(text, options = {}) {
        throw new Error(`[${this.constructor.name}] Method synthesize() must be implemented.`);
    }

    /**
     * Verifica se o motor de síntese está acessível no ambiente (servidor local ou rede).
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return true;
    }

    /**
     * Retorna o nome identificador do provedor TTS.
     * @returns {string}
     */
    getName() {
        return this.constructor.name;
    }
}

module.exports = { BaseTTSProvider };
