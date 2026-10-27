'use strict';

const { BaseTTSProvider } = require('./BaseTTSProvider');
const { KokoroTTS } = require('./KokoroTTS');
const { MagpieTTS } = require('./MagpieTTS');
const { GoogleTTS } = require('./GoogleTTS');
const { PiperTTS } = require('./PiperTTS');
const { VoiceGateway } = require('./VoiceGateway');
const { TTSResponse } = require('./TTSResponse');
const {
    Voice,
    GoogleVoice,
    KokoroVoice,
    PiperVoice,
    MagpieVoice,
    AudioEncoding,
    AudioFormat,
    AudioMimeType,
    TTSProvider,
} = require('./VoiceTypes');

module.exports = {
    BaseTTSProvider,
    KokoroTTS,
    MagpieTTS,
    GoogleTTS,
    PiperTTS,
    VoiceGateway,
    TTSResponse,
    // ── Constantes & Enumeradores de Voz e Áudio ──
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
