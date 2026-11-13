/**
 * Topologia Supervisor-Workers (Hierárquica) para AgentSwarm.
 * Um agente Líder / Supervisor coordena a execução global:
 * - Avalia a meta do usuário e as capacidades dos membros registrados.
 * - Despacha subtarefas para os especialistas mais qualificados.
 * - Consolida as respostas parciais em uma entrega final unificada.
 */
class SupervisorTopology {
    #supervisor;
    #maxIterations;
    #options;

    /**
     * @param {Object} options
     * @param {Object|Function} options.supervisor - Instância de AgenticCore ou função de coordenação.
     * @param {number} [options.maxIterations=5] - Limite máximo de iterações de delegação.
     * @param {Function} [options.planner] - Planejador opcional para decompor o objetivo em tarefas.
     */
    constructor(options = {}) {
        if (!options.supervisor) {
            throw new Error('SupervisorTopology requer a propriedade "supervisor".');
        }
        this.#supervisor = options.supervisor;
        this.#maxIterations = options.maxIterations || 5;
        this.#options = options;
    }

    get name() {
        return 'supervisor';
    }

    get supervisor() {
        return this.#supervisor;
    }

    /**
     * Executa a orquestração supervisionada.
     * @param {Object} params
     * @param {*} params.input - Meta ou instrução do usuário.
     * @param {Map<string, SwarmMember>} params.members - Membros do enxame.
     * @param {SwarmMessageBus} params.bus - Barramento de mensagens.
     * @param {SharedBlackboard} params.blackboard - Quadro compartilhado.
     * @param {EventEmitter} params.emitter - Emissor de eventos do swarm.
     * @returns {Promise<Object>}
     */
    async execute({ input, members, bus, blackboard, emitter }) {
        const startTime = Date.now();
        blackboard.set('goal', input, { updatedBy: 'supervisor' });

        // Coleta os cartões de capacidades de todos os especialistas disponíveis
        const availableWorkers = Array.from(members.values()).map((m) => m.toCard());
        blackboard.set('available_workers', availableWorkers, { updatedBy: 'supervisor' });

        // 1. Planejamento / Decomposição de tarefas
        const tasks = await this.#planTasks(input, availableWorkers);
        blackboard.set('planned_tasks', tasks, { updatedBy: 'supervisor' });

        const taskResults = [];

        // 2. Despacho e execução das subtarefas
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const workerId = task.assignedTo || this.#findBestWorker(task, members);
            const worker = members.get(workerId);

            if (!worker) {
                throw new Error(`SupervisorTopology: Trabalhador "${workerId}" atribuído à tarefa "${task.id}" não encontrado.`);
            }

            const taskStartTime = Date.now();
            emitter?.emit('swarm:task_dispatched', {
                taskId: task.id || `task-${i + 1}`,
                assignedTo: workerId,
                supervisorId: 'supervisor',
                description: task.description || task.instruction
            });

            bus?.send('supervisor', workerId, task, { topic: 'task_assignment', taskId: task.id });

            const workerOutput = await worker.execute(task.instruction || task.description || task, {
                taskId: task.id,
                supervisorGoal: input,
                blackboardSnapshot: blackboard.snapshot()
            });

            const durationMs = Date.now() - taskStartTime;
            const record = {
                taskId: task.id || `task-${i + 1}`,
                workerId,
                role: worker.role,
                instruction: task.instruction || task.description,
                output: workerOutput,
                durationMs
            };

            taskResults.push(record);
            blackboard.set(`task_result_${task.id || i}`, workerOutput, { updatedBy: workerId });
            blackboard.appendToList('completed_tasks', record, { updatedBy: workerId });

            bus?.send(workerId, 'supervisor', workerOutput, { topic: 'task_result', taskId: task.id });
            emitter?.emit('swarm:task_completed', {
                taskId: task.id || `task-${i + 1}`,
                completedBy: workerId,
                durationMs,
                output: workerOutput
            });
        }

        // 3. Síntese final pelo supervisor
        const finalSynthesis = await this.#synthesize(input, taskResults, blackboard);
        blackboard.set('final_synthesis', finalSynthesis, { updatedBy: 'supervisor' });

        return {
            finalOutput: finalSynthesis,
            tasks: taskResults,
            totalDurationMs: Date.now() - startTime
        };
    }

    async #planTasks(goal, availableWorkers) {
        if (typeof this.#options.planner === 'function') {
            return await this.#options.planner(goal, availableWorkers);
        }

        // Se o supervisor for um agente LLM, podemos pedir o plano estruturado
        if (typeof this.#supervisor.processMessage === 'function') {
            const workersList = availableWorkers
                .map((w) => `- ID: ${w.id} (Role: ${w.role}, Capacidades: [${w.capabilities.join(', ')}])`)
                .join('\n');

            const prompt = `Você é o Supervisor do Swarm.
Objetivo Geral: "${goal}"

Especialistas disponíveis:
${workersList}

Divida este objetivo em subtarefas sequenciais para os especialistas adequados.
Responda APENAS em JSON no formato:
[
  { "id": "task_1", "assignedTo": "<worker_id>", "instruction": "o que fazer" }
]`;

            try {
                const response = await this.#supervisor.processMessage(`supervisor-plan-${Date.now()}`, prompt);
                const text = response?.response || String(response);
                const match = text.match(/\[[\s\S]*\]/);
                if (match) {
                    const parsed = JSON.parse(match[0]);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            } catch (e) {
                // Fallback gracioso para atribuição direta por membros
            }
        }

        // Fallback: atribui uma tarefa correspondente para cada trabalhador disponível
        return availableWorkers.map((w, idx) => ({
            id: `task_${idx + 1}`,
            assignedTo: w.id,
            instruction: `Execute sua especialidade (${w.role}) em relação ao objetivo: "${goal}"`
        }));
    }

    #findBestWorker(task, members) {
        const requiredCap = task.requiredCapability;
        if (requiredCap) {
            for (const [id, member] of members.entries()) {
                if (member.hasCapability(requiredCap)) return id;
            }
        }
        // Retorna o primeiro membro disponível
        return Array.from(members.keys())[0];
    }

    async #synthesize(goal, taskResults, blackboard) {
        if (typeof this.#options.synthesizer === 'function') {
            return await this.#options.synthesizer(goal, taskResults, blackboard);
        }

        const consolidatedContext = taskResults
            .map((r) => `[Resultado de ${r.workerId} (${r.role})]:\n${typeof r.output === 'object' ? JSON.stringify(r.output, null, 2) : r.output}`)
            .join('\n\n');

        if (typeof this.#supervisor.processMessage === 'function') {
            const prompt = `Você é o Supervisor do Swarm.
Objetivo Inicial: "${goal}"

Resultados dos especialistas:
${consolidatedContext}

Com base nas entregas acima, formule a síntese e resposta final completa e integrada para o usuário.`;

            const res = await this.#supervisor.processMessage(`supervisor-syn-${Date.now()}`, prompt);
            return res?.response !== undefined ? res.response : res;
        }

        if (typeof this.#supervisor === 'function') {
            return await this.#supervisor({ goal, taskResults, consolidatedContext });
        }

        // Síntese textual padrão
        return `Síntese Consolidada do Swarm:\n\n${consolidatedContext}`;
    }
}

module.exports = SupervisorTopology;

