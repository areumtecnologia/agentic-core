'use strict';

const EventEmitter = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// WorkingMemory — janela deslizante de turns recentes (memória de curto prazo).
//
// Mantém apenas os N turns mais recentes no contexto ativo enviado ao LLM.
// Turns mais antigos são elegíveis para compactação (via ContextCompactor)
// ou persistência em memória episódica (via EpisodicMemory).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} WorkingMemoryOptions
 * @property {number} [maxTurns=20]        Limite de turns antes de disparar compactação
 * @property {number} [keepRecent=10]      Turns mantidos após compactação
 * @property {number} [minTurnsToCompact=5] Mínimo de turns elegíveis para compactar
 */

class WorkingMemory extends EventEmitter {
    /** @type {object[]} Turns ativos no contexto (não compactados) */
    #turns = [];
    /** @type {string|null} Resumo consolidado dos turns já compactados */
    #compactedSummary = null;
    /** @type {Date|null} Quando a última compactação ocorreu */
    #lastCompactionAt = null;
    /** @type {string[]} IDs de memórias episódicas recuperadas e injetadas */
    #retrievedRefs = [];

    #maxTurns;
    #keepRecent;
    #minTurnsToCompact;

    /**
     * @param {WorkingMemoryOptions} [opts]
     */
    constructor({
        maxTurns = 20,
        keepRecent = 10,
        minTurnsToCompact = 5,
    } = {}) {
        super();
        if (keepRecent >= maxTurns) {
            throw new RangeError('[WorkingMemory] keepRecent must be less than maxTurns.');
        }
        this.#maxTurns = maxTurns;
        this.#keepRecent = keepRecent;
        this.#minTurnsToCompact = minTurnsToCompact;
    }

    /** Adiciona um ou mais turns à memória de trabalho. */
    append(...turns) {
        this.#turns.push(...turns);
        this.emit('appended', { count: turns.length, total: this.#turns.length });
    }

    /** Retorna os turns ativos (snapshot). */
    getTurns() {
        return [...this.#turns];
    }

    /** Número de turns ativos. */
    get size() {
        return this.#turns.length;
    }

    /** Resumo compactado atual (ou null). */
    get compactedSummary() {
        return this.#compactedSummary;
    }

    get lastCompactionAt() {
        return this.#lastCompactionAt;
    }

    /** Indica se a memória atingiu o limiar para compactação. */
    needsCompaction() {
        return this.#turns.length >= this.#maxTurns;
    }

    /**
     * Seleciona os turns elegíveis para compactação (os mais antigos).
     * @returns {object[]} Turns a serem compactados
     */
    getCompactableTurns() {
        const count = this.#turns.length - this.#keepRecent;
        if (count < this.#minTurnsToCompact) return [];
        return this.#turns.slice(0, count);
    }

    /**
     * Substitui os turns antigos por um resumo consolidado.
     * Mantém apenas os #keepRecent turns mais recentes.
     * @param {string} newSummary  Resumo consolidado (existente + novos)
     */
    applyCompaction(newSummary) {
        const compacted = this.#turns.slice(0, this.#turns.length - this.#keepRecent);
        this.#turns = this.#turns.slice(-this.#keepRecent);
        this.#compactedSummary = newSummary;
        this.#lastCompactionAt = new Date();
        this.emit('compacted', {
            compactedCount: compacted.length,
            remainingCount: this.#turns.length,
            summary: newSummary,
        });
        return compacted;
    }

    /**
     * Define o resumo compactado diretamente (ex: restauração de sessão).
     * @param {string} summary
     */
    setCompactedSummary(summary) {
        this.#compactedSummary = summary;
    }

    /** Adiciona referência a memória episódica recuperada. */
    addRetrievedRef(refId) {
        if (!this.#retrievedRefs.includes(refId)) {
            this.#retrievedRefs.push(refId);
        }
    }

    /** Referências de memória episódica ativas. */
    get retrievedRefs() {
        return [...this.#retrievedRefs];
    }

    /** Limpa toda a memória de trabalho. */
    clear() {
        this.#turns = [];
        this.#compactedSummary = null;
        this.#lastCompactionAt = null;
        this.#retrievedRefs = [];
        this.emit('cleared');
    }

    /** Snapshot serializável. */
    toJSON() {
        return {
            turns: this.#turns,
            compactedSummary: this.#compactedSummary,
            lastCompactionAt: this.#lastCompactionAt,
            retrievedRefs: this.#retrievedRefs,
            maxTurns: this.#maxTurns,
            keepRecent: this.#keepRecent,
        };
    }

    /** Restaura de snapshot. */
    static fromJSON(data) {
        const wm = new WorkingMemory({
            maxTurns: data.maxTurns,
            keepRecent: data.keepRecent,
        });
        wm.#turns = data.turns || [];
        wm.#compactedSummary = data.compactedSummary || null;
        wm.#lastCompactionAt = data.lastCompactionAt ? new Date(data.lastCompactionAt) : null;
        wm.#retrievedRefs = data.retrievedRefs || [];
        return wm;
    }
}

module.exports = { WorkingMemory };
