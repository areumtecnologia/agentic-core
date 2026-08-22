'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SemanticMemoryEnhanced — versão com busca semântica integrada
// ─────────────────────────────────────────────────────────────────────────────

const EventEmitter = require('events');
const { v4: uuid } = require('uuid');
const { SemanticSearch } = require('./SemanticSearch');

/**
 * SemanticMemory com busca semântica vetorial
 */
class SemanticMemoryEnhanced extends EventEmitter {
    #store;
    #search;
    #provider;

    constructor(store, provider, options = {}) {
        super();
        if (!store) throw new TypeError('[SemanticMemoryEnhanced] store is required.');
        
        this.#store = store;
        this.#provider = provider;
        this.#search = new SemanticSearch(provider, options.search);
    }

    /**
     * Aprende um fato com indexação semântica
     */
    async learn({ sessionId, subject, predicate, object, confidence = 1.0, tags = [] }) {
        if (!sessionId) throw new TypeError('sessionId is required');
        if (!subject) throw new TypeError('subject is required');
        if (!predicate) throw new TypeError('predicate is required');
        if (object === undefined) throw new TypeError('object is required');

        // Busca fato existente
        const existing = await this.#findExisting(sessionId, subject, predicate);
        
        let record;
        if (existing) {
            existing.content.object = object;
            existing.content.confidence = confidence;
            existing.updatedAt = new Date();
            await this.#store.save(existing);
            record = existing;
            this.emit('updated', record);
        } else {
            record = {
                id: uuid(),
                sessionId,
                type: 'semantic',
                content: { subject, predicate, object, confidence },
                tags,
                createdAt: new Date(),
                updatedAt: new Date(),
                importance: confidence
            };
            await this.#store.save(record);
            this.emit('learned', record);
        }

        // Indexa para busca semântica
        await this.#search.indexRecord(record);
        
        return record;
    }

    /**
     * Busca fatos por similaridade semântica
     */
    async search(query, options = {}) {
        const results = await this.#search.hybridSearch(query, options);
        
        // Recupera registros completos
        const records = [];
        for (const result of results) {
            const record = await this.#store.get(result.id);
            if (record) {
                records.push({
                    record,
                    similarity: result.semanticScore,
                    score: result.score,
                    metadata: result.metadata
                });
            }
        }

        return records;
    }

    /**
     * Busca fatos por sujeito/predicado/objeto com busca semântica
     */
    async query({ sessionId, subject, predicate, object, semanticQuery, limit = 10 }) {
        // Busca exata primeiro
        let records = [];
        if (subject || predicate || object) {
            records = await this.#store.findBySession(sessionId, {
                type: 'semantic',
                limit: limit * 2
            });

            records = records.filter(r => {
                const content = r.content;
                if (subject && content.subject !== subject) return false;
                if (predicate && content.predicate !== predicate) return false;
                if (object && content.object !== object) return false;
                return true;
            });
        }

        // Se tem query semântica, busca por similaridade
        if (semanticQuery) {
            const semanticResults = await this.search(semanticQuery, {
                sessionId,
                limit: limit * 2
            });

            // Merge resultados
            const recordMap = new Map();
            records.forEach(r => recordMap.set(r.id, { record: r, score: 1.0 }));
            
            semanticResults.forEach(r => {
                if (recordMap.has(r.record.id)) {
                    recordMap.get(r.record.id).score = Math.max(
                        recordMap.get(r.record.id).score,
                        r.score
                    );
                } else {
                    recordMap.set(r.record.id, { record: r.record, score: r.score });
                }
            });

            records = Array.from(recordMap.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(item => item.record);
        }

        return records.slice(0, limit);
    }

    /**
     * Encontra fatos relacionados
     */
    async findRelated(factId, options = {}) {
        const fact = await this.#store.get(factId);
        if (!fact) return [];

        const query = `${fact.content.subject} ${fact.content.predicate} ${fact.content.object}`;
        return await this.search(query, {
            ...options,
            minImportance: 0.5
        });
    }

    /**
     * Atualiza importância de um fato
     */
    async updateImportance(factId, importance) {
        const fact = await this.#store.get(factId);
        if (!fact) return null;

        fact.importance = Math.max(0, Math.min(1, importance));
        fact.updatedAt = new Date();
        
        await this.#store.save(fact);
        await this.#search.indexRecord(fact);
        
        this.emit('importanceUpdated', fact);
        return fact;
    }

    /**
     * Remove fato
     */
    async forget(factId) {
        const fact = await this.#store.get(factId);
        if (!fact) return false;

        await this.#store.delete(factId);
        this.#search.remove(factId);
        
        this.emit('forgotten', factId);
        return true;
    }

    /**
     * Estatísticas
     */
    async getStats() {
        const searchStats = this.#search.getStats();
        
        const allFacts = await this.#store.findBySession(null, {
            type: 'semantic',
            limit: 10000
        });

        const bySubject = {};
        const byPredicate = {};
        let totalConfidence = 0;

        for (const fact of allFacts) {
            const subject = fact.content.subject;
            const predicate = fact.content.predicate;
            
            bySubject[subject] = (bySubject[subject] || 0) + 1;
            byPredicate[predicate] = (byPredicate[predicate] || 0) + 1;
            totalConfidence += fact.content.confidence || 0;
        }

        return {
            ...searchStats,
            totalFacts: allFacts.length,
            bySubject,
            byPredicate,
            averageConfidence: allFacts.length > 0 ? totalConfidence / allFacts.length : 0
        };
    }

    /**
     * Reindexa todos os fatos
     */
    async reindex() {
        const allFacts = await this.#store.findBySession(null, {
            type: 'semantic',
            limit: 10000
        });

        await this.#search.reindex(allFacts);
        this.emit('reindexed', { count: allFacts.length });
    }

    async #findExisting(sessionId, subject, predicate) {
        const records = await this.#store.findBySession(sessionId, {
            type: 'semantic',
            limit: 500
        });
        
        return records.find(r =>
            r.content.subject === subject &&
            r.content.predicate === predicate
        );
    }
}

module.exports = { SemanticMemoryEnhanced };
