'use strict';

const EventEmitter = require('events');
const { v4: uuid } = require('uuid');

// ─────────────────────────────────────────────────────────────────────────────
// EpisodicMemory — armazena episódios (turnos significativos) em backend
// persistente via MemoryStore. Permite recuperar contexto de conversas
// anteriores para a sessão atual.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Episode
 * @property {string} id
 * @property {string} sessionId
 * @property {object} turn          Turn original (role + parts)
 * @property {string} [summary]      Resumo textual do episódio
 * @property {number} [importance]   Score 0-1
 * @property {string[]} [tags]
 * @property {Date} createdAt
 */

class EpisodicMemory extends EventEmitter {
    #store;

    /**
     * @param {import('./MemoryStore').MemoryStore} store  Backend de persistência
     */
    constructor(store) {
        super();
        if (!store) throw new TypeError(`[${this.constructor.name}] store (MemoryStore) is required.`);
        if (typeof store.save !== 'function' || typeof store.findBySession !== 'function') {
            throw new TypeError(`[${this.constructor.name}] store must implement save() and findBySession() methods.`);
        }
        this.#store = store;
    }

    /**
     * Persiste um episódio.
     * @param {object} params
     * @param {string} params.sessionId
     * @param {object} params.turn
     * @param {string} [params.summary]
     * @param {number} [params.importance=0.5]
     * @param {string[]} [params.tags=[]]
     * @returns {Promise<Episode>}
     */
    async remember({ sessionId, turn, summary, importance = 0.5, tags = [] }) {
        if (!sessionId) {
            throw new TypeError(`[${this.constructor.name}] sessionId is required.`);
        }
        if (!turn) {
            throw new TypeError(`[${this.constructor.name}] turn is required.`);
        }
        if (importance < 0 || importance > 1) {
            throw new TypeError(`[${this.constructor.name}] importance must be between 0 and 1.`);
        }
        
        const record = {
            id: uuid(),
            sessionId,
            type: 'episodic',
            content: { turn, summary },
            importance,
            tags,
            createdAt: new Date(),
        };
        await this.#store.save(record);
        this.emit('remembered', record);
        return record;
    }

    /**
     * Recupera episódios de uma sessão.
     * @param {string} sessionId
     * @param {object} [filter] { tags?, limit?, offset? }
     * @returns {Promise<Episode[]>}
     */
    async recall(sessionId, { tags, limit = 10, offset = 0 } = {}) {
        return this.#store.findBySession(sessionId, { type: 'episodic', tags, limit, offset });
    }

    /**
     * Recupera os episódios mais importantes de uma sessão.
     * @param {string} sessionId
     * @param {number} [limit=5]
     * @returns {Promise<Episode[]>}
     */
    async recallImportant(sessionId, limit = 5) {
        const all = await this.#store.findBySession(sessionId, { type: 'episodic', limit: 100 });
        return all
            .sort((a, b) => (b.importance || 0) - (a.importance || 0))
            .slice(0, limit);
    }

    /**
     * Remove um episódio.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async forget(id) {
        const deleted = await this.#store.delete(id);
        if (deleted) this.emit('forgotten', { id });
        return deleted;
    }

    /**
     * Remove todos os episódios de uma sessão.
     * @param {string} sessionId
     * @returns {Promise<number>}
     */
    async forgetSession(sessionId) {
        const count = await this.#store.deleteBySession(sessionId);
        if (count > 0) this.emit('session_forgotten', { sessionId, count });
        return count;
    }

    /**
     * Compartilha episódios entre sessões.
     * Copia episódios de uma sessão de origem para uma sessão de destino.
     * @param {string} fromSessionId  Sessão de origem
     * @param {string} toSessionId    Sessão de destino
     * @param {object} [filter] { tags?, limit? }
     * @returns {Promise<number>} Quantidade de episódios compartilhados
     */
    async shareSession(fromSessionId, toSessionId, { tags, limit = 100 } = {}) {
        const episodes = await this.#store.findBySession(fromSessionId, {
            type: 'episodic',
            tags,
            limit,
        });
        
        let sharedCount = 0;
        for (const episode of episodes) {
            // Cria uma cópia do episódio na sessão de destino com novo sessionId
            const sharedEpisode = {
                ...episode,
                sessionId: toSessionId,
                // Remove o ID original para evitar conflitos, gerará novo ID ao salvar
                id: undefined,
            };
            await this.#store.save(sharedEpisode);
            sharedCount++;
        }
        
        if (sharedCount > 0) {
            this.emit('shared', { fromSessionId, toSessionId, count: sharedCount });
        }
        return sharedCount;
    }

    /**
     * Importa episódios de outro EpisodicMemory instance.
     * Útil para migrar memória entre diferentes instâncias.
     * @param {import('./EpisodicMemory').EpisodicMemory} sourceMemory  Outra instância EpisodicMemory
     * @param {object} [filter] { tags?, limit? }
     * @returns {Promise<number>} Quantidade de episódios importados
     */
    async importFrom(sourceMemory, { tags, limit = 100 } = {}) {
        // Busca episódios da sessão atual na memória fonte
        const currentSessionId = this.#getCurrentSessionId();
        if (!currentSessionId) {
            throw new Error('[EpisodicMemory] Current session ID not available for import.');
        }
        
        const episodes = await sourceMemory.recall(currentSessionId, { tags, limit });
        
        let importedCount = 0;
        for (const episode of episodes) {
            // Adapta o episode para a sessão atual
            const adaptedEpisode = {
                ...episode,
                sessionId: currentSessionId,
                id: undefined, // Gerará novo ID ao salvar
            };
            await this.#store.save(adaptedEpisode);
            importedCount++;
        }
        
        if (importedCount > 0) {
            this.emit('imported', { from: sourceMemory.constructor.name, count: importedCount });
        }
        return importedCount;
    }

    /** Obtém a ID da sessão corrente (implementação depende do contexto). */
    #getCurrentSessionId() {
        // Esta é uma implementação básica - subclasses ou o contexto da aplicação
        // devem fornecer o sessionId real
        return null;
    }
}

module.exports = { EpisodicMemory };
