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

    // ── Suporte a Diário de Execução Durável & Checkpoints (v4.0) ──

    /**
     * Adiciona uma entrada imutável ao diário de execução da sessão.
     * @param {string} sessionId
     * @param {object} entry
     * @returns {Promise<boolean>}
     */
    async appendJournal(sessionId, entry) {
        return false;
    }

    /**
     * Retorna todas as entradas do diário de execução da sessão.
     * @param {string} sessionId
     * @returns {Promise<Array<object>>}
     */
    async getJournal(sessionId) {
        return [];
    }

    /**
     * Localiza a entrada mais recente no diário pela chave de idempotência.
     * @param {string} sessionId
     * @param {string} idempotencyKey
     * @returns {Promise<object|null>}
     */
    async findJournalEntry(sessionId, idempotencyKey) {
        const journal = await this.getJournal(sessionId);
        for (let i = journal.length - 1; i >= 0; i--) {
            if (journal[i].idempotencyKey === idempotencyKey) {
                return journal[i];
            }
        }
        return null;
    }

    /**
     * Salva um checkpoint de estado atômico.
     * @param {string} sessionId
     * @param {object} checkpoint
     * @returns {Promise<boolean>}
     */
    async saveCheckpoint(sessionId, checkpoint) {
        return false;
    }

    /**
     * Carrega o checkpoint mais recente da sessão.
     * @param {string} sessionId
     * @returns {Promise<object|null>}
     */
    async getLatestCheckpoint(sessionId) {
        return null;
    }

    /**
     * Limpa o diário e checkpoints da sessão.
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async clearJournal(sessionId) {
        return false;
    }
}

module.exports = { SessionStore };
