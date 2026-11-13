/**
 * Topologia de Colaboração em Quadro Compartilhado (Blackboard Topology) para AgentSwarm.
 * Os agentes operam de maneira autônoma e concorrente sobre o SharedBlackboard:
 * - Inspecionam o estado e dados publicados por outros membros.
 * - Publicam seus achados e atualizações.
 * - Iteram rodada a rodada até que a condição de parada (`isComplete`) seja atingida ou o teto de rodadas (`maxRounds`).
 */
class BlackboardTopology {
    #maxRounds;
    #isComplete;
    #options;

    /**
     * @param {Object} [options={}]
     * @param {number} [options.maxRounds=3] - Número máximo de rodadas de colaboração.
     * @param {Function} [options.isComplete] - Função verificadora de parada: (blackboard, round) => boolean.
     * @param {Function} [options.formatMemberInput] - Formatador do prompt para cada membro: (member, blackboard, round) => input.
     * @param {Function} [options.synthesizer] - Síntese final opcional dos dados do quadro.
     */
    constructor(options = {}) {
        this.#maxRounds = options.maxRounds || 3;
        this.#isComplete = typeof options.isComplete === 'function' ? options.isComplete : null;
        this.#options = options;
    }

    get name() {
        return 'blackboard';
    }

    /**
     * Executa a colaboração distribuída sobre o quadro compartilhado.
     * @param {Object} params
     * @param {*} params.input - Dado inicial ou objetivo.
     * @param {Map<string, SwarmMember>} params.members - Membros do enxame.
     * @param {SwarmMessageBus} params.bus - Barramento de mensagens.
     * @param {SharedBlackboard} params.blackboard - Quadro compartilhado.
     * @param {EventEmitter} params.emitter - Emissor de eventos do swarm.
     * @returns {Promise<Object>}
     */
    async execute({ input, members, bus, blackboard, emitter }) {
        const startTime = Date.now();
        blackboard.set('goal', input, { updatedBy: 'blackboard_init' });

        const roundsHistory = [];

        for (let round = 1; round <= this.#maxRounds; round++) {
            const roundStartTime = Date.now();
            const roundActions = [];

            // Dispara rodada para todos os membros aptos em paralelo ou sequência cooperativa
            for (const [memberId, member] of members.entries()) {
                const memberInput = typeof this.#options.formatMemberInput === 'function'
                    ? this.#options.formatMemberInput(member, blackboard, round)
                    : {
                          goal: input,
                          round,
                          currentBlackboard: blackboard.snapshot()
                      };

                emitter?.emit('swarm:task_dispatched', {
                    taskId: `round-${round}-${memberId}`,
                    round,
                    assignedTo: memberId
                });

                bus?.send('blackboard', memberId, memberInput, { topic: 'round_start', round });

                try {
                    const output = await member.execute(memberInput, { round, blackboard });
                    const record = {
                        round,
                        memberId,
                        role: member.role,
                        output,
                        timestamp: Date.now()
                    };

                    roundActions.push(record);
                    blackboard.set(`member_${memberId}_round_${round}`, output, { updatedBy: memberId });
                    blackboard.appendToList('contributions', record, { updatedBy: memberId });

                    bus?.send(memberId, 'blackboard', output, { topic: 'contribution', round });
                    emitter?.emit('swarm:task_completed', {
                        taskId: `round-${round}-${memberId}`,
                        completedBy: memberId,
                        output
                    });
                } catch (err) {
                    roundActions.push({
                        round,
                        memberId,
                        role: member.role,
                        error: err.message,
                        timestamp: Date.now()
                    });
                }
            }

            roundsHistory.push({
                round,
                durationMs: Date.now() - roundStartTime,
                actions: roundActions
            });

            // Verifica se a condição de término customizada foi satisfeita
            if (this.#isComplete && this.#isComplete(blackboard, round)) {
                break;
            }
        }

        // Síntese final
        let finalOutput;
        if (typeof this.#options.synthesizer === 'function') {
            finalOutput = await this.#options.synthesizer(blackboard, roundsHistory);
        } else {
            finalOutput = blackboard.snapshot();
        }

        blackboard.set('final_output', finalOutput, { updatedBy: 'blackboard_finish' });

        return {
            finalOutput,
            rounds: roundsHistory,
            blackboard: blackboard.snapshot(),
            totalDurationMs: Date.now() - startTime
        };
    }
}

module.exports = BlackboardTopology;

