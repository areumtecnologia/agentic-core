'use strict';

const EventEmitter = require('events');
const { v4: uuid } = require('uuid');

// ─────────────────────────────────────────────────────────────────────────────
// SemanticMemory — conhecimento factual extraído e indexado.
// Diferente da EpisodicMemory (eventos), a SemanticMemory armazena
// fatos, preferências e conhecimento duradouro sobre o usuário ou domínio.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SemanticFact
 * @property {string} id
 * @property {string} sessionId     Sessão de origem (ou 'global' para fatos compartilhados)
 * @property {string} subject       Sujeito do fato (ex: "user", "company_policy")
 * @property {string} predicate     Predicado (ex: "prefers", "knows", "is")
 * @property {string} object        Valor do fato
 * @property {number} [confidence] 0-1
 * @property {string[]} [tags]
 * @property {Date} createdAt
 * @property {Date} [updatedAt]
 */

class SemanticMemory extends EventEmitter {
    #store;

    /**
     * @param {import('./MemoryStore').MemoryStore} store
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
     * Armazena ou atualiza um fato semântico.
     * @param {object} params
     * @param {string} params.sessionId
     * @param {string} params.subject
     * @param {string} params.predicate
     * @param {string} params.object
     * @param {number} [params.confidence=1.0]
     * @param {string[]} [params.tags=[]]
     * @returns {Promise<SemanticFact>}
     */
    async learn({ sessionId, subject, predicate, object, confidence = 1.0, tags = [] }) {
        if (!sessionId) {
            throw new TypeError(`[${this.constructor.name}] sessionId is required.`);
        }
        if (!subject) {
            throw new TypeError(`[${this.constructor.name}] subject is required.`);
        }
        if (!predicate) {
            throw new TypeError(`[${this.constructor.name}] predicate is required.`);
        }
        if (object === undefined || object === null) {
            throw new TypeError(`[${this.constructor.name}] object is required.`);
        }
        if (confidence < 0 || confidence > 1) {
            throw new TypeError(`[${this.constructor.name}] confidence must be between 0 and 1.`);
        }
        
        // Busca fato existente com mesmo subject+predicate para atualizar
        const existing = await this.#findExisting(sessionId, subject, predicate);

        if (existing) {
            existing.content.object = object;
            existing.content.confidence = confidence;
            existing.updatedAt = new Date();
            await this.#store.save(existing);
            this.emit('updated', existing);
            return existing;
        }

        const record = {
            id: uuid(),
            sessionId,
            type: 'semantic',
            content: { subject, predicate, object, confidence },
            tags,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.#store.save(record);
        this.emit('learned', record);
        return record;
    }

    async #findExisting(sessionId, subject, predicate) {
        const records = await this.#store.findBySession(sessionId, { type: 'semantic', limit: 500 });
        return records.find(r =>
            r.content.subject === subject &&
            r.content.predicate === predicate
        );
    }

    /**
     * Recupera fatos de uma sessão.
     * @param {string} sessionId
     * @param {object} [filter] { subject?, tags?, limit? }
     * @returns {Promise<SemanticFact[]>}
     */
    async recall(sessionId, { subject, tags, limit = 50 } = {}) {
        const records = await this.#store.findBySession(sessionId, { type: 'semantic', tags, limit });
        if (subject) {
            return records.filter(r => r.content.subject === subject);
        }
        return records;
    }

    /**
     * Recupera fatos globais (sessionId = 'global').
     * @param {object} [filter]
     * @returns {Promise<SemanticFact[]>}
     */
    async recallGlobal(filter = {}) {
        return this.recall('global', filter);
    }

    /**
     * Remove um fato.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async forget(id) {
        const deleted = await this.#store.delete(id);
        if (deleted) this.emit('forgotten', { id });
        return deleted;
    }

    /**
     * Remove todos os fatos de uma sessão.
     * @param {string} sessionId
     * @returns {Promise<number>}
     */
    async forgetSession(sessionId) {
        const count = await this.#store.deleteBySession(sessionId);
        if (count > 0) this.emit('session_forgotten', { sessionId, count });
        return count;
    }
}

module.exports = { SemanticMemory };
