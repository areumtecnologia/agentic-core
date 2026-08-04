'use strict';

class TaskNode {
    /**
     * @param {object} opts
     * @param {string} opts.id
     * @param {object} opts.agent
     * @param {string} opts.task
     * @param {string[]} [opts.dependsOn=[]]
     * @param {object} [opts.context={}]
     */
    constructor({ id, agent, task, dependsOn = [], context = {} }) {
        this.id = id;
        this.agent = agent;
        this.task = task;
        this.dependsOn = dependsOn;
        this.context = context;
        this.status = 'pending'; // pending | running | completed | failed
        this.result = null;
        this.error = null;
    }
}

module.exports = { TaskNode };
