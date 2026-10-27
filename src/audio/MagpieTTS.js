'use strict';

const { BaseTTSProvider } = require('./BaseTTSProvider');
const { MagpieVoice } = require('./VoiceTypes');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// MagpieTTS — Provedor Text-to-Speech com Zero-Shot Voice Cloning da NVIDIA NIM
// Baseado em: https://build.nvidia.com/nvidia/magpie-tts-zeroshot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} MagpieTTSOptions
 * @property {string} [baseURL] URL base do endpoint NIM (ex: 'http://localhost:9000/v1' ou 'https://integrate.api.nvidia.com/v1')
 * @property {string} [apiKey] Chave de API da NVIDIA (padrão process.env.NVIDIA_API_KEY)
 * @property {string} [model='nvidia/magpie-tts-zeroshot'] Nome do modelo NIM
 * @property {MagpieVoice|string} [voice=MagpieVoice.ZEROSHOT_MULTILINGUAL_FEMALE] Voz base
 * @property {string} [language='pt-BR'] Idioma da síntese ('pt-BR', 'en-US', 'es-ES', etc.)
 * @property {number} [sampleRateHz=22050] Taxa de amostragem em Hz (padrão 22050 para Magpie)
 * @property {Buffer|string} [audioPrompt] Amostra de áudio de referência (Buffer, base64 ou caminho de arquivo WAV) para clonagem zero-shot
 * @property {number} [timeoutMs=30000] Timeout em ms
 * @property {boolean} [mockMode=false] Modo simulado para testes e CI/CD
 * @property {boolean} [autoFallbackToMock=true] Fallback automático caso o servidor NIM local/remoto não esteja acessível
 */

class MagpieTTS extends BaseTTSProvider {
    #baseURL;
    #apiKey;
    #language;
    #sampleRateHz;
    #audioPrompt;
    #timeoutMs;
    #mockMode;
    #autoFallbackToMock;

    /** @type {typeof MagpieVoice} Enumeração de vozes suportadas pelo Magpie TTS */
    static VOICE = MagpieVoice;

    static VOICES = Object.freeze([
        { id: MagpieVoice.ZEROSHOT_MULTILINGUAL_FEMALE, name: 'Magpie Multilingual Female (Zero-Shot Base)', gender: 'female' },
        { id: MagpieVoice.ZEROSHOT_MULTILINGUAL_MALE, name: 'Magpie Multilingual Male (Zero-Shot Base)', gender: 'male' },
        { id: MagpieVoice.MULTILINGUAL_EN_US_ARIA, name: 'Aria (Standard EN-US)', gender: 'female' },
    ]);

    static SUPPORTED_LANGUAGES = Object.freeze([
        'pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT',
        'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'hi-IN', 'vi-VN'
    ]);

    constructor(options = {}) {
        const url = (options.url || options.baseURL || process.env.NVIDIA_MAGPIE_BASE_URL || process.env.MAGPIE_BASE_URL || 'http://localhost:9000/v1').replace(/\/+$/, '');
        const apiKey = options.apiKey || process.env.NVIDIA_API_KEY || '';
        super({
            model: options.model || 'nvidia/magpie-tts-zeroshot',
            voice: options.voice || MagpieVoice.ZEROSHOT_MULTILINGUAL_FEMALE,
            apiKey,
            url
        });
        this.#baseURL = url;
        this.#apiKey = apiKey;
        this.#language = options.language || 'pt-BR';
        this.#sampleRateHz = options.sampleRateHz || 22050;
        this.#audioPrompt = options.audioPrompt || null;
        this.#timeoutMs = options.timeoutMs || 30000;
        this.#mockMode = Boolean(options.mockMode);
        this.#autoFallbackToMock = options.autoFallbackToMock !== false;
    }

    get baseURL() { return this.#baseURL; }
    get url() { return this.#baseURL; }
    get apiKey() { return this.#apiKey; }
    get language() { return this.#language; }
    get sampleRateHz() { return this.#sampleRateHz; }
    get audioPrompt() { return this.#audioPrompt; }
    get mockMode() { return this.#mockMode; }

    set mockMode(val) { this.#mockMode = Boolean(val); }

    /**
     * Define ou atualiza a amostra de áudio de referência para clonagem zero-shot.
     * @param {Buffer|string|null} prompt Buffer WAV, string base64 ou caminho de arquivo
     */
    setAudioPrompt(prompt) {
        this.#audioPrompt = prompt;
    }

    /**
     * Retorna a lista de vozes pré-configuradas do Magpie.
     */
    static getAvailableVoices() {
        return [...MagpieTTS.VOICES];
    }

    /**
     * Retorna os 12 idiomas oficialmente suportados pelo Magpie ZeroShot.
     */
    static getSupportedLanguages() {
        return [...MagpieTTS.SUPPORTED_LANGUAGES];
    }

    /**
     * Normaliza a referência de áudio (Buffer, base64 ou arquivo) para Buffer.
     * @private
     */
    #normalizeAudioPrompt(prompt) {
        if (!prompt) return null;
        if (Buffer.isBuffer(prompt)) return prompt;
        if (typeof prompt === 'string') {
            if (fs.existsSync(prompt)) {
                return fs.readFileSync(prompt);
            }
            // Trata como base64
            const cleanBase64 = prompt.replace(/^data:[^;]+;base64,/, '');
            return Buffer.from(cleanBase64, 'base64');
        }
        return null;
    }

    /**
     * Sintetiza texto em fala usando NVIDIA Magpie TTS ZeroShot.
     *
     * @param {string} text Texto para sintetizar
     * @param {object} [options]
     * @param {Buffer|string} [options.audioPrompt] Amostra de áudio para clonagem zero-shot (substitui o padrão)
     * @param {string} [options.voice]
     * @param {string} [options.language] Idioma ('pt-BR', 'en-US', etc.)
     * @param {number} [options.sampleRateHz]
     * @param {AbortSignal} [options.signal]
     * @returns {Promise<Buffer>} Buffer de áudio (WAV PCM)
     */
    async synthesize(text, options = {}) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new TypeError('[MagpieTTS] text is required and must be a non-empty string.');
        }

        const cleanText = text.trim();
        const selectedVoice = options.voice || this.voice;
        const selectedLanguage = options.language || this.#language;
        const selectedSampleRate = options.sampleRateHz || this.#sampleRateHz;
        const rawPrompt = options.audioPrompt !== undefined ? options.audioPrompt : this.#audioPrompt;
        const promptBuffer = this.#normalizeAudioPrompt(rawPrompt);
        const isZeroShot = Boolean(promptBuffer && promptBuffer.length > 0);

        if (this.#mockMode) {
            const mockBuffer = this.#generateMockWavBuffer(cleanText, selectedSampleRate, selectedVoice, rawPrompt);
            this.emit('synthesized', {
                text: cleanText,
                sizeBytes: mockBuffer.length,
                format: 'wav',
                voice: selectedVoice,
                language: selectedLanguage,
                zeroShotCloned: isZeroShot,
                neuralCloned: false,
                mock: true
            });
            return mockBuffer;
        }

        const formData = new FormData();
        formData.append('text', cleanText);
        formData.append('voice', selectedVoice);
        formData.append('language', selectedLanguage);
        formData.append('sample_rate_hz', String(selectedSampleRate));

        if (promptBuffer) {
            formData.append('audio_prompt', new Blob([promptBuffer], { type: 'audio/wav' }), 'audio_prompt.wav');
        }

        // Tenta endpoint padrão do Speech NIM (/v1/audio/synthesize_online ou /v1/audio/speech)
        const endpointsToTry = [
            `${this.#baseURL}/audio/synthesize_online`,
            `${this.#baseURL}/audio/speech`,
            `${this.#baseURL}/audio/synthesize`
        ];

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
        if (options.signal) {
            options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        let lastError = null;
        for (const endpoint of endpointsToTry) {
            try {
                const headers = {};
                if (this.#apiKey) {
                    headers['Authorization'] = `Bearer ${this.#apiKey}`;
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: formData,
                    signal: controller.signal
                });

                if (!response.ok) {
                    const statusText = await response.text().catch(() => '');
                    lastError = new Error(`HTTP ${response.status} from ${endpoint}: ${statusText}`);
                    continue; // Tenta o próximo endpoint
                }

                clearTimeout(timer);
                const arrayBuffer = await response.arrayBuffer();
                let resultBuffer = Buffer.from(arrayBuffer);

                // Se o servidor retornar LPCM bruto sem cabeçalho WAV (RIFF), envolve no cabeçalho
                if (resultBuffer.subarray(0, 4).toString() !== 'RIFF') {
                    resultBuffer = this.#wrapRawLpcmInWav(resultBuffer, selectedSampleRate);
                }

                this.emit('synthesized', {
                    text: cleanText,
                    sizeBytes: resultBuffer.length,
                    format: 'wav',
                    voice: selectedVoice,
                    language: selectedLanguage,
                    zeroShotCloned: isZeroShot,
                    neuralCloned: true
                });

                return resultBuffer;
            } catch (err) {
                lastError = err;
            }
        }

        clearTimeout(timer);

        if (this.#autoFallbackToMock) {
            console.warn(`[MagpieTTS] Servidor Magpie não acessível em "${this.#baseURL}". Usando síntese de fala local.`);
            const fallbackBuffer = this.#generateMockWavBuffer(cleanText, selectedSampleRate, selectedVoice, rawPrompt);
            this.emit('synthesized', {
                text: cleanText,
                sizeBytes: fallbackBuffer.length,
                format: 'wav',
                voice: selectedVoice,
                language: selectedLanguage,
                zeroShotCloned: isZeroShot,
                neuralCloned: false,
                mock: true
            });
            return fallbackBuffer;
        }

        throw new Error(`[MagpieTTS] Falha ao sintetizar áudio com Magpie ZeroShot: ${lastError?.message || 'Servidor inacessível'}`);
    }

    /**
     * Verifica se o servidor NVIDIA Magpie NIM está online e acessível.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${this.#baseURL}/models`, {
                headers: this.#apiKey ? { 'Authorization': `Bearer ${this.#apiKey}` } : {},
                signal: controller.signal
            }).catch(() => null);
            clearTimeout(timer);
            return Boolean(res && res.ok);
        } catch {
            return false;
        }
    }

    /**
     * Envolve áudio LPCM bruto em cabeçalho WAV de 44 bytes.
     * @private
     */
    #wrapRawLpcmInWav(pcmBuffer, sampleRate) {
        const numChannels = 1;
        const bitsPerSample = 16;
        const dataSize = pcmBuffer.length;

        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20); // PCM
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
        header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
        header.writeUInt16LE(bitsPerSample, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);

        return Buffer.concat([header, pcmBuffer]);
    }

    /**
     * Sintetiza fala utilizando o sintetizador nativo do sistema operacional (Windows SAPI)
     * aplicando equalização e pitch shifting caso a voz de referência seja masculina.
     * @private
     */
    #synthesizeSystemSpeech(text, voiceName, audioPrompt) {
        if (process.platform !== 'win32') return null;
        try {
            const { execSync } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            const os = require('os');

            const tempWav = path.join(os.tmpdir(), `tts_magpie_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);
            const tempPs1 = path.join(os.tmpdir(), `tts_magpie_${Date.now()}_${Math.random().toString(36).substring(7)}.ps1`);
            const safeText = text.replace(/'/g, "''").replace(/[\r\n]+/g, ' ');

            // Detecta se a voz de referência ou o nome do arquivo indica homem
            const promptStr = typeof audioPrompt === 'string' ? audioPrompt.toLowerCase() : '';
            const voiceStr = (voiceName || '').toLowerCase();
            const isMale = /male|renan|adam|alex|homem|daniel|david/i.test(voiceStr) ||
                           /renan|male|homem/i.test(promptStr);

            const psScript = [
                'Add-Type -AssemblyName System.Speech',
                '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
                '$installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }',
                isMale
                    ? '$targetVoice = $installed | Where-Object { $_ -like "*Daniel*" -or $_ -like "*David*" -or $_ -like "*Male*" } | Select-Object -First 1'
                    : '$targetVoice = $installed | Where-Object { $_ -like "*Maria*" -or $_ -like "*Portuguese*" -or $_ -like "*Zira*" } | Select-Object -First 1',
                'if (-not $targetVoice) { $targetVoice = $installed | Select-Object -First 1 }',
                'if ($targetVoice) { $synth.SelectVoice($targetVoice) }',
                `$synth.SetOutputToWaveFile('${tempWav.replace(/\\/g, '/')}')`,
                `$synth.Speak('${safeText}')`,
                '$synth.Dispose()'
            ].join('\r\n');

            fs.writeFileSync(tempPs1, psScript, 'latin1');
            execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'ignore', timeout: 15000 });

            if (fs.existsSync(tempWav) && fs.statSync(tempWav).size > 100) {
                // Se for masculina e o sistema só tiver voz feminina (Maria), aplica modulação de formante e pitch via FFmpeg
                if (isMale) {
                    try {
                        const tempMale = path.join(os.tmpdir(), `tts_magpie_male_${Date.now()}.wav`);
                        execSync(`powershell -NoProfile -Command "ffmpeg -i '${tempWav.replace(/\\/g, '/')}' -af 'asetrate=22050*0.78,atempo=1.28,equalizer=f=120:width_type=o:width=2:g=4' '${tempMale.replace(/\\/g, '/')}' -y"`, { stdio: 'ignore' });
                        if (fs.existsSync(tempMale) && fs.statSync(tempMale).size > 100) {
                            const maleBuf = fs.readFileSync(tempMale);
                            try { fs.unlinkSync(tempMale); } catch {}
                            try { fs.unlinkSync(tempWav); } catch {}
                            try { fs.unlinkSync(tempPs1); } catch {}
                            return maleBuf;
                        }
                    } catch {}
                }

                const buffer = fs.readFileSync(tempWav);
                try { fs.unlinkSync(tempWav); } catch {}
                try { fs.unlinkSync(tempPs1); } catch {}
                return buffer;
            }
        } catch {
            // Silencioso se falhar, segue para o fallback sonoro
        }
        return null;
    }

    /**
     * Gera buffer WAV com fala do sistema operacional ou sintetizador senoidal de teste.
     * @private
     */
    #generateMockWavBuffer(text, sampleRate, voiceName, audioPrompt) {
        // Tenta síntese de voz falada real do sistema operacional primeiro
        const realSpeech = this.#synthesizeSystemSpeech(text, voiceName || this.voice, audioPrompt);
        if (realSpeech && realSpeech.length > 1000) {
            return realSpeech;
        }

        const numChannels = 1;
        const bitsPerSample = 16;
        const wordCount = Math.max(1, text.split(/\s+/).length);
        const durationSec = Math.max(0.5, Math.min(10, wordCount * 0.08));
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
        const frequency = 480;
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin((Math.PI * i) / numSamples);
            const sample = Math.floor(Math.sin(2 * Math.PI * frequency * t) * envelope * 8000);
            audioData.writeInt16LE(sample, i * 2);
        }

        return Buffer.concat([header, audioData]);
    }
}

module.exports = { MagpieTTS };
