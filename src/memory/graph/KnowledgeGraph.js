'use strict';

/**
 * KnowledgeGraph — Motor de Grafo de Conhecimento em memória com indexação bidirecional
 * Permite modelar Entidades (Nós) e Relações (Arestas) com suporte a travessias multi-hop.
 */
class KnowledgeGraph {
    #entities = new Map(); // id -> GraphEntity
    #relations = new Map(); // id -> GraphRelation
    #outEdges = new Map();  // sourceId -> Set<relationId>
    #inEdges = new Map();   // targetId -> Set<relationId>

    /**
     * Adiciona ou atualiza uma entidade no grafo.
     * @param {object} params
     * @param {string} params.id Identificador único
     * @param {string} [params.name] Nome descritivo da entidade
     * @param {string} [params.type='concept'] Categoria ('person', 'project', 'company', etc.)
     * @param {Record<string, any>} [params.attributes={}] Atributos customizados
     * @returns {object} Entidade criada/atualizada
     */
    addEntity({ id, name, type = 'concept', attributes = {} }) {
        if (!id) throw new Error('[KnowledgeGraph] Entity ID is required.');
        const normId = String(id).trim().toLowerCase();

        const existing = this.#entities.get(normId);
        const entity = {
            id: normId,
            name: name ? String(name).trim() : (existing?.name || id),
            type: String(type).trim().toLowerCase(),
            attributes: { ...(existing?.attributes || {}), ...attributes },
            createdAt: existing?.createdAt || new Date(),
            updatedAt: new Date()
        };

        this.#entities.set(normId, entity);
        if (!this.#outEdges.has(normId)) this.#outEdges.set(normId, new Set());
        if (!this.#inEdges.has(normId)) this.#inEdges.set(normId, new Set());

        return entity;
    }

    /**
     * Obtém uma entidade pelo ID.
     * @param {string} id
     * @returns {object|null}
     */
    getEntity(id) {
        if (!id) return null;
        return this.#entities.get(String(id).trim().toLowerCase()) || null;
    }

    /**
     * Retorna todas as entidades cadastradas.
     * @returns {Array<object>}
     */
    getAllEntities() {
        return Array.from(this.#entities.values());
    }

    /**
     * Adiciona uma relação direcional (tripla: Sujeito -[PREDICADO]-> Objeto).
     * @param {object} params
     * @param {string} params.sourceId Entidade de origem (Subject)
     * @param {string} params.predicate Ação ou relação (Predicate)
     * @param {string} params.targetId Entidade de destino (Object)
     * @param {number} [params.weight=1.0] Peso ou nível de confiança (0 a 1)
     * @param {object} [params.metadata={}] Metadados adicionais (data, contexto, etc.)
     * @returns {object} Relação criada
     */
    addRelation({ sourceId, predicate, targetId, weight = 1.0, metadata = {} }) {
        if (!sourceId || !predicate || !targetId) {
            throw new Error('[KnowledgeGraph] sourceId, predicate and targetId are required.');
        }

        const src = String(sourceId).trim().toLowerCase();
        const tgt = String(targetId).trim().toLowerCase();
        const pred = String(predicate).trim().toUpperCase();

        // Assegura existência dos nós
        if (!this.#entities.has(src)) this.addEntity({ id: src, name: sourceId });
        if (!this.#entities.has(tgt)) this.addEntity({ id: tgt, name: targetId });

        const relId = `${src}:${pred}:${tgt}`;
        const relation = {
            id: relId,
            sourceId: src,
            predicate: pred,
            targetId: tgt,
            weight: Number(weight) || 1.0,
            metadata: { ...metadata },
            createdAt: new Date()
        };

        this.#relations.set(relId, relation);
        this.#outEdges.get(src).add(relId);
        this.#inEdges.get(tgt).add(relId);

        return relation;
    }

    /**
     * Retorna relações originadas ou apontando para uma entidade.
     * @param {string} entityId
     * @param {('out'|'in'|'both')} [direction='both']
     * @returns {Array<object>}
     */
    getRelations(entityId, direction = 'both') {
        const normId = String(entityId).trim().toLowerCase();
        const relIds = new Set();

        if (direction === 'out' || direction === 'both') {
            const outSet = this.#outEdges.get(normId);
            if (outSet) outSet.forEach(id => relIds.add(id));
        }

        if (direction === 'in' || direction === 'both') {
            const inSet = this.#inEdges.get(normId);
            if (inSet) inSet.forEach(id => relIds.add(id));
        }

        return Array.from(relIds).map(id => this.#relations.get(id)).filter(Boolean);
    }

    /**
     * Travessia em largura (BFS) a partir de uma entidade inicial até `maxHops` saltos.
     * Extrai o subgrafo relacional relevante em torno da entidade.
     * 
     * @param {string} startEntityId
     * @param {number} [maxHops=2]
     * @returns {Array<{ hop: number, source: object, predicate: string, target: object, weight: number }>}
     */
    traverse(startEntityId, maxHops = 2) {
        const startId = String(startEntityId).trim().toLowerCase();
        if (!this.#entities.has(startId)) return [];

        const visitedEntities = new Set([startId]);
        const visitedRelations = new Set();
        const resultPaths = [];

        // Fila para BFS: [ [currentEntityId, currentHop] ]
        const queue = [[startId, 0]];

        while (queue.length > 0) {
            const [currId, hop] = queue.shift();
            if (hop >= maxHops) continue;

            const relations = this.getRelations(currId, 'both');
            for (const rel of relations) {
                if (visitedRelations.has(rel.id)) continue;
                visitedRelations.add(rel.id);

                const srcEntity = this.#entities.get(rel.sourceId);
                const tgtEntity = this.#entities.get(rel.targetId);

                resultPaths.push({
                    hop: hop + 1,
                    source: srcEntity,
                    predicate: rel.predicate,
                    target: tgtEntity,
                    weight: rel.weight,
                    metadata: rel.metadata
                });

                // Descobre a outra ponta para continuar a travessia
                const nextEntityId = rel.sourceId === currId ? rel.targetId : rel.sourceId;
                if (!visitedEntities.has(nextEntityId)) {
                    visitedEntities.add(nextEntityId);
                    queue.push([nextEntityId, hop + 1]);
                }
            }
        }

        return resultPaths;
    }

    /**
     * Localiza entidades que combinam com palavras-chave presentes no texto.
     * @param {string} text
     * @returns {Array<object>}
     */
    findMatchingEntities(text) {
        if (!text || typeof text !== 'string') return [];
        const normalized = text.toLowerCase();
        const matches = [];

        for (const entity of this.#entities.values()) {
            const idMatches = normalized.includes(entity.id);
            const nameMatches = entity.name && normalized.includes(entity.name.toLowerCase());
            if (idMatches || nameMatches) {
                matches.push(entity);
            }
        }

        return matches;
    }

    /**
     * Consulta o grafo e gera um subgrafo contextual a partir das entidades identificadas no texto.
     * @param {string} queryText
     * @param {number} [maxHops=2]
     * @returns {string} Formatação em texto para enriquecimento de prompt
     */
    queryContext(queryText, maxHops = 2) {
        const matchingEntities = this.findMatchingEntities(queryText);
        if (matchingEntities.length === 0) return '';

        const allPaths = [];
        const seenRelations = new Set();

        for (const ent of matchingEntities) {
            const paths = this.traverse(ent.id, maxHops);
            for (const p of paths) {
                const key = `${p.source.id}:${p.predicate}:${p.target.id}`;
                if (!seenRelations.has(key)) {
                    seenRelations.add(key);
                    allPaths.push(p);
                }
            }
        }

        if (allPaths.length === 0) return '';
        return this.formatSubgraphAsMarkdown(allPaths);
    }

    /**
     * Formata uma lista de caminhos em Markdown claro para o prompt do LLM.
     * @param {Array<object>} paths
     * @returns {string}
     */
    formatSubgraphAsMarkdown(paths) {
        return paths
            .map(p => {
                const src = p.source.name || p.source.id;
                const tgt = p.target.name || p.target.id;
                const metaStr = p.metadata && Object.keys(p.metadata).length ? ` (${JSON.stringify(p.metadata)})` : '';
                return `- (${src}) -[${p.predicate}]-> (${tgt})${metaStr}`;
            })
            .join('\n');
    }

    /**
     * Serializa o grafo para JSON.
     */
    toJSON() {
        return {
            entities: Array.from(this.#entities.values()),
            relations: Array.from(this.#relations.values())
        };
    }

    /**
     * Restaura o grafo a partir de dados serializados.
     */
    static fromJSON(data) {
        const kg = new KnowledgeGraph();
        if (data && Array.isArray(data.entities)) {
            for (const ent of data.entities) {
                kg.addEntity(ent);
            }
        }
        if (data && Array.isArray(data.relations)) {
            for (const rel of data.relations) {
                kg.addRelation(rel);
            }
        }
        return kg;
    }
}

module.exports = { KnowledgeGraph };

