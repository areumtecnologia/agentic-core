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

        if (config?.stop) {
            body.stop = config.stop;
        }

        if (openAITools.length > 0) {
            body.tools = openAITools;
        }

        if (config?.toolChoice || config?.tool_choice) {
            body.tool_choice = config.toolChoice || config.tool_choice;
        }

        const completion = await this.#client.chat.completions.create(body, { signal });
        return this.translateResponseToProvider(completion, tools);
    }

    /**
     * Gera conteúdo em streaming usando a API de chat completions da OpenAI.
     * @param {object} params
     * @returns {AsyncIterable<object>}
     */
    async *generateContentStream({ contents, systemInstruction, tools, config, signal }) {
        const messages = this.translateContentsToMessages(contents, systemInstruction);
        const openAITools = this.translateToolDeclarations(tools);

        const body = {
            model: this.model,
            messages,
            temperature: config?.temperature,
            max_tokens: config?.maxOutputTokens,
            top_p: config?.topP,
            stream: true,
        };

        if (config?.stop) {
            body.stop = config.stop;
        }

        if (openAITools.length > 0) {
            body.tools = openAITools;
        }

        if (config?.toolChoice || config?.tool_choice) {
            body.tool_choice = config.toolChoice || config.tool_choice;
        }

        const stream = await this.#client.chat.completions.create(body, { signal });

        let accumulatedContent = '';
        let accumulatedReasoning = '';
        const toolCallsMap = new Map(); // index -> { id, name, arguments }

        for await (const chunk of stream) {
            const choice = chunk.choices?.[0];
            const delta = choice?.delta;
            if (!delta) continue;

            if (delta.content) {
                accumulatedContent += delta.content;
                yield { type: 'token', text: delta.content };
            }

            if (delta.reasoning_content || delta.thought || delta.reasoning) {
                const thoughtText = delta.reasoning_content || delta.thought || delta.reasoning;
                accumulatedReasoning += thoughtText;
                yield { type: 'thought', thought: thoughtText };
            }

            if (Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallsMap.has(idx)) {
                        toolCallsMap.set(idx, {
                            id: tc.id || `call_${idx}`,
                            name: tc.function?.name || '',
                            arguments: tc.function?.arguments || ''
                        });
                    } else {
                        const existing = toolCallsMap.get(idx);
                        if (tc.id) existing.id = tc.id;
                        if (tc.function?.name) existing.name += tc.function.name;
                        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                    }
                }
            }
        }

        // Reconstrói a resposta padronizada
        const parts = [];
        if (accumulatedContent) parts.push({ text: accumulatedContent });
        if (accumulatedReasoning) parts.push({ thought: true, text: accumulatedReasoning });

        // Se toolCallsMap estiver vazio mas accumulatedContent tiver chamadas de tools embutidas (típico de modelos compactos):
        if (toolCallsMap.size === 0 && accumulatedContent) {
            const { cleanedText, toolCalls } = this.extractToolCallsFromText(accumulatedContent, tools);
            if (toolCalls.length > 0) {
                const textPart = parts.find(p => p.text);
                if (textPart) {
                    textPart.text = cleanedText;
                }
                for (let idx = 0; idx < toolCalls.length; idx++) {
                    const tc = toolCalls[idx];
                    toolCallsMap.set(idx, {
                        id: `call_${tc.name}_${idx}`,
                        name: tc.name,
                        arguments: JSON.stringify(tc.args || {})
                    });
                }
            }
        }

        for (const tc of toolCallsMap.values()) {
            let fnName = tc.name;
            let fnArgs = this.safeParseJSON(tc.arguments);

            // Auto-reparo se o nome veio vazio (ex: Ollama com FunctionGemma)
            if (!fnName && accumulatedContent) {
                const rec = this.extractToolCallsFromText(accumulatedContent, tools);
                if (rec.toolCalls.length > 0) {
                    fnName = rec.toolCalls[0].name;
                    if (Object.keys(fnArgs).length === 0 && Object.keys(rec.toolCalls[0].args).length > 0) {
                        fnArgs = rec.toolCalls[0].args;
                    }
                }
            }
            if (!fnName) continue;

            parts.push({
                functionCall: {
                    id: tc.id,
                    name: fnName,
                    args: fnArgs
                }
            });
            yield {
                type: 'tool_call',
                functionCall: {
                    id: tc.id,
                    name: fnName,
                    args: fnArgs
                }
            };
        }

        const fullResponse = {
            candidates: [{
                content: {
                    role: 'model',
                    parts
                }
            }],
            usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }
        };

        yield { type: 'response', response: fullResponse };
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

        const supportsSystem = typeof this.supportsSystemRole === 'function' ? this.supportsSystemRole() : true;

        if (systemInstruction && supportsSystem) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        let firstUserTurnHandled = false;

        for (let i = 0; i < contents.length; i++) {
            const turn = contents[i];

            if (turn.role === 'user') {
                const userMsgs = this.translateUserTurn(turn);
                if (systemInstruction && !supportsSystem && !firstUserTurnHandled && userMsgs.length > 0) {
                    firstUserTurnHandled = true;
                    if (typeof userMsgs[0].content === 'string') {
                        userMsgs[0].content = `[INSTRUÇÕES DO SISTEMA]\n${systemInstruction}\n\n[MENSAGEM DO USUÁRIO]\n${userMsgs[0].content}`;
                    }
                }
                messages.push(...userMsgs);
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
        } else if (!turn.parts.some(p => p.functionCall)) {
            const allText = turn.parts.map(p => p.text || '').join('\n').trim();
            assistantMsg.content = allText || '';
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
    translateResponseToProvider(data, tools = []) {
        const choice = data.choices?.[0];
        if (!choice) {
            throw new Error(`[${this.constructor.name}] API returned no choices.`);
        }

        const message = choice.message;
        const parts = [];

        if (message.content) {
            parts.push({ text: message.content });
        }

        if (message.reasoning_content || message.thought || message.reasoning) {
            const thText = message.reasoning_content || message.thought || message.reasoning;
            parts.push({ thought: true, text: thText });
        }

        if (message.tool_calls && message.tool_calls.length > 0) {
            for (const tc of message.tool_calls) {
                let fnName = tc.function?.name || '';
                let fnArgs = typeof tc.function?.arguments === 'string'
                    ? this.safeParseJSON(tc.function.arguments)
                    : tc.function?.arguments ?? {};

                // Auto-reparo de tool_call com nome vazio (comum quando Ollama não parseia FunctionGemma ou MiniCPM)
                if (!fnName && message.content) {
                    const recovered = this.extractToolCallsFromText(message.content, tools);
                    if (recovered.toolCalls.length > 0) {
                        fnName = recovered.toolCalls[0].name;
                        if (Object.keys(fnArgs).length === 0 && Object.keys(recovered.toolCalls[0].args).length > 0) {
                            fnArgs = recovered.toolCalls[0].args;
                        }
                    }
                }

                if (fnName) {
                    parts.push({
                        functionCall: {
                            id: tc.id,
                            name: fnName,
                            args: fnArgs,
                        },
                    });
                }
            }
        }

        // Se nenhuma functionCall foi adicionada ainda (ou faltaram chamadas de texto), extrai do message.content
        if (!parts.some(p => p.functionCall) && message.content) {
            const { cleanedText, toolCalls } = this.extractToolCallsFromText(message.content, tools);
            if (toolCalls.length > 0) {
                const textPart = parts.find(p => p.text);
                if (textPart) {
                    textPart.text = cleanedText;
                }
                for (const tc of toolCalls) {
                    parts.push({
                        functionCall: {
                            name: tc.name,
                            args: tc.args,
                        },
                    });
                }
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
     * Parse tolerante e seguro de JSON com fallback para formatos comuns gerados por LLMs (chaves sem aspas, aspas simples).
     * @param {string} str
     * @returns {object}
     */
    safeParseJSON(str) {
        if (!str || typeof str !== 'string') return {};
        const trimmed = str.trim();
        if (!trimmed) return {};
        try {
            return JSON.parse(trimmed);
        } catch {
            try {
                // Lenient parsing: substitui aspas simples e corrige chaves sem aspas
                const cleaned = trimmed
                    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
                    .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
                    .replace(/,\s*([}\]])/g, '$1');
                return JSON.parse(cleaned);
            } catch {
                // Fallback para pares chave: valor sem aspas (estilo Python/Gemma: {param: (2 + 2 * 3), name: 'test'})
                try {
                    const inner = trimmed.replace(/^\{|\}$/g, '').trim();
                    if (!inner) return {};
                    const result = {};
                    const parts = inner.split(/,(?![^(]*\))/);
                    for (const part of parts) {
                        const colonIdx = part.indexOf(':');
                        if (colonIdx === -1) continue;
                        const k = part.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
                        let v = part.slice(colonIdx + 1).trim();
                        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                            v = v.slice(1, -1);
                        } else if (!isNaN(Number(v)) && v !== '') {
                            v = Number(v);
                        } else if (v === 'true') {
                            v = true;
                        } else if (v === 'false') {
                            v = false;
                        } else if (v === 'null') {
                            v = null;
                        }
                        if (k) result[k] = v;
                    }
                    if (Object.keys(result).length > 0) return result;
                } catch {}
                return { _raw: str };
            }
        }
    }

    /**
     * Extrai chamadas de ferramentas emitidas em formato texto/XML/Markdown/ReAct/FunctionGemma por modelos compactos.
     * @param {string} text
     * @param {Array<object>} [tools=[]]  Lista de ferramentas declaradas para validação e desambiguação
     * @returns {{ cleanedText: string, toolCalls: Array<{ name: string, args: object }> }}
     */
    extractToolCallsFromText(text, tools = []) {
        if (!text || typeof text !== 'string') return { cleanedText: text, toolCalls: [] };

        const allowedToolNames = new Set();
        if (Array.isArray(tools) && tools.length > 0) {
            for (const t of tools) {
                const name = t.declaration?.name || t.function?.name || t.name;
                if (name) allowedToolNames.add(name);
            }
        }

        const toolCalls = [];
        let cleanedText = text;

        // 1. Dialeto FunctionGemma: [prefix:]func_name{...}<end_function_call> ou call:func_name{...}
        // Exemplos: calculation: calculate_expression{expression: (2 + 2 * 3)}<end_function_call>
        //           call:get_current_datetime{}<end_function_call>
        const fgRegex = /(?:([a-zA-Z0-9_-]+):\s*|<call:\s*)?([a-zA-Z0-9_-]+)\s*(\{[\s\S]*?\})(?:<end_function_call>|<end_of_turn>|>)?/gi;
        let fgMatch;
        while ((fgMatch = fgRegex.exec(text)) !== null) {
            const prefix = fgMatch[1];
            let name = fgMatch[2];
            const rawArgs = fgMatch[3];

            if (allowedToolNames.size > 0) {
                if (allowedToolNames.has(name)) {
                    // name é a ferramenta válida
                } else if (prefix && allowedToolNames.has(prefix)) {
                    name = prefix;
                } else {
                    continue;
                }
            }

            const args = this.safeParseJSON(rawArgs);
            if (name && !toolCalls.some(t => t.name === name)) {
                toolCalls.push({ name, args });
            }
            cleanedText = cleanedText.replace(fgMatch[0], '').trim();
        }

        // 2. Dialeto ChatML XML: <tool_call>\n{"name": "...", "arguments": {...}}\n</tool_call>
        const toolCallXmlRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
        let tcXmlMatch;
        while ((tcXmlMatch = toolCallXmlRegex.exec(text)) !== null) {
            const inner = tcXmlMatch[1].trim();
            const parsed = this.safeParseJSON(inner);
            const name = parsed.name || parsed.function || parsed.tool;
            const args = parsed.arguments || parsed.parameters || parsed.args || {};
            if (name && !toolCalls.some(t => t.name === name)) {
                toolCalls.push({ name, args: typeof args === 'string' ? this.safeParseJSON(args) : args });
            }
            cleanedText = cleanedText.replace(tcXmlMatch[0], '').trim();
        }

        // 3. Dialeto MiniCPM ou tags parciais: name="tool_name"> ou <tool_call name="..." />
        const miniCpmRegex = /(?:<tool_call\s+)?name=["']([a-zA-Z0-9_-]+)["']\s*(?:arguments|args)?=?["']?(\{[\s\S]*?\})?["']?\s*\/?>/gi;
        let mcMatch;
        while ((mcMatch = miniCpmRegex.exec(text)) !== null) {
            const name = mcMatch[1];
            const args = mcMatch[2] ? this.safeParseJSON(mcMatch[2]) : {};
            if (name && !toolCalls.some(t => t.name === name)) {
                toolCalls.push({ name, args });
            }
            cleanedText = cleanedText.replace(mcMatch[0], '').trim();
        }

        // 4. Blocos de código Markdown ```json { "name": "..." } ```
        const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gis;
        let jsonMatch;
        while ((jsonMatch = jsonBlockRegex.exec(text)) !== null) {
            const parsed = this.safeParseJSON(jsonMatch[1]);
            const name = parsed.name || parsed.function || parsed.tool || parsed.tool_call?.name;
            const args = parsed.arguments || parsed.parameters || parsed.args || parsed.tool_call?.arguments || {};
            if (name && !toolCalls.some(t => t.name === name)) {
                toolCalls.push({ name, args: typeof args === 'string' ? this.safeParseJSON(args) : args });
            }
            cleanedText = cleanedText.replace(jsonMatch[0], '').trim();
        }

        // 5. Dialeto ReAct: Action: tool_name \n Action Input: {...}
        const reactRegex = /Action:\s*([a-zA-Z0-9_-]+)\s*\n\s*Action Input:\s*(\{[\s\S]*?\}|[^\n]+)/gi;
        let reactMatch;
        while ((reactMatch = reactRegex.exec(text)) !== null) {
            const name = reactMatch[1];
            const rawInput = reactMatch[2].trim();
            const args = (rawInput.startsWith('{') && rawInput.endsWith('}'))
                ? this.safeParseJSON(rawInput)
                : { input: rawInput };
            if (name && !toolCalls.some(t => t.name === name)) {
                toolCalls.push({ name, args });
            }
            cleanedText = cleanedText.replace(reactMatch[0], '').trim();
        }

        // 6. JSON inline puro: {"name": "...", "arguments": {...}}
        if (toolCalls.length === 0) {
            const rawJsonRegex = /(\{\s*"(?:name|tool|function)"\s*:\s*"([a-zA-Z0-9_-]+)"\s*,\s*"(?:arguments|parameters|args)"\s*:\s*(\{[\s\S]*?\})\s*\})/gis;
            let rawMatch;
            while ((rawMatch = rawJsonRegex.exec(text)) !== null) {
                const name = rawMatch[2];
                const args = this.safeParseJSON(rawMatch[3]);
                if (name && !toolCalls.some(t => t.name === name)) {
                    toolCalls.push({ name, args });
                }
                cleanedText = cleanedText.replace(rawMatch[0], '').trim();
            }
        }

        // 7. Tags XML genéricas: <tool_name key="val" /> ou <tool_name>...</tool_name>
        if (toolCalls.length === 0) {
            const xmlTagRegex = /<([a-zA-Z0-9_-]+)\s+([^>]*?)(?:\/>|>(.*?)<\/\1>)/gis;
            let xmlMatch;
            while ((xmlMatch = xmlTagRegex.exec(text)) !== null) {
                const toolName = xmlMatch[1];
                const lower = toolName.toLowerCase();
                if (['p', 'div', 'span', 'br', 'b', 'i', 'strong', 'em', 'tool_call', 'tools', 'tool_response', 'think', 'thought', 'step', 'expression', 'user', 'assistant', 'system', 'human', 'ai', 'message', 'response', 'query', 'input', 'output'].includes(lower)) {
                    continue;
                }

                // Se conhecemos as ferramentas declaradas, rejeita tags desconhecidas
                if (allowedToolNames.size > 0) {
                    let matchedName = null;
                    for (const an of allowedToolNames) {
                        if (an.toLowerCase() === lower) {
                            matchedName = an;
                            break;
                        }
                    }
                    if (!matchedName) continue;
                } else if (/^[A-Z]/.test(toolName)) {
                    // Rejeita tags iniciando em maiúscula como <User>, <Output>, etc.
                    continue;
                }

                const rawAttributes = xmlMatch[2] || '';
                const innerContent = xmlMatch[3] || '';
                const args = {};
                const attrRegex = /([a-zA-Z0-9_-]+)=["']([^"']*?)["']/g;
                let attrMatch;
                while ((attrMatch = attrRegex.exec(rawAttributes)) !== null) {
                    let val = attrMatch[2];
                    if (/^\d+$/.test(val)) val = parseInt(val, 10);
                    else if (/^\d+\.\d+$/.test(val)) val = parseFloat(val);
                    else if (val === 'true') val = true;
                    else if (val === 'false') val = false;
                    args[attrMatch[1]] = val;
                }
                if (innerContent.trim()) {
                    const parsedInner = this.safeParseJSON(innerContent.trim());
                    if (typeof parsedInner === 'object' && parsedInner !== null && !parsedInner._raw) {
                        Object.assign(args, parsedInner);
                    } else if (Object.keys(args).length === 0) {
                        args.content = innerContent.trim();
                    }
                }
                toolCalls.push({ name: toolName, args });
                cleanedText = cleanedText.replace(xmlMatch[0], '').trim();
            }
        }

        return { cleanedText, toolCalls };
    }
}

module.exports = { OpenAIProvider };
