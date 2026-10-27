'use strict';

const { BaseTTSProvider } = require('./BaseTTSProvider');
const { PiperVoice } = require('./VoiceTypes');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─────────────────────────────────────────────────────────────────────────────
// PiperTTS — Provedor Text-to-Speech Ultra-Leve (< 50MB RAM) para Linux/CPU
// Baseado no Piper (ONNX): https://github.com/rhasspy/piper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} PiperTTSOptions
 * @property {string} [piperPath='piper'] Caminho para o executável do piper
 * @property {string} [model='piper-tts'] Identificador do modelo
 * @property {string} [modelPath] Caminho para o arquivo .onnx do modelo
 * @property {string} [modelConfigPath] Caminho para o arquivo .json do modelo
 * @property {string} [baseURL] URL caso o piper esteja rodando como micro-servidor HTTP (ex: 'http://localhost:5000')
 * @property {PiperVoice|string} [voice=PiperVoice.PT_BR_FABER_MEDIUM] Identificador ou constante da voz
 * @property {number} [lengthScale=1.0] Controle de velocidade (1.0 = normal, >1.0 = mais lento, <1.0 = mais rápido)
 * @property {number} [timeoutMs=15000] Timeout para geração em ms
 * @property {boolean} [autoFallback=true] Fallback caso o binário não esteja instalado
 */

class PiperTTS extends BaseTTSProvider {
    #piperPath;
    #modelPath;
    #modelConfigPath;
    #baseURL;
    #apiKey;
    #lengthScale;
    #timeoutMs;
    #autoFallback;

    /** @type {typeof PiperVoice} Enumeração de vozes suportadas pelo Piper TTS */
    static VOICE = PiperVoice;

    static VOICES = Object.freeze([
        { id: PiperVoice.PT_BR_FABER_MEDIUM, name: 'Faber (pt-BR Masculina Média)', gender: 'male', lang: 'pt-BR' },
        { id: PiperVoice.PT_BR_EDRESSON_LOW, name: 'Edresson (pt-BR Masculina Leve)', gender: 'male', lang: 'pt-BR' },
        { id: PiperVoice.EN_US_LESSAC_MEDIUM, name: 'Lessac (en-US Feminina Média)', gender: 'female', lang: 'en-US' },
        { id: PiperVoice.EN_US_RYAN_MEDIUM, name: 'Ryan (en-US Masculina Média)', gender: 'male', lang: 'en-US' }
    ]);

    constructor(options = {}) {
        const url = (options.url || options.baseURL || process.env.PIPER_BASE_URL || '').replace(/\/+$/, '');
        const apiKey = options.apiKey || process.env.PIPER_API_KEY || '';
        super({
            model: options.model || 'piper-tts',
            voice: options.voice || PiperVoice.PT_BR_FABER_MEDIUM,
            apiKey,
            url
        });
        this.#piperPath = options.piperPath || process.env.PIPER_PATH || 'piper';
        this.#modelPath = options.modelPath || process.env.PIPER_MODEL_PATH || '';
        this.#modelConfigPath = options.modelConfigPath || '';
        this.#baseURL = url;
        this.#apiKey = apiKey;
        this.#lengthScale = typeof options.lengthScale === 'number' ? options.lengthScale : 1.0;
        this.#timeoutMs = options.timeoutMs || 15000;
        this.#autoFallback = options.autoFallback !== false;
    }

    get baseURL() { return this.#baseURL; }
    get url() { return this.#baseURL; }
    get apiKey() { return this.#apiKey; }

    static getAvailableVoices() {
        return [...PiperTTS.VOICES];
    }

    /**
     * Verifica se o executável do Piper ou o servidor HTTP está acessível no ambiente.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        if (this.#baseURL) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 1500);
                const res = await fetch(`${this.#baseURL}/`, { signal: controller.signal }).catch(() => null);
                clearTimeout(timer);
                return Boolean(res && res.ok);
            } catch {
                return false;
            }
        }

        try {
            const checkCmd = process.platform === 'win32' ? `where ${this.#piperPath}` : `which ${this.#piperPath}`;
            execSync(checkCmd, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sintetiza texto em áudio WAV utilizando Piper.
     *
     * @param {string} text Texto para sintetizar
     * @param {object} [options]
     * @param {string} [options.voice]
     * @param {number} [options.lengthScale]
     * @returns {Promise<Buffer>} Buffer contendo o áudio WAV
     */
    async synthesize(text, options = {}) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new TypeError('[PiperTTS] text is required and must be a non-empty string.');
        }

        const cleanText = text.trim();
        const selectedVoice = options.voice || this.voice;
        const lengthScale = options.lengthScale ?? this.#lengthScale;

        // 1. Tenta sintetizar via micro-servidor HTTP local se configurado
        if (this.#baseURL) {
            try {
                const buffer = await this.#synthesizeViaHttp(cleanText, selectedVoice, lengthScale);
                this.emit('synthesized', { text: cleanText, sizeBytes: buffer.length, format: 'wav', voice: selectedVoice, provider: 'piper-http' });
                return buffer;
            } catch (err) {
                if (!this.#autoFallback) throw err;
                console.warn(`[PiperTTS] Servidor HTTP Piper em ${this.#baseURL} falhou. Tentando binário local...`);
            }
        }

        // 2. Tenta executar o binário do Piper diretamente via CLI
        try {
            const buffer = await this.#synthesizeViaCli(cleanText, selectedVoice, lengthScale);
            this.emit('synthesized', { text: cleanText, sizeBytes: buffer.length, format: 'wav', voice: selectedVoice, provider: 'piper-cli' });
            return buffer;
        } catch (cliErr) {
            if (!this.#autoFallback) throw cliErr;
            console.warn(`[PiperTTS] Binário do Piper não encontrado ou falhou (${cliErr.message}). Acionando síntese nativa do SO...`);
        }

        // 3. Fallback nativo
        const fallbackBuffer = this.#synthesizeFallback(cleanText, selectedVoice);
        this.emit('synthesized', { text: cleanText, sizeBytes: fallbackBuffer.length, format: 'wav', voice: selectedVoice, mock: true });
        return fallbackBuffer;
    }

    /**
     * @private
     */
    async #synthesizeViaHttp(text, voice, lengthScale) {
        const url = `${this.#baseURL}/?text=${encodeURIComponent(text)}&length_scale=${lengthScale}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arrayBuf = await res.arrayBuffer();
            return Buffer.from(arrayBuf);
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    }

    /**
     * @private
     */
    #synthesizeViaCli(text, voice, lengthScale) {
        return new Promise((resolve, reject) => {
            const tempOutput = path.join(os.tmpdir(), `piper_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);
            const args = ['--output_file', tempOutput];

            if (this.#modelPath) {
                args.push('--model', this.#modelPath);
            } else {
                args.push('--model', voice);
            }

            if (this.#modelConfigPath) {
                args.push('--config', this.#modelConfigPath);
            }

            if (lengthScale !== 1.0) {
                args.push('--length_scale', String(lengthScale));
            }

            let piperProcess;
            try {
                piperProcess = spawn(this.#piperPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
            } catch (err) {
                return reject(err);
            }

            let stderrData = '';
            piperProcess.stderr.on('data', chunk => { stderrData += chunk.toString(); });

            const timer = setTimeout(() => {
                try { piperProcess.kill(); } catch {}
                reject(new Error(`[PiperTTS] Timeout de ${this.#timeoutMs}ms excedido na execução do Piper.`));
            }, this.#timeoutMs);

            piperProcess.on('error', err => {
                clearTimeout(timer);
                reject(err);
            });

            piperProcess.on('close', code => {
                clearTimeout(timer);
                if (code !== 0) {
                    return reject(new Error(`[PiperTTS] Piper encerrou com código ${code}: ${stderrData}`));
                }

                if (fs.existsSync(tempOutput)) {
                    try {
                        const buffer = fs.readFileSync(tempOutput);
                        fs.unlinkSync(tempOutput);
                        resolve(buffer);
                    } catch (readErr) {
                        reject(readErr);
                    }
                } else {
                    reject(new Error('[PiperTTS] Arquivo de saída WAV não foi gerado.'));
                }
            });

            // Envia o texto para a entrada padrão (stdin) do Piper
            piperProcess.stdin.write(text, 'utf-8');
            piperProcess.stdin.end();
        });
    }

    /**
     * Fallback local para ambientes sem Piper instalado
     * @private
     */
    #synthesizeFallback(text, voiceName) {
        if (process.platform === 'win32') {
            try {
                const tempWav = path.join(os.tmpdir(), `piper_fallback_${Date.now()}.wav`);
                const safeText = text.replace(/'/g, "''").replace(/[\r\n]+/g, ' ');
                const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${tempWav.replace(/\\/g, '/')}'); $s.Speak('${safeText}'); $s.Dispose()`;
                execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore', timeout: 10000 });
                if (fs.existsSync(tempWav)) {
                    const buf = fs.readFileSync(tempWav);
                    try { fs.unlinkSync(tempWav); } catch {}
                    return buf;
                }
            } catch {}
        }

        // Sintetizador senoidal básico para Linux sem desktop TTS
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
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin((Math.PI * i) / numSamples);
            const sample = Math.floor(Math.sin(2 * Math.PI * 440 * t) * envelope * 8000);
            audioData.writeInt16LE(sample, i * 2);
        }

        return Buffer.concat([header, audioData]);
    }
}

module.exports = { PiperTTS };
