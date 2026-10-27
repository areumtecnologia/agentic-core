'use strict';

const EventEmitter = require('events');
const { KokoroTTS } = require('./KokoroTTS');
const { MagpieTTS } = require('./MagpieTTS');
const { GoogleTTS } = require('./GoogleTTS');
const { PiperTTS } = require('./PiperTTS');

// ─────────────────────────────────────────────────────────────────────────────
// VoiceGateway — Orquestrador de áudio bidirecional (STT + TTS) sob demanda
// Suporta Google Cloud (Zero RAM), Piper (<50MB), Kokoro (ONNX) e Magpie NIM
// ─────────────────────────────────────────────────────────────────────────────

class VoiceGateway extends EventEmitter {
    #tts;
    #sttProvider;

    /**
     * @param {object} [options]
     * @param {BaseTTSProvider} [options.ttsProvider] Instância de provedor de TTS (GoogleTTS, KokoroTTS, PiperTTS, MagpieTTS)
     * @param {BaseTTSProvider|object} [options.tts] Retrocompatível: instância ou opções do motor TTS
     * @param {object} [options.sttProvider] Provedor multimodal com suporte a áudio (ex: NvidiaProvider)
     */
    constructor(options = {}) {
        super();
        const rawTTS = options.ttsProvider || options.tts;
        if (rawTTS && (typeof rawTTS.synthesize === 'function')) {
            this.#tts = rawTTS;
        } else {
            const ttsOpt = typeof rawTTS === 'object' && rawTTS !== null ? rawTTS : {};
            const provider = (ttsOpt.provider || 'google').toLowerCase();
            switch (provider) {
                case 'piper':
                    this.#tts = new PiperTTS(ttsOpt);
                    break;
                case 'kokoro':
                    this.#tts = new KokoroTTS(ttsOpt);
                    break;
                case 'magpie':
                    this.#tts = new MagpieTTS(ttsOpt);
                    break;
                case 'google':
                default:
                    this.#tts = new GoogleTTS(ttsOpt);
                    break;
            }
        }
        this.#sttProvider = options.sttProvider || null;
    }

    get tts() { return this.#tts; }
    get ttsProvider() { return this.#tts; }
    get sttProvider() { return this.#sttProvider; }

    set sttProvider(provider) { this.#sttProvider = provider; }

    /**
     * Sintetiza fala a partir de texto usando o motor configurado (Kokoro ou Magpie).
     * @param {string} text
     * @param {object} [options]
     * @returns {Promise<Buffer>}
     */
    async textToSpeech(text, options = {}) {
        return await this.#tts.synthesize(text, options);
    }

    /**
     * Processa um turno de voz completo com um agente do AgenticCore:
     * 1. Áudio de entrada (base64/attachment) é enviado para o modelo multimodal (ex: Nemotron Omni)
     * 2. O agente processa a solicitação no loop agêntico
     * 3. A resposta de texto é sintetizada em áudio pelo motor TTS ativo
     *
     * @param {import('../AgenticCore').AgenticCore} agent
     * @param {string} sessionId
     * @param {object} audioAttachment { base64, mimeType }
     * @param {object} [options]
     * @returns {Promise<{ response: string, audioBuffer: Buffer, rawResult: object }>}
     */
    async processVoiceTurn(agent, sessionId, audioAttachment, options = {}) {
        if (!agent || typeof agent.processMessage !== 'function') {
            throw new TypeError('[VoiceGateway] A valid AgenticCore instance is required.');
        }

        const prompt = options.prompt || 'Ouça e transcreva este áudio, respondendo adequadamente ao usuário com clareza.';
        const result = await agent.processMessage(sessionId, prompt, audioAttachment, options);
        const responseText = result?.response || '';

        let audioBuffer = null;
        if (responseText && options.tts !== false) {
            audioBuffer = await this.#tts.synthesize(responseText, options.ttsOptions || {});
        }

        return {
            response: responseText,
            audioBuffer,
            rawResult: result
        };
    }
}

module.exports = { VoiceGateway };
