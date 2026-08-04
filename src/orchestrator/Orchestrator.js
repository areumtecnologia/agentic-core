'use strict';

const { TaskGraph } = require('./TaskGraph');
const { ParallelExecutor } = require('./ParallelExecutor');

class Orchestrator {
    #graph;
    #executor;

    /**
     * @param {object} [opts={}]
     * @param {number} [opts.maxConcurrent=4]
     */
    constructor({ maxConcurrent = 4 } = {}) {
        this.#graph = new TaskGraph();
        this.#executor = new ParallelExecutor({ maxConcurrent });
    }

    /**
     * Adiciona uma tarefa ao grafo.
     * @param {string} id
     * @param {object} opts
     * @returns {import('./TaskNode').TaskNode}
     */
    addTask(id, { agent, task, dependsOn = [], context = {} }) {
        return this.#graph.add(id, { agent, task, dependsOn, context });
    }

    /**
     * Executa todas as tarefas do grafo.
     * @param {object} [opts={}]
     * @param {AbortSignal} [opts.signal]
     * @param {function} [opts.onTaskComplete]
     * @param {function} [opts.onTaskError]
     * @returns {Promise<Map<string, import('./TaskNode').TaskNode['result']>>}
     */
    async execute({ signal, onTaskComplete, onTaskError } = {}) {
        return this.#executor.execute(this.#graph, {
            signal,
            onTaskComplete,
            onTaskError,
        });
    }

    /** @returns {TaskGraph} */
    get graph() {
        return this.#graph;
    }
}

module.exports = { Orchestrator };
