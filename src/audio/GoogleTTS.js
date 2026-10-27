'use strict';

const { BaseTTSProvider } = require('./BaseTTSProvider');
const { GoogleVoice, AudioEncoding } = require('./VoiceTypes');

// ─────────────────────────────────────────────────────────────────────────────
// GoogleTTS — Provedor Text-to-Speech via Google Cloud API (Zero RAM no servidor)
// Ideal para servidores Linux de baixo custo (1 a 4 GB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} GoogleTTSOptions
 * @property {string} [apiKey] Chave de API do Google Cloud (padrão GOOGLE_API_KEY ou GEMINI_API_KEY)
 * @property {string} [model='google-cloud-tts'] Identificador do modelo
 * @property {string} [languageCode='pt-BR'] Código do idioma
 * @property {GoogleVoice|string} [voice=GoogleVoice.PT_BR_NEURAL2_A] Nome ou constante da voz
 * @property {AudioEncoding|string} [audioEncoding=AudioEncoding.MP3] Formato de áudio
 * @property {number} [speakingRate=1.0] Velocidade da fala (0.25 a 4.0)
 * @property {number} [pitch=0.0] Pitch (-20.0 a 20.0)
 * @property {number} [timeoutMs=20000] Timeout da requisição
 * @property {boolean} [useFreeFallback=true] Se true, usa o endpoint gratuito zero-config caso não haja API Key
 * @property {boolean} [autoFallbackToMock=true] Fallback caso a rede esteja indisponível
 */

class GoogleTTS extends BaseTTSProvider {
    #apiKey;
    #url;
    #languageCode;
    #audioEncoding;
    #speakingRate;
    #pitch;
    #timeoutMs;
    #useFreeFallback;
    #autoFallbackToMock;

    /** @type {typeof GoogleVoice} Enumeração de vozes suportadas pelo Google TTS */
    static VOICE = GoogleVoice;

    static VOICES = Object.freeze([
        { id: GoogleVoice.PT_BR_NEURAL2_A, name: 'Neural2 Feminina A (pt-BR)', gender: 'female', lang: 'pt-BR' },
        { id: GoogleVoice.PT_BR_NEURAL2_B, name: 'Neural2 Masculina B (pt-BR)', gender: 'male', lang: 'pt-BR' },
        { id: GoogleVoice.PT_BR_NEURAL2_C, name: 'Neural2 Feminina C (pt-BR)', gender: 'female', lang: 'pt-BR' },
        { id: GoogleVoice.PT_BR_WAVENET_A, name: 'WaveNet Feminina A (pt-BR)', gender: 'female', lang: 'pt-BR' },
        { id: GoogleVoice.PT_BR_WAVENET_B, name: 'WaveNet Masculina B (pt-BR)', gender: 'male', lang: 'pt-BR' },
        { id: GoogleVoice.PT_BR_STANDARD_A, name: 'Standard Feminina A (pt-BR)', gender: 'female', lang: 'pt-BR' },
        { id: GoogleVoice.PT_BR_STANDARD_B, name: 'Standard Masculina B (pt-BR)', gender: 'male', lang: 'pt-BR' },
        { id: GoogleVoice.EN_US_NEURAL2_C, name: 'Neural2 Feminina C (en-US)', gender: 'female', lang: 'en-US' },
        { id: GoogleVoice.EN_US_NEURAL2_D, name: 'Neural2 Masculina D (en-US)', gender: 'male', lang: 'en-US' },
    ]);

    constructor(options = {}) {
        const apiKey = options.apiKey || process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        const url = options.url || options.baseURL || 'https://texttospeech.googleapis.com/v1/text:synthesize';
        super({
            model: options.model || 'google-cloud-tts',
            voice: options.voice || GoogleVoice.PT_BR_NEURAL2_A,
            apiKey,
            url
        });
        this.#apiKey = apiKey;
        this.#url = url;
        this.#languageCode = options.languageCode || 'pt-BR';
        this.#audioEncoding = options.audioEncoding || AudioEncoding.MP3;
        this.#speakingRate = typeof options.speakingRate === 'number' ? options.speakingRate : 1.0;
        this.#pitch = typeof options.pitch === 'number' ? options.pitch : 0.0;
        this.#timeoutMs = options.timeoutMs || 20000;
        this.#useFreeFallback = options.useFreeFallback !== false;
        this.#autoFallbackToMock = options.autoFallbackToMock !== false;
    }

    get url() { return this.#url; }
    get apiKey() { return this.#apiKey; }
    get languageCode() { return this.#languageCode; }
    get audioEncoding() { return this.#audioEncoding; }

    static getAvailableVoices() {
        return [...GoogleTTS.VOICES];
    }

    /**
     * Sintetiza texto em áudio através da API do Google Cloud ou fallback gratuito.
     *
     * @param {string} text Texto para sintetizar
     * @param {object} [options]
     * @param {string} [options.voice]
     * @param {string} [options.languageCode]
     * @param {number} [options.speakingRate]
     * @param {AbortSignal} [options.signal]
     * @returns {Promise<Buffer>}
     */
    async synthesize(text, options = {}) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new TypeError('[GoogleTTS] text is required and must be a non-empty string.');
        }

        const cleanText = text.trim();
        const selectedVoice = options.voice || this.voice;
        const selectedLang = options.languageCode || this.#languageCode;
        const selectedEncoding = options.audioEncoding || this.#audioEncoding;
        const rate = options.speakingRate ?? this.#speakingRate;

        // 1. Tenta API Oficial do Google Cloud TTS se houver API Key
        if (this.#apiKey) {
            try {
                const buffer = await this.#synthesizeViaOfficialApi(cleanText, selectedVoice, selectedLang, selectedEncoding, rate, options.signal);
                this.emit('synthesized', {
                    text: cleanText,
                    sizeBytes: buffer.length,
                    format: selectedEncoding.toLowerCase(),
                    voice: selectedVoice,
                    provider: 'google-cloud-official'
                });
                return buffer;
            } catch (err) {
                if (!this.#useFreeFallback && !this.#autoFallbackToMock) {
                    throw err;
                }
                console.warn(`[GoogleTTS] Falha na API Oficial Google TTS (${err.message}). Tentando fallback...`);
            }
        }

        // 2. Se não houver chave ou falhar, usa endpoint zero-config de alta velocidade (sem cartão / sem custo de RAM)
        if (this.#useFreeFallback) {
            try {
                const buffer = await this.#synthesizeViaZeroConfig(cleanText, selectedLang, options.signal);
                this.emit('synthesized', {
                    text: cleanText,
                    sizeBytes: buffer.length,
                    format: 'mp3',
                    voice: selectedVoice,
                    provider: 'google-translate-tts'
                });
                return buffer;
            } catch (err) {
                if (!this.#autoFallbackToMock) {
                    throw err;
                }
                console.warn(`[GoogleTTS] Falha no endpoint zero-config Google (${err.message}). Acionando fallback local...`);
            }
        }

        // 3. Fallback sonoro simulado para ambientes totalmente offline
        const fallbackBuffer = this.#generateOfflineWavBuffer(cleanText, selectedVoice);
        this.emit('synthesized', {
            text: cleanText,
            sizeBytes: fallbackBuffer.length,
            format: 'wav',
            voice: selectedVoice,
            mock: true
        });
        return fallbackBuffer;
    }

    /**
     * Chamada à API Oficial Google Cloud Text-to-Speech
     * @private
     */
    async #synthesizeViaOfficialApi(text, voiceName, langCode, encoding, rate, signal) {
        const url = this.#url.includes('?') ? `${this.#url}&key=${this.#apiKey}` : `${this.#url}?key=${this.#apiKey}`;
        const isMale = /male|\-B$|\-D$/i.test(voiceName);

        const payload = {
            input: { text },
            voice: {
                languageCode: langCode,
                name: voiceName,
                ssmlGender: isMale ? 'MALE' : 'FEMALE'
            },
            audioConfig: {
                audioEncoding: encoding,
                speakingRate: rate,
                pitch: this.#pitch
            }
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
        if (signal) {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!res.ok) {
                const errorData = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}: ${errorData}`);
            }

            const data = await res.json();
            if (!data.audioContent) {
                throw new Error('Google TTS response missing audioContent');
            }

            return Buffer.from(data.audioContent, 'base64');
        } catch (err) {
            clearTimeout(timeout);
            throw err;
        }
    }

    /**
     * Endpoint Zero-Config de alta velocidade do Google
     * @private
     */
    async #synthesizeViaZeroConfig(text, langCode, signal) {
        // Divide o texto em fragmentos menores se exceder 200 caracteres
        const chunks = this.#splitTextIntoChunks(text, 180);
        const audioBuffers = [];

        for (const chunk of chunks) {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${langCode}&client=tw-ob`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
            if (signal) {
                signal.addEventListener('abort', () => controller.abort(), { once: true });
            }

            try {
                const res = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} from Google Translate TTS`);
                }

                const arrayBuf = await res.arrayBuffer();
                audioBuffers.push(Buffer.from(arrayBuf));
            } catch (err) {
                clearTimeout(timeout);
                throw err;
            }
        }

        return Buffer.concat(audioBuffers);
    }

    #splitTextIntoChunks(text, maxLength) {
        if (text.length <= maxLength) return [text];
        const words = text.split(/\s+/);
        const chunks = [];
        let current = '';

        for (const word of words) {
            if ((current + ' ' + word).trim().length > maxLength) {
                if (current) chunks.push(current.trim());
                current = word;
            } else {
                current = current ? current + ' ' + word : word;
            }
        }
        if (current) chunks.push(current.trim());
        return chunks;
    }

    #generateOfflineWavBuffer(text, voiceName) {
        const sampleRate = 22050;
        const numChannels = 1;
        const bitsPerSample = 16;
        const wordCount = Math.max(1, text.split(/\s+/).length);
        const durationSec = Math.max(0.5, Math.min(8, wordCount * 0.08));
        const numSamples = Math.floor(sampleRate * durationSec);
        const dataSize = numSamples * numChannels * (bitsPerSample / 8);

        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
        header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
        header.writeUInt16LE(bitsPerSample, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);

        const audioData = Buffer.alloc(dataSize);
        const frequency = /male|\-B$/i.test(voiceName) ? 220 : 440;
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin((Math.PI * i) / numSamples);
            const sample = Math.floor(Math.sin(2 * Math.PI * frequency * t) * envelope * 8000);
            audioData.writeInt16LE(sample, i * 2);
        }

        return Buffer.concat([header, audioData]);
    }
}

module.exports = { GoogleTTS };
