'use strict';

const EventEmitter = require('events');
const { AgenticCore } = require('./AgenticCore');
const { AgentConfig } = require('./AgentConfig');

// ─────────────────────────────────────────────────────────────────────────────
// SubAgent — agente especializado com escopo reduzido, executado sob demanda
// por um AgenticCore pai. Reutiliza a infraestrutura de providers, tools e
// memória, mas sem gestão própria de sessão externa.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SubAgentOptions
 * @property {AgenticCore} parent        Agente pai (para delegação)
 * @property {AgentConfig} config        Configuração específica do subagente
 * @property {string} name               Nome identificador do subagente
 * @property {object[]} [tools=[]]       Tools específicas (opcional)
 * @property {object} [context]          Contexto inicial injetado
 */

/**
 * @typedef {object} SubAgentResult
 * @property {boolean} success
 * @property {string} output             Resposta textual do subagente
 * @property {object} [data]             Dados estruturados retornados
 * @property {number} durationMs         Duração da execução em ms
 * @property {Error} [error]             Erro, se houver
 */

class SubAgent extends EventEmitter {
    #parent;
    #config;
    #name;
    #tools;
    #context;

    /**
     * @param {SubAgentOptions} opts
     */
    constructor({ parent, config, name, tools = [], context = {} }) {
        super();
        if (!parent || !(parent instanceof AgenticCore)) {
            throw new TypeError('[SubAgent] parent must be an instance of AgenticCore.');
        }
        if (!config || !(config instanceof AgentConfig)) {
            throw new TypeError('[SubAgent] config must be an instance of AgentConfig.');
        }
        if (!name || typeof name !== 'string') {
            throw new TypeError('[SubAgent] name must be a non-empty string.');
        }
        this.#parent = parent;
        this.#config = config;
        this.#name = name;
        this.#tools = tools;
        this.#context = context;
    }

    /** Nome do subagente. */
    get name() { return this.#name; }

    /** Configuração do subagente. */
    get config() { return this.#config; }

    /**
     * Executa uma tarefa isolada com contexto injetado do pai.
     *
     * @param {string} task                 Descrição da tarefa
     * @param {object} [parentContext]      Dados/contexto do pai (mescla com #context)
     * @param {AbortSignal} [signal]        Sinal de cancelamento
     * @returns {Promise<SubAgentResult>}
     */
    async execute(task, parentContext = {}, signal) {
        const startAt = Date.now();
        const mergedContext = { ...this.#context, ...parentContext };

        // Injeta contexto no prompt do subagente
        const contextPrompt = this.#buildContextPrompt(mergedContext);
        const fullTask = contextPrompt ? `${contextPrompt}\n\nTask: ${task}` : task;

        let sessionId;

        try {
            // Cria sessão efêmera no pai para isolar o histórico da conversa
            sessionId = `subagent:${this.#name}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
            this.#parent.createSession(sessionId, {
                name: this.#name,
                phone: 'subagent',
                origin: 'subagent',
            });

            // Executa com tools e config isoladas do subagente (sem mutar o registry global do pai)
            const result = await this.#parent.processMessage(
                sessionId,
                fullTask,
                {},
                {
                    tools: this.#tools,
                    agent: this.#config,
                    signal
                }
            );

            const durationMs = Date.now() - startAt;
            const subAgentResult = {
                success: true,
                output: result.response || '',
                data: result,
                durationMs,
            };

            this.emit('completed', subAgentResult);
            return subAgentResult;

        } catch (error) {
            const durationMs = Date.now() - startAt;
            const subAgentResult = {
                success: false,
                output: '',
                data: null,
                durationMs,
                error,
            };
            this.emit('failed', subAgentResult);
            return subAgentResult;
        } finally {
            if (sessionId) {
                this.#parent.clearSession(sessionId, { reason: 'subagent_completed', eventTrigger: false });
            }
        }
    }


    /**
     * Constrói prompt de contexto a partir do objeto de contexto.
     * @param {object} context
     * @returns {string}
     */
    #buildContextPrompt(context) {
        const entries = Object.entries(context);
        if (entries.length === 0) return '';
        const lines = entries.map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                return `[${key}]: ${JSON.stringify(value)}`;
            }
            return `[${key}]: ${value}`;
        });
        return `<context>\n${lines.join('\n')}\n</context>`;
    }
}

module.exports = { SubAgent };
