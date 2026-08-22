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
        this.#maxConcurrent = Math.max(1, maxConcurrent);
    }

    /**
     * Executa o grafo de tarefas em paralelo respeitando dependências e concorrência máxima.
     * @param {import('./TaskGraph').TaskGraph} graph
     * @param {object} [opts={}]
     * @param {AbortSignal} [opts.signal]
     * @param {function} [opts.onTaskComplete]
     * @param {function} [opts.onTaskError]
     * @returns {Promise<Map<string, any>>}
     */
    async execute(graph, { signal, onTaskComplete, onTaskError } = {}) {
        // Valida ciclo e obtém os nós
        graph.topologicalSort();

        const allNodes = new Map(graph.nodes.map(n => [n.id, n]));
        const totalNodes = allNodes.size;
        if (totalNodes === 0) return new Map();

        const completed = new Set();
        const running = new Set();
        const results = new Map();

        return new Promise((resolve, reject) => {
            let isAborted = false;
            let abortListener = null;

            const cleanup = () => {
                if (signal && abortListener) {
                    signal.removeEventListener('abort', abortListener);
                }
            };

            if (signal) {
                if (signal.aborted) {
                    return reject(signal.reason || new DOMException('The user aborted a request.', 'AbortError'));
                }
                abortListener = () => {
                    isAborted = true;
                    cleanup();
                    reject(signal.reason || new DOMException('The user aborted a request.', 'AbortError'));
                };
                signal.addEventListener('abort', abortListener, { once: true });
            }

            const checkAndDispatch = () => {
                if (isAborted) return;

                if (completed.size >= totalNodes) {
                    cleanup();
                    return resolve(results);
                }

                // Encontra nós que estão prontos para execução
                const readyNodes = [];
                for (const [id, node] of allNodes.entries()) {
                    if (!completed.has(id) && !running.has(id)) {
                        const depsCompleted = node.dependsOn.every(depId => completed.has(depId));
                        if (depsCompleted) {
                            readyNodes.push(node);
                        }
                    }
                }

                // Despacha nós até o limite de maxConcurrent
                while (readyNodes.length > 0 && running.size < this.#maxConcurrent) {
                    if (isAborted) return;

                    const node = readyNodes.shift();
                    running.add(node.id);

                    this.#executeNode(node, signal, onTaskComplete, onTaskError)
                        .then((result) => {
                            results.set(node.id, result);
                        })
                        .catch((error) => {
                            const errResult = { success: false, output: '', error };
                            results.set(node.id, errResult);
                        })
                        .finally(() => {
                            running.delete(node.id);
                            completed.add(node.id);
                            checkAndDispatch();
                        });
                }
            };

            // Disparo inicial
            checkAndDispatch();
        });
    }

    async #executeNode(node, signal, onTaskComplete, onTaskError) {
        // Verifica se alguma dependência falhou
        if (node.dependsOn && node.dependsOn.length > 0) {
            // Se houver dependências com falha, cancela execução deste nó
            // Observação: nós anteriores já gravaram seus status
        }

        node.status = 'running';
        this.emit('task_started', { node });

        try {
            const result = await node.agent.execute(node.task, node.context, signal);
            node.status = 'completed';
            node.result = result;
            this.emit('task_completed', { node, result });
            onTaskComplete?.(node, result);
            return result;
        } catch (error) {
            node.status = 'failed';
            node.error = error;
            const errResult = { success: false, output: '', error };
            node.result = errResult;
            this.emit('task_failed', { node, error });
            onTaskError?.(node, error);
            return errResult;
        }
    }
}

module.exports = { ParallelExecutor };

