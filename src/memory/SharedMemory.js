'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SharedMemory — memória compartilhada entre sessões
// Permite compartilhar episódios, conhecimento semântico e contexto global
// ─────────────────────────────────────────────────────────────────────────────

const EventEmitter = require('events');
const { v4: uuid } = require('uuid');

/**
 * @typedef {object} SharedMemoryOptions
 * @property {string} [namespace='global'] Namespace para isolamento
 * @property {number} [maxSharedRecords=1000] Máximo de registros compartilhados
 * @property {number} [importanceThreshold=0.7] Score mínimo para compartilhar
 * @property {boolean} [enableCrossSession=true] Habilita compartilhamento entre sessões
 */

/**
 * Gerencia memória compartilhada entre sessões
 */
class SharedMemory extends EventEmitter {
    #store;
    #namespace;
    #maxSharedRecords;
    #importanceThreshold;
    #enableCrossSession;
    #sharedIndex = new Map(); // key -> Set<recordId>
    #sessionSubscriptions = new Map(); // sessionId -> Set<tags>

    constructor(store, options = {}) {
        super();
        this.#store = store;
        this.#namespace = options.namespace || 'global';
        this.#maxSharedRecords = options.maxSharedRecords || 1000;
        this.#importanceThreshold = options.importanceThreshold || 0.7;
        this.#enableCrossSession = options.enableCrossSession !== false;
    }

    /**
     * Compartilha um registro de memória com outras sessões
     * @param {object} record Registro de memória
     * @param {object} options Opções de compartilhamento
     * @returns {Promise<string|null>} ID do registro compartilhado ou null
     */
    async share(record, options = {}) {
        if (!this.#enableCrossSession) {
            return null;
        }

        // Valida importância
        const importance = record.importance || 0;
        if (importance < this.#importanceThreshold) {
            return null;
        }

        // Cria cópia para compartilhamento
        const sharedRecord = {
            ...record,
            id: uuid(),
            sessionId: `shared:${this.#namespace}`,
            sharedFrom: record.sessionId,
            sharedAt: new Date(),
            sharedTags: options.tags || record.tags || [],
            isShared: true
        };

        // Salva no store
        await this.#store.save(sharedRecord);

        // Indexa por tags
        for (const tag of sharedRecord.sharedTags) {
            if (!this.#sharedIndex.has(tag)) {
                this.#sharedIndex.set(tag, new Set());
            }
            this.#sharedIndex.get(tag).add(sharedRecord.id);
        }

        // Limita tamanho
        await this.#enforceLimits();

        this.emit('shared', { record: sharedRecord });
        return sharedRecord.id;
    }

    /**
     * Recupera memórias compartilhadas relevantes para uma sessão
     * @param {string} sessionId ID da sessão
     * @param {object} options Opções de recuperação
     * @returns {Promise<object[]>} Memórias compartilhadas
     */
    async retrieveForSession(sessionId, options = {}) {
        if (!this.#enableCrossSession) {
            return [];
        }

        const { tags = [], limit = 10, minImportance = 0.5 } = options;

        let candidateIds = new Set();

        // Busca por tags
        if (tags.length > 0) {
            for (const tag of tags) {
                const ids = this.#sharedIndex.get(tag);
                if (ids) {
                    ids.forEach(id => candidateIds.add(id));
                }
            }
        } else {
            // Busca geral - pega registros recentes
            const allShared = await this.#store.findBySession(`shared:${this.#namespace}`, {
                limit: this.#maxSharedRecords
            });
            allShared.forEach(r => candidateIds.add(r.id));
        }

        // Recupera registros
        const records = [];
        for (const id of candidateIds) {
            const record = await this.#store.get(id);
            if (!record) continue;
            
            if (record.importance < minImportance) continue;
            
            // Verifica expiração
            if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
                await this.#store.delete(id);
                continue;
            }

            records.push(record);
        }

        // Ordena por importância e recência
        records.sort((a, b) => {
            const importanceDiff = (b.importance || 0) - (a.importance || 0);
            if (importanceDiff !== 0) return importanceDiff;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return records.slice(0, limit);
    }

    /**
     * Inscreve uma sessão em tags específicas
     * @param {string} sessionId ID da sessão
     * @param {string[]} tags Tags para seguir
     */
    subscribe(sessionId, tags) {
        if (!this.#sessionSubscriptions.has(sessionId)) {
            this.#sessionSubscriptions.set(sessionId, new Set());
        }
        const subs = this.#sessionSubscriptions.get(sessionId);
        tags.forEach(tag => subs.add(tag));
        
        this.emit('subscribed', { sessionId, tags });
    }

    /**
     * Cancela inscrição de uma sessão
     * @param {string} sessionId ID da sessão
     * @param {string[]} [tags] Tags específicas ou todas
     */
    unsubscribe(sessionId, tags) {
        if (!this.#sessionSubscriptions.has(sessionId)) return;
        
        if (!tags) {
            this.#sessionSubscriptions.delete(sessionId);
        } else {
            const subs = this.#sessionSubscriptions.get(sessionId);
            tags.forEach(tag => subs.delete(tag));
            if (subs.size === 0) {
                this.#sessionSubscriptions.delete(sessionId);
            }
        }
        
        this.emit('unsubscribed', { sessionId, tags });
    }

    /**
     * Notifica sessões inscritas sobre nova memória compartilhada
     * @param {object} record Registro compartilhado
     */
    async notifySubscribers(record) {
        const tags = record.sharedTags || [];
        
        for (const [sessionId, subscribedTags] of this.#sessionSubscriptions) {
            const hasOverlap = tags.some(tag => subscribedTags.has(tag));
            if (hasOverlap) {
                this.emit('notification', {
                    sessionId,
                    record,
                    tags: tags.filter(t => subscribedTags.has(t))
                });
            }
        }
    }

    /**
     * Busca memórias compartilhadas por similaridade semântica
     * @param {number[]} embedding Vetor de embedding
     * @param {object} options Opções de busca
     * @returns {Promise<object[]>} Memórias similares
     */
    async searchSimilar(embedding, options = {}) {
        if (typeof this.#store.searchSimilar !== 'function') {
            return [];
        }

        const { limit = 10, minImportance = 0.5 } = options;
        
        const results = await this.#store.searchSimilar(embedding, {
            sessionId: `shared:${this.#namespace}`,
            topK: limit * 2 // Busca mais para filtrar
        });

        return results
            .filter(r => (r.record.importance || 0) >= minImportance)
            .slice(0, limit)
            .map(r => r.record);
    }

    /**
     * Remove memórias compartilhadas antigas ou de baixa importância
     * @returns {Promise<number>} Número de registros removidos
     */
    async cleanup() {
        const allShared = await this.#store.findBySession(`shared:${this.#namespace}`, {
            limit: this.#maxSharedRecords * 2
        });

        let removed = 0;
        const now = new Date();
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        for (const record of allShared) {
            const isOld = new Date(record.createdAt) < oneMonthAgo;
            const isLowImportance = (record.importance || 0) < 0.3;
            const isExpired = record.expiresAt && new Date(record.expiresAt) < now;

            if (isOld || isLowImportance || isExpired) {
                await this.#store.delete(record.id);
                removed++;
                
                // Remove dos índices
                for (const [tag, ids] of this.#sharedIndex) {
                    ids.delete(record.id);
                    if (ids.size === 0) {
                        this.#sharedIndex.delete(tag);
                    }
                }
            }
        }

        this.emit('cleanup', { removed });
        return removed;
    }

    /**
     * Estatísticas de memória compartilhada
     * @returns {Promise<object>} Estatísticas
     */
    async getStats() {
        const allShared = await this.#store.findBySession(`shared:${this.#namespace}`, {
            limit: this.#maxSharedRecords
        });

        const byType = {};
        const byTag = {};
        let totalImportance = 0;

        for (const record of allShared) {
            byType[record.type] = (byType[record.type] || 0) + 1;
            
            for (const tag of record.sharedTags || []) {
                byTag[tag] = (byTag[tag] || 0) + 1;
            }
            
            totalImportance += record.importance || 0;
        }

        return {
            total: allShared.length,
            byType,
            byTag,
            averageImportance: allShared.length > 0 ? totalImportance / allShared.length : 0,
            subscribers: this.#sessionSubscriptions.size,
            namespaces: this.#namespace
        };
    }

    /**
     * Enforça limites de tamanho
     */
    async #enforceLimits() {
        const allShared = await this.#store.findBySession(`shared:${this.#namespace}`, {
            limit: this.#maxSharedRecords * 2
        });

        if (allShared.length <= this.#maxSharedRecords) return;

        // Ordena por importância e recência
        allShared.sort((a, b) => {
            const importanceDiff = (a.importance || 0) - (b.importance || 0);
            if (importanceDiff !== 0) return importanceDiff;
            return new Date(a.createdAt) - new Date(b.createdAt);
        });

        // Remove os menos importantes/antigos
        const toRemove = allShared.slice(0, allShared.length - this.#maxSharedRecords);
        for (const record of toRemove) {
            await this.#store.delete(record.id);
        }
    }

    /**
     * Limpa todos os dados compartilhados
     */
    async clear() {
        const allShared = await this.#store.findBySession(`shared:${this.#namespace}`, {
            limit: this.#maxSharedRecords
        });

        for (const record of allShared) {
            await this.#store.delete(record.id);
        }

        this.#sharedIndex.clear();
        this.#sessionSubscriptions.clear();
        
        this.emit('cleared');
    }
}

module.exports = { SharedMemory };
