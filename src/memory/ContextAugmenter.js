'use strict';

/**
 * ContextAugmenter — Módulo de recuperação automática (RAG de Memória)
 * Enriquece o turno do usuário com fatos semânticos e episódios históricos relevantes
 * antes da chamada aos modelos de linguagem.
 */
class ContextAugmenter {
    #semanticMemory;
    #episodicMemory;
    #graphMemory;
    #maxSemanticFacts;
    #maxEpisodicSummaries;

    /**
     * @param {object} options
     * @param {import('./SemanticMemory').SemanticMemory} [options.semanticMemory]
     * @param {import('./EpisodicMemory').EpisodicMemory} [options.episodicMemory]
     * @param {import('./graph/GraphMemoryStore').GraphMemoryStore} [options.graphMemory]
     * @param {number} [options.maxSemanticFacts=10]
     * @param {number} [options.maxEpisodicSummaries=3]
     */
    constructor({
        semanticMemory = null,
        episodicMemory = null,
        graphMemory = null,
        maxSemanticFacts = 10,
        maxEpisodicSummaries = 3
    } = {}) {
        this.#semanticMemory = semanticMemory;
        this.#episodicMemory = episodicMemory;
        this.#graphMemory = graphMemory;
        this.#maxSemanticFacts = maxSemanticFacts;
        this.#maxEpisodicSummaries = maxEpisodicSummaries;
    }

    /**
     * Recupera contexto relevante da memória de longo prazo para a sessão.
     * @param {object|string} session  Sessão ativa ou ID da sessão
     * @param {string|object} message Mensagem do usuário
     * @returns {Promise<string|null>} Bloco de contexto recuperado em XML/Markdown ou null
     */
    async retrieveContext(session, message) {
        if (!this.#semanticMemory && !this.#episodicMemory && !this.#graphMemory) {
            return null;
        }

        const sessionId = typeof session === 'string' ? session : (session?.id || 'default');
        const sections = [];

        // 1. Consulta fatos semânticos (preferências, dados cadastrais, regras de negócio)
        if (this.#semanticMemory) {
            try {
                const facts = await this.#semanticMemory.recall(sessionId, {
                    limit: this.#maxSemanticFacts
                });

                if (Array.isArray(facts) && facts.length > 0) {
                    const factLines = facts.map(f => {
                        const content = f.content || f;
                        return `- [${content.subject || 'user'}] ${content.predicate || 'is'}: ${content.object || ''}`;
                    });
                    sections.push(`### Relevant Knowledge & Facts:\n${factLines.join('\n')}`);
                }
            } catch (err) {
                // Silencia falha de busca para não interromper o fluxo principal
            }
        }

        // 2. Consulta memórias episódicas (conversas passadas ou histórico arquivado)
        if (this.#episodicMemory) {
            try {
                const episodes = await this.#episodicMemory.recall(sessionId, {
                    limit: this.#maxEpisodicSummaries
                });

                if (Array.isArray(episodes) && episodes.length > 0) {
                    const episodeLines = episodes.map(ep => {
                        const summary = ep.content?.summary || ep.summary || (ep.turn ? JSON.stringify(ep.turn) : '');
                        return `- [Episode]: ${summary}`;
                    });
                    sections.push(`### Past Conversation Highlights:\n${episodeLines.join('\n')}`);
                }
            } catch (err) {
                // Silencia falha de busca
            }
        }

        // 3. Consulta subgrafo relacional de conhecimento (GraphRAG / Multi-Hop)
        if (this.#graphMemory) {
            try {
                const messageText = typeof message === 'string'
                    ? message
                    : (message?.text || message?.content || (Array.isArray(message?.parts) ? message.parts.map(p => p.text).filter(Boolean).join(' ') : ''));

                const graphSubgraph = await this.#graphMemory.queryRelatedContext(sessionId, messageText);
                if (graphSubgraph && graphSubgraph.length > 0) {
                    sections.push(`### Relational Knowledge Graph (Multi-Hop Context):\n${graphSubgraph}`);
                }
            } catch (err) {
                // Silencia falha de busca no grafo
            }
        }

        if (sections.length === 0) {
            return null;
        }

        return `<retrieved_context>\n${sections.join('\n\n')}\n</retrieved_context>`;
    }
}

module.exports = { ContextAugmenter };
