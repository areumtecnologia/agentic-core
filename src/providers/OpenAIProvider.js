'use strict';

const OpenAI = require('openai');
const { BaseProvider } = require('./BaseProvider');

// ─────────────────────────────────────────────────────────────────────────────
// OpenAIProvider — implementação usando o SDK oficial 'openai'
// Servindo também de base para todos os provedores compatíveis com a API OpenAI
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

class OpenAIProvider extends BaseProvider {
    #client;
    #apiKey;
    #baseURL;

    /**
     * @param {object} options
     * @param {string} [options.apiKey]   Chave de API
     * @param {string} options.model      Nome do modelo (ex: 'gpt-4o', 'gpt-4o-mini')
     * @param {string} [options.baseURL='https://api.openai.com/v1']  URL base da API
     * @param {boolean} [options.allowEmptyApiKey=false] Permite apiKey vazia (ex: Ollama local)
     * @param {object} [options.openAIOptions={}] Opções adicionais para o construtor OpenAI SDK
     */
    constructor({ apiKey, model, baseURL = DEFAULT_BASE_URL, allowEmptyApiKey = false, openAIOptions = {} } = {}) {
        super({ model });
        if (!apiKey && !allowEmptyApiKey) {
            throw new TypeError(`[${new.target.name}] apiKey is required.`);
        }
        this.#apiKey = apiKey || 'ollama';
        this.#baseURL = (baseURL || DEFAULT_BASE_URL).replace(/\/+$/, '');

        this.#client = new OpenAI({
            apiKey: this.#apiKey,
            baseURL: this.#baseURL,
            ...openAIOptions,
        });
    }

    getName() {
        return 'openai';
    }

    /**
     * Retorna a instância do SDK OpenAI.
     * @returns {OpenAI}
     */
    getClient() {
        return this.#client;
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
        const messages = this.translateContentsToMessages(contents, systemInstruction);
        const openAITools = this.translateToolDeclarations(tools);

        const body = {
            model: this.model,
            messages,
            temperature: config?.temperature,
            max_tokens: config?.maxOutputTokens,
            top_p: config?.topP,
        };

        if (openAITools.length > 0) {
            body.tools = openAITools;
        }

        const completion = await this.#client.chat.completions.create(body, { signal });
        return this.translateResponseToProvider(completion);
    }

    // ── Tradução: Histórico (Gemini → OpenAI) ────────────────────────────────

    /**
     * Converte o histórico de contents (formato Gemini) para o formato messages da OpenAI.
     * @param {object[]} contents
     * @param {string}   systemInstruction
     * @returns {object[]}
     */
    translateContentsToMessages(contents, systemInstruction) {
        const messages = [];
        const toolCallIdsByIndex = new Map();

        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        for (let i = 0; i < contents.length; i++) {
            const turn = contents[i];

            if (turn.role === 'user') {
                messages.push(...this.translateUserTurn(turn));
            } else if (turn.role === 'model') {
                const toolCallIds = this.translateModelTurn(turn, messages);
                if (toolCallIds.length > 0) {
                    toolCallIdsByIndex.set(i + 1, toolCallIds);
                }
            } else if (turn.role === 'tool') {
                this.translateToolTurn(turn, messages, toolCallIdsByIndex.get(i));
            }
        }

        return messages;
    }

    /**
     * Converte o turno do usuário extraindo textos e anexos multimodais (imagens, áudios, vídeos, documentos).
     * Conforme os padrões da API OpenAI.
     * @param {object} turn
     * @returns {object[]}
     */
    translateUserTurn(turn) {
        const hasInlineData = turn.parts.some(p => p.inlineData);

        if (!hasInlineData) {
            const text = turn.parts.filter(p => p.text).map(p => p.text).join('\n');
            return [{ role: 'user', content: text }];
        }

        const content = [];
        for (const part of turn.parts) {
            if (part.text) {
                content.push({
                    type: 'text',
                    text: part.text
                });
            } else if (part.inlineData) {
                const { mimeType, data } = part.inlineData;
                const base64Url = data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`;
                const rawBase64 = data.replace(/^data:[^;]+;base64,/, '');

                if (mimeType.startsWith('image/')) {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: base64Url
                        }
                    });
                } else if (mimeType.startsWith('audio/')) {
                    const formatExt = mimeType.split('/')[1]?.split(';')[0]?.toLowerCase() || 'wav';
                    const format = formatExt === 'mpeg' ? 'mp3' : formatExt;
                    content.push({
                        type: 'input_audio',
                        input_audio: {
                            data: rawBase64,
                            format
                        }
                    });
                } else if (mimeType.startsWith('video/')) {
                    content.push({
                        type: 'video_url',
                        video_url: {
                            url: base64Url
                        }
                    });
                } else if (mimeType === 'application/pdf') {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: base64Url
                        }
                    });
                } else if (mimeType.startsWith('text/')) {
                    try {
                        const textContent = Buffer.from(rawBase64, 'base64').toString('utf-8');
                        content.push({
                            type: 'text',
                            text: `[Anexo ${mimeType}]\n${textContent}`
                        });
                    } catch {
                        content.push({
                            type: 'image_url',
                            image_url: { url: base64Url }
                        });
                    }
                } else {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: base64Url
                        }
                    });
                }
            }
        }
        return [{ role: 'user', content }];
    }

    /**
     * @param {object} turn
     * @param {object[]} messages
     * @returns {string[]}  IDs gerados para tool_calls (para correlacionar com o turno tool seguinte)
     */
    translateModelTurn(turn, messages) {
        const assistantMsg = { role: 'assistant' };
        const toolCallIds = [];

        // Texto de resposta (ignora thoughts)
        const textParts = turn.parts.filter(p => p.text && !p.thought);
        if (textParts.length > 0) {
            assistantMsg.content = textParts.map(p => p.text).join('\n');
        }

        // Chamadas de função
        const functionCallParts = turn.parts.filter(p => p.functionCall);
        if (functionCallParts.length > 0) {
            assistantMsg.tool_calls = functionCallParts.map((p, idx) => {
                const id = `call_${p.functionCall.name}_${idx}`;
                toolCallIds.push(id);
                return {
                    id,
                    type: 'function',
                    function: {
                        name: p.functionCall.name,
                        arguments: JSON.stringify(p.functionCall.args ?? {}),
                    },
                };
            });
        }

        messages.push(assistantMsg);
        return toolCallIds;
    }

    /**
     * @param {object} turn
     * @param {object[]} messages
     * @param {string[]} [toolCallIds]  IDs gerados no turno model anterior
     */
    translateToolTurn(turn, messages, toolCallIds = []) {
        turn.parts.forEach((part, index) => {
            const fnResponse = part.functionResponse;
            if (!fnResponse) return;

            const toolCallId = toolCallIds[index] || `call_${fnResponse.name}_${index}`;
            const content = typeof fnResponse.response?.result === 'string'
                ? fnResponse.response.result
                : JSON.stringify(fnResponse.response?.result ?? {});

            messages.push({
                role: 'tool',
                tool_call_id: toolCallId,
                content,
            });
        });
    }

    // ── Tradução: Tools (Gemini → OpenAI) ────────────────────────────────────

    /**
     * Converte declarações de tools do formato Gemini/neutro para o formato OpenAI.
     * @param {object[]} tools  Array de { declaration, handler }
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
                type: 'function',
                function: {
                    name: decl.name,
                    description: decl.description,
                    parameters,
                },
            };
        });
    }

    // ── Tradução: Resposta (OpenAI → Gemini) ─────────────────────────────────

    /**
     * Converte a resposta da API OpenAI para o formato padronizado (ProviderResponse).
     * @param {object} data  Resposta bruta ou objeto Completion da API OpenAI
     * @returns {import('./BaseProvider').ProviderResponse}
     */
    translateResponseToProvider(data) {
        const choice = data.choices?.[0];
        if (!choice) {
            throw new Error(`[${this.constructor.name}] API returned no choices.`);
        }

        const message = choice.message;
        const parts = [];

        if (message.content) {
            parts.push({ text: message.content });
        }

        if (message.reasoning_content || message.thought) {
            parts.push({ thought: message.reasoning_content || message.thought });
        }

        if (message.tool_calls && message.tool_calls.length > 0) {
            for (const tc of message.tool_calls) {
                parts.push({
                    functionCall: {
                        name: tc.function.name,
                        args: typeof tc.function.arguments === 'string'
                            ? this.safeParseJSON(tc.function.arguments)
                            : tc.function.arguments ?? {},
                    },
                });
            }
        }

        return {
            candidates: [{
                content: {
                    role: 'model',
                    parts,
                },
            }],
            usageMetadata: {
                promptTokenCount: data.usage?.prompt_tokens ?? 0,
                candidatesTokenCount: data.usage?.completion_tokens ?? 0,
                totalTokenCount: data.usage?.total_tokens ?? 0,
            },
        };
    }

    // ── Utilitários ──────────────────────────────────────────────────────────

    /**
     * Converte recursivamente os valores de `type` para lowercase (Gemini usa 'STRING', OpenAI usa 'string').
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

    /**
     * Parse seguro de JSON com fallback para evitar crash em argumentos malformados.
     * @param {string} str
     * @returns {object}
     */
    safeParseJSON(str) {
        try {
            return JSON.parse(str || '{}');
        } catch {
            return { _raw: str };
        }
    }
}

module.exports = { OpenAIProvider };
