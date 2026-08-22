'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SemanticSearch — busca semântica vetorial para memória
// Suporta embeddings, similaridade por cosseno e busca híbrida
// ─────────────────────────────────────────────────────────────────────────────

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * @typedef {object} SemanticSearchOptions
 * @property {string} [embeddingModel='text-embedding-3-small']
 * @property {number} [similarityThreshold=0.7]
 * @property {number} [maxResults=10]
 * @property {boolean} [enableHybridSearch=true]
 * @property {number} [vectorDimensions=1536]
 */

/**
 * Busca semântica para memória com suporte a embeddings
 */
class SemanticSearch extends EventEmitter {
    #provider;
    #options;
    #embeddingCache = new Map();
    #index = new Map(); // id -> {embedding, metadata}

    constructor(provider, options = {}) {
        super();
        this.#provider = provider;
        this.#options = {
            embeddingModel: 'text-embedding-3-small',
            similarityThreshold: 0.7,
            maxResults: 10,
            enableHybridSearch: true,
            vectorDimensions: 1536,
            ...options
        };
    }

    /**
     * Gera embedding para texto
     */
    async generateEmbedding(text) {
        if (!text || text.trim().length === 0) {
            return null;
        }

        // Cache
        const cacheKey = crypto.createHash('md5').update(text).digest('hex');
        if (this.#embeddingCache.has(cacheKey)) {
            return this.#embeddingCache.get(cacheKey);
        }

        try {
            // Tenta usar provider para embeddings
            if (this.#provider && typeof this.#provider.generateEmbedding === 'function') {
                const embedding = await this.#provider.generateEmbedding(text);
                this.#embeddingCache.set(cacheKey, embedding);
                return embedding;
            }

            // Fallback: embedding simples baseado em hash
            const embedding = this.#generateSimpleEmbedding(text);
            this.#embeddingCache.set(cacheKey, embedding);
            return embedding;
        } catch (error) {
            console.warn('[SemanticSearch] Embedding generation failed:', error.message);
            return this.#generateSimpleEmbedding(text);
        }
    }

    /**
     * Indexa um registro de memória
     */
    async indexRecord(record) {
        if (!record || !record.id) return;

        const text = this.#extractText(record);
        if (!text) return;

        const embedding = await this.generateEmbedding(text);
        if (!embedding) return;

        this.#index.set(record.id, {
            embedding,
            metadata: {
                id: record.id,
                sessionId: record.sessionId,
                type: record.type,
                tags: record.tags || [],
                createdAt: record.createdAt,
                importance: record.importance || 0
            }
        });

        this.emit('indexed', { id: record.id });
    }

    /**
     * Busca registros similares
     */
    async search(query, options = {}) {
        const {
            sessionId,
            type,
            tags,
            limit = this.#options.maxResults,
            threshold = this.#options.similarityThreshold,
            minImportance = 0
        } = options;

        const queryEmbedding = await this.generateEmbedding(query);
        if (!queryEmbedding) return [];

        const results = [];

        for (const [id, data] of this.#index) {
            const metadata = data.metadata;

            // Filtros
            if (sessionId && metadata.sessionId !== sessionId) continue;
            if (type && metadata.type !== type) continue;
            if (tags && tags.length > 0) {
                const hasTag = tags.some(tag => metadata.tags.includes(tag));
                if (!hasTag) continue;
            }
            if (metadata.importance < minImportance) continue;

            // Similaridade
            const similarity = this.#cosineSimilarity(queryEmbedding, data.embedding);
            if (similarity >= threshold) {
                results.push({
                    id,
                    similarity,
                    metadata,
                    score: similarity * (1 + metadata.importance)
                });
            }
        }

        // Ordena por score
        results.sort((a, b) => b.score - a.score);

        this.emit('searched', { query, resultsCount: results.length });
        return results.slice(0, limit);
    }

    /**
     * Busca híbrida: semântica + textual
     */
    async hybridSearch(query, options = {}) {
        if (!this.#options.enableHybridSearch) {
            return this.search(query, options);
        }

        const semanticResults = await this.search(query, options);
        const textResults = await this.#textSearch(query, options);

        // Combina resultados
        const combined = new Map();

        // Adiciona resultados semânticos
        for (const result of semanticResults) {
            combined.set(result.id, {
                ...result,
                semanticScore: result.similarity,
                textScore: 0
            });
        }

        // Adiciona/merge resultados textuais
        for (const result of textResults) {
            if (combined.has(result.id)) {
                combined.get(result.id).textScore = result.score;
            } else {
                combined.set(result.id, {
                    ...result,
                    semanticScore: 0,
                    textScore: result.score
                });
            }
        }

        // Score combinado
        const finalResults = Array.from(combined.values()).map(item => ({
            ...item,
            score: (item.semanticScore * 0.7) + (item.textScore * 0.3)
        }));

        finalResults.sort((a, b) => b.score - a.score);

        return finalResults.slice(0, options.limit || this.#options.maxResults);
    }

    /**
     * Busca textual simples
     */
    async #textSearch(query, options = {}) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const results = [];

        for (const [id, data] of this.#index) {
            const metadata = data.metadata;
            
            // Filtros básicos
            if (options.sessionId && metadata.sessionId !== options.sessionId) continue;
            if (options.type && metadata.type !== options.type) continue;

            // Score baseado em termos
            let score = 0;
            const text = JSON.stringify(metadata).toLowerCase();
            
            for (const term of queryTerms) {
                if (text.includes(term)) {
                    score += 1;
                }
            }

            if (score > 0) {
                results.push({
                    id,
                    score: score / queryTerms.length,
                    metadata
                });
            }
        }

        return results;
    }

    /**
     * Similaridade por cosseno
     */
    #cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (normA * normB);
    }

    /**
     * Embedding simples baseado em hash (fallback)
     */
    #generateSimpleEmbedding(text) {
        const dimensions = this.#options.vectorDimensions;
        const embedding = new Array(dimensions).fill(0);
        
        // Gera embedding determinístico baseado no texto
        const hash = crypto.createHash('sha256').update(text).digest();
        
        for (let i = 0; i < dimensions; i++) {
            const byteIndex = i % hash.length;
            embedding[i] = (hash[byteIndex] / 255) * 2 - 1; // Normaliza para [-1, 1]
        }

        return embedding;
    }

    /**
     * Extrai texto de um registro
     */
    #extractText(record) {
        const parts = [];

        if (record.content) {
            if (typeof record.content === 'string') {
                parts.push(record.content);
            } else if (record.content.text) {
                parts.push(record.content.text);
            } else if (record.content.subject && record.content.predicate && record.content.object) {
                parts.push(`${record.content.subject} ${record.content.predicate} ${record.content.object}`);
            } else {
                parts.push(JSON.stringify(record.content));
            }
        }

        if (record.tags && record.tags.length > 0) {
            parts.push(record.tags.join(' '));
        }

        if (record.summary) {
            parts.push(record.summary);
        }

        return parts.join(' ').trim();
    }

    /**
     * Remove registro do índice
     */
    remove(id) {
        const removed = this.#index.delete(id);
        if (removed) {
            this.emit('removed', { id });
        }
        return removed;
    }

    /**
     * Limpa índice
     */
    clear() {
        this.#index.clear();
        this.#embeddingCache.clear();
        this.emit('cleared');
    }

    /**
     * Estatísticas
     */
    getStats() {
        return {
            indexedRecords: this.#index.size,
            cachedEmbeddings: this.#embeddingCache.size,
            vectorDimensions: this.#options.vectorDimensions
        };
    }

    /**
     * Reindexa todos os registros
     */
    async reindex(records) {
        this.clear();
        
        for (const record of records) {
            await this.indexRecord(record);
        }

        this.emit('reindexed', { count: records.length });
    }
}

module.exports = { SemanticSearch };
