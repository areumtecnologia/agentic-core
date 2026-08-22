'use strict';

const axios = require('axios');
const { BaseProvider } = require('./BaseProvider');

// ─────────────────────────────────────────────────────────────────────────────
// AnthropicProvider — implementação nativa da API Anthropic Messages (/v1/messages)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

class AnthropicProvider extends BaseProvider {
    #apiKey;
    #baseURL;
    #anthropicVersion;

    /**
     * @param {object} options
     * @param {string} options.apiKey             Chave de API da Anthropic
     * @param {string} [options.model='claude-3-7-sonnet-20250219'] Nome do modelo
     * @param {string} [options.baseURL]          URL base da API (padrão: https://api.anthropic.com/v1)
     * @param {string} [options.anthropicVersion] Versão da API Anthropic
     */
    constructor({
        apiKey,
        model = 'claude-3-7-sonnet-20250219',
        baseURL = DEFAULT_BASE_URL,
        anthropicVersion = DEFAULT_ANTHROPIC_VERSION,
    } = {}) {
        super({ model });
        if (!apiKey) throw new TypeError('[AnthropicProvider] apiKey is required.');
        this.#apiKey = apiKey;
        this.#baseURL = (baseURL || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.#anthropicVersion = anthropicVersion || DEFAULT_ANTHROPIC_VERSION;
    }

    getName() {
        return 'anthropic';
    }

    /**
     * @param {object} params
     * @param {object[]} params.contents
     * @param {string}   params.systemInstruction
     * @param {object[]} params.tools
     * @param {object}   params.config
     * @param {AbortSignal} [params.signal]
     * @returns {Promise<import('./BaseProvider').ProviderResponse>}
     */
    async generateContent({ contents, systemInstruction, tools, config, signal }) {
        const messages = this.translateContentsToMessages(contents);
        const anthropicTools = this.translateToolDeclarations(tools);

        const payload = {
            model: this.model,
            messages,
            max_tokens: config?.maxOutputTokens || 4096,
        };

        if (systemInstruction) {
            payload.system = systemInstruction;
        }

        if (config?.temperature !== undefined && config?.temperature !== null) {
            payload.temperature = config.temperature;
        }

        if (config?.topP !== undefined && config?.topP !== null) {
            payload.top_p = config.topP;
        }

        if (anthropicTools.length > 0) {
            payload.tools = anthropicTools;
        }

        const url = `${this.#baseURL}/messages`;

        const response = await axios.post(url, payload, {
            headers: {
                'x-api-key': this.#apiKey,
                'anthropic-version': this.#anthropicVersion,
                'content-type': 'application/json',
            },
            signal,
        });

        return this.translateResponseToProvider(response.data);
    }

    // ── Tradução: Histórico (Gemini → Anthropic) ────────────────────────────

    /**
     * Converte o histórico estruturado para o formato de mensagens da Anthropic.
     * Garante a alternância correta entre user e assistant.
     * @param {object[]} contents
     * @returns {object[]}
     */
    translateContentsToMessages(contents) {
        const rawMessages = [];
        const toolCallIdsByIndex = new Map();

        for (let i = 0; i < contents.length; i++) {
            const turn = contents[i];

            if (turn.role === 'user') {
                rawMessages.push(this.translateUserTurn(turn));
            } else if (turn.role === 'model') {
                const { message, toolCallIds } = this.translateModelTurn(turn);
                rawMessages.push(message);
                if (toolCallIds.length > 0) {
                    toolCallIdsByIndex.set(i + 1, toolCallIds);
                }
            } else if (turn.role === 'tool') {
                rawMessages.push(this.translateToolTurn(turn, toolCallIdsByIndex.get(i)));
            }
        }

        // Consolida mensagens consecutivas com o mesmo role (exigência da API Anthropic)
        const consolidated = [];
        for (const msg of rawMessages) {
            if (!msg) continue;
            const last = consolidated[consolidated.length - 1];
            if (last && last.role === msg.role) {
                const lastContent = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }];
                const msgContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
                last.content = [...lastContent, ...msgContent];
            } else {
                consolidated.push({
                    role: msg.role,
                    content: Array.isArray(msg.content) ? [...msg.content] : msg.content,
                });
            }
        }

        return consolidated;
    }

    /**
     * Converte o turno do usuário para blocos de conteúdo da Anthropic.
     * @param {object} turn
     * @returns {object}
     */
    translateUserTurn(turn) {
        const content = [];

        for (const part of turn.parts || []) {
            if (part.text) {
                content.push({ type: 'text', text: part.text });
            } else if (part.inlineData) {
                const { mimeType, data } = part.inlineData;
                const rawBase64 = data.replace(/^data:[^;]+;base64,/, '');

                if (mimeType.startsWith('image/')) {
                    content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: rawBase64,
                        },
                    });
                } else if (mimeType.startsWith('text/')) {
                    try {
                        const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
                        content.push({ type: 'text', text: `[Anexo ${mimeType}]\n${decoded}` });
                    } catch {
                        content.push({ type: 'text', text: `[Anexo Base64 ${mimeType}]` });
                    }
                } else {
                    content.push({ type: 'text', text: `[Anexo ${mimeType}]` });
                }
            }
        }

        return {
            role: 'user',
            content: content.length === 1 && content[0].type === 'text' ? content[0].text : content,
        };
    }

    /**
     * Converte o turno do modelo para o formato assistant da Anthropic.
     * @param {object} turn
     * @returns {{ message: object, toolCallIds: string[] }}
     */
    translateModelTurn(turn) {
        const content = [];
        const toolCallIds = [];

        for (const [idx, part] of (turn.parts || []).entries()) {
            if (part.text && !part.thought) {
                content.push({ type: 'text', text: part.text });
            } else if (part.functionCall) {
                const id = `call_${part.functionCall.name}_${idx}`;
                toolCallIds.push(id);
                content.push({
                    type: 'tool_use',
                    id,
                    name: part.functionCall.name,
                    input: part.functionCall.args || {},
                });
            }
        }

        return {
            message: {
                role: 'assistant',
                content: content.length === 1 && content[0].type === 'text' ? content[0].text : (content.length > 0 ? content : [{ type: 'text', text: '' }]),
            },
            toolCallIds,
        };
    }

    /**
     * Converte respostas de ferramentas para o formato tool_result do role user.
     * @param {object} turn
     * @param {string[]} [toolCallIds]
     * @returns {object}
     */
    translateToolTurn(turn, toolCallIds = []) {
        const content = [];

        for (const [idx, part] of (turn.parts || []).entries()) {
            const fnResponse = part.functionResponse;
            if (!fnResponse) continue;

            const toolUseId = toolCallIds[idx] || `call_${fnResponse.name}_${idx}`;
            const resultPayload = typeof fnResponse.response?.result === 'string'
                ? fnResponse.response.result
                : JSON.stringify(fnResponse.response?.result ?? {});

            content.push({
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: resultPayload,
            });
        }

        return {
            role: 'user',
            content,
        };
    }

    // ── Tradução: Tools (Gemini → Anthropic) ─────────────────────────────────

    /**
     * Converte declarações de tools para o formato da Anthropic.
     * @param {object[]} tools
     * @returns {object[]}
     */
    translateToolDeclarations(tools) {
        if (!tools || tools.length === 0) return [];

        return tools.map(t => {
            const decl = t.declaration || t;
            const parameters = this.convertTypesToLowerCase(
                JSON.parse(JSON.stringify(decl.parameters || { type: 'object', properties: {} }))
            );

            return {
                name: decl.name,
                description: decl.description || '',
                input_schema: parameters,
            };
        });
    }

    // ── Tradução: Resposta (Anthropic → ProviderResponse) ────────────────────

    /**
     * Converte a resposta da API Anthropic para a estrutura padrão ProviderResponse.
     * @param {object} data
     * @returns {import('./BaseProvider').ProviderResponse}
     */
    translateResponseToProvider(data) {
        if (!data || !Array.isArray(data.content)) {
            throw new Error(`[${this.constructor.name}] API returned an unexpected response format.`);
        }

        const parts = [];

        for (const block of data.content) {
            if (block.type === 'text') {
                parts.push({ text: block.text });
            } else if (block.type === 'thinking') {
                parts.push({ thought: block.thinking });
            } else if (block.type === 'tool_use') {
                parts.push({
                    functionCall: {
                        name: block.name,
                        args: block.input || {},
                    },
                });
            }
        }

        const inputTokens = data.usage?.input_tokens ?? 0;
        const outputTokens = data.usage?.output_tokens ?? 0;

        return {
            candidates: [{
                content: {
                    role: 'model',
                    parts,
                },
            }],
            usageMetadata: {
                promptTokenCount: inputTokens,
                candidatesTokenCount: outputTokens,
                totalTokenCount: inputTokens + outputTokens,
            },
        };
    }

    // ── Utilitários ──────────────────────────────────────────────────────────

    /**
     * Converte recursivamente os tipos do schema para minúsculas.
     * @param {object} obj
     * @returns {object}
     */
    convertTypesToLowerCase(obj) {
        if (!obj || typeof obj !== 'object') return obj;

        if (typeof obj.type === 'string') {
            obj.type = obj.type.toLowerCase();
        }
        if (obj.properties) {
            for (const key of Object.keys(obj.properties)) {
                this.convertTypesToLowerCase(obj.properties[key]);
            }
        }
        if (obj.items) {
            this.convertTypesToLowerCase(obj.items);
        }
        return obj;
    }
}

module.exports = { AnthropicProvider };
