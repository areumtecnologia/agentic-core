'use strict';

class SessionStore {
    /**
     * Salva os dados da sessão.
     * @param {string} sessionId
     * @param {object} data
     * @returns {Promise<boolean>}
     */
    async save(sessionId, data) {
        throw new Error('Method save() must be implemented.');
    }

    /**
     * Carrega os dados da sessão.
     * @param {string} sessionId
     * @returns {Promise<object|null>}
     */
    async load(sessionId) {
        throw new Error('Method load() must be implemented.');
    }

    /**
     * Remove os dados da sessão.
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async delete(sessionId) {
        throw new Error('Method delete() must be implemented.');
    }

    /**
     * Verifica se a sessão existe.
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async exists(sessionId) {
        throw new Error('Method exists() must be implemented.');
    }
}

module.exports = { SessionStore };
