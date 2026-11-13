/**
 * Topologia de Pipeline Sequencial para AgentSwarm.
 * Encaminha o artefato de entrada através de uma cadeia ordenada de agentes especialistas,
 * onde a saída de cada membro se torna a entrada (ou contexto enriquecido) do próximo.
 */
class PipelineTopology {
    #stages; // Array de IDs de membros ordenados
    #options;

    /**
     * @param {Object} [options={}]
     * @param {string[]} [options.stages=[]] - Lista ordenada de IDs dos membros a executar. Se omitido, executa todos na ordem de registro.
     * @param {Function} [options.transformInput] - Função opcional para transformar dados entre estágios: (output, nextStage, context) => transformedInput.
     */
    constructor(options = {}) {
        this.#stages = options.stages ? [...options.stages] : null;
        this.#options = options;
    }

    get name() {
        return 'pipeline';
    }

    /**
     * Executa o pipeline com os membros do swarm.
     * @param {Object} params
     * @param {*} params.input - Dado inicial ou objetivo.
     * @param {Map<string, SwarmMember>} params.members - Mapa de membros do swarm.
     * @param {SwarmMessageBus} params.bus - Barramento de mensagens.
     * @param {SharedBlackboard} params.blackboard - Quadro compartilhado.
     * @param {EventEmitter} params.emitter - Emissor de eventos do swarm.
     * @returns {Promise<Object>} Resultado final e histórico por estágio.
     */
    async execute({ input, members, bus, blackboard, emitter }) {
        const stageIds = this.#stages || Array.from(members.keys());
        if (stageIds.length === 0) {
            throw new Error('PipelineTopology não possui estágios/membros cadastrados para execução.');
        }

        let currentPayload = input;
        const stageResults = [];
        const startTime = Date.now();

        blackboard.set('pipeline_input', input, { updatedBy: 'pipeline' });

        for (let i = 0; i < stageIds.length; i++) {
            const memberId = stageIds[i];
            const member = members.get(memberId);
            if (!member) {
                throw new Error(`PipelineTopology: Membro "${memberId}" não encontrado no Swarm.`);
            }

            const stageStartTime = Date.now();
            emitter?.emit('swarm:task_dispatched', {
                taskId: `stage-${i + 1}-${memberId}`,
                stageIndex: i,
                assignedTo: memberId,
                input: currentPayload
            });

            bus?.send('pipeline', memberId, currentPayload, { topic: 'stage_input', stageIndex: i });

            let stageInput = currentPayload;
            if (typeof this.#options.transformInput === 'function') {
                stageInput = this.#options.transformInput(currentPayload, memberId, {
                    stageIndex: i,
                    stageResults,
                    blackboard
                });
            }

            const output = await member.execute(stageInput, {
                stageIndex: i,
                pipelineInput: input,
                previousResults: stageResults
            });

            const durationMs = Date.now() - stageStartTime;
            const stageRecord = {
                stageIndex: i,
                memberId,
                role: member.role,
                input: stageInput,
                output,
                durationMs
            };

            stageResults.push(stageRecord);
            blackboard.set(`pipeline_stage_${i}_${memberId}`, output, { updatedBy: memberId });
            blackboard.appendToList('pipeline_history', stageRecord, { updatedBy: memberId });

            bus?.send(memberId, 'pipeline', output, { topic: 'stage_output', stageIndex: i });
            emitter?.emit('swarm:task_completed', {
                taskId: `stage-${i + 1}-${memberId}`,
                completedBy: memberId,
                durationMs,
                output
            });

            currentPayload = output;
        }

        blackboard.set('pipeline_final_output', currentPayload, { updatedBy: 'pipeline' });

        return {
            finalOutput: currentPayload,
            stages: stageResults,
            totalDurationMs: Date.now() - startTime
        };
    }
}

module.exports = PipelineTopology;

