'use strict';

const { MemoryStore } = require('./MemoryStore');
const { v4: uuid } = require('uuid');

// ─────────────────────────────────────────────────────────────────────────────
// InMemoryStore — implementação default de MemoryStore usando Map.
// Útil para testes e desenvolvimento. Não persiste entre restarts.
// ─────────────────────────────────────────────────────────────────────────────

class InMemoryStore extends MemoryStore {
    /** @type {Map<string, MemoryRecord>} */
    #records = new Map();
    /** index secundário: sessionId → Set<recordId> */
    #sessionIndex = new Map();

    async save(record) {
        if (!record || typeof record !== 'object') {
            throw new TypeError(`[${this.constructor.name}] record must be an object.`);
        }
        if (!record.sessionId) {
            throw new TypeError(`[${this.constructor.name}] record.sessionId is required.`);
        }
        if (!record.type) {
            throw new TypeError(`[${this.constructor.name}] record.type is required.`);
        }
        if (!record.content) {
            throw new TypeError(`[${this.constructor.name}] record.content is required.`);
        }
        
        if (!record.id) record.id = uuid();
        if (!record.createdAt) record.createdAt = new Date();
        this.#records.set(record.id, record);

        if (!this.#sessionIndex.has(record.sessionId)) {
            this.#sessionIndex.set(record.sessionId, new Set());
        }
        this.#sessionIndex.get(record.sessionId).add(record.id);

        return record;
    }

    async get(id) {
        return this.#records.get(id) ?? null;
    }

    async findBySession(sessionId, { type, tags, limit = 100, offset = 0 } = {}) {
        const ids = this.#sessionIndex.get(sessionId);
        if (!ids) return [];

        let results = [];
        for (const id of ids) {
            const rec = this.#records.get(id);
            if (!rec) continue;
            if (type && rec.type !== type) continue;
            if (tags && tags.length > 0) {
                const recTags = rec.tags || [];
                if (!tags.some(t => recTags.includes(t))) continue;
            }
            results.push(rec);
        }

        // Ordena por createdAt descendente (mais recente primeiro)
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return results.slice(offset, offset + limit);
    }

    async delete(id) {
        const rec = this.#records.get(id);
        if (!rec) return false;
        this.#records.delete(id);
        const ids = this.#sessionIndex.get(rec.sessionId);
        if (ids) {
            ids.delete(id);
            if (ids.size === 0) this.#sessionIndex.delete(rec.sessionId);
        }
        return true;
    }

    async deleteBySession(sessionId) {
        const ids = this.#sessionIndex.get(sessionId);
        if (!ids) return 0;
        const count = ids.size;
        for (const id of ids) {
            this.#records.delete(id);
        }
        this.#sessionIndex.delete(sessionId);
        return count;
    }

    async searchSimilar(_queryEmbedding, _filter = {}) {
        // InMemoryStore não suporta busca vetorial nativa
        return [];
    }

    /** Limpa tudo — útil em testes */
    clear() {
        this.#records.clear();
        this.#sessionIndex.clear();
    }
}

module.exports = { InMemoryStore };
