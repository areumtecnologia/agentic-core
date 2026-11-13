'use strict';

const { KnowledgeGraph } = require('./KnowledgeGraph');

class GraphMemoryStore {
    #globalGraph;
    #sessionGraphs = new Map(); // sessionId -> KnowledgeGraph
    #sessionStore;
    #maxHops;
    #autoExtractTriples;

    /**
     * @param {object} [options={}]
     * @param {import('../../persistence/SessionStore').SessionStore} [options.sessionStore]
     * @param {number} [options.maxHops=2]
     * @param {boolean} [options.autoExtractTriples=true]
     * @param {boolean} [options.isolateSessions=false] Se true, cada sessão tem seu próprio grafo
     */
    constructor(options = {}) {
        this.#sessionStore = options.sessionStore || null;
        this.#maxHops = options.maxHops || 2;
        this.#autoExtractTriples = options.autoExtractTriples !== false;
        this.isolateSessions = Boolean(options.isolateSessions);
        this.#globalGraph = new KnowledgeGraph();
    }

    get graph() {
        return this.#globalGraph;
    }

    /**
     * Retorna a instância do grafo para uma sessão.
     * @param {string} [sessionId]
     * @returns {KnowledgeGraph}
     */
    getGraphForSession(sessionId) {
        if (!this.isolateSessions || !sessionId) {
            return this.#globalGraph;
        }

        const sid = String(sessionId);
        if (!this.#sessionGraphs.has(sid)) {
            this.#sessionGraphs.set(sid, new KnowledgeGraph());
        }
        return this.#sessionGraphs.get(sid);
    }

    /**
     * Consulta subgrafos relacionais relevantes para uma mensagem ou termo de busca.
     * @param {string} sessionId
     * @param {string} messageText
     * @returns {Promise<string>} Markdown formatado ou string vazia
     */
    async queryRelatedContext(sessionId, messageText) {
        if (!messageText || typeof messageText !== 'string') return '';
        const graph = this.getGraphForSession(sessionId);
        return graph.queryContext(messageText, this.#maxHops);
    }

    /**
     * Registra uma relação estruturada no grafo de conhecimento.
     * @param {string} sessionId
     * @param {object} triple
     * @param {string} triple.subject
     * @param {string} triple.predicate
     * @param {string} triple.object
     * @param {number} [triple.weight=1.0]
     * @param {object} [triple.metadata]
     * @returns {object}
     */
    addTriple(sessionId, { subject, predicate, object, weight = 1.0, metadata = {} }) {
        const graph = this.getGraphForSession(sessionId);
        return graph.addRelation({
            sourceId: subject,
            predicate,
            targetId: object,
            weight,
            metadata
        });
    }

    /**
     * Extrai e insere triplas estruturadas heurísticas a partir de texto natural.
     * Suporta padrões relacionais comuns em português e inglês.
     * 
     * @param {string} sessionId
     * @param {string} text
     * @returns {Array<object>} Relações criadas
     */
    extractAndIngestTriples(sessionId, text) {
        if (!this.#autoExtractTriples || !text || typeof text !== 'string') return [];

        const graph = this.getGraphForSession(sessionId);
        const created = [];

        // 1. Padrão explícito: (Entidade A) -[PREDICADO]-> (Entidade B)
        const explicitRegex = /\(?([A-Za-z0-9_\sÀ-ÿ]+)\)?\s*-\[([A-Za-z0-9_\s]+)\]->\s*\(?([A-Za-z0-9_\sÀ-ÿ]+)\)?/g;
        let match;
        while ((match = explicitRegex.exec(text)) !== null) {
            const [, sub, pred, obj] = match;
            if (sub && pred && obj) {
                const rel = graph.addRelation({
                    sourceId: sub.trim(),
                    predicate: pred.trim().toUpperCase(),
                    targetId: obj.trim()
                });
                created.push(rel);
            }
        }

        // 2. Padrões linguísticos comuns
        const patterns = [
            // "X trabalha em/na/no Y" / "X works at Y"
            { regex: /([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)?)\s+(?:trabalha\s+n[aoe]|works\s+at)\s+([A-ZÀ-Ý0-9][a-zA-Z0-9_\s]+)/gi, pred: 'WORKS_AT' },
            // "X gerencia/é gerente de Y" / "X manages Y"
            { regex: /([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)?)\s+(?:gerencia|é\s+gerente\s+d[eo]|manages)\s+([A-ZÀ-Ý0-9][a-zA-Z0-9_\s]+)/gi, pred: 'MANAGES' },
            // "X aprovou o/a Y" / "X approved Y"
            { regex: /([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)?)\s+(?:aprovou(?:\s+o|\s+a)?|approved)\s+([A-ZÀ-Ý0-9][a-zA-Z0-9_\s]+)/gi, pred: 'APPROVED' },
            // "X é cliente de Y" / "X is client of Y"
            { regex: /([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)?)\s+(?:é\s+cliente\s+d[eo]|is\s+client\s+of)\s+([A-ZÀ-Ý0-9][a-zA-Z0-9_\s]+)/gi, pred: 'CLIENT_OF' }
        ];

        for (const { regex, pred } of patterns) {
            let m;
            while ((m = regex.exec(text)) !== null) {
                const sub = m[1]?.trim();
                const obj = m[2]?.trim().replace(/[.,;!?]$/, '');
                if (sub && obj && sub.toLowerCase() !== obj.toLowerCase()) {
                    const rel = graph.addRelation({
                        sourceId: sub,
                        predicate: pred,
                        targetId: obj
                    });
                    created.push(rel);
                }
            }
        }

        return created;
    }

    /**
     * Salva o grafo da sessão no SessionStore configurado (se disponível).
     */
    async save(sessionId) {
        if (!this.#sessionStore) return false;
        const sid = String(sessionId);
        const graph = this.getGraphForSession(sid);
        const data = graph.toJSON();
        return this.#sessionStore.save(`graph:${sid}`, data);
    }

    /**
     * Carrega o grafo de uma sessão a partir do SessionStore.
     */
    async load(sessionId) {
        if (!this.#sessionStore) return null;
        const sid = String(sessionId);
        const data = await this.#sessionStore.load(`graph:${sid}`);
        if (!data) return null;

        const loadedGraph = KnowledgeGraph.fromJSON(data);
        if (this.isolateSessions) {
            this.#sessionGraphs.set(sid, loadedGraph);
        } else {
            this.#globalGraph = loadedGraph;
        }
        return loadedGraph;
    }
}

module.exports = { GraphMemoryStore };

