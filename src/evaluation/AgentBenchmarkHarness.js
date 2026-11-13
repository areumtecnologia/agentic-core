const { EventEmitter } = require('events');
const TrajectoryEvaluator = require('./TrajectoryEvaluator');
const EvalReportGenerator = require('./EvalReportGenerator');

/**
 * Harness de Benchmark e Regressão Contínua para Agentes de IA (AgentBenchmarkHarness - v4.3).
 * Executa baterias de cenários em pipelines de CI/CD para assegurar qualidade,
 * ausência de loops cognitivos e atingimento funcional de objetivos.
 */
class AgentBenchmarkHarness extends EventEmitter {
    #agentFactory;
    #scenarios = [];
    #suiteName;
    #options;

    /**
     * @param {Object} options
     * @param {Function} [options.agentFactory] - Função que cria uma nova instância de AgenticCore para cada cenário: () => agent.
     * @param {Object} [options.agent] - Instância de AgenticCore fixa (reaproveitada com sessões isoladas se factory não for informada).
     * @param {Array<Object>} [options.scenarios=[]] - Lista de cenários de teste a executar.
     * @param {string} [options.suiteName='Agent Regression Suite'] - Nome da suíte para relatórios.
     */
    constructor(options = {}) {
        super();
        this.#agentFactory = options.agentFactory || (options.agent ? () => options.agent : null);
        if (!this.#agentFactory) {
            throw new Error('AgentBenchmarkHarness requer a propriedade "agentFactory" ou "agent".');
        }
        this.#scenarios = Array.isArray(options.scenarios) ? [...options.scenarios] : [];
        this.#suiteName = options.suiteName || 'Agent Regression Suite';
        this.#options = options;
    }

    get suiteName() {
        return this.#suiteName;
    }

    get scenarios() {
        return [...this.#scenarios];
    }

    /**
     * Adiciona um cenário de teste à suíte.
     * @param {Object} scenario
     */
    addScenario(scenario) {
        if (!scenario || !scenario.id || !scenario.prompt) {
            throw new Error('Cenário deve possuir ao menos "id" e "prompt".');
        }
        this.#scenarios.push(scenario);
    }

    /**
     * Executa todos os cenários da suíte e compila o relatório final.
     * @returns {Promise<Object>} Resultado consolidado com relatórios em Markdown e JSON.
     */
    async run() {
        if (this.#scenarios.length === 0) {
            throw new Error('Nenhum cenário configurado para execução no AgentBenchmarkHarness.');
        }

        const suiteStartTime = Date.now();
        this.emit('eval:suite_started', {
            suiteName: this.#suiteName,
            scenariosCount: this.#scenarios.length
        });

        const evaluatedScenarios = [];
        let totalTokensAccumulated = 0;

        for (let i = 0; i < this.#scenarios.length; i++) {
            const scenario = this.#scenarios[i];
            const scResult = await this.runScenario(scenario);
            evaluatedScenarios.push(scResult);

            if (scResult.tokenUsage?.total) {
                totalTokensAccumulated += scResult.tokenUsage.total;
            }

            this.emit('eval:scenario_completed', scResult);
        }

        const totalDurationMs = Date.now() - suiteStartTime;
        const totalScenarios = evaluatedScenarios.length;
        const passedScenarios = evaluatedScenarios.filter((s) => s.passed).length;
        const failedScenarios = totalScenarios - passedScenarios;
        const passRate = totalScenarios > 0 ? Math.round((passedScenarios / totalScenarios) * 100) : 0;
        const averageTokenUsage = totalScenarios > 0 ? Math.round(totalTokensAccumulated / totalScenarios) : 0;

        const summary = {
            suiteName: this.#suiteName,
            totalScenarios,
            passedScenarios,
            failedScenarios,
            passRate,
            totalDurationMs,
            averageTokenUsage,
            scenarios: evaluatedScenarios
        };

        const markdownSummary = EvalReportGenerator.generateMarkdown(summary);
        const jsonSummary = EvalReportGenerator.generateJson(summary);

        const finalResult = {
            ...summary,
            markdownSummary,
            jsonSummary
        };

        this.emit('eval:suite_completed', finalResult);
        return finalResult;
    }

    /**
     * Executa um cenário individualmente.
     * @param {Object} scenario
     * @returns {Promise<Object>}
     */
    async runScenario(scenario) {
        const scenarioStartTime = Date.now();
        const agent = this.#agentFactory();
        const sessionId = `eval-${scenario.id}-${Date.now()}`;

        // Rastreamento de ações do agente durante o cenário
        const actionsTaken = [];
        let tokenUsage = { prompt: 0, completion: 0, total: 0 };
        let finishReason = null;

        const onToolCall = ({ name, args }) => {
            actionsTaken.push({ name, args, timestamp: Date.now() });
        };

        if (typeof agent.on === 'function') {
            agent.on('tool_call', onToolCall);
        }

        let agentOutput;
        let executionError = null;

        try {
            if (typeof agent.processMessage === 'function') {
                const responseObj = await agent.processMessage(sessionId, scenario.prompt);
                agentOutput = responseObj?.response !== undefined ? responseObj.response : responseObj;
                if (responseObj?.usageMetadata) {
                    tokenUsage = {
                        prompt: responseObj.usageMetadata.promptTokenCount || 0,
                        completion: responseObj.usageMetadata.candidatesTokenCount || 0,
                        total: responseObj.usageMetadata.totalTokenCount || 0
                    };
                }
                finishReason = responseObj?.finish_reason || responseObj?.finishReason;
            } else if (typeof agent === 'function') {
                agentOutput = await agent(scenario.prompt, { sessionId });
            } else {
                throw new Error('O agente fornecido não possui método processMessage().');
            }
        } catch (err) {
            executionError = err;
        } finally {
            if (typeof agent.off === 'function') {
                agent.off('tool_call', onToolCall);
            }
        }

        const durationMs = Date.now() - scenarioStartTime;

        if (executionError) {
            return {
                id: scenario.id,
                name: scenario.name || scenario.id,
                passed: false,
                durationMs,
                error: executionError.message,
                failures: [`Erro durante execução do agente: ${executionError.message}`],
                metrics: { goalScore: 0.0, alignmentScore: 0.0, hasLoop: false, loopScore: 0.0 }
            };
        }

        // Avaliação de métricas
        const goalResult = TrajectoryEvaluator.evaluateGoal(agentOutput, {
            expectedContains: scenario.expectedContains,
            forbiddenContains: scenario.forbiddenContains,
            expectedPattern: scenario.expectedPattern,
            validator: scenario.validator
        });

        const trajectoryResult = TrajectoryEvaluator.evaluateTrajectory(actionsTaken, scenario.goldenTrajectory);
        const loopResult = TrajectoryEvaluator.detectLoops(actionsTaken);
        const efficiencyResult = TrajectoryEvaluator.evaluateEfficiency(
            { totalTokens: tokenUsage.total, turnCount: actionsTaken.length + 1 },
            { maxAllowedTokens: scenario.maxAllowedTokens, maxAllowedTurns: scenario.maxAllowedTurns }
        );

        const allFailures = [...goalResult.failures];
        if (loopResult.hasLoop) {
            allFailures.push(...loopResult.loopPatterns);
        }
        if (trajectoryResult.missingTools.length > 0) {
            allFailures.push(`Trajetória incompleta: ausência de [${trajectoryResult.missingTools.join(', ')}].`);
        }

        const passed = goalResult.passed && !loopResult.hasLoop && trajectoryResult.missingTools.length === 0;

        return {
            id: scenario.id,
            name: scenario.name || scenario.id,
            passed,
            output: agentOutput,
            durationMs,
            tokenUsage,
            finishReason,
            turns: actionsTaken.length + 1,
            failures: allFailures,
            metrics: {
                goalScore: goalResult.score,
                alignmentScore: trajectoryResult.alignmentScore,
                missingTools: trajectoryResult.missingTools,
                unexpectedTools: trajectoryResult.unexpectedTools,
                hasLoop: loopResult.hasLoop,
                loopScore: loopResult.loopScore,
                loopPatterns: loopResult.loopPatterns,
                tokenEfficiency: efficiencyResult.tokenEfficiency,
                stepEfficiency: efficiencyResult.stepEfficiency
            }
        };
    }
}

module.exports = AgentBenchmarkHarness;

