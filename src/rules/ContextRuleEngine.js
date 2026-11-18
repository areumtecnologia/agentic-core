'use strict';

const EventEmitter = require('events');
const { AgentEvents } = require('../AgentEvents');
const { IntentRouter } = require('../slm/IntentRouter');

/**
 * ContextRuleEngine — Motor declarativo para avaliação e injeção automática de contexto.
 *
 * Avalia regras cadastradas (por palavras-chave, regex, intenções semânticas ou predicados)
 * a cada turno da conversa. Ao dar match, aplica a diretriz/propaganda automaticamente
 * via `agent.injectSystemContext()`, respeitando controles estritos de limites por sessão
 * (frequency capping), intervalos de resfriamento (cooldown) e janelas temporais de validade.
 */
class ContextRuleEngine extends EventEmitter {
    #rules = new Map();

    /**
     * @param {object} [options={}]
     * @param {object[]} [options.rules=[]] Lista opcional de regras iniciais
     */
    constructor(options = {}) {
        super();
        if (Array.isArray(options.rules)) {
            for (const r of options.rules) {
                this.registerRule(r);
            }
        }
    }

    /**
     * Registra uma nova regra declarativa no motor.
     *
     * @param {object} rule
     * @param {string} rule.id                    Identificador único da regra
     * @param {string} [rule.description]         Descrição humana para logs e auditoria
     * @param {object} rule.match                 Critérios de correspondência
     * @param {Array<string|RegExp>} [rule.match.keywords] Palavras-chave ou expressões regulares
     * @param {string[]} [rule.match.intents]     Intenções pré-definidas
     * @param {Function} [rule.match.predicate]   Predicado customizado ({ session, text, normalized, history }) => boolean
     * @param {string|Function} rule.context      Texto da instrução ou função geradora ({ session, match }) => string
     * @param {object} [rule.options]             Opções repassadas para o injectSystemContext (ttlTurns, persistent, label, priority)
     * @param {object} [rule.limits]              Políticas de frequência (maxPerSession, cooldownTurns, startsAt, expiresAt)
     * @returns {ContextRuleEngine} this (encadeável)
     */
    registerRule(rule) {
        if (!rule || typeof rule !== 'object') {
            throw new TypeError('[ContextRuleEngine] Rule must be an object.');
        }
        if (!rule.id || typeof rule.id !== 'string' || rule.id.trim().length === 0) {
            throw new TypeError('[ContextRuleEngine] Rule must have a non-empty string "id".');
        }
        if (!rule.match || typeof rule.match !== 'object') {
            throw new TypeError(`[ContextRuleEngine] Rule "${rule.id}" must define a "match" object.`);
        }
        const hasKeywords = Array.isArray(rule.match.keywords) && rule.match.keywords.length > 0;
        const hasIntents = Array.isArray(rule.match.intents) && rule.match.intents.length > 0;
        const hasPredicate = typeof rule.match.predicate === 'function';

        if (!hasKeywords && !hasIntents && !hasPredicate) {
            throw new TypeError(
                `[ContextRuleEngine] Rule "${rule.id}" must define at least one match criteria: ` +
                `"keywords", "intents" or "predicate".`
            );
        }

        if (!rule.context && !rule.experimentId) {
            throw new TypeError(`[ContextRuleEngine] Rule "${rule.id}" must define a "context" or an "experimentId".`);
        }
        if (rule.context && typeof rule.context !== 'string' && typeof rule.context !== 'function') {
            throw new TypeError(`[ContextRuleEngine] Rule "${rule.id}" must define a string or function "context".`);
        }

        this.#rules.set(rule.id, {
            id: rule.id.trim(),
            description: rule.description || '',
            match: {
                keywords: Array.isArray(rule.match.keywords) ? [...rule.match.keywords] : null,
                intents: Array.isArray(rule.match.intents) ? [...rule.match.intents] : null,
                predicate: typeof rule.match.predicate === 'function' ? rule.match.predicate : null,
            },
            context: rule.context || null,
            experimentId: rule.experimentId || null,
            options: {
                ttlTurns: rule.options?.ttlTurns ?? 2,
                persistent: rule.options?.persistent ?? false,
                label: rule.options?.label || rule.id.trim(),
                priority: rule.options?.priority || 'normal',
                tracking: rule.options?.tracking || rule.tracking || null,
            },
            limits: {
                maxPerSession: rule.limits?.maxPerSession ?? 1,
                cooldownTurns: rule.limits?.cooldownTurns ?? 2,
                startsAt: rule.limits?.startsAt ? new Date(rule.limits.startsAt) : null,
                expiresAt: rule.limits?.expiresAt ? new Date(rule.limits.expiresAt) : null,
            },
        });

        return this;
    }

    /**
     * Remove uma regra por id.
     * @param {string} id
     * @returns {boolean} true se a regra existia e foi removida
     */
    unregisterRule(id) {
        if (!id || typeof id !== 'string') return false;
        return this.#rules.delete(id.trim());
    }

    /**
     * Retorna uma cópia da lista de regras registradas.
     * @returns {object[]}
     */
    getRules() {
        return Array.from(this.#rules.values()).map(r => ({
            id: r.id,
            description: r.description,
            match: { ...r.match },
            options: { ...r.options },
            limits: { ...r.limits },
        }));
    }

    /**
     * Limpa todas as regras cadastradas.
     * @returns {number} Quantidade de regras removidas
     */
    clearRules() {
        const count = this.#rules.size;
        this.#rules.clear();
        return count;
    }

    /**
     * Avalia todas as regras contra a mensagem do usuário e aplica automaticamente
     * as correspondentes via `agent.injectSystemContext()`.
     *
     * @param {object} params
     * @param {import('../AgenticCore').AgenticCore} params.agent
     * @param {import('../AgentSession').AgentSession} params.session
     * @param {string} params.userText
     * @returns {Promise<string[]>} IDs das regras que foram disparadas neste turno
     */
    async evaluateAndApply({ agent, session, userText }) {
        if (!userText || typeof userText !== 'string' || this.#rules.size === 0) {
            return [];
        }

        const normalized = userText
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        const currentTurn = session.getHistory().length;
        if (!session._ruleState) {
            session._ruleState = { rules: {} };
        }

        const now = new Date();
        const triggeredRuleIds = [];

        for (const rule of this.#rules.values()) {
            const state = session._ruleState.rules[rule.id] || { triggerCount: 0, lastTriggerTurn: -999 };

            // 1. Validação temporal
            if (rule.limits.startsAt && now < rule.limits.startsAt) continue;
            if (rule.limits.expiresAt && now > rule.limits.expiresAt) continue;

            // 2. Frequency Capping por sessão
            if (state.triggerCount >= rule.limits.maxPerSession) continue;

            // 3. Cooldown de turnos
            if (currentTurn - state.lastTriggerTurn <= rule.limits.cooldownTurns) continue;

            // 4. Teste de correspondência
            let isMatch = false;
            let matchDetails = null;

            // 4.1 Match por Keywords / Regex
            if (rule.match.keywords) {
                for (const kw of rule.match.keywords) {
                    if (kw instanceof RegExp) {
                        if (kw.test(userText) || kw.test(normalized)) {
                            isMatch = true;
                            matchDetails = { type: 'regex', pattern: kw.toString() };
                            break;
                        }
                    } else if (typeof kw === 'string') {
                        const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                        if (normalized.includes(kwNorm)) {
                            isMatch = true;
                            matchDetails = { type: 'keyword', keyword: kw };
                            break;
                        }
                    }
                }
            }

            // 4.2 Match por Intents
            if (!isMatch && rule.match.intents) {
                for (const intent of rule.match.intents) {
                    const intentNorm = intent.toLowerCase();
                    // Avalia correspondências comuns via IntentRouter ou heurística de intent
                    if (intentNorm === 'datetime' && IntentRouter.shouldEnforceDatetime(userText)) {
                        isMatch = true;
                        matchDetails = { type: 'intent', intent };
                        break;
                    }
                    if (intentNorm === 'closing' && IntentRouter.shouldEnforceClosing(userText)) {
                        isMatch = true;
                        matchDetails = { type: 'intent', intent };
                        break;
                    }
                    if (normalized.includes(intentNorm)) {
                        isMatch = true;
                        matchDetails = { type: 'intent', intent };
                        break;
                    }
                }
            }

            // 4.3 Match por Predicado Customizado
            if (!isMatch && typeof rule.match.predicate === 'function') {
                try {
                    const result = await rule.match.predicate({
                        session,
                        text: userText,
                        normalized,
                        history: session.getHistory(),
                    });
                    if (result) {
                        isMatch = true;
                        matchDetails = { type: 'predicate' };
                    }
                } catch (err) {
                    agent.emit(AgentEvents.ERROR, {
                        error: err,
                        source: `rule_predicate_${rule.id}`,
                        session: session.toJSON(),
                    });
                }
            }

            // 5. Se deu match, resolve o texto do contexto e injeta
            if (isMatch) {
                let contextText = '';
                let variantSelected = null;
                try {
                    if (rule.experimentId && agent.experimentEngine) {
                        variantSelected = agent.experimentEngine.selectVariant(rule.experimentId, session, { match: matchDetails });
                        contextText = variantSelected ? variantSelected.text : '';
                    } else if (typeof rule.context === 'function') {
                        contextText = await rule.context({ session, match: matchDetails });
                    } else if (rule.context) {
                        contextText = String(rule.context);
                    }
                } catch (err) {
                    agent.emit(AgentEvents.ERROR, {
                        error: err,
                        source: `rule_context_resolver_${rule.id}`,
                        session: session.toJSON(),
                    });
                    continue;
                }

                if (contextText && typeof contextText === 'string' && contextText.trim().length > 0) {
                    // Prepara opções enriquecidas caso variante de experimento tenha sido selecionada
                    const injectionOptions = { ...rule.options };
                    if (variantSelected) {
                        injectionOptions.tracking = {
                            ...(injectionOptions.tracking || {}),
                            experimentId: rule.experimentId,
                            variantId: variantSelected.id,
                        };
                    }

                    // Delega para o método injectSystemContext do core (mantendo interoperabilidade total!)
                    agent.injectSystemContext(session.id, contextText.trim(), injectionOptions);

                    // Registra estado de disparo na sessão
                    state.triggerCount += 1;
                    state.lastTriggerTurn = currentTurn;
                    state.lastTriggerAt = new Date();
                    session._ruleState.rules[rule.id] = state;

                    triggeredRuleIds.push(rule.id);

                    agent.emit(AgentEvents.RULE_TRIGGERED, {
                        sessionId: session.id,
                        ruleId: rule.id,
                        match: matchDetails,
                        context: contextText.trim(),
                        options: injectionOptions,
                        experimentId: rule.experimentId || null,
                        variantId: variantSelected ? variantSelected.id : null,
                        triggerCount: state.triggerCount,
                        session: session.toJSON(),
                    });
                }
            }
        }

        return triggeredRuleIds;
    }
}

module.exports = { ContextRuleEngine };
