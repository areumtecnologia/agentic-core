'use strict';

const EventEmitter = require('events');
const { AgenticCore } = require('../AgenticCore');
const { AgentConfig } = require('../AgentConfig');

class PlatformManager extends EventEmitter {
    #tenants = new Map();

    /**
     * Registra um novo tenant.
     * @param {string} tenantId
     * @param {object} [config={}]
     * @returns {object}
     */
    registerTenant(tenantId, config = {}) {
        if (this.#tenants.has(tenantId)) {
            throw new Error(`Tenant "${tenantId}" already exists.`);
        }
        const tenant = {
            id: tenantId,
            agents: new Map(),
            sessions: new Map(),
            config,
            createdAt: new Date(),
        };
        this.#tenants.set(tenantId, tenant);
        this.emit('tenant_registered', { tenantId });
        return this.getTenant(tenantId);
    }

    /**
     * Cria um agente para um tenant.
     * @param {string} tenantId
     * @param {AgentConfig} agentConfig
     * @param {object} [agentOptions={}]  Opções repassadas ao AgenticCore (provider, apiKey, etc.)
     * @returns {AgenticCore}
     */
    createAgent(tenantId, agentConfig, agentOptions = {}) {
        const tenant = this.#tenants.get(tenantId);
        if (!tenant) {
            throw new Error(`Tenant "${tenantId}" not found.`);
        }
        const agent = new AgenticCore({ agent: agentConfig, ...agentOptions });
        const agentName = agentConfig.agentName || agentConfig.name || `agent-${Date.now()}`;
        tenant.agents.set(agentName, agent);
        this.emit('agent_created', { tenantId, agent: agentName });
        return agent;
    }

    /**
     * @param {string} tenantId
     * @returns {object|null}
     */
    getTenant(tenantId) {
        return this.#tenants.get(tenantId) || null;
    }

    /**
     * @param {string} tenantId
     * @param {string} agentName
     * @returns {AgenticCore|null}
     */
    getAgent(tenantId, agentName) {
        const tenant = this.#tenants.get(tenantId);
        return tenant?.agents.get(agentName) || null;
    }

    /**
     * @param {string} tenantId
     * @returns {object|null}
     */
    getMetrics(tenantId) {
        const tenant = this.#tenants.get(tenantId);
        if (!tenant) return null;
        return {
            agentCount: tenant.agents.size,
            sessionCount: tenant.sessions.size,
        };
    }
}

module.exports = { PlatformManager };
