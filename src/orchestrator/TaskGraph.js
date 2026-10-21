'use strict';

const { TaskNode } = require('./TaskNode');

class TaskGraph {
    #nodes = new Map();
    #edges = [];

    /**
     * Adiciona um nó ao grafo.
     * Suporta add(id, opts) ou add({ id, ...opts }).
     * @param {string|object} idOrOpts
     * @param {object} [options={}]
     * @returns {TaskNode}
     */
    add(idOrOpts, options = {}) {
        let id;
        let opts;
        if (typeof idOrOpts === 'object' && idOrOpts !== null) {
            opts = idOrOpts;
            id = opts.id;
        } else {
            id = idOrOpts;
            opts = options;
        }

        const node = new TaskNode({ id, ...opts });
        this.#nodes.set(id, node);
        for (const dep of node.dependsOn) {
            this.#edges.push({ from: dep, to: id });
        }
        return node;
    }

    /**
     * @param {string} id
     * @returns {TaskNode|undefined}
     */
    get(id) {
        return this.#nodes.get(id);
    }

    /** @returns {TaskNode[]} */
    get nodes() {
        return Array.from(this.#nodes.values());
    }

    /**
     * @param {string} nodeId
     * @returns {string[]}
     */
    getDependencies(nodeId) {
        const node = this.#nodes.get(nodeId);
        return node ? node.dependsOn : [];
    }

    /**
     * @param {string} nodeId
     * @returns {string[]}
     */
    getDependents(nodeId) {
        return this.#edges
            .filter(e => e.from === nodeId)
            .map(e => e.to);
    }

    /**
     * Ordenação topológica dos nós (Kahn's algorithm simplificado).
     * @returns {TaskNode[]}
     */
    topologicalSort() {
        const visited = new Set();
        const result = [];
        const temp = new Set();

        const visit = (nodeId) => {
            if (temp.has(nodeId)) {
                throw new Error(`[TaskGraph] Cycle detected involving node: ${nodeId}`);
            }
            if (visited.has(nodeId)) return;

            temp.add(nodeId);
            const node = this.#nodes.get(nodeId);
            if (node) {
                for (const dep of node.dependsOn) {
                    visit(dep);
                }
            }
            temp.delete(nodeId);
            visited.add(nodeId);
            result.push(nodeId);
        };

        for (const id of this.#nodes.keys()) {
            visit(id);
        }

        return result.map(id => this.#nodes.get(id)).filter(Boolean);
    }
}

module.exports = { TaskGraph };
