'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// VoiceTypes — Constantes e Enumeradores para Vozes e Áudio
// Elimina o uso de strings mágicas em toda a biblioteca
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vozes suportadas pela API Google Cloud Text-to-Speech (Neural2, Wavenet, Standard).
 * @readonly
 * @enum {string}
 */
const GoogleVoice = Object.freeze({
    // Português do Brasil (pt-BR)
    PT_BR_NEURAL2_A: 'pt-BR-Neural2-A', // Feminina (Alta definição neural)
    PT_BR_NEURAL2_B: 'pt-BR-Neural2-B', // Masculina (Alta definição neural)
    PT_BR_NEURAL2_C: 'pt-BR-Neural2-C', // Feminina (Alta definição neural)
    PT_BR_WAVENET_A: 'pt-BR-Wavenet-A', // Feminina (WaveNet)
    PT_BR_WAVENET_B: 'pt-BR-Wavenet-B', // Masculina (WaveNet)
    PT_BR_STANDARD_A: 'pt-BR-Standard-A', // Feminina (Standard)
    PT_BR_STANDARD_B: 'pt-BR-Standard-B', // Masculina (Standard)
    // Inglês (en-US)
    EN_US_NEURAL2_C: 'en-US-Neural2-C', // Feminina
    EN_US_NEURAL2_D: 'en-US-Neural2-D', // Masculina
    EN_US_NEURAL2_F: 'en-US-Neural2-F', // Feminina
    EN_US_NEURAL2_J: 'en-US-Neural2-J', // Masculina
});

/**
 * Vozes suportadas pelo modelo neural Kokoro 82M.
 * @readonly
 * @enum {string}
 */
const KokoroVoice = Object.freeze({
    // US English Female
    AF_BELLA: 'af_bella',
    AF_SARAH: 'af_sarah',
    AF_NICOLE: 'af_nicole',
    AF_SKY: 'af_sky',
    // US English Male
    AM_ADAM: 'am_adam',
    AM_MICHAEL: 'am_michael',
    AM_ECHO: 'am_echo',
    // UK English Female
    BF_EMMA: 'bf_emma',
    BF_ISABELLA: 'bf_isabella',
    // UK English Male
    BM_GEORGE: 'bm_george',
    BM_FABLE: 'bm_fable',
    // Multilingual
    PF_DORA: 'pf_dora',
    PM_ALEX: 'pm_alex',
});

/**
 * Vozes suportadas pelo motor ultra-leve Piper TTS (ONNX / Linux).
 * @readonly
 * @enum {string}
 */
const PiperVoice = Object.freeze({
    // Português do Brasil
    PT_BR_FABER_MEDIUM: 'pt_BR-faber-medium', // Masculina
    PT_BR_EDRESSON_LOW: 'pt_BR-edresson-low',   // Masculina leve
    // Inglês
    EN_US_LESSAC_MEDIUM: 'en_US-lessac-medium', // Feminina
    EN_US_RYAN_MEDIUM: 'en_US-ryan-medium',     // Masculina
});

/**
 * Vozes suportadas pelo modelo NVIDIA Magpie TTS Zero-Shot.
 * @readonly
 * @enum {string}
 */
const MagpieVoice = Object.freeze({
    ZEROSHOT_MULTILINGUAL_FEMALE: 'Magpie-ZeroShot-Multilingual.Female',
    ZEROSHOT_MULTILINGUAL_MALE: 'Magpie-ZeroShot-Multilingual.Male',
    MULTILINGUAL_EN_US_ARIA: 'Magpie-Multilingual.EN-US.Aria',
});

/**
 * Agrupamento centralizado de todas as vozes enumeradas por provedor.
 * Permite sintaxe idiomática: Voice.Google.PT_BR_NEURAL2_A ou Voice.Kokoro.AF_BELLA.
 * @readonly
 */
const Voice = Object.freeze({
    Google: GoogleVoice,
    Kokoro: KokoroVoice,
    Piper: PiperVoice,
    Magpie: MagpieVoice,
});

/**
 * Codificações de áudio suportadas.
 * @readonly
 * @enum {string}
 */
const AudioEncoding = Object.freeze({
    MP3: 'MP3',
    LINEAR16: 'LINEAR16',
    OGG_OPUS: 'OGG_OPUS',
});

/**
 * Formatos de arquivo de áudio.
 * @readonly
 * @enum {string}
 */
const AudioFormat = Object.freeze({
    MP3: 'mp3',
    WAV: 'wav',
    OGG: 'ogg',
    FLAC: 'flac',
});

/**
 * MIME types padronizados para anexos de áudio.
 * @readonly
 * @enum {string}
 */
const AudioMimeType = Object.freeze({
    OGG: 'audio/ogg',
    WAV: 'audio/wav',
    MP3: 'audio/mpeg',
    WEBM: 'audio/webm',
    FLAC: 'audio/flac',
});

/**
 * Identificadores padronizados dos provedores de TTS.
 * @readonly
 * @enum {string}
 */
const TTSProvider = Object.freeze({
    GOOGLE: 'google',
    KOKORO: 'kokoro',
    PIPER: 'piper',
    MAGPIE: 'magpie',
});

module.exports = {
    Voice,
    GoogleVoice,
    KokoroVoice,
    PiperVoice,
    MagpieVoice,
    AudioEncoding,
    AudioFormat,
    AudioMimeType,
    TTSProvider,
};
