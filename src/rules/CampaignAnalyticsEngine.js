'use strict';

const EventEmitter = require('events');
const { AgentEvents } = require('../AgentEvents');

/**
 * CampaignAnalyticsEngine — Sistema de atribuição conversacional e analytics de campanhas/injeções.
 *
 * Monitora o funil completo de injeções dinâmicas no AgenticCore:
 * 1. INJETADO: A diretriz/propaganda foi enviada ao prompt.
 * 2. RENDERIZADO: O LLM citou termos/cupons no texto final.
 * 3. ENGAJADO: O cliente interagiu sobre o tópico no turno seguinte.
 * 4. CONVERTIDO: Uma ação ou tool de conversão foi alcançada.
 */
class CampaignAnalyticsEngine extends EventEmitter {
    #enabled;
    #maxEvents;
    #campaigns = new Map();
    #sessionActiveCampaigns = new Map(); // sessionId -> Map<campaignId, state>
    #eventsHistory = [];

    /**
     * @param {object} [options={}]
     * @param {boolean} [options.enabled=true]
     * @param {number} [options.maxEvents=500] Limite de eventos no histórico em memória
     */
    constructor({ enabled = true, maxEvents = 500 } = {}) {
        super();
        this.#enabled = Boolean(enabled);
        this.#maxEvents = Number(maxEvents) || 500;
    }

    get enabled() {
        return this.#enabled;
    }

    set enabled(val) {
        this.#enabled = Boolean(val);
    }

    /**
     * Retorna ou inicializa o registro acumulado de uma campanha.
     * @private
     * @param {string} campaignId
     * @returns {object}
     */
    #getOrCreateCampaign(campaignId) {
        if (!this.#campaigns.has(campaignId)) {
            this.#campaigns.set(campaignId, {
                campaignId,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                injections: 0,
                renders: 0,
                engagements: 0,
                conversions: 0,
                uniqueSessions: new Set(),
            });
        }
        return this.#campaigns.get(campaignId);
    }

    /**
     * Registra que uma campanha/contexto foi injetada no prompt de uma sessão.
     *
     * @param {object} params
     * @param {string} params.sessionId
     * @param {string} params.campaignId
     * @param {object} params.trackingSpec
     * @param {number} [params.turnNumber=0]
     */
    recordInjection({ sessionId, campaignId, trackingSpec, turnNumber = 0 }) {
        if (!this.#enabled || !campaignId) return;

        const sid = String(sessionId);
        const cid = String(campaignId).trim();
        const camp = this.#getOrCreateCampaign(cid);

        camp.injections += 1;
        camp.lastSeen = new Date().toISOString();
        camp.uniqueSessions.add(sid);

        if (!this.#sessionActiveCampaigns.has(sid)) {
            this.#sessionActiveCampaigns.set(sid, new Map());
        }

        const sessionCamps = this.#sessionActiveCampaigns.get(sid);
        sessionCamps.set(cid, {
            campaignId: cid,
            trackingSpec: trackingSpec || {},
            injectedTurn: turnNumber,
            lastRenderedTurn: null,
            isRenderedInCurrentCycle: false,
            engagedTurns: new Set(),
            converted: false,
        });

        this.#pushEvent({
            type: 'injected',
            sessionId: sid,
            campaignId: cid,
            turnNumber,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Analisa o texto retornado pelo LLM para verificar se os renderPatterns deram match.
     *
     * @param {object} params
     * @param {import('../AgenticCore').AgenticCore} params.agent
     * @param {string} params.sessionId
     * @param {string} params.responseText
     * @param {number} [params.turnNumber=0]
     * @returns {string[]} IDs das campanhas que foram renderizadas com sucesso nesta resposta
     */
    recordTurnResponse({ agent, sessionId, responseText, turnResponseText, turnNumber = 0 }) {
        const text = responseText || turnResponseText;
        if (!this.#enabled || !text) return [];

        const sid = String(sessionId);
        const sessionCamps = this.#sessionActiveCampaigns.get(sid);
        if (!sessionCamps || sessionCamps.size === 0) return [];

        const normalizedResponse = text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        const renderedCampaignIds = [];

        for (const [cid, state] of sessionCamps.entries()) {
            const spec = state.trackingSpec;
            const patterns = spec.renderPatterns || [];

            let matchedPattern = null;
            for (const pat of patterns) {
                if (pat instanceof RegExp) {
                    if (pat.test(responseText) || pat.test(normalizedResponse)) {
                        matchedPattern = pat.toString();
                        break;
                    }
                } else if (typeof pat === 'string') {
                    const normPat = pat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    if (normalizedResponse.includes(normPat)) {
                        matchedPattern = pat;
                        break;
                    }
                }
            }

            if (matchedPattern) {
                const camp = this.#getOrCreateCampaign(cid);
                camp.renders += 1;
                camp.lastSeen = new Date().toISOString();

                state.lastRenderedTurn = turnNumber;
                state.isRenderedInCurrentCycle = true;
                renderedCampaignIds.push(cid);

                this.#pushEvent({
                    type: 'rendered',
                    sessionId: sid,
                    campaignId: cid,
                    matchedPattern,
                    turnNumber,
                    timestamp: new Date().toISOString(),
                });

                agent?.emit?.(AgentEvents.INJECTION_RENDERED, {
                    sessionId: sid,
                    campaignId: cid,
                    pattern: matchedPattern,
                    turnNumber,
                    responseText,
                });
            }
        }

        return renderedCampaignIds;
    }

    /**
     * Avalia a mensagem do usuário no turno seguinte para verificar se houve engajamento
     * com campanhas recentemente renderizadas.
     *
     * @param {object} params
     * @param {import('../AgenticCore').AgenticCore} params.agent
     * @param {string} params.sessionId
     * @param {string} params.userText
     * @param {number} [params.turnNumber=0]
     * @returns {string[]} IDs das campanhas com as quais o usuário engajou
     */
    recordUserFollowUp({ agent, sessionId, userText, turnNumber = 0 }) {
        if (!this.#enabled || !userText) return [];

        const sid = String(sessionId);
        const sessionCamps = this.#sessionActiveCampaigns.get(sid);
        if (!sessionCamps || sessionCamps.size === 0) return [];

        const normalizedUser = userText
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        const engagedCampaignIds = [];

        for (const [cid, state] of sessionCamps.entries()) {
            // Só considera engajamento se a campanha foi renderizada recentemente (no turno anterior ou no ciclo ativo)
            if (state.lastRenderedTurn === null) continue;

            const spec = state.trackingSpec;
            const engagementPatterns = spec.engagementPatterns || spec.renderPatterns || [];

            let matchedPattern = null;
            for (const pat of engagementPatterns) {
                if (pat instanceof RegExp) {
                    if (pat.test(userText) || pat.test(normalizedUser)) {
                        matchedPattern = pat.toString();
                        break;
                    }
                } else if (typeof pat === 'string') {
                    const normPat = pat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    if (normalizedUser.includes(normPat)) {
                        matchedPattern = pat;
                        break;
                    }
                }
            }

            if (matchedPattern && !state.engagedTurns.has(turnNumber)) {
                state.engagedTurns.add(turnNumber);
                const camp = this.#getOrCreateCampaign(cid);
                camp.engagements += 1;
                camp.lastSeen = new Date().toISOString();

                engagedCampaignIds.push(cid);

                this.#pushEvent({
                    type: 'engaged',
                    sessionId: sid,
                    campaignId: cid,
                    matchedPattern,
                    turnNumber,
                    timestamp: new Date().toISOString(),
                });

                agent?.emit?.(AgentEvents.INJECTION_ENGAGED, {
                    sessionId: sid,
                    campaignId: cid,
                    pattern: matchedPattern,
                    userText,
                    turnNumber,
                });

                // Retroalimenta recompensa de engajamento no motor de experimentos A/B (Multi-Armed Bandit)
                if (agent?.experimentEngine && spec?.experimentId && spec?.variantId) {
                    const rewardVal = spec.engagementReward ?? 0.3;
                    agent.experimentEngine.recordReward(spec.experimentId, spec.variantId, rewardVal, 'engagement');
                }
            }
        }

        return engagedCampaignIds;
    }

    /**
     * Registra uma conversão bem-sucedida associada a uma campanha.
     *
     * @param {object} params
     * @param {import('../AgenticCore').AgenticCore} params.agent
     * @param {string} params.sessionId
     * @param {string} [params.campaignId] Se omitido, tenta converter a campanha renderizada ativa
     * @param {string} [params.toolName]
     * @param {string} [params.reason='tool_executed']
     */
    recordConversion({ agent, sessionId, campaignId, toolName, reason = 'goal_achieved' }) {
        if (!this.#enabled) return;

        const sid = String(sessionId);
        const sessionCamps = this.#sessionActiveCampaigns.get(sid);

        let targetCampaignId = campaignId;

        // Se nenhum campaignId foi especificado, procura pela campanha ativa na sessão
        if (!targetCampaignId && sessionCamps) {
            for (const [cid, state] of sessionCamps.entries()) {
                if (state.lastRenderedTurn !== null && !state.converted) {
                    if (toolName && state.trackingSpec?.conversionTool) {
                        if (state.trackingSpec.conversionTool === toolName) {
                            targetCampaignId = cid;
                            break;
                        }
                    } else {
                        targetCampaignId = cid;
                        break;
                    }
                }
            }
        }

        if (!targetCampaignId) return;

        const camp = this.#getOrCreateCampaign(targetCampaignId);
        camp.conversions += 1;
        camp.lastSeen = new Date().toISOString();

        if (sessionCamps && sessionCamps.has(targetCampaignId)) {
            sessionCamps.get(targetCampaignId).converted = true;
        }

        this.#pushEvent({
            type: 'converted',
            sessionId: sid,
            campaignId: targetCampaignId,
            toolName: toolName || null,
            reason,
            timestamp: new Date().toISOString(),
        });

        agent?.emit?.(AgentEvents.INJECTION_CONVERTED, {
            sessionId: sid,
            campaignId: targetCampaignId,
            toolName: toolName || null,
            reason,
        });

        // Retroalimenta recompensa de conversão no motor de experimentos A/B (Multi-Armed Bandit)
        const activeState = sessionCamps?.get(targetCampaignId);
        if (agent?.experimentEngine && activeState?.trackingSpec?.experimentId && activeState?.trackingSpec?.variantId) {
            const spec = activeState.trackingSpec;
            const rewardVal = spec.conversionReward ?? 1.0;
            agent.experimentEngine.recordReward(spec.experimentId, spec.variantId, rewardVal, 'conversion');
        }
    }

    /**
     * Retorna métricas consolidadas de todas as campanhas ou de uma específica.
     * @param {string} [campaignId]
     * @returns {object|object[]}
     */
    getMetrics(campaignId) {
        const computeMetrics = (c) => {
            const renderRate = c.injections > 0 ? (c.renders / c.injections) * 100 : 0;
            const engagementRate = c.renders > 0 ? (c.engagements / c.renders) * 100 : 0;
            const conversionRate = c.renders > 0 ? (c.conversions / c.renders) * 100 : 0;

            return {
                campaignId: c.campaignId,
                injections: c.injections,
                renders: c.renders,
                engagements: c.engagements,
                conversions: c.conversions,
                uniqueSessions: c.uniqueSessions.size,
                renderRate: Number(renderRate.toFixed(1)),
                engagementRate: Number(engagementRate.toFixed(1)),
                conversionRate: Number(conversionRate.toFixed(1)),
                firstSeen: c.firstSeen,
                lastSeen: c.lastSeen,
            };
        };

        if (campaignId) {
            const entry = this.#campaigns.get(String(campaignId).trim());
            return entry ? computeMetrics(entry) : null;
        }

        return Array.from(this.#campaigns.values()).map(computeMetrics);
    }

    /**
     * Gera um relatório analítico formatado em Markdown pronto para dashboards, logs ou PRs.
     * @returns {string}
     */
    generateMarkdownReport() {
        const list = this.getMetrics();
        if (list.length === 0) {
            return '### 📊 Relatório de Campanhas Conversacionais\n\n*Nenhuma campanha registrada no período.*';
        }

        let md = '### 📊 Relatório de Desempenho de Campanhas Conversacionais\n\n';
        md += '| Campanha | Injeções | Exibições (Render) | Taxa Exibição | Engajamentos (CTR) | Taxa Engajamento | Conversões | CVR |\n';
        md += '|---|---|---|---|---|---|---|---|\n';

        for (const m of list) {
            md += `| \`${m.campaignId}\` | ${m.injections} | ${m.renders} | ${m.renderRate}% | ${m.engagements} | **${m.engagementRate}%** | ${m.conversions} | **${m.conversionRate}%** |\n`;
        }

        const totalInjections = list.reduce((acc, m) => acc + m.injections, 0);
        const totalRenders = list.reduce((acc, m) => acc + m.renders, 0);
        const totalEngagements = list.reduce((acc, m) => acc + m.engagements, 0);
        const totalConversions = list.reduce((acc, m) => acc + m.conversions, 0);

        md += '\n';
        md += `**Totais Consolidados:** ${totalInjections} injeções, ${totalRenders} exibições pelo LLM, ${totalEngagements} interações de clientes e ${totalConversions} conversões finais.\n`;

        return md;
    }

    /**
     * Limpa histórico e métricas acumuladas.
     */
    reset() {
        this.#campaigns.clear();
        this.#sessionActiveCampaigns.clear();
        this.#eventsHistory = [];
    }

    /**
     * @private
     * @param {object} event
     */
    #pushEvent(event) {
        this.#eventsHistory.push(event);
        if (this.#eventsHistory.length > this.#maxEvents) {
            this.#eventsHistory.shift();
        }
    }
}

module.exports = { CampaignAnalyticsEngine };
