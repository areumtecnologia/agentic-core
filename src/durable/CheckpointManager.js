'use strict';

const EventEmitter = require('events');
const { ExecutionJournal, JournalEntryType } = require('./ExecutionJournal');

class CheckpointManager extends EventEmitter {
    #sessionStore;
    #enabled;
    #checkpointOnStep;

    /**
     * @param {import('../persistence/SessionStore').SessionStore} sessionStore
     * @param {object} [options={}]
     * @param {boolean} [options.enabled=true]
     * @param {boolean} [options.checkpointOnStep=true]
     */
    constructor(sessionStore, options = {}) {
        super();
        this.#sessionStore = sessionStore || null;
        this.#enabled = options.enabled !== false;
        this.#checkpointOnStep = options.checkpointOnStep !== false;
    }

    get isEnabled() {
        return this.#enabled && Boolean(this.#sessionStore);
    }

    get sessionStore() {
        return this.#sessionStore;
    }

    /**
     * Registra a intenção de execução de uma ferramenta.
     * Retorna se a ferramenta já foi executada e confirmada anteriormente (idempotência).
     * 
     * @param {string} sessionId
     * @param {number} turnIndex
     * @param {string} toolName
     * @param {Record<string, any>} [args={}]
     * @returns {Promise<{ alreadyExecuted: boolean, cachedResult: any, idempotencyKey: string }>}
     */
    async recordToolStart(sessionId, turnIndex, toolName, args = {}) {
        if (!this.isEnabled) {
            return { alreadyExecuted: false, cachedResult: null, idempotencyKey: '' };
        }

        const sid = String(sessionId);
        const idempotencyKey = ExecutionJournal.generateIdempotencyKey(sid, turnIndex, toolName, args);

        const existing = await this.#sessionStore.findJournalEntry(sid, idempotencyKey);
        if (existing && existing.type === JournalEntryType.TOOL_COMMITTED) {
            return {
                alreadyExecuted: true,
                cachedResult: existing.payload.result,
                idempotencyKey
            };
        }

        const entry = ExecutionJournal.createEntry({
            sessionId: sid,
            turnIndex,
            type: JournalEntryType.TOOL_INVOKING,
            idempotencyKey,
            payload: { toolName, args }
        });

        await this.#sessionStore.appendJournal(sid, entry);
        return {
            alreadyExecuted: false,
            cachedResult: null,
            idempotencyKey
        };
    }

    /**
     * Registra o resultado concluído da ferramenta de forma atômica no diário.
     * 
     * @param {string} sessionId
     * @param {number} turnIndex
     * @param {string} idempotencyKey
     * @param {string} toolName
     * @param {any} result
     * @param {number} [durationMs=0]
     * @returns {Promise<boolean>}
     */
    async commitToolResult(sessionId, turnIndex, idempotencyKey, toolName, result, durationMs = 0) {
        if (!this.isEnabled) return false;

        const sid = String(sessionId);
        const entry = ExecutionJournal.createEntry({
            sessionId: sid,
            turnIndex,
            type: JournalEntryType.TOOL_COMMITTED,
            idempotencyKey,
            payload: { toolName, result, durationMs }
        });

        const success = await this.#sessionStore.appendJournal(sid, entry);
        if (this.#checkpointOnStep) {
            await this.saveStepCheckpoint(sid, {
                lastTurnIndex: turnIndex,
                lastCompletedTool: toolName,
                lastIdempotencyKey: idempotencyKey,
                timestamp: Date.now()
            });
        }
        return success;
    }

    /**
     * Registra falha na execução da ferramenta.
     */
    async recordToolFailure(sessionId, turnIndex, idempotencyKey, toolName, error, durationMs = 0) {
        if (!this.isEnabled) return false;

        const sid = String(sessionId);
        const entry = ExecutionJournal.createEntry({
            sessionId: sid,
            turnIndex,
            type: JournalEntryType.TOOL_FAILED,
            idempotencyKey,
            payload: {
                toolName,
                error: error instanceof Error ? error.message : String(error),
                durationMs
            }
        });

        return this.#sessionStore.appendJournal(sid, entry);
    }

    /**
     * Salva um checkpoint de snapshot da sessão ou grafo.
     * @param {string} sessionId
     * @param {object} checkpointData
     * @returns {Promise<boolean>}
     */
    async saveStepCheckpoint(sessionId, checkpointData) {
        if (!this.isEnabled) return false;
        const sid = String(sessionId);
        return this.#sessionStore.saveCheckpoint(sid, {
            sessionId: sid,
            ...checkpointData,
            createdAt: new Date().toISOString()
        });
    }

    /**
     * Carrega o último checkpoint registrado.
     * @param {string} sessionId
     * @returns {Promise<object|null>}
     */
    async getLatestCheckpoint(sessionId) {
        if (!this.isEnabled) return null;
        return this.#sessionStore.getLatestCheckpoint(String(sessionId));
    }

    /**
     * Recupera o diário de execução da sessão.
     * @param {string} sessionId
     * @returns {Promise<Array<object>>}
     */
    async getJournal(sessionId) {
        if (!this.isEnabled) return [];
        return this.#sessionStore.getJournal(String(sessionId));
    }

    /**
     * Reconstrói o mapa de execuções completadas para recuperação após reinício/queda.
     * @param {string} sessionId
     * @returns {Promise<{ completedTools: Map<string, any>, lastTurnIndex: number, hasPendingInvokes: boolean }>}
     */
    async recoverSession(sessionId) {
        const sid = String(sessionId);
        const entries = await this.getJournal(sid);
        const completedTools = new Map();
        let lastTurnIndex = 0;
        let hasPendingInvokes = false;

        const invokingKeys = new Set();

        for (const entry of entries) {
            if (entry.turnIndex > lastTurnIndex) {
                lastTurnIndex = entry.turnIndex;
            }

            if (entry.type === JournalEntryType.TOOL_INVOKING) {
                invokingKeys.add(entry.idempotencyKey);
            } else if (entry.type === JournalEntryType.TOOL_COMMITTED) {
                invokingKeys.delete(entry.idempotencyKey);
                completedTools.set(entry.idempotencyKey, {
                    toolName: entry.payload.toolName,
                    result: entry.payload.result,
                    timestamp: entry.payload.timestamp
                });
            } else if (entry.type === JournalEntryType.TOOL_FAILED) {
                invokingKeys.delete(entry.idempotencyKey);
            }
        }

        hasPendingInvokes = invokingKeys.size > 0;

        return {
            completedTools,
            lastTurnIndex,
            hasPendingInvokes,
            pendingKeys: Array.from(invokingKeys)
        };
    }
}

module.exports = {
    CheckpointManager
};
