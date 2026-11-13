/**
 * Avaliador Algorítmico de Trajetória e Eficiência de Agentes de IA (TrajectoryEvaluator - v4.3).
 * Calcula métricas determinísticas sobre a qualidade da execução:
 * - Goal Completion Rate (GCR)
 * - Trajectory Alignment (Similaridade com Golden Trajectory)
 * - Loop Detection Score (Detecção de armadilhas cognitivas e chamadas repetitivas)
 * - Token & Step Efficiency (Relação de custo computacional por objetivo)
 */
class TrajectoryEvaluator {
    /**
     * Avalia se a resposta final atingiu o objetivo funcional esperado.
     * @param {*} output - Resposta do agente (string ou objeto).
     * @param {Object} criteria - Critérios esperados.
     * @returns {{ passed: boolean, score: number, failures: string[] }}
     */
    static evaluateGoal(output, criteria = {}) {
        const text = typeof output === 'string' ? output : JSON.stringify(output || '');
        const failures = [];
        let checksCount = 0;
        let checksPassed = 0;

        // 1. Strings obrigatórias
        if (criteria.expectedContains && Array.isArray(criteria.expectedContains)) {
            for (const sub of criteria.expectedContains) {
                checksCount++;
                if (text.toLowerCase().includes(String(sub).toLowerCase())) {
                    checksPassed++;
                } else {
                    failures.push(`A resposta não contém o termo esperado: "${sub}".`);
                }
            }
        }

        // 2. Termos proibidos (ex: recusas, vazamentos de prompt)
        if (criteria.forbiddenContains && Array.isArray(criteria.forbiddenContains)) {
            for (const forbidden of criteria.forbiddenContains) {
                checksCount++;
                if (text.toLowerCase().includes(String(forbidden).toLowerCase())) {
                    failures.push(`A resposta contém termo proibido: "${forbidden}".`);
                } else {
                    checksPassed++;
                }
            }
        }

        // 3. Padrão Regex
        if (criteria.expectedPattern instanceof RegExp) {
            checksCount++;
            if (criteria.expectedPattern.test(text)) {
                checksPassed++;
            } else {
                failures.push(`A resposta não correspondeu ao padrão regex: ${criteria.expectedPattern}.`);
            }
        }

        // 4. Validador funcional customizado
        if (typeof criteria.validator === 'function') {
            checksCount++;
            try {
                const validRes = criteria.validator(output);
                if (validRes === true || validRes?.passed === true) {
                    checksPassed++;
                } else {
                    failures.push(validRes?.reason || 'Validador funcional rejeitou a saída.');
                }
            } catch (err) {
                failures.push(`Erro durante validação funcional: ${err.message}`);
            }
        }

        const score = checksCount > 0 ? Number((checksPassed / checksCount).toFixed(2)) : (text.length > 0 ? 1.0 : 0.0);
        return {
            passed: failures.length === 0,
            score,
            failures
        };
    }

    /**
     * Avalia o alinhamento da sequência de ferramentas executadas contra a trajetória dourada (Golden Trajectory).
     * @param {Array<string|Object>} actualActions - Ações executadas pelo agente (nomes das tools).
     * @param {Array<string>} goldenTrajectory - Sequência de ferramentas de referência.
     * @returns {{ alignmentScore: number, missingTools: string[], unexpectedTools: string[] }}
     */
    static evaluateTrajectory(actualActions = [], goldenTrajectory = []) {
        if (!Array.isArray(goldenTrajectory) || goldenTrajectory.length === 0) {
            return { alignmentScore: 1.0, missingTools: [], unexpectedTools: [] };
        }

        const actualNames = actualActions.map((a) => (typeof a === 'string' ? a : a.name || a.toolName));
        const missingTools = goldenTrajectory.filter((expected) => !actualNames.includes(expected));
        const unexpectedTools = actualNames.filter((act) => !goldenTrajectory.includes(act));

        // Jaccard similarity sobre os conjuntos de ferramentas
        const setA = new Set(actualNames);
        const setG = new Set(goldenTrajectory);
        const intersection = new Set([...setA].filter((x) => setG.has(x)));
        const union = new Set([...setA, ...setG]);

        const jaccard = union.size > 0 ? intersection.size / union.size : 1.0;

        // Bônus/penalidade de ordem relativa
        let orderMatches = 0;
        let lastIdx = -1;
        for (const exp of goldenTrajectory) {
            const idx = actualNames.indexOf(exp);
            if (idx > lastIdx) {
                orderMatches++;
                lastIdx = idx;
            }
        }
        const orderScore = goldenTrajectory.length > 0 ? orderMatches / goldenTrajectory.length : 1.0;
        const alignmentScore = Number(((jaccard * 0.6) + (orderScore * 0.4)).toFixed(2));

        return {
            alignmentScore,
            missingTools,
            unexpectedTools
        };
    }

    /**
     * Detecta loops de raciocínio, chamadas repetitivas de ferramentas ou parâmetros idênticos.
     * @param {Array<Object>} actionHistory - Histórico de chamadas de ferramentas [{ name, args }].
     * @returns {{ hasLoop: boolean, loopScore: number, loopPatterns: string[] }}
     */
    static detectLoops(actionHistory = []) {
        if (!Array.isArray(actionHistory) || actionHistory.length < 2) {
            return { hasLoop: false, loopScore: 0.0, loopPatterns: [] };
        }

        const loopPatterns = [];
        let duplicateInvocations = 0;

        for (let i = 1; i < actionHistory.length; i++) {
            const curr = actionHistory[i];
            const prev = actionHistory[i - 1];

            const currName = curr.name || curr.toolName;
            const prevName = prev.name || prev.toolName;

            if (currName === prevName) {
                const currArgsStr = JSON.stringify(curr.args || {});
                const prevArgsStr = JSON.stringify(prev.args || {});
                if (currArgsStr === prevArgsStr) {
                    duplicateInvocations++;
                    loopPatterns.push(`Invocação duplicada consecutiva de "${currName}" com os mesmos parâmetros.`);
                }
            }
        }

        const loopRatio = duplicateInvocations / (actionHistory.length - 1);
        const loopScore = Number(Math.min(1.0, loopRatio * 2).toFixed(2));

        return {
            hasLoop: duplicateInvocations > 0,
            loopScore,
            loopPatterns
        };
    }

    /**
     * Avalia a eficiência de tokens e turnos consumidos.
     * @param {Object} metrics - { totalTokens, turnCount }
     * @param {Object} limits - { maxAllowedTokens, maxAllowedTurns }
     * @returns {{ tokenEfficiency: number, stepEfficiency: number, withinLimits: boolean }}
     */
    static evaluateEfficiency(metrics = {}, limits = {}) {
        const tokens = metrics.totalTokens || 0;
        const turns = metrics.turnCount || 1;
        const maxTokens = limits.maxAllowedTokens || 4000;
        const maxTurns = limits.maxAllowedTurns || 5;

        const tokenEfficiency = Number(Math.max(0, 1 - (tokens / (maxTokens * 1.5))).toFixed(2));
        const stepEfficiency = Number(Math.max(0, 1 - (turns / (maxTurns * 1.5))).toFixed(2));
        const withinLimits = tokens <= maxTokens && turns <= maxTurns;

        return {
            tokenEfficiency,
            stepEfficiency,
            withinLimits
        };
    }
}

module.exports = TrajectoryEvaluator;

