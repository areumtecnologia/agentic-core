'use strict';

const EventEmitter = require('events');

class ParallelExecutor extends EventEmitter {
    #maxConcurrent;
    #graph;

    /**
     * @param {import('./TaskGraph').TaskGraph|object} [graphOrOpts={}]
     * @param {object} [opts={}]
     */
    constructor(graphOrOpts = {}, opts = {}) {
        super();
        if (graphOrOpts && typeof graphOrOpts.topologicalSort === 'function') {
            this.#graph = graphOrOpts;
            this.#maxConcurrent = Math.max(1, opts?.maxConcurrent || 4);
        } else {
            this.#graph = null;
            this.#maxConcurrent = Math.max(1, graphOrOpts?.maxConcurrent || 4);
        }
    }

    /**
     * Executa o grafo configurado no construtor.
     * @param {object} [opts={}]
     * @returns {Promise<Map<string, any>>}
     */
    async run(opts = {}) {
        if (!this.#graph) {
            throw new Error('[ParallelExecutor] No graph was provided in constructor. Call execute(graph, opts).');
        }
        return this.execute(this.#graph, opts);
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

                    this.#executeNode(node, signal, onTaskComplete, onTaskError, results)
                        .then((result) => {
                            results.set(node.id, result);
                            results[node.id] = result;
                        })
                        .catch((error) => {
                            const errResult = { success: false, output: '', error };
                            results.set(node.id, errResult);
                            results[node.id] = errResult;
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

    async #executeNode(node, signal, onTaskComplete, onTaskError, results) {
        // Verifica se alguma dependência falhou
        if (node.dependsOn && node.dependsOn.length > 0) {
            const failedDepId = node.dependsOn.find(depId => {
                const depRes = results?.get ? results.get(depId) : results?.[depId];
                return !depRes || depRes.success === false;
            });

            if (failedDepId) {
                const error = new Error(`[ParallelExecutor] Dependency "${failedDepId}" failed or was skipped.`);
                node.status = 'skipped';
                node.error = error;
                const errResult = { success: false, status: 'skipped', output: '', error };
                node.result = errResult;
                this.emit('task_failed', { node, error });
                onTaskError?.(node, error);
                return errResult;
            }
        }

        // Contexto unificado que suporta tanto acesso por mapa quanto objeto
        const contextPayload = Object.assign(new Map(results), {
            results: Object.fromEntries(results.entries()),
            context: node.context
        });

        // Avalia condição de branching (se houver)
        if (typeof node.condition === 'function') {
            const shouldRun = await node.condition(contextPayload, node.context);
            if (!shouldRun) {
                node.status = 'skipped';
                const skipResult = { success: true, skipped: true, status: 'skipped', output: 'Skipped by branch condition' };
                node.result = skipResult;
                this.emit('task_skipped', { node });
                return skipResult;
            }
        }

        // Aplica transformação dinâmica de contexto baseada nos nós anteriores
        let effectiveContext = node.context;
        if (typeof node.transformContext === 'function') {
            effectiveContext = await node.transformContext(contextPayload, node.context);
        }

        node.status = 'running';
        this.emit('task_started', { node });

        try {
            let result;
            if (typeof node.fn === 'function') {
                result = await node.fn(effectiveContext, signal);
            } else if (node.agent && typeof node.agent.execute === 'function') {
                result = await node.agent.execute(node.task, effectiveContext, signal);
            } else {
                throw new Error(`[ParallelExecutor] Node "${node.id}" has no executable agent or fn.`);
            }

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

