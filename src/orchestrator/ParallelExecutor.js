'use strict';

const EventEmitter = require('events');

class ParallelExecutor extends EventEmitter {
    #maxConcurrent;

    /**
     * @param {object} [opts={}]
     * @param {number} [opts.maxConcurrent=4]
     */
    constructor({ maxConcurrent = 4 } = {}) {
        super();
        this.#maxConcurrent = maxConcurrent;
    }

    /**
     * Executa o grafo de tarefas respeitando dependências.
     * @param {TaskGraph} graph
     * @param {object} [opts={}]
     * @param {AbortSignal} [opts.signal]
     * @param {function} [opts.onTaskComplete]
     * @param {function} [opts.onTaskError]
     * @returns {Promise<Map<string, SubAgentResult>>}
     */
    async execute(graph, { signal, onTaskComplete, onTaskError } = {}) {
        const sorted = graph.topologicalSort();
        const completed = new Set();
        const results = new Map();

        for (const node of sorted) {
            // Espera todas as dependências
            for (const dep of node.dependsOn) {
                while (!completed.has(dep)) {
                    await this.#wait(50);
                    if (signal?.aborted) {
                        throw new DOMException('The user aborted a request.', 'AbortError');
                    }
                }
            }

            // Executa o nó
            node.status = 'running';
            this.emit('task_started', { node });

            try {
                const result = await node.agent.execute(node.task, node.context, signal);
                node.status = 'completed';
                node.result = result;
                completed.add(node.id);
                results.set(node.id, result);
                this.emit('task_completed', { node, result });
                onTaskComplete?.(node, result);
            } catch (error) {
                node.status = 'failed';
                node.error = error;
                completed.add(node.id);
                this.emit('task_failed', { node, error });
                onTaskError?.(node, error);
            }
        }

        return results;
    }

    #wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { ParallelExecutor };
