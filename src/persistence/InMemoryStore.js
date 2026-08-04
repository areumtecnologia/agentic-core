'use strict';

const { SessionStore } = require('./SessionStore');

class InMemorySessionStore extends SessionStore {
    #store = new Map();

    /**
     * @param {string} sessionId
     * @param {object} data
     * @returns {Promise<boolean>}
     */
    async save(sessionId, data) {
        this.#store.set(sessionId, { ...data, savedAt: new Date() });
        return true;
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<object|null>}
     */
    async load(sessionId) {
        return this.#store.get(sessionId) || null;
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async delete(sessionId) {
        return this.#store.delete(sessionId);
    }

    /**
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async exists(sessionId) {
        return this.#store.has(sessionId);
    }

    /** Limpa todo o armazenamento. */
    clear() {
        this.#store.clear();
    }
}

module.exports = { InMemorySessionStore };
