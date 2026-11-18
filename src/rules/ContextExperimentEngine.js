'use strict';

const EventEmitter = require('events');
const { AgentEvents } = require('../AgentEvents');

/**
 * ContextExperimentEngine — Motor de A/B Testing & Multi-Armed Bandit (v4.4).
 *
 * Gerencia experimentos de copy, tons de voz e mensagens injetadas.
 * Implementa algoritmos de Multi-Armed Bandit (Epsilon-Greedy, Softmax, Round-Robin, Static-Split)
 * para alocar mais tráfego à variante vencedora (exploitation) enquanto mantém
 * exploração contínua de novas opções (exploration).
 */
class ContextExperimentEngine extends EventEmitter {
    #experiments = new Map(); // experimentId -> experimentConfig
    #sessionVariants = new Map(); // `${sessionId}:${experimentId}` -> variantId
    #roundRobinIndices = new Map(); // experimentId -> currentIndex
    #enabled = true;

    /**
     * @param {object} [options={}]
     * @param {boolean} [options.enabled=true]
     * @param {object[]} [options.experiments=[]]
     */
    constructor(options = {}) {
        super();
        this.#enabled = options.enabled !== false;

        if (Array.isArray(options.experiments)) {
            for (const exp of options.experiments) {
                this.createExperiment(exp);
            }
        }
    }

    get enabled() {
        return this.#enabled;
    }

    set enabled(val) {
        this.#enabled = Boolean(val);
    }

    /**
     * Registra um novo experimento.
     *
     * @param {object} config
     * @param {string} config.id - Identificador único do experimento
     * @param {string} [config.name] - Nome descritivo
     * @param {('epsilon-greedy'|'softmax'|'round-robin'|'static-split')} [config.strategy='epsilon-greedy']
     * @param {number} [config.epsilon=0.15] - Taxa de exploração para epsilon-greedy (0 a 1)
     * @param {number} [config.temperature=0.5] - Parâmetro tau para softmax
     * @param {boolean} [config.stickToSession=true] - Mantém a mesma variante para a sessão
     * @param {object[]} config.variants - Lista de variantes
     * @param {string} config.variants[].id - ID da variante
     * @param {string} config.variants[].text - Texto a ser injetado no contexto
     * @param {string} [config.variants[].label] - Rótulo amigável
     * @param {number} [config.variants[].weight=1] - Peso para static-split
     * @param {object} [config.conversionGoal] - Metas e valores de recompensa
     * @param {string} [config.conversionGoal.toolName] - Tool que converte
     * @param {number} [config.conversionGoal.rewardValue=1.0] - Recompensa na conversão
     * @param {number} [config.conversionGoal.engagementReward=0.3] - Recompensa no engajamento
     * @returns {ContextExperimentEngine}
     */
    createExperiment(config) {
        if (!config || typeof config !== 'object') {
            throw new TypeError('[ContextExperimentEngine] Experiment config must be an object.');
        }
        if (!config.id || typeof config.id !== 'string') {
            throw new TypeError('[ContextExperimentEngine] Experiment must have a non-empty string "id".');
        }
        if (!Array.isArray(config.variants) || config.variants.length < 2) {
            throw new TypeError(`[ContextExperimentEngine] Experiment "${config.id}" must have at least 2 variants.`);
        }

        const variantsMap = new Map();
        for (const v of config.variants) {
            if (!v.id || typeof v.id !== 'string') {
                throw new TypeError(`[ContextExperimentEngine] Each variant in "${config.id}" must have an "id".`);
            }
            if (typeof v.text !== 'string' && typeof v.text !== 'function') {
                throw new TypeError(`[ContextExperimentEngine] Variant "${v.id}" in "${config.id}" must have "text" (string or function).`);
            }

            variantsMap.set(v.id, {
                id: v.id,
                label: v.label || v.id,
                text: v.text,
                weight: typeof v.weight === 'number' && v.weight > 0 ? v.weight : 1,
                stats: {
                    impressions: 0,
                    engagements: 0,
                    conversions: 0,
                    totalReward: 0,
                    averageReward: 0,
                },
            });
        }

        this.#experiments.set(config.id, {
            id: config.id,
            name: config.name || config.id,
            strategy: config.strategy || 'epsilon-greedy',
            epsilon: typeof config.epsilon === 'number' ? Math.max(0, Math.min(1, config.epsilon)) : 0.15,
            temperature: typeof config.temperature === 'number' && config.temperature > 0 ? config.temperature : 0.5,
            stickToSession: config.stickToSession !== false,
            variants: variantsMap,
            conversionGoal: {
                toolName: config.conversionGoal?.toolName || null,
                rewardValue: config.conversionGoal?.rewardValue ?? 1.0,
                engagementReward: config.conversionGoal?.engagementReward ?? 0.3,
            },
            createdAt: new Date().toISOString(),
        });

        this.#roundRobinIndices.set(config.id, 0);
        return this;
    }

    /**
     * Remove um experimento registrado.
     * @param {string} id
     * @returns {boolean}
     */
    removeExperiment(id) {
        this.#roundRobinIndices.delete(id);
        return this.#experiments.delete(id);
    }

    /**
     * Retorna a lista de experimentos configurados.
     * @returns {object[]}
     */
    getExperiments() {
        return Array.from(this.#experiments.values()).map(e => ({
            id: e.id,
            name: e.name,
            strategy: e.strategy,
            epsilon: e.epsilon,
            stickToSession: e.stickToSession,
            variantsCount: e.variants.size,
            variants: Array.from(e.variants.values()).map(v => ({
                id: v.id,
                label: v.label,
                stats: { ...v.stats },
            })),
        }));
    }

    /**
     * Obtém um experimento pelo ID.
     * @param {string} id
     * @returns {object|null}
     */
    getExperiment(id) {
        return this.#experiments.get(id) || null;
    }

    /**
     * Seleciona uma variante de contexto para a sessão usando o algoritmo do Bandit.
     *
     * @param {string} experimentId
     * @param {string|object} sessionOrId - ID da sessão ou objeto AgentSession
     * @param {object} [contextParams={}] - Parâmetros extras para geração dinâmica de texto
     * @returns {object} { id, text, label, experimentId, strategy, isExploiting }
     */
    selectVariant(experimentId, sessionOrId, contextParams = {}) {
        const exp = this.#experiments.get(experimentId);
        if (!exp) {
            throw new Error(`[ContextExperimentEngine] Experiment "${experimentId}" not found.`);
        }

        const sessionId = typeof sessionOrId === 'object' && sessionOrId !== null
            ? (sessionOrId.id || 'default')
            : (sessionOrId || 'default');

        // Se a sessão já possui variante vinculada e stickToSession está ativo, reusa a mesma
        const sessionKey = `${sessionId}:${experimentId}`;
        if (exp.stickToSession && this.#sessionVariants.has(sessionKey)) {
            const savedVariantId = this.#sessionVariants.get(sessionKey);
            const variant = exp.variants.get(savedVariantId);
            if (variant) {
                const text = typeof variant.text === 'function' ? variant.text(contextParams) : variant.text;
                return {
                    id: variant.id,
                    text,
                    label: variant.label,
                    experimentId: exp.id,
                    strategy: exp.strategy,
                    isExploiting: true,
                    sticky: true,
                };
            }
        }

        const variantsList = Array.from(exp.variants.values());
        let selectedVariant = null;
        let isExploiting = false;

        switch (exp.strategy) {
            case 'round-robin': {
                const idx = (this.#roundRobinIndices.get(experimentId) || 0) % variantsList.length;
                selectedVariant = variantsList[idx];
                this.#roundRobinIndices.set(experimentId, idx + 1);
                isExploiting = false;
                break;
            }

            case 'static-split': {
                const totalWeight = variantsList.reduce((acc, v) => acc + v.weight, 0);
                let rnd = Math.random() * totalWeight;
                for (const v of variantsList) {
                    if (rnd < v.weight) {
                        selectedVariant = v;
                        break;
                    }
                    rnd -= v.weight;
                }
                if (!selectedVariant) selectedVariant = variantsList[0];
                isExploiting = false;
                break;
            }

            case 'softmax': {
                // Probabilidade proporcional a e^(averageReward / temperature)
                const tau = exp.temperature;
                const expScores = variantsList.map(v => Math.exp((v.stats.averageReward || 0) / tau));
                const sumExp = expScores.reduce((acc, s) => acc + s, 0);
                let rnd = Math.random() * sumExp;

                for (let i = 0; i < variantsList.length; i++) {
                    if (rnd < expScores[i]) {
                        selectedVariant = variantsList[i];
                        break;
                    }
                    rnd -= expScores[i];
                }
                if (!selectedVariant) selectedVariant = variantsList[0];

                // Identifica se a selecionada é a líder atual
                const bestVariant = this.#getBestVariant(variantsList);
                isExploiting = selectedVariant.id === bestVariant.id;
                break;
            }

            case 'epsilon-greedy':
            default: {
                const isExploring = Math.random() < exp.epsilon;
                if (isExploring) {
                    // Exploração: escolhe variante aleatória
                    const randIndex = Math.floor(Math.random() * variantsList.length);
                    selectedVariant = variantsList[randIndex];
                    isExploiting = false;
                } else {
                    // Aproveitamento (Exploitation): escolhe a variante com melhor averageReward
                    selectedVariant = this.#getBestVariant(variantsList);
                    isExploiting = true;
                }
                break;
            }
        }

        // Incrementa contagem de impressões da variante
        selectedVariant.stats.impressions += 1;

        if (exp.stickToSession && sessionId) {
            this.#sessionVariants.set(sessionKey, selectedVariant.id);
        }

        const text = typeof selectedVariant.text === 'function'
            ? selectedVariant.text(contextParams)
            : selectedVariant.text;

        const result = {
            id: selectedVariant.id,
            text,
            label: selectedVariant.label,
            experimentId: exp.id,
            strategy: exp.strategy,
            isExploiting,
            sticky: false,
        };

        this.emit(AgentEvents.EXPERIMENT_VARIANT_SELECTED, {
            experimentId: exp.id,
            variantId: selectedVariant.id,
            sessionId,
            strategy: exp.strategy,
            isExploiting,
            stats: { ...selectedVariant.stats },
        });

        return result;
    }

    /**
     * Localiza a variante com melhor recompensa média (com desempate aleatório para exploração inicial).
     * @private
     */
    #getBestVariant(variantsList) {
        let best = variantsList[0];
        for (let i = 1; i < variantsList.length; i++) {
            const current = variantsList[i];
            if (current.stats.averageReward > best.stats.averageReward) {
                best = current;
            } else if (current.stats.averageReward === best.stats.averageReward) {
                // Em caso de empate ou zero, escolhe com menor número de impressões para dar chance
                if (current.stats.impressions < best.stats.impressions) {
                    best = current;
                }
            }
        }
        return best;
    }

    /**
     * Registra uma recompensa obtida por uma variante (ex: clique, engajamento, conversão).
     *
     * @param {string} experimentId
     * @param {string} variantId
     * @param {number} reward - Valor numérico da recompensa (ex: 1.0 para conversão, 0.3 para engajamento)
     * @param {('conversion'|'engagement'|'custom')} [type='custom']
     * @returns {boolean}
     */
    recordReward(experimentId, variantId, reward = 1.0, type = 'custom') {
        const exp = this.#experiments.get(experimentId);
        if (!exp) return false;

        const variant = exp.variants.get(variantId);
        if (!variant) return false;

        const val = typeof reward === 'number' && !isNaN(reward) ? reward : 1.0;
        variant.stats.totalReward += val;

        if (type === 'conversion') {
            variant.stats.conversions += 1;
        } else if (type === 'engagement') {
            variant.stats.engagements += 1;
        }

        // Atualiza a recompensa média móvel por impressão
        const imp = Math.max(1, variant.stats.impressions);
        variant.stats.averageReward = variant.stats.totalReward / imp;

        this.emit(AgentEvents.EXPERIMENT_REWARD_RECORDED, {
            experimentId: exp.id,
            variantId: variant.id,
            reward: val,
            type,
            stats: { ...variant.stats },
        });

        return true;
    }

    /**
     * Retorna as estatísticas consolidadas de um experimento ou de todos.
     * @param {string} [experimentId]
     * @returns {object}
     */
    getExperimentStats(experimentId = null) {
        if (experimentId) {
            const exp = this.#experiments.get(experimentId);
            if (!exp) return null;
            return this.#buildStatsForExperiment(exp);
        }

        const all = {};
        for (const [id, exp] of this.#experiments.entries()) {
            all[id] = this.#buildStatsForExperiment(exp);
        }
        return all;
    }

    #buildStatsForExperiment(exp) {
        const variantsList = Array.from(exp.variants.values());
        const best = this.#getBestVariant(variantsList);

        const variantsStats = variantsList.map(v => {
            const imp = v.stats.impressions;
            const engagementRate = imp > 0 ? ((v.stats.engagements / imp) * 100).toFixed(1) + '%' : '0.0%';
            const conversionRate = imp > 0 ? ((v.stats.conversions / imp) * 100).toFixed(1) + '%' : '0.0%';
            return {
                id: v.id,
                label: v.label,
                impressions: imp,
                engagements: v.stats.engagements,
                conversions: v.stats.conversions,
                engagementRate,
                conversionRate,
                averageReward: Number((v.stats.averageReward || 0).toFixed(4)),
                isLeader: v.id === best.id && (imp > 0 || v.stats.totalReward > 0),
            };
        });

        return {
            id: exp.id,
            name: exp.name,
            strategy: exp.strategy,
            epsilon: exp.epsilon,
            leaderVariantId: best.id,
            variants: variantsStats,
        };
    }

    /**
     * Gera relatório executivo em formato Markdown com o desempenho de experimentos.
     * @param {string} [experimentId]
     * @returns {string}
     */
    generateMarkdownReport(experimentId = null) {
        const statsObj = this.getExperimentStats(experimentId);
        if (!statsObj) return '# Relatório de Experimentos\nNenhum experimento encontrado.';

        const list = experimentId ? [statsObj] : Object.values(statsObj);
        let md = '# 📊 Relatório de Experimentos A/B & Multi-Armed Bandit\n\n';

        for (const exp of list) {
            md += `## Experimento: \`${exp.id}\` — ${exp.name}\n`;
            md += `- **Estratégia**: \`${exp.strategy}\` (ε = ${exp.epsilon})\n`;
            md += `- **Variante Líder**: \`${exp.leaderVariantId}\`\n\n`;

            md += '| Variante | Impressões | Engajamento | Conversões | CVR (%) | Score Médio | Status |\n';
            md += '|---|---|---|---|---|---|---|\n';

            for (const v of exp.variants) {
                const status = v.isLeader ? '🏆 **Líder (Exploiting)**' : 'Explorando';
                md += `| \`${v.id}\` | ${v.impressions} | ${v.engagements} (${v.engagementRate}) | ${v.conversions} | **${v.conversionRate}** | ${v.averageReward} | ${status} |\n`;
            }
            md += '\n---\n\n';
        }

        return md.trim();
    }
}

module.exports = {
    ContextExperimentEngine,
};
