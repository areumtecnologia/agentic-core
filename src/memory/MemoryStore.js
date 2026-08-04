'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// MemoryStore — interface abstrata para backends de memória persistente.
// Implementações concretas: InMemoryStore, RedisStore, PostgresStore, etc.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} MemoryRecord
 * @property {string} id            UUID do registro
 * @property {string} sessionId     Sessão à qual a memória pertence
 * @property {string} type          'episodic' | 'semantic' | 'summary'
 * @property {object} content       Conteúdo estruturado da memória
 * @property {number} [importance]  Score 0-1 de relevância
 * @property {string[]} [tags]      Tags para filtragem
 * @property {number} [embedding]   Vetor de embedding (opcional)
 * @property {Date}  createdAt      Timestamp de criação
 * @property {Date}  [expiresAt]   Expiração opcional
 */

class MemoryStore {
    /**
     * Persiste um registro de memória.
     * @param {MemoryRecord} record
     * @returns {Promise<MemoryRecord>}
     */
    async save(record) {
        throw new Error(`[${this.constructor.name}] Method save() must be implemented.`);
    }

    /**
     * Recupera um registro pelo ID.
     * @param {string} id
     * @returns {Promise<MemoryRecord|null>}
     */
    async get(id) {
        throw new Error(`[${this.constructor.name}] Method get() must be implemented.`);
    }

    /**
     * Busca registros por sessão, opcionalmente filtrados por tipo/tags.
     * @param {string} sessionId
     * @param {object} [filter] { type?, tags?, limit?, offset? }
     * @returns {Promise<MemoryRecord[]>}
     */
    async findBySession(sessionId, filter = {}) {
        throw new Error(`[${this.constructor.name}] Method findBySession() must be implemented.`);
    }

    /**
     * Remove um registro pelo ID.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error(`[${this.constructor.name}] Method delete() must be implemented.`);
    }

    /**
     * Remove todos os registros de uma sessão.
     * @param {string} sessionId
     * @returns {Promise<number>} Quantidade removida
     */
    async deleteBySession(sessionId) {
        throw new Error(`[${this.constructor.name}] Method deleteBySession() must be implemented.`);
    }

    /**
     * Busca semântica por similaridade (apenas stores com suporte a embeddings).
     * Implementações que não suportam devem retornar array vazio.
     * @param {number[]} queryEmbedding
     * @param {object} [filter] { sessionId?, type?, topK? }
     * @returns {Promise<{ record: MemoryRecord, score: number }[]>}
     */
    async searchSimilar(queryEmbedding, filter = {}) {
        return [];
    }
}

module.exports = { MemoryStore };
