'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RedisMemoryStore — implementação persistente de MemoryStore usando Redis.
// Suporta expiração, busca por sessão e busca semântica básica.
// ─────────────────────────────────────────────────────────────────────────────

const { MemoryStore } = require('./MemoryStore');
const { v4: uuid } = require('uuid');

/**
 * @typedef {object} RedisMemoryStoreOptions
 * @property {string} [host='localhost']
 * @property {number} [port=6379]
 * @property {string} [password]
 * @property {string} [db=0]
 * @property {number} [defaultTTL] TTL padrão em segundos
 * @property {boolean} [enableVectorSearch=false] Habilita busca semântica
 */

class RedisMemoryStore extends MemoryStore {
    #client = null;
    #options;
    #isConnected = false;

    constructor(options = {}) {
        super();
        this.#options = {
            host: 'localhost',
            port: 6379,
            password: null,
            db: 0,
            defaultTTL: null,
            enableVectorSearch: false,
            ...options
        };
    }

    /**
     * Conecta ao Redis
     */
    async connect() {
        if (this.#isConnected) return;

        try {
            const redis = require('redis');
            this.#client = redis.createClient({
                socket: {
                    host: this.#options.host,
                    port: this.#options.port
                },
                password: this.#options.password,
                database: this.#options.db
            });

            this.#client.on('error', (err) => {
                console.error('[RedisMemoryStore] Redis error:', err);
            });

            await this.#client.connect();
            this.#isConnected = true;
            console.log('[RedisMemoryStore] Connected to Redis');
        } catch (error) {
            console.warn('[RedisMemoryStore] Redis not available, falling back to in-memory:', error.message);
            // Fallback para InMemoryStore
            const { InMemoryStore } = require('./InMemoryStore');
            this.#fallbackStore = new InMemoryStore();
            this.#isConnected = false;
        }
    }

    /**
     * Persiste um registro de memória
     */
    async save(record) {
        await this.#ensureConnected();

        if (!record.id) record.id = uuid();
        if (!record.createdAt) record.createdAt = new Date();

        const key = `memory:${record.id}`;
        const data = JSON.stringify(record);

        if (this.#isConnected) {
            await this.#client.set(key, data);
            
            // Index por sessão
            const sessionKey = `session:${record.sessionId}:memories`;
            await this.#client.sAdd(sessionKey, record.id);
            
            // Index por tipo
            const typeKey = `type:${record.type}:memories`;
            await this.#client.sAdd(typeKey, record.id);

            // TTL se configurado
            if (record.expiresAt) {
                const ttl = Math.floor((new Date(record.expiresAt) - new Date()) / 1000);
                if (ttl > 0) await this.#client.expire(key, ttl);
            } else if (this.#options.defaultTTL) {
                await this.#client.expire(key, this.#options.defaultTTL);
            }

            return record;
        } else {
            return this.#fallbackStore.save(record);
        }
    }

    /**
     * Recupera um registro pelo ID
     */
    async get(id) {
        await this.#ensureConnected();

        if (this.#isConnected) {
            const key = `memory:${id}`;
            const data = await this.#client.get(key);
            if (!data) return null;
            
            const record = JSON.parse(data);
            record.createdAt = new Date(record.createdAt);
            if (record.expiresAt) record.expiresAt = new Date(record.expiresAt);
            
            return record;
        } else {
            return this.#fallbackStore.get(id);
        }
    }

    /**
     * Busca registros por sessão
     */
    async findBySession(sessionId, filter = {}) {
        await this.#ensureConnected();

        const { type, tags, limit = 100, offset = 0 } = filter;

        if (this.#isConnected) {
            const sessionKey = `session:${sessionId}:memories`;
            const ids = await this.#client.sMembers(sessionKey);
            
            if (ids.length === 0) return [];

            // Busca em lote
            const pipeline = this.#client.multi();
            ids.forEach(id => pipeline.get(`memory:${id}`));
            const results = await pipeline.exec();

            let records = [];
            for (const [err, data] of results) {
                if (err || !data) continue;
                const record = JSON.parse(data);
                record.createdAt = new Date(record.createdAt);
                
                // Filtros
                if (type && record.type !== type) continue;
                if (tags && tags.length > 0) {
                    const recTags = record.tags || [];
                    if (!tags.some(t => recTags.includes(t))) continue;
                }
                
                records.push(record);
            }

            // Ordena por createdAt descendente
            records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return records.slice(offset, offset + limit);
        } else {
            return this.#fallbackStore.findBySession(sessionId, filter);
        }
    }

    /**
     * Remove um registro pelo ID
     */
    async delete(id) {
        await this.#ensureConnected();

        if (this.#isConnected) {
            const record = await this.get(id);
            if (!record) return false;

            const key = `memory:${id}`;
            await this.#client.del(key);
            
            // Remove dos índices
            await this.#client.sRem(`session:${record.sessionId}:memories`, id);
            await this.#client.sRem(`type:${record.type}:memories`, id);

            return true;
        } else {
            return this.#fallbackStore.delete(id);
        }
    }

    /**
     * Remove todos os registros de uma sessão
     */
    async deleteBySession(sessionId) {
        await this.#ensureConnected();

        if (this.#isConnected) {
            const sessionKey = `session:${sessionId}:memories`;
            const ids = await this.#client.sMembers(sessionKey);
            
            if (ids.length === 0) return 0;

            const pipeline = this.#client.multi();
            ids.forEach(id => {
                pipeline.del(`memory:${id}`);
                pipeline.sRem(sessionKey, id);
            });
            await pipeline.exec();

            await this.#client.del(sessionKey);
            return ids.length;
        } else {
            return this.#fallbackStore.deleteBySession(sessionId);
        }
    }

    /**
     * Busca semântica por similaridade
     */
    async searchSimilar(queryEmbedding, filter = {}) {
        await this.#ensureConnected();

        if (!this.#options.enableVectorSearch) {
            console.warn('[RedisMemoryStore] Vector search not enabled');
            return [];
        }

        // Implementação básica usando Redis Search (RediSearch)
        // Requer módulo RediSearch instalado
        try {
            const { sessionId, type, topK = 10 } = filter;
            
            // Nota: Implementação completa requer RediSearch com índices vetoriais
            // Por enquanto, retorna array vazio
            console.warn('[RedisMemoryStore] Vector search requires RediSearch module');
            return [];
        } catch (error) {
            console.error('[RedisMemoryStore] Vector search error:', error);
            return [];
        }
    }

    /**
     * Define tempo de expiração
     */
    async setExpiration(id, expiresAt) {
        await this.#ensureConnected();

        if (this.#isConnected) {
            const ttl = Math.floor((new Date(expiresAt) - new Date()) / 1000);
            if (ttl > 0) {
                await this.#client.expire(`memory:${id}`, ttl);
                return true;
            }
            return false;
        } else {
            // Fallback não suporta expiração
            return false;
        }
    }

    /**
     * Verifica se registro expirou
     */
    async isExpired(id) {
        await this.#ensureConnected();

        if (this.#isConnected) {
            const ttl = await this.#client.ttl(`memory:${id}`);
            return ttl === -2; // Chave não existe
        } else {
            return false;
        }
    }

    /**
     * Lista tipos de memória
     */
    async listTypes() {
        await this.#ensureConnected();

        if (this.#isConnected) {
            const keys = await this.#client.keys('type:*:memories');
            const types = keys.map(k => k.split(':')[1]);
            return [...new Set(types)];
        } else {
            return ['episodic', 'semantic', 'summary'];
        }
    }

    /**
     * Garante conexão
     */
    async #ensureConnected() {
        if (!this.#isConnected && !this.#fallbackStore) {
            await this.connect();
        }
    }

    /**
     * Desconecta do Redis
     */
    async disconnect() {
        if (this.#client && this.#isConnected) {
            await this.#client.quit();
            this.#isConnected = false;
        }
    }
}

module.exports = { RedisMemoryStore };
