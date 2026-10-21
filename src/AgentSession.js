
// ─────────────────────────────────────────────────────────────────────────────
// AgentSession — encapsula todo o estado de uma conversa -Incluir evento que dispara sempre que o historico e modificado
// ─────────────────────────────────────────────────────────────────────────────
const { v4: uuid } = require('uuid');
const EventEmitter = require('events');
// Importa a nova camada de memória de curto prazo
const { WorkingMemory } = require('./memory');

class AgentSession extends EventEmitter {
  /** @type {string}   */ id;
  /** @type {object}   */ user;
    /** @type {WorkingMemory} */ #workingMemory; // Memória de trabalho (janela deslizante)
  /** @type {number}   */ vulnerabilityCount = 0;
  /** @type {boolean}  */ terminated = false;
  /** @type {Date}     */ createdAt = new Date();
  /** @type {Date}     */ lastActivity = new Date();
  /** @type {object|null} */ retryState = null;
  /** @type {number}   */ idleTimeoutMs = 0;
  /** @type {string}   */ status = 'active'; // 'active' | 'paused' | 'escalated'
  /** @type {object|null} */ handoverInfo = null;
  /** @type {boolean}  */ idleRepeat = false;
  /** @type {boolean}  */ idleProcessing = false;

    #ttlTimer = null;
    #onExpire;
    #idleTimer = null;
    #onIdle;

    isSmallModel = false;

    get isPaused() {
        return this.status === 'paused' || this.status === 'escalated';
    }

    pause(reason = 'Manual pause', priority = 'medium', briefing = '') {
        this.status = 'paused';
        this.handoverInfo = {
            reason,
            priority,
            briefing,
            timestamp: new Date()
        };
        this.emit('status_changed', { status: this.status, handoverInfo: this.handoverInfo });
    }

    resume() {
        this.status = 'active';
        this.handoverInfo = null;
        this.emit('status_changed', { status: this.status });
    }

    constructor(id, user, onExpire, onIdle, options = {}) {
        super();
        this.id = id || uuid();
        this.user = Object.freeze({ ...user });
        this.#onExpire = onExpire;
        this.#onIdle = onIdle;
        this.isSmallModel = Boolean(options.isSmallModel);
        const maxTurns = options.maxTurns || (this.isSmallModel ? 8 : 20);
        const keepRecent = options.keepRecent || (this.isSmallModel ? 4 : 10);
        const minTurnsToCompact = options.minTurnsToCompact || (this.isSmallModel ? 3 : 5);
        this.#workingMemory = new WorkingMemory({ maxTurns, keepRecent, minTurnsToCompact });
    }

    touch() { this.lastActivity = new Date(); }

    scheduleTTL(ms) {
        this.cancelTTL();
        this.#ttlTimer = setTimeout(() => this.#onExpire(this.id), ms);
        this.#ttlTimer.unref?.(); // não bloqueia shutdown do processo
    }

    cancelTTL() {
        if (this.#ttlTimer) { clearTimeout(this.#ttlTimer); this.#ttlTimer = null; }
    }

    scheduleIdle(ms) {
        this.cancelIdle();
        if (!ms || ms <= 0) return;
        this.#idleTimer = setTimeout(() => this.#onIdle?.(this.id), ms);
        this.#idleTimer.unref?.(); // não bloqueia shutdown do processo
    }

    cancelIdle() {
        if (this.#idleTimer) { clearTimeout(this.#idleTimer); this.#idleTimer = null; }
    }

    appendHistory(...turns) {
        let turnsToAppend = turns;
        if (this.isSmallModel) {
            // Sanitiza turns para modelos compactos: trunca saídas volumosas de ferramentas em turnos passados
            // Clona superficialmente os objetos para não mutar as referências originais do chamador
            turnsToAppend = turns.map(t => {
                if (t && t.role === 'tool' && Array.isArray(t.parts)) {
                    let hasModified = false;
                    const newParts = t.parts.map(p => {
                        if (p?.functionResponse?.response?.result && typeof p.functionResponse.response.result === 'string' && p.functionResponse.response.result.length > 350) {
                            hasModified = true;
                            return {
                                ...p,
                                functionResponse: {
                                    ...p.functionResponse,
                                    response: {
                                        ...p.functionResponse.response,
                                        result: p.functionResponse.response.result.substring(0, 350) + '... [resumo compactado]'
                                    }
                                }
                            };
                        }
                        return p;
                    });
                    return hasModified ? { ...t, parts: newParts } : t;
                }
                return t;
            });
        }
        this.#workingMemory.append(...turnsToAppend);
        this.emit(AgentSessionEvents.HISTORY_UPDATED, this.getHistory());
    }

    // Obtem o historico da conversa
    getHistory() {
        return this.#workingMemory.getTurns();
    }

    // Restaura o historico e turnos da conversa
    setHistory(history) {
        if (!Array.isArray(history)) throw new TypeError('[AgentSession] history must be an array.');
        // Reseta a WorkingMemory e repopula com o histórico fornecido
        this.#workingMemory.clear();
        this.#workingMemory.append(...history);
        this.emit(AgentSessionEvents.HISTORY_UPDATED, this.getHistory());
    }

    // Acesso direto à WorkingMemory (usado pelo AgenticCore para compactação)
    get workingMemory() {
        return this.#workingMemory;
    }

    toJSON() {
        return {
            id: this.id,
            user: this.user,
            vulnerabilityCount: this.vulnerabilityCount,
            terminated: this.terminated,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity,
            turns: this.getHistory().length,
            // Exporta o histórico como array para compatibilidade
            history: this.getHistory(),
            idleTimeoutMs: this.idleTimeoutMs,
            idleRepeat: this.idleRepeat,
            status: this.status,
            handoverInfo: this.handoverInfo,
        };
    }
}

// AgentSessionEvents
const AgentSessionEvents = {
    HISTORY_UPDATED: 'history_updated',
};

module.exports = { AgentSession, AgentSessionEvents };