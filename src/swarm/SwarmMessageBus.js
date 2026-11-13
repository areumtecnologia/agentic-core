const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * Barramento assíncrono pub/sub de mensagens entre agentes (Agent-to-Agent - A2A).
 * Suporta mensagens diretas ponto a ponto, canais temáticos (topics), broadcast
 * e requisições no padrão RPC assíncrono com correlationId e timeout.
 */
class SwarmMessageBus extends EventEmitter {
    #history = [];
    #pendingRequests = new Map();
    #maxHistory;

    constructor(options = {}) {
        super();
        this.#maxHistory = options.maxHistory || 1000;
    }

    /**
     * Envia uma mensagem ponto a ponto para um agente específico.
     * @param {string} from - ID do agente remetente.
     * @param {string} to - ID do agente destinatário.
     * @param {*} payload - Conteúdo da mensagem.
     * @param {Object} [meta={}] - Metadados adicionais.
     * @returns {Object} Mensagem registrada.
     */
    send(from, to, payload, meta = {}) {
        if (!from || !to) {
            throw new Error('SwarmMessageBus.send requer "from" e "to" preenchidos.');
        }

        const message = {
            id: meta.id || `msg-${crypto.randomUUID()}`,
            from,
            to,
            type: 'direct',
            payload,
            topic: meta.topic || null,
            correlationId: meta.correlationId || null,
            timestamp: Date.now(),
            meta
        };

        this.#recordMessage(message);

        // Dispara evento direcionado ao destinatário e evento global de mensagem
        this.emit(`message:${to}`, message);
        this.emit('message', message);

        // Se houver correlationId resolvendo uma requisição pendente
        if (message.correlationId && this.#pendingRequests.has(message.correlationId)) {
            const pending = this.#pendingRequests.get(message.correlationId);
            // Só resolve quando for uma resposta endereçada ao solicitante original
            if (message.from !== pending.from && message.to === pending.from) {
                clearTimeout(pending.timer);
                this.#pendingRequests.delete(message.correlationId);
                pending.resolve(message);
            }
        }

        return message;
    }

    /**
     * Transmite uma mensagem para todos os agentes do enxame (broadcast).
     * @param {string} from - ID do agente remetente.
     * @param {*} payload - Conteúdo da mensagem.
     * @param {Object} [meta={}] - Metadados adicionais.
     * @returns {Object} Mensagem registrada.
     */
    broadcast(from, payload, meta = {}) {
        if (!from) {
            throw new Error('SwarmMessageBus.broadcast requer "from" preenchido.');
        }

        const message = {
            id: meta.id || `msg-${crypto.randomUUID()}`,
            from,
            to: '*',
            type: 'broadcast',
            payload,
            topic: meta.topic || null,
            correlationId: meta.correlationId || null,
            timestamp: Date.now(),
            meta
        };

        this.#recordMessage(message);

        this.emit('broadcast', message);
        this.emit('message', message);

        return message;
    }

    /**
     * Publica uma mensagem em um canal ou tópico específico.
     * @param {string} from - ID do remetente.
     * @param {string} topic - Nome do tópico.
     * @param {*} payload - Conteúdo da mensagem.
     * @param {Object} [meta={}] - Metadados adicionais.
     * @returns {Object} Mensagem registrada.
     */
    publish(from, topic, payload, meta = {}) {
        if (!from || !topic) {
            throw new Error('SwarmMessageBus.publish requer "from" e "topic" preenchidos.');
        }

        const message = {
            id: meta.id || `msg-${crypto.randomUUID()}`,
            from,
            to: null,
            type: 'topic',
            topic,
            payload,
            correlationId: meta.correlationId || null,
            timestamp: Date.now(),
            meta
        };

        this.#recordMessage(message);

        this.emit(`topic:${topic}`, message);
        this.emit('message', message);

        return message;
    }

    /**
     * Envia uma mensagem e aguarda uma resposta correlacionada do destinatário (padrão RPC A2A).
     * @param {string} from - ID do agente solicitante.
     * @param {string} to - ID do agente que responderá.
     * @param {*} payload - Conteúdo da requisição.
     * @param {Object} [options={}] - Opções com timeoutMs.
     * @returns {Promise<Object>} Resposta recebida.
     */
    request(from, to, payload, options = {}) {
        const timeoutMs = options.timeoutMs || 10000;
        const correlationId = `req-${crypto.randomUUID()}`;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.#pendingRequests.delete(correlationId);
                reject(new Error(`SwarmMessageBus.request timed out após ${timeoutMs}ms aguardando resposta de "${to}".`));
            }, timeoutMs);

            this.#pendingRequests.set(correlationId, { from, to, resolve, reject, timer });

            try {
                this.send(from, to, payload, { correlationId, ...options.meta });
            } catch (err) {
                clearTimeout(timer);
                this.#pendingRequests.delete(correlationId);
                reject(err);
            }
        });
    }

    /**
     * Inscreve um ouvinte para mensagens enviadas a um destinatário específico.
     * @param {string} agentId - ID do agente interessado.
     * @param {Function} handler - Callback acionado ao receber mensagem.
     * @returns {Function} Função para desinscrever.
     */
    subscribeAgent(agentId, handler) {
        const eventName = `message:${agentId}`;
        this.on(eventName, handler);
        return () => this.off(eventName, handler);
    }

    /**
     * Inscreve um ouvinte para um tópico temático.
     * @param {string} topic - Nome do tópico.
     * @param {Function} handler - Callback acionado ao receber mensagem do tópico.
     * @returns {Function} Função para desinscrever.
     */
    subscribeTopic(topic, handler) {
        const eventName = `topic:${topic}`;
        this.on(eventName, handler);
        return () => this.off(eventName, handler);
    }

    /**
     * Retorna cópia do histórico de mensagens auditadas.
     * @param {Object} [filter={}] - Filtros por from, to ou topic.
     * @returns {Array<Object>}
     */
    getHistory(filter = {}) {
        return this.#history.filter((msg) => {
            if (filter.from && msg.from !== filter.from) return false;
            if (filter.to && msg.to !== filter.to) return false;
            if (filter.topic && msg.topic !== filter.topic) return false;
            if (filter.type && msg.type !== filter.type) return false;
            return true;
        });
    }

    /**
     * Limpa o histórico de mensagens e cancela requisições pendentes.
     */
    clear() {
        for (const [corrId, { timer, reject }] of this.#pendingRequests.entries()) {
            clearTimeout(timer);
            reject(new Error('SwarmMessageBus foi resetado antes de receber a resposta.'));
        }
        this.#pendingRequests.clear();
        this.#history = [];
    }

    #recordMessage(message) {
        this.#history.push(Object.freeze({ ...message }));
        if (this.#history.length > this.#maxHistory) {
            this.#history.shift();
        }
    }
}

module.exports = SwarmMessageBus;
