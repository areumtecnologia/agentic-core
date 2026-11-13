const { EventEmitter } = require('events');

/**
 * Quadro de Conhecimento Compartilhado (Shared Blackboard) para agentes autônomos.
 * Permite que múltiplos agentes leiam, escrevam, appendem e observem estado compartilhado
 * com versionamento otimista, locking e trilha de auditoria (audit trail).
 */
class SharedBlackboard extends EventEmitter {
    #data = new Map(); // key -> { value, version, updatedAt, updatedBy, meta }
    #auditTrail = [];
    #maxAuditEntries;

    constructor(options = {}) {
        super();
        this.#maxAuditEntries = options.maxAuditEntries || 500;
    }

    /**
     * Define ou atualiza o valor de uma chave no quadro negro.
     * @param {string} key - Chave do dado.
     * @param {*} value - Valor a ser armazenado.
     * @param {Object} [options={}] - Opções: updatedBy, expectedVersion (lock otimista), meta.
     * @returns {Object} Registro armazenado com nova versão.
     */
    set(key, value, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('SharedBlackboard.set requer uma chave em formato de string.');
        }

        const existing = this.#data.get(key);
        const currentVersion = existing ? existing.version : 0;

        if (options.expectedVersion !== undefined && options.expectedVersion !== currentVersion) {
            throw new Error(
                `Conflito de Concorrência no Blackboard para "${key}": versão esperada ${options.expectedVersion}, versão atual ${currentVersion}.`
            );
        }

        const newVersion = currentVersion + 1;
        const entry = {
            key,
            value,
            version: newVersion,
            updatedAt: Date.now(),
            updatedBy: options.updatedBy || 'system',
            meta: options.meta || {}
        };

        this.#data.set(key, entry);

        const auditItem = {
            action: existing ? 'UPDATE' : 'CREATE',
            key,
            value,
            version: newVersion,
            previousVersion: currentVersion,
            updatedBy: entry.updatedBy,
            timestamp: entry.updatedAt
        };
        this.#recordAudit(auditItem);

        this.emit('updated', entry);
        this.emit(`updated:${key}`, entry);

        return entry;
    }

    /**
     * Obtém o registro de uma chave.
     * @param {string} key - Chave.
     * @returns {*} Valor armazenado ou undefined.
     */
    get(key) {
        const entry = this.#data.get(key);
        return entry ? entry.value : undefined;
    }

    /**
     * Obtém a entrada completa com metadados e versão.
     * @param {string} key - Chave.
     * @returns {Object|null}
     */
    getEntry(key) {
        const entry = this.#data.get(key);
        return entry ? { ...entry } : null;
    }

    /**
     * Verifica se uma chave existe no quadro.
     * @param {string} key - Chave.
     * @returns {boolean}
     */
    has(key) {
        return this.#data.has(key);
    }

    /**
     * Remove uma chave do quadro.
     * @param {string} key - Chave.
     * @param {string} [deletedBy='system'] - Identificador do autor.
     * @returns {boolean} Se existia e foi removida.
     */
    delete(key, deletedBy = 'system') {
        const existing = this.#data.get(key);
        if (!existing) return false;

        this.#data.delete(key);

        this.#recordAudit({
            action: 'DELETE',
            key,
            previousVersion: existing.version,
            updatedBy: deletedBy,
            timestamp: Date.now()
        });

        this.emit('deleted', { key, deletedBy, previousVersion: existing.version });
        this.emit(`deleted:${key}`, { key, deletedBy });

        return true;
    }

    /**
     * Adiciona um item a uma lista armazenada no quadro negro (cria a lista se não existir).
     * @param {string} key - Chave da lista.
     * @param {*} item - Item para anexar.
     * @param {Object} [options={}] - Opções.
     * @returns {Array} Lista atualizada.
     */
    appendToList(key, item, options = {}) {
        const currentList = this.get(key);
        const list = Array.isArray(currentList) ? [...currentList] : [];
        list.push(item);
        this.set(key, list, options);
        return list;
    }

    /**
     * Retorna todas as entradas atuais como um objeto plano.
     * @returns {Object}
     */
    snapshot() {
        const snapshot = {};
        for (const [k, v] of this.#data.entries()) {
            snapshot[k] = v.value;
        }
        return snapshot;
    }

    /**
     * Retorna o snapshot completo com versão e metadados.
     * @returns {Object}
     */
    detailedSnapshot() {
        const snapshot = {};
        for (const [k, v] of this.#data.entries()) {
            snapshot[k] = { ...v };
        }
        return snapshot;
    }

    /**
     * Retorna o histórico de auditoria de alterações.
     * @param {string} [key] - Filtrar por chave opcional.
     * @returns {Array<Object>}
     */
    getAuditTrail(key) {
        if (!key) return [...this.#auditTrail];
        return this.#auditTrail.filter((a) => a.key === key);
    }

    /**
     * Limpa todo o estado do quadro.
     */
    clear() {
        this.#data.clear();
        this.#auditTrail = [];
        this.emit('cleared');
    }

    #recordAudit(entry) {
        this.#auditTrail.push(Object.freeze({ ...entry }));
        if (this.#auditTrail.length > this.#maxAuditEntries) {
            this.#auditTrail.shift();
        }
    }
}

module.exports = SharedBlackboard;

