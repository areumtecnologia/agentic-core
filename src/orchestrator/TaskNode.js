'use strict';

class TaskNode {
    /**
     * @param {object} opts
     * @param {string} opts.id
     * @param {object} [opts.agent]
     * @param {string} [opts.task]
     * @param {Function} [opts.fn] Função assíncrona executável direta (opcional)
     * @param {string[]} [opts.dependsOn=[]]
     * @param {string[]} [opts.deps] Alias para dependsOn
     * @param {object} [opts.context={}]
     * @param {Function} [opts.condition] Predicado (parentResults, context) => boolean
     * @param {Function} [opts.transformContext] Função (context, parentResults) => object
     */
    constructor({
        id,
        agent = null,
        task = '',
        fn = null,
        dependsOn = [],
        deps = null,
        context = {},
        condition = null,
        transformContext = null
    } = {}) {
        this.id = id;
        this.agent = agent;
        this.task = task;
        this.fn = fn;
        this.dependsOn = deps || dependsOn || [];
        this.context = context;
        this.condition = condition;
        this.transformContext = transformContext;
        this.status = 'pending'; // pending | running | completed | failed | skipped
        this.result = null;
        this.error = null;
    }
}

module.exports = { TaskNode };
