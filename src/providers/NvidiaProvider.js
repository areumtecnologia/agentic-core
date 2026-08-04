'use strict';

const { OpenAIProvider } = require('./OpenAIProvider');

// ─────────────────────────────────────────────────────────────────────────────
// NvidiaProvider — implementação usando o pacote oficial 'openai' para Nvidia NIM
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

class NvidiaProvider extends OpenAIProvider {
    /**
     * @param {object} options
     * @param {string} options.apiKey   Chave de API do Nvidia NIM
     * @param {string} options.model    Nome do modelo (ex: 'minimaxai/minimax-m3')
     * @param {string} [options.baseURL='https://integrate.api.nvidia.com/v1']  URL base da API da Nvidia
     */
    constructor({ apiKey, model, baseURL = DEFAULT_BASE_URL } = {}) {
        if (!apiKey) throw new TypeError('[NvidiaProvider] apiKey is required.');
        super({
            apiKey,
            model,
            baseURL,
        });
    }

    getName() {
        return 'nvidia';
    }

    /**
     * Sobrescreve a tradução do turno do usuário para usar o formato `audio_url` com
     * Data URI em Base64, conforme exigido pela API Nvidia NIM.
     * O formato `input_audio` do OpenAI nativo não é suportado pelo NIM.
     * @param {object} turn
     * @returns {object[]}
     */
    translateUserTurn(turn) {
        const hasInlineData = turn.parts.some(p => p.inlineData);
        const hasAudio = turn.parts.some(p => p.inlineData?.mimeType?.startsWith('audio/'));

        // Sem áudio: delega inteiramente para a implementação base
        if (!hasAudio) {
            return super.translateUserTurn(turn);
        }

        // Com áudio: constrói o content manualmente usando audio_url (formato NIM)
        const content = [];

        for (const part of turn.parts) {
            if (part.text) {
                content.push({ type: 'text', text: part.text });
                continue;
            }

            if (!part.inlineData) continue;

            const { mimeType, data } = part.inlineData;
            const rawBase64 = data.replace(/^data:[^;]+;base64,/, '');
            const base64Url = data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`;

            if (mimeType.startsWith('audio/')) {
                // Formato exigido pelo Nvidia NIM: audio_url com Data URI em Base64
                content.push({
                    type: 'audio_url',
                    audio_url: {
                        url: `data:${mimeType};base64,${rawBase64}`
                    }
                });
            } else if (mimeType.startsWith('image/')) {
                content.push({ type: 'image_url', image_url: { url: base64Url } });
            } else if (mimeType.startsWith('video/')) {
                content.push({ type: 'video_url', video_url: { url: base64Url } });
            } else if (mimeType === 'application/pdf') {
                content.push({ type: 'image_url', image_url: { url: base64Url } });
            } else if (mimeType.startsWith('text/')) {
                try {
                    const textContent = Buffer.from(rawBase64, 'base64').toString('utf-8');
                    content.push({ type: 'text', text: `[Anexo ${mimeType}]\n${textContent}` });
                } catch {
                    content.push({ type: 'image_url', image_url: { url: base64Url } });
                }
            } else {
                content.push({ type: 'image_url', image_url: { url: base64Url } });
            }
        }

        return [{ role: 'user', content }];
    }
}

module.exports = { NvidiaProvider };
