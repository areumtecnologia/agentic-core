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
     */
    async recall(sessionId, { subject, tags, limit = 50 } = {}) {
        const records = await this.#store.findBySession(sessionId, { type: 'semantic', tags, limit });
        if (subject) {
            return records.filter(r => r.content.subject === subject);
        }
        return records;
    }

    /** Recupera fatos globais (sessionId = 'global'). */
    async recallGlobal(filter = {}) {
        return this.recall('global', filter);
    }

    /**
     * Busca fatos por padrão de predicate (ex: "prefers", "knows", "is").
     * @param {string} predicate
     * @param {object} [filter] { subject?, sessionId?, tags?, limit? }
     * @returns {Promise<SemanticFact[]>}
     */
    async recallByPredicate(predicate, { subject, sessionId, tags, limit = 50 } = {}) {
        const filter = { type: 'semantic' };
        if (tags && tags.length > 0) filter.tags = tags;
        if (limit) filter.limit = limit;
        
        const records = await this.#store.findBySession(sessionId || 'global', filter);
        
        // Filtra pelo predicate correspondente
        const filtered = records.filter(r => r.content.predicate === predicate);
        
        // Se há filtro de subject, aplica também
        if (subject) {
            return filtered.filter(r => r.content.subject === subject);
        }
        return filtered;
    }

    /**
     * Busca fatos por range de confiança.
     * @param {number} minConfidence  Confiança mínima (0-1)
     * @param {number} [maxConfidence=1.0]  Confiança máxima (0-1)
     * @param {object} [filter] { subject?, tags?, limit? }
     * @returns {Promise<SemanticFact[]>}
     */
    async recallByConfidence(minConfidence, { maxConfidence = 1.0, subject, tags, limit = 50 } = {}) {
        if (minConfidence < 0 || minConfidence > 1 || maxConfidence < 0 || maxConfidence > 1) {
            throw new TypeError('[SemanticMemory] confidence values must be between 0 and 1.');
        }
        if (minConfidence > maxConfidence) {
            throw new TypeError('[SemanticMemory] minConfidence must be <= maxConfidence.');
        }
        
        const records = await this.#store.findBySession('global', {
            type: 'semantic',
            tags,
            limit: 1000,
        });
        
        return records
            .filter(r => {
                const confidence = r.content.confidence ?? 1.0;
                return confidence >= minConfidence && confidence <= maxConfidence;
            })
            .filter(r => subject ? r.content.subject === subject : true)
            .slice(0, limit);
    }

    /** Remove um fato. */
    async forget(id) {
        const deleted = await this.#store.delete(id);
        if (deleted) this.emit('forgotten', { id });
        return deleted;
    }

    /** Remove todos os fatos de uma sessão. */
    async forgetSession(sessionId) {
        const count = await this.#store.deleteBySession(sessionId);
        if (count > 0) this.emit('session_forgotten', { sessionId, count });
        return count;
    }
}

module.exports = { SemanticMemory };
