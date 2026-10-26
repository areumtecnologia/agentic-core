'use strict';

const { OpenAIProvider } = require('./OpenAIProvider');
const { ThinkingStreamParser } = require('./helpers/ThinkingStreamParser');
const { IntentRouter } = require('../slm/IntentRouter');

// ─────────────────────────────────────────────────────────────────────────────
// OllamaProvider — provedor para modelos locais Ollama com suporte a Thinking
// ─────────────────────────────────────────────────────────────────────────────

class OllamaProvider extends OpenAIProvider {
    /**
     * @param {object} options
     * @param {string} options.model    Nome do modelo local (ex: 'llama3.2:1b', 'gemma4:e4b', 'qwen2.5:0.5b')
     * @param {string} [options.baseURL='http://localhost:11434/v1']  URL base do Ollama
     * @param {string} [options.apiKey] Chave de API opcional (para proxies)
     * @param {string[]} [options.stop] Sequências de parada customizadas
     * @param {object|boolean} [options.thinking] Configuração de raciocínio (ex: true, { enabled: true, mode: 'auto'|'always', language: 'pt-BR' })
     * @param {boolean} [options.emulateThinking] Atalho booleano para habilitar thinking emulado em modelos sem suporte nativo
     * @param {object} [options.openAIOptions={}]
     */
    constructor({ model, baseURL = 'http://localhost:11434/v1', apiKey, stop, thinking, emulateThinking, openAIOptions = {} } = {}) {
        if (!model) throw new TypeError('[OllamaProvider] model is required.');

        let cleanBase = (baseURL || 'http://localhost:11434').replace(/\/+$/, '');
        if (!cleanBase.endsWith('/v1')) {
            cleanBase += '/v1';
        }

        super({
            apiKey: apiKey || 'ollama',
            model,
            baseURL: cleanBase,
            allowEmptyApiKey: true,
            openAIOptions,
        });

        this.customStop = stop || null;
        this.thinkingConfig = this.#normalizeThinkingConfig(thinking, emulateThinking);
    }

    getName() {
        return 'ollama';
    }

    /**
     * Normaliza as opções de raciocínio.
     * @private
     */
    #normalizeThinkingConfig(thinking, emulateThinking) {
        const isEnabled = Boolean(emulateThinking || thinking);
        if (typeof thinking === 'object' && thinking !== null) {
            return {
                enabled: thinking.enabled !== false,
                mode: thinking.mode || 'always', // 'always' | 'auto'
                language: thinking.language || 'pt-BR',
                tag: thinking.tag || 'think',
                customInstruction: thinking.instruction || thinking.customInstruction || null,
                budget: thinking.budget || null,
            };
        }
        return {
            enabled: isEnabled,
            mode: 'always',
            language: 'pt-BR',
            tag: 'think',
            customInstruction: null,
            budget: null,
        };
    }

    /**
     * Identifica se o modelo configurado é pequeno (geralmente <= 1.5B parâmetros).
     * @returns {boolean}
     */
    isSmallModel() {
        const m = (this.model || '').toLowerCase();
        return (
            m.includes('0.5b') ||
            m.includes('0.6b') ||
            m.includes('0.8b') ||
            m.includes('350m') ||
            m.includes('1b') ||
            m.includes('1.2b') ||
            m.includes('functiongemma') ||
            m.includes('minicpm5-1b') ||
            m.includes('drana')
        );
    }

    /**
     * Verifica se o modelo suporta a role 'system' nativamente em seu template de chat.
     * @returns {boolean}
     */
    supportsSystemRole() {
        const m = (this.model || '').toLowerCase();
        return !m.includes('functiongemma');
    }

    /**
     * Retorna os stop tokens padrão para evitar loops infinitos em modelos compactos.
     * @returns {string[]}
     */
    getDefaultStopTokens() {
        const m = (this.model || '').toLowerCase();
        if (m.includes('functiongemma')) {
            return [];
        }
        return ['<|im_end|>', '<|endoftext|>', '<end_of_turn>', '<end_function_call>', '</tool_call>'];
    }

    /**
     * Determina se o raciocínio deve ser ativado para a requisição atual.
     * @param {object} [config={}]
     * @param {Array} [contents=[]]
     * @returns {boolean}
     */
    isThinkingActive(config = {}, contents = []) {
        if (config?.thinking === false || config?.emulateThinking === false) {
            return false;
        }

        if (config?.thinking === true || config?.emulateThinking === true) {
            return true;
        }

        if (typeof config?.thinking === 'object' && config.thinking !== null) {
            if (config.thinking.enabled === false) return false;
            if (config.thinking.mode === 'auto') {
                return IntentRouter.shouldEnforceReasoning(contents);
            }
            return true;
        }

        if (this.thinkingConfig.enabled) {
            if (this.thinkingConfig.mode === 'auto') {
                return IntentRouter.shouldEnforceReasoning(contents);
            }
            return true;
        }

        return false;
    }

    /**
     * Gera a instrução de sistema injetando a diretiva de raciocínio.
     * @param {string|object} systemInstruction
     * @param {boolean} activeThinking
     * @param {string} [lang='pt-BR']
     * @returns {string}
     */
    buildSystemInstruction(systemInstruction, activeThinking, lang = 'pt-BR') {
        let base = typeof systemInstruction === 'string' ? systemInstruction : '';
        if (systemInstruction && typeof systemInstruction === 'object' && Array.isArray(systemInstruction.parts)) {
            base = systemInstruction.parts.map(p => p.text || '').join('\n');
        }

        if (!activeThinking) {
            return base;
        }

        if (this.thinkingConfig.customInstruction) {
            return base ? `${base}\n\n${this.thinkingConfig.customInstruction}` : this.thinkingConfig.customInstruction;
        }

        const isEn = typeof lang === 'string' && lang.toLowerCase().startsWith('en');
        const tag = this.thinkingConfig.tag || 'think';

        const directive = isEn
            ? `[REASONING DIRECTIVE]\nBefore providing any final answer or executing tool calls, you MUST formulate your reasoning step-by-step inside <${tag}> and </${tag}> tags. Formulate deductions, analyze constraints, and verify logic. After closing </${tag}>, output only the final user response or tool calls.`
            : `[DIRETIVA DE RACIOCÍNIO]\nAntes de fornecer qualquer resposta final ou executar ferramentas, você DEVE estruturar seu raciocínio passo a passo dentro das tags <${tag}> e </${tag}>. Analise premissas, regras, planeje sua execução e deduza as conclusões. Ao fechar </${tag}>, forneça a resposta direta ao usuário ou a chamada de ferramentas apropriada.`;

        return base ? `${base}\n\n${directive}` : directive;
    }

    /**
     * Injeta a diretiva de raciocínio no primeiro turno do usuário para modelos sem suporte a system role.
     * @private
     */
    #injectDirectiveIntoUserTurn(contents, lang = 'pt-BR') {
        if (!Array.isArray(contents) || contents.length === 0) return contents;

        const firstUserIndex = contents.findIndex(c => c.role === 'user');
        if (firstUserIndex === -1) return contents;

        const directive = this.buildSystemInstruction('', true, lang);
        return contents.map((turn, idx) => {
            if (idx === firstUserIndex) {
                const parts = turn.parts ? [...turn.parts] : [];
                if (parts.length > 0 && parts[0].text) {
                    return {
                        ...turn,
                        parts: [{ ...parts[0], text: `${directive}\n\n${parts[0].text}` }, ...parts.slice(1)],
                    };
                }
            }
            return turn;
        });
    }

    /**
     * Processa candidatos da resposta bruta extraindo blocos de raciocínio e reparando chamadas de tool embutidas.
     * @private
     */
    #processResponseThinking(response, tools = []) {
        if (!response || !response.candidates || response.candidates.length === 0) {
            return response;
        }

        const candidate = response.candidates[0];
        if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) {
            return response;
        }

        const originalParts = candidate.content.parts;
        const newParts = [];
        let foundThoughtText = '';

        for (const part of originalParts) {
            if (part.thought) {
                newParts.push(part);
                continue;
            }

            if (part.text) {
                const { thought, text: cleanedText, hasThinking } = ThinkingStreamParser.extractThinking(part.text, {
                    openTag: `<${this.thinkingConfig.tag}>`,
                    closeTag: `</${this.thinkingConfig.tag}>`,
                });

                if (hasThinking && thought) {
                    foundThoughtText = foundThoughtText ? `${foundThoughtText}\n\n${thought}` : thought;
                }

                if (cleanedText) {
                    const sanitizedText = cleanedText
                        .replace(/^\[(?:DIRETIVA DE RACIOCÍNIO|REASONING DIRECTIVE)\]\s*/i, '')
                        .trim();
                    if (sanitizedText) {
                        newParts.push({ text: sanitizedText });
                    }
                }
            } else {
                newParts.push(part);
            }
        }

        if (foundThoughtText) {
            const hasExistingThought = newParts.some(p => p.thought && p.text === foundThoughtText);
            if (!hasExistingThought) {
                newParts.unshift({ thought: true, text: foundThoughtText });
            }
        }

        // Se o modelo emitiu tool calls embutidas no texto após fechar </think>
        const textPart = newParts.find(p => p.text);
        const hasFunctionCall = newParts.some(p => p.functionCall);

        if (!hasFunctionCall && textPart && textPart.text) {
            const { cleanedText, toolCalls } = this.extractToolCallsFromText(textPart.text, tools);
            if (toolCalls.length > 0) {
                textPart.text = cleanedText;
                for (let idx = 0; idx < toolCalls.length; idx++) {
                    const tc = toolCalls[idx];
                    newParts.push({
                        functionCall: {
                            id: `call_${tc.name}_${idx}`,
                            name: tc.name,
                            args: tc.args || {},
                        },
                    });
                }
            }
        }

        candidate.content.parts = newParts;
        return response;
    }

    async generateContent({ contents, systemInstruction, tools, config, signal }) {
        const modifiedConfig = { ...config };
        if (!modifiedConfig.stop) {
            modifiedConfig.stop = this.customStop || (this.isSmallModel() ? this.getDefaultStopTokens() : undefined);
        }

        const activeThinking = this.isThinkingActive(config, contents);
        const effectiveInstruction = this.supportsSystemRole()
            ? this.buildSystemInstruction(systemInstruction, activeThinking, this.thinkingConfig.language)
            : systemInstruction;

        let effectiveContents = contents;
        if (!this.supportsSystemRole() && activeThinking && contents && contents.length > 0) {
            effectiveContents = this.#injectDirectiveIntoUserTurn(contents, this.thinkingConfig.language);
        }

        const rawResult = await super.generateContent({
            contents: effectiveContents,
            systemInstruction: effectiveInstruction,
            tools,
            config: modifiedConfig,
            signal,
        });

        return this.#processResponseThinking(rawResult, tools);
    }

    async *generateContentStream({ contents, systemInstruction, tools, config, signal }) {
        const modifiedConfig = { ...config };
        if (!modifiedConfig.stop) {
            modifiedConfig.stop = this.customStop || (this.isSmallModel() ? this.getDefaultStopTokens() : undefined);
        }

        const activeThinking = this.isThinkingActive(config, contents);
        const effectiveInstruction = this.supportsSystemRole()
            ? this.buildSystemInstruction(systemInstruction, activeThinking, this.thinkingConfig.language)
            : systemInstruction;

        let effectiveContents = contents;
        if (!this.supportsSystemRole() && activeThinking && contents && contents.length > 0) {
            effectiveContents = this.#injectDirectiveIntoUserTurn(contents, this.thinkingConfig.language);
        }

        const parentStream = super.generateContentStream({
            contents: effectiveContents,
            systemInstruction: effectiveInstruction,
            tools,
            config: modifiedConfig,
            signal,
        });

        const parser = new ThinkingStreamParser({
            openTag: `<${this.thinkingConfig.tag}>`,
            closeTag: `</${this.thinkingConfig.tag}>`,
        });

        for await (const chunk of parentStream) {
            if (chunk.type === 'token' && chunk.text) {
                const parsedOutputs = parser.feed(chunk.text);
                for (const item of parsedOutputs) {
                    if (item.type === 'thought') {
                        yield { type: 'thought', thought: item.thought };
                    } else if (item.type === 'token') {
                        yield { type: 'token', text: item.text };
                    }
                }
            } else if (chunk.type === 'response') {
                const flushed = parser.flush();
                for (const item of flushed) {
                    if (item.type === 'thought') {
                        yield { type: 'thought', thought: item.thought };
                    } else if (item.type === 'token') {
                        yield { type: 'token', text: item.text };
                    }
                }

                const summary = parser.getSummary();
                const processedResponse = this.#processResponseThinking(chunk.response, tools);

                if (summary.accumulatedThought) {
                    const candidate = processedResponse?.candidates?.[0];
                    if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
                        const hasThoughtPart = candidate.content.parts.some(p => p.thought);
                        if (!hasThoughtPart) {
                            candidate.content.parts.unshift({ thought: true, text: summary.accumulatedThought });
                        }
                    }
                }

                yield { type: 'response', response: processedResponse };
            } else {
                yield chunk;
            }
        }
    }
}

module.exports = { OllamaProvider };
