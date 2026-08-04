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
        if (!store) throw new TypeError('[EpisodicMemory] store (MemoryStore) is required.');
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
}

module.exports = { EpisodicMemory };
