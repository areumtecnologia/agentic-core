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
 * @property {number} [importanceThreshold=0.3] Score mínimo para um turn ser considerado importante
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
    /** @type {number[]} Scores de importância para cada turn (0-1) */
    #importanceScores = [];
    /** @type {number} Score mínimo para um turn ser considerado importante */
    #importanceThreshold;

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
        importanceThreshold = 0.3,
    } = {}) {
        super();
        if (keepRecent >= maxTurns) {
            throw new RangeError('[WorkingMemory] keepRecent must be less than maxTurns.');
        }
        if (importanceThreshold < 0 || importanceThreshold > 1) {
            throw new RangeError('[WorkingMemory] importanceThreshold must be between 0 and 1.');
        }
        this.#maxTurns = maxTurns;
        this.#keepRecent = keepRecent;
        this.#minTurnsToCompact = minTurnsToCompact;
        this.#importanceThreshold = importanceThreshold;
        // Initialize importance scores for existing turns (will be filled as turns are added)
        this.#importanceScores = [];
    }

    /** Adiciona um ou mais turns à memória de trabalho. */
    append(...turns) {
        // Initialize importance scores for new turns (default: medium importance 0.5)
        const newScores = turns.map(() => 0.5);
        this.#turns.push(...turns);
        this.#importanceScores.push(...newScores);
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
     * Seleciona os turns elegíveis para compactação, priorizando os de menor importância.
     * Turns com score de importância abaixo do threshold são preferidos para compactação.
     * @returns {object[]} Turns a serem compactados
     */
    getCompactableTurns() {
        const count = this.#turns.length - this.#keepRecent;
        if (count < this.#minTurnsToCompact) return [];
        
        // Cria pares [turn, importanceScore] e ordena pelo score (menor primeiro)
        const scoredTurns = this.#turns.map((turn, i) => ({
            turn,
            score: this.#importanceScores[i] ?? 0.5,
        }));
        scoredTurns.sort((a, b) => a.score - b.score);
        
        // Retorna as turns com menor importância (até o count necessário)
        const compactable = scoredTurns
            .slice(0, count)
            .map(item => item.turn);
        return compactable;
    }

    /**
     * Substitui os turns antigos por um resumo consolidado.
     * Mantém apenas os #keepRecent turns mais recentes, priorizando os de maior importância.
     * @param {string} newSummary  Resumo consolidado (existente + novos)
     */
    applyCompaction(newSummary) {
        // Seleciona quais turns manter (os de maior importância entre os #keepRecent mais recentes)
        const recentTurns = this.#turns.slice(-this.#keepRecent);
        const recentScores = this.#importanceScores.slice(-this.#keepRecent);
        
        // Ordena as turns recentes por importância (menor para maior)
        const indexedTurns = recentTurns.map((turn, i) => ({
            turn,
            score: recentScores[i] ?? 0.5,
        }));
        indexedTurns.sort((a, b) => b.score - a.score);
        
        // Mantém apenas as turns mais importantes (apenas #keepRecent dos mais importantes)
        // Se há mais turns do que o limite, mantém apenas as #keepRecent mais importantes
        const importantTurns = indexedTurns
            .slice(0, this.#keepRecent)
            .map(item => item.turn);
        
        const compacted = this.#turns.filter(
            turn => !importantTurns.includes(turn)
        );
        
        this.#turns = importantTurns;
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

    /** Define a importância de um turn específico (0-1). */
    setImportance(turn, importance) {
        if (importance < 0 || importance > 1) {
            throw new RangeError('[WorkingMemory] importance must be between 0 and 1.');
        }
        const index = this.#turns.indexOf(turn);
        if (index === -1) {
            throw new Error(`[WorkingMemory] turn not found in memory.`);
        }
        this.#importanceScores[index] = importance;
        this.emit('importance-updated', { turn, importance });
    }

    /** Obtém o score de importância de um turn. */
    getImportance(turn) {
        const index = this.#turns.indexOf(turn);
        if (index === -1) {
            return null;
        }
        return this.#importanceScores[index];
    }

    /** Obtém os scores de importância de todos os turns. */
    getAllImportanceScores() {
        return this.#importanceScores.map((score, i) => ({
            turn: this.#turns[i],
            score,
        }));
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
