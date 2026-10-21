'use strict';

/**
 * ToolSecurityPolicy — Gerencia e aplica políticas de segurança na execução de ferramentas
 * (Rate limiting, controle de permissões por perfil/tenant, auditoria).
 */
class ToolSecurityPolicy {
    #allowedTools;
    #blockedTools;
    #maxInvocationsPerMinute;
    #sessionInvocations = new Map(); // sessionId -> array of timestamps

    /**
     * @param {object} [options]
     * @param {string[]} [options.allowedTools]  Lista branca de ferramentas permitidas (se vazia, todas exceto bloqueadas)
     * @param {string[]} [options.blockedTools]  Lista negra de ferramentas bloqueadas
     * @param {number}   [options.maxInvocationsPerMinute=60] Limite de invocações por minuto
     */
    constructor({ allowedTools = [], blockedTools = [], maxInvocationsPerMinute = 60 } = {}) {
        this.#allowedTools = new Set(allowedTools);
        this.#blockedTools = new Set(blockedTools);
        this.#maxInvocationsPerMinute = maxInvocationsPerMinute;
    }

    /**
     * Valida se a execução da ferramenta é permitida pelas políticas de segurança.
     * @param {string} toolName
     * @param {string} sessionId
     * @returns {{ allowed: boolean, reason?: string }}
     */
    authorize(toolName, sessionId) {
        if (this.#blockedTools.has(toolName)) {
            return { allowed: false, reason: `Tool "${toolName}" is explicitly blocked by policy.` };
        }

        if (this.#allowedTools.size > 0 && !this.#allowedTools.has(toolName)) {
            return { allowed: false, reason: `Tool "${toolName}" is not in the allowed policy whitelist.` };
        }

        // Rate limiting
        const now = Date.now();
        const windowMs = 60000;
        let timestamps = this.#sessionInvocations.get(sessionId) || [];
        timestamps = timestamps.filter(t => now - t < windowMs);

        if (timestamps.length >= this.#maxInvocationsPerMinute) {
            return {
                allowed: false,
                reason: `Rate limit exceeded: max ${this.#maxInvocationsPerMinute} tool executions per minute reached.`
            };
        }

        timestamps.push(now);
        this.#sessionInvocations.set(sessionId, timestamps);

        return { allowed: true };
    }

    /**
     * Valida invocação (alias para authorize)
     * @param {string} toolName
     * @param {string} sessionId
     * @returns {{ allowed: boolean, reason?: string }}
     */
    validateInvocation(toolName, sessionId) {
        return this.authorize(toolName, sessionId);
    }

    /** Limpa dados de auditoria de uma sessão */
    clearSession(sessionId) {
        this.#sessionInvocations.delete(sessionId);
    }
}

module.exports = { ToolSecurityPolicy };
