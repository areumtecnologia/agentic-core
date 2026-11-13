const { EventEmitter } = require('events');
const crypto = require('crypto');
const SwarmMessageBus = require('./SwarmMessageBus');
const SharedBlackboard = require('./SharedBlackboard');
const SwarmMember = require('./SwarmMember');
const PipelineTopology = require('./topologies/PipelineTopology');

/**
 * Orquestrador Central de Enxames de Agentes (AgentSwarm - v4.2).
 * Coordena múltiplos agentes autônomos cooperativos sob topologias customizáveis
 * (Supervisor-Worker, Pipeline Sequencial, Shared Blackboard) com comunicação A2A.
 */
class AgentSwarm extends EventEmitter {
    #id;
    #members = new Map(); // id -> SwarmMember
    #topology;
    #bus;
    #blackboard;
    #options;

    /**
     * @param {Object} [options={}]
     * @param {string} [options.id] - Identificador único do swarm.
     * @param {Object} [options.topology] - Instância de topologia (SupervisorTopology, PipelineTopology, BlackboardTopology).
     * @param {SwarmMessageBus} [options.bus] - Instância customizada de barramento.
     * @param {SharedBlackboard} [options.blackboard] - Instância customizada de quadro compartilhado.
     */
    constructor(options = {}) {
        super();
        this.#id = options.id || `swarm-${crypto.randomUUID().slice(0, 8)}`;
        this.#bus = options.bus || new SwarmMessageBus();
        this.#blackboard = options.blackboard || new SharedBlackboard();
        this.#topology = options.topology || new PipelineTopology();
        this.#options = options;

        // Propaga eventos internos do blackboard e do bus
        this.#blackboard.on('updated', (entry) => {
            this.emit('swarm:blackboard_updated', entry);
        });

        this.#bus.on('message', (msg) => {
            this.emit('swarm:message_sent', msg);
        });
    }

    get id() {
        return this.#id;
    }

    get topology() {
        return this.#topology;
    }

    get bus() {
        return this.#bus;
    }

    get blackboard() {
        return this.#blackboard;
    }

    get size() {
        return this.#members.size;
    }

    /**
     * Registra um membro especialista no enxame.
     * @param {string|SwarmMember} idOrMember - ID ou instância de SwarmMember.
     * @param {Object|Function} [agent] - Instância de AgenticCore ou função executora.
     * @param {Object} [profile={}] - Perfil com role, capabilities, metadata.
     * @returns {SwarmMember} O membro registrado.
     */
    registerMember(idOrMember, agent, profile = {}) {
        let member;
        if (idOrMember instanceof SwarmMember) {
            member = idOrMember;
        } else {
            member = new SwarmMember({
                id: idOrMember,
                agent,
                role: profile.role || 'specialist',
                capabilities: profile.capabilities || [],
                metadata: profile.metadata || {}
            });
        }

        this.#members.set(member.id, member);

        // Notifica o barramento e o quadro sobre o novo membro disponível
        this.#blackboard.set(`member_card_${member.id}`, member.toCard(), {
            updatedBy: 'swarm',
            meta: { role: member.role }
        });

        this.emit('swarm:member_registered', member.toCard());
        return member;
    }

    /**
     * Remove um membro do enxame.
     * @param {string} memberId
     * @returns {boolean}
     */
    removeMember(memberId) {
        if (!this.#members.has(memberId)) return false;
        this.#members.delete(memberId);
        this.#blackboard.delete(`member_card_${memberId}`, 'swarm');
        this.emit('swarm:member_removed', { memberId });
        return true;
    }

    /**
     * Obtém um membro registrado pelo ID.
     * @param {string} memberId
     * @returns {SwarmMember|undefined}
     */
    getMember(memberId) {
        return this.#members.get(memberId);
    }

    /**
     * Verifica se um membro existe.
     * @param {string} memberId
     * @returns {boolean}
     */
    hasMember(memberId) {
        return this.#members.has(memberId);
    }

    /**
     * Retorna array com todos os membros registrados.
     * @returns {Array<SwarmMember>}
     */
    getMembers() {
        return Array.from(this.#members.values());
    }

    /**
     * Retorna os cartões (manifestos) de capacidades de todos os membros.
     * @returns {Array<Object>}
     */
    getMemberCards() {
        return this.getMembers().map((m) => m.toCard());
    }

    /**
     * Define uma nova topologia de coordenação para o enxame.
     * @param {Object} topology
     */
    setTopology(topology) {
        if (!topology || typeof topology.execute !== 'function') {
            throw new Error('A topologia do Swarm deve implementar o método execute().');
        }
        this.#topology = topology;
    }

    /**
     * Executa o enxame colaborativo sob a topologia configurada.
     * @param {*} input - Objetivo, instrução ou dados de entrada.
     * @param {Object} [options={}] - Opções adicionais.
     * @returns {Promise<Object>} Resultado consolidado da execução coletiva.
     */
    async execute(input, options = {}) {
        if (this.#members.size === 0) {
            throw new Error(`AgentSwarm "${this.#id}" não possui membros registrados para execução.`);
        }

        const startTime = Date.now();
        this.emit('swarm:started', {
            swarmId: this.#id,
            topology: this.#topology.name,
            membersCount: this.#members.size,
            input
        });

        try {
            const result = await this.#topology.execute({
                input,
                members: this.#members,
                bus: this.#bus,
                blackboard: this.#blackboard,
                emitter: this,
                options
            });

            const totalDurationMs = Date.now() - startTime;
            const finalPayload = {
                swarmId: this.#id,
                topology: this.#topology.name,
                result: result.finalOutput,
                details: result,
                totalDurationMs
            };

            this.emit('swarm:completed', finalPayload);
            return finalPayload;
        } catch (err) {
            this.emit('swarm:error', { swarmId: this.#id, error: err });
            throw err;
        }
    }

    /**
     * Reseta o estado do swarm (limpa quadro compartilhado e barramento de mensagens).
     */
    reset() {
        this.#blackboard.clear();
        this.#bus.clear();
        for (const member of this.#members.values()) {
            member.setStatus('idle');
            this.#blackboard.set(`member_card_${member.id}`, member.toCard(), { updatedBy: 'swarm' });
        }
        this.emit('swarm:reset', { swarmId: this.#id });
    }
}

module.exports = AgentSwarm;

