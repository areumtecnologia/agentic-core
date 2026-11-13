'use strict';

const { SessionStore } = require('./SessionStore');

class InMemorySessionStore extends SessionStore {
    #store = new Map();
    #journals = new Map();
    #checkpoints = new Map();

    /**
     * @param {string} sessionId
     * @param {object} data
     * @returns {Promise<boolean>}
     */
    async save(sessionId, data) {
        this.#store.set(String(sessionId), { ...data, savedAt: new Date() });
        return true;
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<object|null>}
     */
    async load(sessionId) {
        return this.#store.get(String(sessionId)) || null;
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async delete(sessionId) {
        const sid = String(sessionId);
        this.#journals.delete(sid);
        this.#checkpoints.delete(sid);
        return this.#store.delete(sid);
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async exists(sessionId) {
        return this.#store.has(String(sessionId));
    }

    // ── Suporte a Diário de Execução Durável & Checkpoints ──

    /**
     * @param {string} sessionId
     * @param {object} entry
     * @returns {Promise<boolean>}
     */
    async appendJournal(sessionId, entry) {
        const sid = String(sessionId);
        if (!this.#journals.has(sid)) {
            this.#journals.set(sid, []);
        }
        const entries = this.#journals.get(sid);
        entries.push({ ...entry, recordedAt: new Date() });
        return true;
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<Array<object>>}
     */
    async getJournal(sessionId) {
        const sid = String(sessionId);
        const entries = this.#journals.get(sid) || [];
        return entries.map(e => ({ ...e }));
    }

    /**
     * @param {string} sessionId
     * @param {string} idempotencyKey
     * @returns {Promise<object|null>}
     */
    async findJournalEntry(sessionId, idempotencyKey) {
        const sid = String(sessionId);
        const entries = this.#journals.get(sid) || [];
        for (let i = entries.length - 1; i >= 0; i--) {
            if (entries[i].idempotencyKey === idempotencyKey) {
                return { ...entries[i] };
            }
        }
        return null;
    }

    /**
     * @param {string} sessionId
     * @param {object} checkpoint
     * @returns {Promise<boolean>}
     */
    async saveCheckpoint(sessionId, checkpoint) {
        const sid = String(sessionId);
        this.#checkpoints.set(sid, { ...checkpoint, savedAt: new Date() });
        return true;
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<object|null>}
     */
    async getLatestCheckpoint(sessionId) {
        const sid = String(sessionId);
        const cp = this.#checkpoints.get(sid);
        return cp ? { ...cp } : null;
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async clearJournal(sessionId) {
        const sid = String(sessionId);
        this.#journals.delete(sid);
        this.#checkpoints.delete(sid);
        return true;
    }

    /** Limpa todo o armazenamento. */
    clear() {
        this.#store.clear();
        this.#journals.clear();
        this.#checkpoints.clear();
    }
}

module.exports = { InMemorySessionStore };
