'use strict';

const { BaseTTSProvider } = require('./BaseTTSProvider');
const { KokoroVoice, AudioFormat } = require('./VoiceTypes');
const http = require('http');
const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// KokoroTTS — Provedor Text-to-Speech sob demanda para o modelo Kokoro 82M
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} KokoroTTSOptions
 * @property {string} [baseURL] URL base do endpoint OpenAI-compatible (ex: 'http://localhost:8880/v1')
 * @property {string} [apiKey='kokoro'] Chave de API opcional
 * @property {string} [model='kokoro'] Identificador do modelo
 * @property {KokoroVoice|string} [voice=KokoroVoice.AF_BELLA] Voz padrão ou constante
 * @property {AudioFormat|string} [format=AudioFormat.MP3] Formato de áudio de saída ('mp3' | 'wav' | 'opus' | 'flac')
 * @property {number} [speed=1.0] Velocidade da fala (0.5 a 2.0)
 * @property {number} [timeoutMs=30000] Timeout para requisições em ms
 * @property {boolean} [mockMode=false] Se true, sintetiza áudios simulados válidos sem chamada de rede (útil para testes unitários/CI)
 * @property {boolean} [autoFallbackToMock=true] Se true, caso o servidor Kokoro local não esteja ativo, gera buffer de fallback
 */

class KokoroTTS extends BaseTTSProvider {
    #baseURL;
    #apiKey;
    #format;
    #speed;
    #timeoutMs;
    #mockMode;
    #autoFallbackToMock;

    /** @type {typeof KokoroVoice} Enumeração de vozes suportadas pelo Kokoro 82M */
    static VOICE = KokoroVoice;

    static VOICES = Object.freeze([
        { id: KokoroVoice.AF_BELLA, name: 'Bella (US Female)', gender: 'female', lang: 'en-US' },
        { id: KokoroVoice.AF_SARAH, name: 'Sarah (US Female)', gender: 'female', lang: 'en-US' },
        { id: KokoroVoice.AF_NICOLE, name: 'Nicole (US Female)', gender: 'female', lang: 'en-US' },
        { id: KokoroVoice.AF_SKY, name: 'Sky (US Female)', gender: 'female', lang: 'en-US' },
        { id: KokoroVoice.AM_ADAM, name: 'Adam (US Male)', gender: 'male', lang: 'en-US' },
        { id: KokoroVoice.AM_MICHAEL, name: 'Michael (US Male)', gender: 'male', lang: 'en-US' },
        { id: KokoroVoice.AM_ECHO, name: 'Echo (US Male)', gender: 'male', lang: 'en-US' },
        { id: KokoroVoice.BF_EMMA, name: 'Emma (UK Female)', gender: 'female', lang: 'en-GB' },
        { id: KokoroVoice.BF_ISABELLA, name: 'Isabella (UK Female)', gender: 'female', lang: 'en-GB' },
        { id: KokoroVoice.BM_GEORGE, name: 'George (UK Male)', gender: 'male', lang: 'en-GB' },
        { id: KokoroVoice.BM_FABLE, name: 'Fable (UK Male)', gender: 'male', lang: 'en-GB' },
        { id: KokoroVoice.PF_DORA, name: 'Dora (Multilingual Female)', gender: 'female', lang: 'multilingual' },
        { id: KokoroVoice.PM_ALEX, name: 'Alex (Multilingual Male)', gender: 'male', lang: 'multilingual' },
    ]);

    constructor(options = {}) {
        const url = (options.url || options.baseURL || process.env.KOKORO_BASE_URL || 'http://localhost:8880/v1').replace(/\/+$/, '');
        const apiKey = options.apiKey || process.env.KOKORO_API_KEY || 'kokoro';
        super({
            model: options.model || 'kokoro',
            voice: options.voice || process.env.KOKORO_VOICE || KokoroVoice.AF_BELLA,
            apiKey,
            url
        });
        this.#baseURL = url;
        this.#apiKey = apiKey;
        this.#format = options.format || AudioFormat.MP3;
        this.#speed = typeof options.speed === 'number' ? options.speed : 1.0;
        this.#timeoutMs = options.timeoutMs || 30000;
        this.#mockMode = Boolean(options.mockMode);
        this.#autoFallbackToMock = options.autoFallbackToMock !== false;
    }

    get baseURL() { return this.#baseURL; }
    get url() { return this.#baseURL; }
    get apiKey() { return this.#apiKey; }
    get format() { return this.#format; }
    get speed() { return this.#speed; }
    get mockMode() { return this.#mockMode; }

    set mockMode(val) { this.#mockMode = Boolean(val); }

    /**
     * Retorna a lista de vozes conhecidas suportadas pelo Kokoro 82M.
     */
    static getAvailableVoices() {
        return [...KokoroTTS.VOICES];
    }

    /**
     * Verifica a disponibilidade do servidor Kokoro.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        if (this.#mockMode) return true;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const url = `${this.#baseURL}/models`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.#apiKey}` },
                signal: controller.signal
            }).catch(() => null);
            clearTimeout(timer);
            return Boolean(res && res.ok);
        } catch {
            return false;
        }
    }

    /**
     * Sintetiza texto em áudio usando o Kokoro 82M sob demanda.
     *
     * @param {string} text Texto para sintetizar
     * @param {object} [options]
     * @param {string} [options.voice] Voz a utilizar
     * @param {string} [options.format] Formato ('mp3' | 'wav')
     * @param {number} [options.speed] Velocidade
     * @param {AbortSignal} [options.signal]
     * @returns {Promise<Buffer>} Buffer binário com os dados de áudio
     */
    async synthesize(text, options = {}) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new TypeError('[KokoroTTS] text is required and must be a non-empty string.');
        }

        const cleanText = text.trim();
        const selectedVoice = options.voice || this.voice;
        const selectedFormat = options.format || this.#format;
        const selectedSpeed = typeof options.speed === 'number' ? options.speed : this.#speed;

        // Modo Mock explícito: gera áudio simulado para testes rápidos e CI/CD
        if (this.#mockMode) {
            const mockBuffer = this.#generateMockAudioBuffer(cleanText, selectedFormat, selectedVoice);
            this.emit('synthesized', { text: cleanText, sizeBytes: mockBuffer.length, format: selectedFormat, voice: selectedVoice, mock: true });
            return mockBuffer;
        }

        const endpoint = `${this.#baseURL}/audio/speech`;
        const payload = {
            model: options.model || this.model,
            input: cleanText,
            voice: selectedVoice,
            response_format: selectedFormat,
            speed: selectedSpeed
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
        if (options.signal) {
            options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.#apiKey}`
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`[KokoroTTS] HTTP ${response.status} from ${endpoint}: ${errorText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            this.emit('synthesized', { text: cleanText, sizeBytes: buffer.length, format: selectedFormat, voice: selectedVoice });
            return buffer;
        } catch (error) {
            clearTimeout(timeout);

            // Se o servidor local não estiver rodando e fallback estiver ativo, emite aviso e gera mock com voz real
            const isConnectionError = error.code === 'ECONNREFUSED' || error.name === 'TypeError' || error.message?.includes('fetch failed');
            if (this.#autoFallbackToMock && isConnectionError) {
                console.warn(`[KokoroTTS] Servidor Kokoro não detectado em "${this.#baseURL}". Usando síntese de fala local.`);
                return this.#generateMockAudioBuffer(cleanText, selectedFormat, selectedVoice);
            }

            throw error;
        }
    }

    /**
     * Sintetiza fala real utilizando o sintetizador nativo do sistema operacional (Windows SAPI).
     * @private
     */
    #synthesizeSystemSpeech(text, voiceName) {
        if (process.platform !== 'win32') return null;
        try {
            const { execSync } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            const os = require('os');

            const tempWav = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);
            const tempPs1 = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.ps1`);
            const safeText = text.replace(/'/g, "''").replace(/[\r\n]+/g, ' ');

            const isMale = /adam|michael|daniel|george|alex|male/i.test(voiceName || '');

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
                if (isMale) {
                    try {
                        const tempMale = path.join(os.tmpdir(), `tts_male_${Date.now()}.wav`);
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
     * Gera um buffer de áudio com fala real (Windows Speech) ou sintético válido com header correto.
     * @private
     */
    #generateMockAudioBuffer(text, format, voiceName) {
        // Tenta síntese de voz falada real do sistema operacional primeiro
        const realSpeech = this.#synthesizeSystemSpeech(text, voiceName || this.voice);
        if (realSpeech && realSpeech.length > 1000) {
            return realSpeech;
        }

        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        // Duração simulada: ~50ms por palavra, mínimo 0.5s
        const wordCount = Math.max(1, text.split(/\s+/).length);
        const durationSec = Math.max(0.5, Math.min(10, wordCount * 0.08));
        const numSamples = Math.floor(sampleRate * durationSec);
        const dataSize = numSamples * numChannels * (bitsPerSample / 8);

        // Header WAV padrão RIFF (44 bytes)
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // SubChunk1Size (PCM = 16)
        header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
        header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
        header.writeUInt16LE(bitsPerSample, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);

        // Gera tom senoidal suave (440Hz / Lá) no payload de áudio
        const audioData = Buffer.alloc(dataSize);
        const frequency = 440;
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin((Math.PI * i) / numSamples);
            const sample = Math.floor(Math.sin(2 * Math.PI * frequency * t) * envelope * 8000);
            audioData.writeInt16LE(sample, i * 2);
        }

        return Buffer.concat([header, audioData]);
    }
}

module.exports = { KokoroTTS };
