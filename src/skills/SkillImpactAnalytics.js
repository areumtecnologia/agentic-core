'use strict';

const EventEmitter = require('events');

/**
 * SkillImpactAnalytics
 * Sistema de telemetria, observabilidade e análise de impacto de Skills no AgenticCore.
 * Monitora ativações heurísticas e explícitas, tempo de resposta de scripts, taxas de sucesso,
 * consumo de tokens associado e eficiência geral por skill.
 */
class SkillImpactAnalytics extends EventEmitter {
    /**
     * @param {object} [options]
     * @param {boolean} [options.enabled=true] Se a coleta de telemetria está habilitada
     * @param {number} [options.maxEvents=500] Limite máximo de histórico de eventos em memória
     */
    constructor({ enabled = true, maxEvents = 500 } = {}) {
        super();
        this.enabled = Boolean(enabled);
        this.maxEvents = Number(maxEvents) || 500;

        /** @type {Map<string, object>} */
        this.skillsData = new Map();
        /** @type {Array<object>} */
        this.eventsHistory = [];
        this.globalStats = {
            totalActivations: 0,
            totalExecutions: 0,
            totalExecutionSuccesses: 0,
            totalExecutionFailures: 0,
            totalExecutionDurationMs: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalTokens: 0,
        };
    }

    /**
     * Retorna ou inicializa o registro de métricas de uma skill específica.
     * @private
     * @param {string} skillName
     * @returns {object}
     */
    _getOrCreateSkillEntry(skillName) {
        if (!this.skillsData.has(skillName)) {
            this.skillsData.set(skillName, {
                skillName,
                firstSeen: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                activations: {
                    total: 0,
                    preTurnAuto: 0,
                    explicitLoad: 0,
                    subAgent: 0,
                    other: 0,
                },
                executions: {
                    total: 0,
                    successes: 0,
                    failures: 0,
                    totalDurationMs: 0,
                    minDurationMs: null,
                    maxDurationMs: null,
                },
                tokens: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                },
                turnsAssisted: 0,
                sessions: new Set(),
            });
        }
        return this.skillsData.get(skillName);
    }

    /**
     * Adiciona um evento ao histórico limitado em anel.
     * @private
     * @param {object} event
     */
    _pushEvent(event) {
        if (this.eventsHistory.length >= this.maxEvents) {
            this.eventsHistory.shift();
        }
        this.eventsHistory.push(event);
    }

    /**
     * Registra uma ativação de skill (seja no Turno 0, via tool skills_load ou via SkillSubAgent).
     * @param {object} params
     * @param {string} params.skillName Nome da skill
     * @param {'pre_turn_auto'|'explicit_load'|'sub_agent'|string} [params.type='explicit_load'] Tipo de ativação
     * @param {number} [params.score] Score de correspondência se aplicável
     * @param {string} [params.sessionId] ID da sessão
     * @param {object} [params.metadata] Metadados contextuais adicionais
     */
    recordActivation({
        skillName,
        type = 'explicit_load',
        score = null,
        sessionId = null,
        metadata = {},
    } = {}) {
        if (!this.enabled || !skillName) return;

        const entry = this._getOrCreateSkillEntry(skillName);
        entry.lastUsed = new Date().toISOString();
        entry.activations.total += 1;

        if (type === 'pre_turn_auto') {
            entry.activations.preTurnAuto += 1;
        } else if (type === 'explicit_load') {
            entry.activations.explicitLoad += 1;
        } else if (type === 'sub_agent') {
            entry.activations.subAgent += 1;
        } else {
            entry.activations.other += 1;
        }

        if (sessionId) {
            entry.sessions.add(sessionId);
        }

        this.globalStats.totalActivations += 1;

        const record = {
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            eventType: 'activation',
            skillName,
            type,
            score,
            sessionId,
            timestamp: new Date().toISOString(),
            metadata,
        };

        this._pushEvent(record);
        this.emit('metric:recorded', { eventType: 'activation', skillName, record });
        return record;
    }

    /**
     * Registra a execução de um script auxiliar da skill.
     * @param {object} params
     * @param {string} params.skillName Nome da skill
     * @param {string} params.scriptName Nome do script executado
     * @param {number} params.durationMs Duração em milissegundos
     * @param {boolean} params.success Se executou com sucesso (exitCode 0)
     * @param {number} [params.exitCode=0] Código de saída do processo
     * @param {string} [params.error] Mensagem de erro em caso de falha
     * @param {object} [params.metadata] Metadados contextuais adicionais
     */
    recordExecution({
        skillName,
        scriptName,
        durationMs = 0,
        success = true,
        exitCode = 0,
        error = null,
        metadata = {},
    } = {}) {
        if (!this.enabled || !skillName) return;

        const entry = this._getOrCreateSkillEntry(skillName);
        entry.lastUsed = new Date().toISOString();
        entry.executions.total += 1;
        entry.executions.totalDurationMs += durationMs;

        if (success) {
            entry.executions.successes += 1;
            this.globalStats.totalExecutionSuccesses += 1;
        } else {
            entry.executions.failures += 1;
            this.globalStats.totalExecutionFailures += 1;
        }

        if (entry.executions.minDurationMs === null || durationMs < entry.executions.minDurationMs) {
            entry.executions.minDurationMs = durationMs;
        }
        if (entry.executions.maxDurationMs === null || durationMs > entry.executions.maxDurationMs) {
            entry.executions.maxDurationMs = durationMs;
        }

        this.globalStats.totalExecutions += 1;
        this.globalStats.totalExecutionDurationMs += durationMs;

        const record = {
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            eventType: 'execution',
            skillName,
            scriptName,
            durationMs,
            success,
            exitCode,
            error,
            timestamp: new Date().toISOString(),
            metadata,
        };

        this._pushEvent(record);
        this.emit('metric:recorded', { eventType: 'execution', skillName, record });
        return record;
    }

    /**
     * Registra impacto de tokens e turnos quando a skill participou da resposta do agente.
     * @param {object} params
     * @param {string} params.skillName
     * @param {string} [params.sessionId]
     * @param {number} [params.promptTokens=0]
     * @param {number} [params.completionTokens=0]
     * @param {number} [params.totalTokens=0]
     * @param {number} [params.durationMs=0]
     * @param {boolean} [params.success=true]
     */
    recordTurnUsage({
        skillName,
        sessionId = null,
        promptTokens = 0,
        completionTokens = 0,
        totalTokens = 0,
        durationMs = 0,
        success = true,
    } = {}) {
        if (!this.enabled || !skillName) return;

        const entry = this._getOrCreateSkillEntry(skillName);
        entry.lastUsed = new Date().toISOString();
        entry.turnsAssisted += 1;

        const p = Number(promptTokens) || 0;
        const c = Number(completionTokens) || 0;
        const t = Number(totalTokens) || (p + c);

        entry.tokens.promptTokens += p;
        entry.tokens.completionTokens += c;
        entry.tokens.totalTokens += t;

        this.globalStats.totalPromptTokens += p;
        this.globalStats.totalCompletionTokens += c;
        this.globalStats.totalTokens += t;

        if (sessionId) {
            entry.sessions.add(sessionId);
        }

        const record = {
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            eventType: 'turn_usage',
            skillName,
            sessionId,
            tokens: { prompt: p, completion: c, total: t },
            durationMs,
            success,
            timestamp: new Date().toISOString(),
        };

        this._pushEvent(record);
        this.emit('metric:recorded', { eventType: 'turn_usage', skillName, record });
        return record;
    }

    /**
     * Calcula o score composto de eficiência de uma skill (0 a 100).
     * Ponderação:
     * - 50% Taxa de sucesso na execução de scripts
     * - 25% Latência de execução (scripts mais rápidos = maior pontuação)
     * - 25% Frequência de ativação e estabilidade de turnos
     * @private
     * @param {object} entry
     * @returns {number}
     */
    _calculateEfficiencyScore(entry) {
        if (!entry) return 100;

        let score = 100;

        // Fator 1: Falhas em scripts
        if (entry.executions.total > 0) {
            const successRate = (entry.executions.successes / entry.executions.total);
            score = score * 0.5 + (successRate * 100) * 0.5;

            // Fator 2: Penalidade por latência excessiva (acima de 2.000ms reduz gradualmente)
            const avgMs = entry.executions.totalDurationMs / entry.executions.total;
            if (avgMs > 2000) {
                const latencyPenalty = Math.min(25, Math.floor((avgMs - 2000) / 200));
                score = Math.max(10, score - latencyPenalty);
            }
        }

        return Math.round(Math.min(100, Math.max(0, score)));
    }

    /**
     * Retorna os dados calculados e enriquecidos de uma skill.
     * @param {string} skillName
     * @returns {object|null}
     */
    getSkillMetrics(skillName) {
        if (!skillName || !this.skillsData.has(skillName)) {
            return null;
        }

        const raw = this.skillsData.get(skillName);
        const execTotal = raw.executions.total;
        const avgDuration = execTotal > 0
            ? Math.round((raw.executions.totalDurationMs / execTotal) * 100) / 100
            : 0;
        const successRate = execTotal > 0
            ? Math.round((raw.executions.successes / execTotal) * 1000) / 10
            : 100;

        return {
            skillName: raw.skillName,
            firstSeen: raw.firstSeen,
            lastUsed: raw.lastUsed,
            totalActivations: raw.activations.total,
            activationBreakdown: { ...raw.activations },
            scriptExecutions: {
                total: execTotal,
                successes: raw.executions.successes,
                failures: raw.executions.failures,
                successRatePercent: successRate,
                avgDurationMs: avgDuration,
                minDurationMs: raw.executions.minDurationMs ?? 0,
                maxDurationMs: raw.executions.maxDurationMs ?? 0,
                totalDurationMs: raw.executions.totalDurationMs,
            },
            tokensConsumed: { ...raw.tokens },
            turnsAssisted: raw.turnsAssisted,
            sessionsCount: raw.sessions.size,
            efficiencyScore: this._calculateEfficiencyScore(raw),
        };
    }

    /**
     * Retorna todas as métricas para todas as skills registradas.
     * @returns {object[]}
     */
    getAllMetrics() {
        return Array.from(this.skillsData.keys())
            .map(name => this.getSkillMetrics(name))
            .filter(Boolean);
    }

    /**
     * Retorna visão executiva agregada de todas as skills.
     * @returns {object}
     */
    getSummary() {
        const totalSkills = this.skillsData.size;
        const execs = this.globalStats.totalExecutions;
        const overallSuccessRate = execs > 0
            ? Math.round((this.globalStats.totalExecutionSuccesses / execs) * 1000) / 10
            : 100;
        const avgExecDuration = execs > 0
            ? Math.round((this.globalStats.totalExecutionDurationMs / execs) * 100) / 100
            : 0;

        const all = this.getAllMetrics();
        const topByActivations = [...all].sort((a, b) => b.totalActivations - a.totalActivations).slice(0, 5);
        const topByEfficiency = [...all].sort((a, b) => b.efficiencyScore - a.efficiencyScore).slice(0, 5);

        return {
            totalSkillsTracked: totalSkills,
            totalActivations: this.globalStats.totalActivations,
            totalExecutions: execs,
            overallSuccessRatePercent: overallSuccessRate,
            avgExecutionDurationMs: avgExecDuration,
            tokensConsumed: {
                promptTokens: this.globalStats.totalPromptTokens,
                completionTokens: this.globalStats.totalCompletionTokens,
                totalTokens: this.globalStats.totalTokens,
            },
            topSkillsByActivations: topByActivations.map(s => ({ name: s.skillName, activations: s.totalActivations })),
            topSkillsByEfficiency: topByEfficiency.map(s => ({ name: s.skillName, score: s.efficiencyScore })),
        };
    }

    /**
     * Gera relatório de impacto formatado em Markdown, JSON ou Objeto estruturado.
     * @param {object} [options]
     * @param {'markdown'|'json'|'summary'|'object'} [options.format='markdown'] Formato de saída
     * @param {string} [options.skillName] Opcional para filtrar uma skill específica
     * @returns {string|object}
     */
    generateImpactReport({ format = 'markdown', skillName = null } = {}) {
        const summary = this.getSummary();
        const metrics = skillName
            ? (this.getSkillMetrics(skillName) ? [this.getSkillMetrics(skillName)] : [])
            : this.getAllMetrics();

        const reportData = {
            generatedAt: new Date().toISOString(),
            summary,
            skills: metrics,
        };

        this.emit('report:generated', { format, skillName, reportData });

        if (format === 'json') {
            return JSON.stringify(reportData, null, 2);
        }

        if (format === 'summary') {
            return `Skills Tracked: ${summary.totalSkillsTracked} | Total Activations: ${summary.totalActivations} | Scripts: ${summary.totalExecutions} (${summary.overallSuccessRatePercent}% success) | Tokens: ${summary.tokensConsumed.totalTokens}`;
        }

        if (format === 'object') {
            return reportData;
        }

        // Formato Markdown padrão com tabelas e badges visuais
        const lines = [
            '# 📊 Skill Impact & Efficiency Analytics Report',
            `*Generated at: ${reportData.generatedAt}*`,
            '',
            '## 📈 Executive Summary',
            `- **Total Skills Tracked:** ${summary.totalSkillsTracked}`,
            `- **Total Invocations / Activations:** ${summary.totalActivations}`,
            `- **Script Executions:** ${summary.totalExecutions} (${summary.overallSuccessRatePercent}% success rate)`,
            `- **Average Script Latency:** ${summary.avgExecutionDurationMs} ms`,
            `- **Total Tokens Assisted:** ${summary.tokensConsumed.totalTokens.toLocaleString()}`,
            '',
            '## 📋 Detailed Skill Performance Matrix',
        ];

        if (metrics.length === 0) {
            lines.push('*No skills telemetry recorded yet.*');
        } else {
            lines.push('| Skill Name | Activations (Auto / Load / SubAgent) | Scripts Executed (Success %) | Avg Latency | Tokens | Efficiency Score |');
            lines.push('| :--- | :---: | :---: | :---: | :---: | :---: |');

            for (const item of metrics) {
                const actStr = `${item.totalActivations} (${item.activationBreakdown.preTurnAuto} / ${item.activationBreakdown.explicitLoad} / ${item.activationBreakdown.subAgent})`;
                const execStr = `${item.scriptExecutions.total} (${item.scriptExecutions.successRatePercent}%)`;
                const latStr = `${item.scriptExecutions.avgDurationMs} ms`;
                const tokStr = item.tokensConsumed.totalTokens.toLocaleString();
                const scoreBadge = item.efficiencyScore >= 90 ? `🟢 ${item.efficiencyScore}/100` : item.efficiencyScore >= 70 ? `🟡 ${item.efficiencyScore}/100` : `🔴 ${item.efficiencyScore}/100`;

                lines.push(`| \`${item.skillName}\` | ${actStr} | ${execStr} | ${latStr} | ${tokStr} | ${scoreBadge} |`);
            }
        }

        lines.push('');
        return lines.join('\n');
    }

    /**
     * Reseta as estatísticas acumuladas.
     * @param {string} [skillName] Se fornecido, limpa apenas a skill especificada
     */
    reset(skillName = null) {
        if (skillName) {
            this.skillsData.delete(skillName);
        } else {
            this.skillsData.clear();
            this.eventsHistory = [];
            this.globalStats = {
                totalActivations: 0,
                totalExecutions: 0,
                totalExecutionSuccesses: 0,
                totalExecutionFailures: 0,
                totalExecutionDurationMs: 0,
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
                totalTokens: 0,
            };
        }
    }
}

module.exports = { SkillImpactAnalytics };
