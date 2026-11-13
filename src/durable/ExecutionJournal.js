'use strict';

const crypto = require('crypto');
const { v4: uuid } = require('uuid');

/**
 * Tipos de eventos suportados pelo diário de execução imutável.
 */
const JournalEntryType = Object.freeze({
    STEP_INIT: 'STEP_INIT',
    TOOL_INVOKING: 'TOOL_INVOKING',
    TOOL_COMMITTED: 'TOOL_COMMITTED',
    TOOL_FAILED: 'TOOL_FAILED',
    STEP_COMPLETE: 'STEP_COMPLETE',
    TURN_COMPLETE: 'TURN_COMPLETE',
    GRAPH_NODE_COMPLETE: 'GRAPH_NODE_COMPLETE'
});

class ExecutionJournal {
    /**
     * Gera uma chave de idempotência determinística para uma invocação de ferramenta.
     * @param {string} sessionId
     * @param {number} turnIndex
     * @param {string} toolName
     * @param {Record<string, any>} [args={}]
     * @returns {string} SHA-256 hash
     */
    static generateIdempotencyKey(sessionId, turnIndex, toolName, args = {}) {
        let serializedArgs = '';
        try {
            // Ordena chaves para garantir serialização determinística
            serializedArgs = JSON.stringify(args, Object.keys(args || {}).sort());
        } catch {
            serializedArgs = String(args);
        }

        const raw = `${String(sessionId).trim()}:${turnIndex}:${String(toolName).trim().toLowerCase()}:${serializedArgs}`;
        return crypto.createHash('sha256').update(raw).digest('hex');
    }

    /**
     * Cria um novo registro de diário padronizado.
     * @param {object} params
     * @param {string} params.sessionId
     * @param {number} params.turnIndex
     * @param {string} params.type
     * @param {string} [params.idempotencyKey]
     * @param {number} [params.stepIndex=0]
     * @param {object} [params.payload={}]
     * @returns {object} JournalEntry
     */
    static createEntry({ sessionId, turnIndex = 0, type, idempotencyKey = '', stepIndex = 0, payload = {} }) {
        return {
            id: uuid(),
            sessionId: String(sessionId),
            turnIndex,
            stepIndex,
            type,
            idempotencyKey,
            payload: {
                ...payload,
                timestamp: Date.now()
            }
        };
    }
}

module.exports = {
    ExecutionJournal,
    JournalEntryType
};
