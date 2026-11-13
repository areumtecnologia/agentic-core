/**
 * Representa um membro integrante do Swarm (Agent-to-Agent).
 * Encapsula o agente executor (instância de AgenticCore, SubAgent ou função customizada),
 * suas capacidades (capabilities), papel (role) e status operacional.
 */
class SwarmMember {
    #id;
    #agent;
    #role;
    #capabilities;
    #status; // 'idle' | 'working' | 'paused' | 'error'
    #metadata;

    /**
     * @param {Object} options
     * @param {string} options.id - Identificador único do membro.
     * @param {Object|Function} options.agent - Instância de AgenticCore ou função executora.
     * @param {string} [options.role='specialist'] - Papel no enxame (ex: 'researcher', 'coder').
     * @param {string[]} [options.capabilities=[]] - Habilidades ou ferramentas dominadas.
     * @param {Object} [options.metadata={}] - Informações adicionais.
     */
    constructor({ id, agent, role = 'specialist', capabilities = [], metadata = {} }) {
        if (!id || typeof id !== 'string') {
            throw new Error('SwarmMember requer um "id" válido em string.');
        }
        if (!agent) {
            throw new Error(`SwarmMember "${id}" requer um "agent" executor.`);
        }

        this.#id = id;
        this.#agent = agent;
        this.#role = role;
        this.#capabilities = Array.isArray(capabilities) ? [...capabilities] : [];
        this.#status = 'idle';
        this.#metadata = { ...metadata };
    }

    get id() {
        return this.#id;
    }

    get agent() {
        return this.#agent;
    }

    get role() {
        return this.#role;
    }

    get capabilities() {
        return [...this.#capabilities];
    }

    get status() {
        return this.#status;
    }

    get metadata() {
        return { ...this.#metadata };
    }

    setStatus(status) {
        this.#status = status;
    }

    /**
     * Verifica se o membro possui uma capacidade específica.
     * @param {string} capability
     * @returns {boolean}
     */
    hasCapability(capability) {
        return this.#capabilities.includes(capability);
    }

    /**
     * Executa uma tarefa usando o agente subjacente.
     * Suporta instâncias com `processMessage(sessionId, prompt)` ou funções diretas `(input, context) => ...`.
     * @param {string|Object} task - Instrução ou payload da tarefa.
     * @param {Object} [context={}] - Contexto de execução e histórico do swarm.
     * @returns {Promise<*>} Resultado processado.
     */
    async execute(task, context = {}) {
        this.#status = 'working';
        try {
            let result;

            if (typeof this.#agent.processMessage === 'function') {
                const sessionId = context.sessionId || `swarm-${this.#id}-${Date.now()}`;
                const prompt = typeof task === 'string' ? task : JSON.stringify(task);
                const responseObj = await this.#agent.processMessage(sessionId, prompt);
                result = responseObj?.response !== undefined ? responseObj.response : responseObj;
            } else if (typeof this.#agent.execute === 'function') {
                result = await this.#agent.execute(task, context);
            } else if (typeof this.#agent === 'function') {
                result = await this.#agent(task, context);
            } else {
                throw new Error(`O agente do membro "${this.#id}" não possui método executável (processMessage ou execute).`);
            }

            this.#status = 'idle';
            return result;
        } catch (err) {
            this.#status = 'error';
            throw err;
        }
    }

    /**
     * Retorna o Agent Card / manifesto de capacidades do membro.
     * @returns {Object}
     */
    toCard() {
        return {
            id: this.#id,
            role: this.#role,
            capabilities: [...this.#capabilities],
            status: this.#status,
            metadata: { ...this.#metadata }
        };
    }
}

module.exports = SwarmMember;

