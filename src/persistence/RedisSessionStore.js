'use strict';

const { SessionStore } = require('./SessionStore');

/**
 * RedisSessionStore — Adaptador persistente de SessionStore baseado em Redis (v4.4).
 *
 * Suporta persistência atômica, TTL com expiração automática, diário de execução durável,
 * checkpoints de estado e re-hidratação transparente de instâncias de AgentSession
 * para clusters multi-instância e ambientes serverless/Kubernetes.
 */
class RedisSessionStore extends SessionStore {
    #client = null;
    #options = {};
    #isConnected = false;
    #keyPrefix = 'agentic:';
    #defaultTTL = 1800; // 30 minutos em segundos

    /**
     * @param {object} [options={}]
     * @param {string} [options.host='localhost']
     * @param {number} [options.port=6379]
     * @param {string} [options.password]
     * @param {number} [options.db=0]
     * @param {number} [options.ttlSeconds=1800] TTL padrão em segundos (30 min)
     * @param {string} [options.keyPrefix='agentic:'] Prefixo de chaves no Redis
     * @param {object} [options.client] Instância pré-conectada de cliente Redis ou Mock
     */
    constructor(options = {}) {
        super();
        this.#options = {
            host: 'localhost',
            port: 6379,
            password: null,
            db: 0,
            ttlSeconds: 1800,
            keyPrefix: 'agentic:',
            ...options,
        };

        this.#keyPrefix = this.#options.keyPrefix || 'agentic:';
        this.#defaultTTL = typeof this.#options.ttlSeconds === 'number' ? this.#options.ttlSeconds : 1800;

        if (options.client) {
            this.#client = options.client;
            this.#isConnected = true;
        }
    }

    /**
     * Retorna se a conexão com o Redis está ativa.
     * @returns {boolean}
     */
    get isConnected() {
        return this.#isConnected;
    }

    /**
     * Retorna o cliente Redis encapsulado.
     */
    get client() {
        return this.#client;
    }

    /**
     * Conecta ao servidor Redis caso um cliente externo não tenha sido fornecido.
     */
    async connect() {
        if (this.#isConnected && this.#client) return;

        try {
            const redis = require('redis');
            this.#client = redis.createClient({
                socket: {
                    host: this.#options.host,
                    port: this.#options.port,
                },
                password: this.#options.password,
                database: this.#options.db,
            });

            this.#client.on('error', (err) => {
                console.error('[RedisSessionStore] Redis client error:', err);
            });

            await this.#client.connect();
            this.#isConnected = true;
        } catch (err) {
            this.#isConnected = false;
            throw new Error(`[RedisSessionStore] Failed to connect to Redis: ${err.message}`);
        }
    }

    /**
     * Desconecta do Redis.
     */
    async disconnect() {
        if (this.#client && this.#isConnected) {
            if (typeof this.#client.quit === 'function') {
                await this.#client.quit();
            } else if (typeof this.#client.disconnect === 'function') {
                await this.#client.disconnect();
            }
            this.#isConnected = false;
        }
    }

    #sessionKey(sessionId) {
        return `${this.#keyPrefix}session:${sessionId}:state`;
    }

    #journalKey(sessionId) {
        return `${this.#keyPrefix}session:${sessionId}:journal`;
    }

    #checkpointKey(sessionId) {
        return `${this.#keyPrefix}session:${sessionId}:checkpoints`;
    }

    #userKey(userId) {
        return `${this.#keyPrefix}user:${userId}:sessions`;
    }

    async #ensureConnected() {
        if (!this.#isConnected || !this.#client) {
            await this.connect();
        }
    }

    /**
     * Salva o estado completo serializado da sessão com TTL.
     *
     * @param {string} sessionId
     * @param {object} data - Payload de session.toJSON()
     * @param {number} [ttlSeconds] - TTL opcional em segundos
     * @returns {Promise<boolean>}
     */
    async save(sessionId, data, ttlSeconds = null) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const key = this.#sessionKey(sid);
        const ttl = typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : this.#defaultTTL;

        const serialized = JSON.stringify(data);

        if (ttl > 0) {
            if (typeof this.#client.setEx === 'function') {
                await this.#client.setEx(key, ttl, serialized);
            } else if (typeof this.#client.set === 'function') {
                await this.#client.set(key, serialized, 'EX', ttl);
            }
        } else {
            await this.#client.set(key, serialized);
        }

        // Se houver ID de usuário associado, vincula no índice do usuário
        const userId = data.user?.id || (typeof data.user === 'string' ? data.user : null);
        if (userId) {
            const userK = this.#userKey(userId);
            if (typeof this.#client.sAdd === 'function') {
                await this.#client.sAdd(userK, sid);
            }
        }

        return true;
    }

    /**
     * Carrega o estado da sessão a partir do Redis.
     *
     * @param {string} sessionId
     * @returns {Promise<object|null>}
     */
    async load(sessionId) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const key = this.#sessionKey(sid);

        let data = null;
        if (typeof this.#client.get === 'function') {
            data = await this.#client.get(key);
        }

        if (!data) return null;

        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    /**
     * Remove todos os dados da sessão (estado, diário, checkpoints).
     *
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async delete(sessionId) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const sKey = this.#sessionKey(sid);
        const jKey = this.#journalKey(sid);
        const cKey = this.#checkpointKey(sid);

        if (typeof this.#client.del === 'function') {
            await this.#client.del(sKey);
            await this.#client.del(jKey);
            await this.#client.del(cKey);
        }

        return true;
    }

    /**
     * Verifica se a sessão existe e não expirou no Redis.
     *
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async exists(sessionId) {
        await this.#ensureConnected();
        const key = this.#sessionKey(String(sessionId));

        if (typeof this.#client.exists === 'function') {
            const count = await this.#client.exists(key);
            return count > 0;
        }
        const val = await this.load(sessionId);
        return val !== null;
    }

    /**
     * Renova o tempo de vida (TTL) da sessão sem alterar os dados.
     *
     * @param {string} sessionId
     * @param {number} [ttlSeconds]
     * @returns {Promise<boolean>}
     */
    async touch(sessionId, ttlSeconds = null) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const key = this.#sessionKey(sid);
        const ttl = typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : this.#defaultTTL;

        if (typeof this.#client.expire === 'function') {
            await this.#client.expire(key, ttl);
            await this.#client.expire(this.#journalKey(sid), ttl);
            await this.#client.expire(this.#checkpointKey(sid), ttl);
            return true;
        }
        return false;
    }

    // ── Diário de Execução Durável & Checkpoints (v4.0) ────────────────────────

    /**
     * Registra uma entrada imutável no diário de execução da sessão.
     *
     * @param {string} sessionId
     * @param {object} entry
     * @returns {Promise<boolean>}
     */
    async appendJournal(sessionId, entry) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const key = this.#journalKey(sid);
        const payload = JSON.stringify({
            ...entry,
            timestamp: entry.timestamp || new Date().toISOString(),
        });

        if (typeof this.#client.rPush === 'function') {
            await this.#client.rPush(key, payload);
        } else if (typeof this.#client.rpush === 'function') {
            await this.#client.rpush(key, payload);
        }

        // Aplica o mesmo TTL padrão ao diário
        if (this.#defaultTTL > 0 && typeof this.#client.expire === 'function') {
            await this.#client.expire(key, this.#defaultTTL);
        }

        return true;
    }

    /**
     * Retorna todas as entradas do diário de execução da sessão.
     *
     * @param {string} sessionId
     * @returns {Promise<object[]>}
     */
    async getJournal(sessionId) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const key = this.#journalKey(sid);

        let list = [];
        if (typeof this.#client.lRange === 'function') {
            list = await this.#client.lRange(key, 0, -1);
        } else if (typeof this.#client.lrange === 'function') {
            list = await this.#client.lrange(key, 0, -1);
        }

        if (!Array.isArray(list)) return [];

        const result = [];
        for (const item of list) {
            try {
                result.push(typeof item === 'string' ? JSON.parse(item) : item);
            } catch {}
        }
        return result;
    }

    /**
     * Salva um checkpoint atômico no hash de checkpoints da sessão.
     *
     * @param {string} sessionId
     * @param {string} checkpointId
     * @param {object} stateData
     * @returns {Promise<boolean>}
     */
    async saveCheckpoint(sessionId, checkpointId, stateData) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const key = this.#checkpointKey(sid);
        const cid = String(checkpointId);
        const payload = JSON.stringify(stateData);

        if (typeof this.#client.hSet === 'function') {
            await this.#client.hSet(key, cid, payload);
        } else if (typeof this.#client.hset === 'function') {
            await this.#client.hset(key, cid, payload);
        }

        if (this.#defaultTTL > 0 && typeof this.#client.expire === 'function') {
            await this.#client.expire(key, this.#defaultTTL);
        }

        return true;
    }

    /**
     * Carrega um checkpoint de estado específico.
     *
     * @param {string} sessionId
     * @param {string} checkpointId
     * @returns {Promise<object|null>}
     */
    async loadCheckpoint(sessionId, checkpointId) {
        await this.#ensureConnected();
        const sid = String(sessionId);
        const key = this.#checkpointKey(sid);
        const cid = String(checkpointId);

        let data = null;
        if (typeof this.#client.hGet === 'function') {
            data = await this.#client.hGet(key, cid);
        } else if (typeof this.#client.hget === 'function') {
            data = await this.#client.hget(key, cid);
        }

        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
}

module.exports = { RedisSessionStore };
