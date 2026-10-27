'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────────
// TTSResponse — Objeto de resposta para síntese de fala (TTS)
// Permite extrair o buffer bruto ou obter Base64 em WAV (padrão) ou OGG (.toBase64(true))
// ─────────────────────────────────────────────────────────────────────────────

class TTSResponse {
    #buffer;
    #format;
    #voice;
    #provider;
    #model;
    #wavBuffer = null;
    #oggBuffer = null;

    /**
     * @param {object} options
     * @param {Buffer} options.buffer Buffer binário do áudio sintetizado
     * @param {string} [options.format='wav'] Formato de áudio original ('wav' | 'ogg' | 'mp3' | 'opus')
     * @param {string} [options.voice=''] Identificador da voz utilizada
     * @param {string} [options.provider=''] Identificador do provedor (google, piper, kokoro, magpie)
     * @param {string} [options.model=''] Identificador do modelo TTS
     */
    constructor({ buffer, format = 'wav', voice = '', provider = '', model = '' } = {}) {
        this.#buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
        this.#format = String(format || 'wav').toLowerCase();
        this.#voice = voice || '';
        this.#provider = provider || '';
        this.#model = model || '';

        if (this.#isWav(this.#buffer)) {
            this.#wavBuffer = this.#buffer;
        } else if (this.#isOgg(this.#buffer)) {
            this.#oggBuffer = this.#buffer;
        }
    }

    /**
     * Buffer de áudio bruto gerado pelo provedor TTS.
     * @type {Buffer}
     */
    get buffer() {
        return this.#buffer;
    }

    /**
     * Formato original retornado pelo motor de síntese.
     * @type {string}
     */
    get format() {
        return this.#format;
    }

    /**
     * Identificador da voz utilizada na síntese.
     * @type {string}
     */
    get voice() {
        return this.#voice;
    }

    /**
     * Identificador do provedor de TTS.
     * @type {string}
     */
    get provider() {
        return this.#provider;
    }

    /**
     * Identificador do modelo de TTS.
     * @type {string}
     */
    get model() {
        return this.#model;
    }

    /**
     * Tamanho em bytes do buffer original.
     * @type {number}
     */
    get length() {
        return this.#buffer.length;
    }

    /**
     * Retorna a representação em Base64 do áudio.
     *
     * @param {boolean} [asOgg=false] Se true, retorna em formato OGG; se false ou omitido, retorna em WAV (padrão).
     * @returns {string} String codificada em Base64
     */
    toBase64(asOgg = false) {
        const targetBuffer = this.toBuffer(asOgg);
        return targetBuffer.toString('base64');
    }

    /**
     * Retorna o Buffer binário do áudio no formato solicitado.
     *
     * @param {boolean} [asOgg=false] Se true, retorna o Buffer em OGG; se false ou omitido, em WAV (padrão).
     * @returns {Buffer}
     */
    toBuffer(asOgg = false) {
        if (asOgg) {
            if (this.#oggBuffer) {
                return this.#oggBuffer;
            }
            this.#oggBuffer = this.#convertBuffer(this.#buffer, 'ogg');
            return this.#oggBuffer;
        }

        if (this.#wavBuffer) {
            return this.#wavBuffer;
        }
        this.#wavBuffer = this.#convertBuffer(this.#buffer, 'wav');
        return this.#wavBuffer;
    }

    /**
     * Retorna Data URI completa pronta para uso no HTML5 Audio ou APIs web.
     *
     * @param {boolean} [asOgg=false] Se true, retorna data:audio/ogg;base64,... senão data:audio/wav;base64,...
     * @returns {string}
     */
    toDataUri(asOgg = false) {
        const mime = asOgg ? 'audio/ogg' : 'audio/wav';
        return `data:${mime};base64,${this.toBase64(asOgg)}`;
    }

    /**
     * Verifica se o buffer possui cabeçalho RIFF/WAVE.
     * @private
     */
    #isWav(buf) {
        return buf && buf.length >= 12 &&
            buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
            buf.subarray(8, 12).toString('ascii') === 'WAVE';
    }

    /**
     * Verifica se o buffer possui cabeçalho OggS.
     * @private
     */
    #isOgg(buf) {
        return buf && buf.length >= 4 &&
            buf.subarray(0, 4).toString('ascii') === 'OggS';
    }

    /**
     * Converte o buffer entre formatos de áudio via ffmpeg (se disponível) com fallback seguro.
     * @private
     */
    #convertBuffer(inputBuffer, targetFormat) {
        if (!inputBuffer || inputBuffer.length === 0) {
            return inputBuffer;
        }

        if (targetFormat === 'wav' && this.#isWav(inputBuffer)) {
            return inputBuffer;
        }
        if (targetFormat === 'ogg' && this.#isOgg(inputBuffer)) {
            return inputBuffer;
        }

        const rand = Math.random().toString(36).substring(2, 9);
        const tempIn = path.join(os.tmpdir(), `tts_in_${Date.now()}_${rand}.bin`);
        const tempOut = path.join(os.tmpdir(), `tts_out_${Date.now()}_${rand}.${targetFormat}`);

        try {
            fs.writeFileSync(tempIn, inputBuffer);
            const codec = targetFormat === 'ogg' ? '-c:a libopus' : '-c:a pcm_s16le';
            execSync(`ffmpeg -y -i "${tempIn}" ${codec} "${tempOut}"`, { stdio: 'ignore', timeout: 15000 });
            if (fs.existsSync(tempOut)) {
                return fs.readFileSync(tempOut);
            }
        } catch {
            // Em ambientes sem ffmpeg, retorna o buffer original de forma graciosa
        } finally {
            try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn); } catch {}
            try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch {}
        }

        return inputBuffer;
    }

    toJSON() {
        return {
            sizeBytes: this.#buffer.length,
            format: this.#format,
            voice: this.#voice,
            provider: this.#provider,
            model: this.#model,
        };
    }
}

module.exports = { TTSResponse };
