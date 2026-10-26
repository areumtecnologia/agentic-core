'use strict';

const { SubAgent } = require('../SubAgent');
const { AgentConfig } = require('../AgentConfig');

/**
 * SkillSubAgent
 * SubAgente especializado cujo prompt de sistema e regras de execução
 * são derivados diretamente de uma Skill instalada (SKILL.md).
 * Executa tarefas isoladas em uma sessão efêmera e reporta o resultado final.
 */
class SkillSubAgent extends SubAgent {
    /**
     * @param {object} options
     * @param {AgenticCore} options.parent Agente pai orquestrador
     * @param {string} options.skillName Nome da skill instalada
     * @param {string} [options.name] Nome opcional do subagente
     * @param {object[]} [options.tools=[]] Ferramentas adicionais
     * @param {object} [options.context={}] Contexto injetado
     */
    constructor({ parent, skillName, name, tools = [], context = {} }) {
        if (!parent || !parent.skillsManager) {
            throw new TypeError('[SkillSubAgent] Parent agent must have skills enabled.');
        }

        if (!skillName || typeof skillName !== 'string') {
            throw new TypeError('[SkillSubAgent] skillName must be a non-empty string.');
        }

        const skillsManager = parent.skillsManager;
        const skill = skillsManager.getSkill(skillName);
        if (!skill) {
            throw new Error(`[SkillSubAgent] Skill "${skillName}" is not installed.`);
        }

        const skillDetails = skillsManager.loadSkillInstructions(skillName);

        const subAgentName = name || `${skill.name}_specialist`;
        const subConfig = new AgentConfig(
            subAgentName,
            parent.agentName,
            `Specialist sub-agent grounded strictly in the "${skill.name}" skill.`,
            `Specialist in ${skill.name}`,
            `Execute tasks following strictly the guidelines and workflows of ${skill.name}.`,
            `You are a specialist execution agent strictly grounded in the "${skill.name}" skill.\n\n` +
            `Skill Description: ${skillDetails.description}\n\n` +
            `### SKILL WORKFLOW & RULES:\n${skillDetails.instructions}`,
            'pt-BR'
        );

        super({
            parent,
            config: subConfig,
            name: subAgentName,
            tools,
            context: {
                skillName: skill.name,
                skillVersion: skill.version,
                ...context,
            },
        });

        this.skill = skill;
        this.skillDetails = skillDetails;
        this.skillsManager = skillsManager;

        if (skillsManager.analytics) {
            skillsManager.analytics.recordActivation({
                skillName: skill.name,
                type: 'sub_agent',
                metadata: { subAgentName },
            });
        }
    }

    /**
     * Executa uma tarefa isolada monitorando a telemetria da skill.
     * @param {string} task
     * @param {object} [parentContext={}]
     * @param {AbortSignal} [signal]
     * @returns {Promise<object>}
     */
    async execute(task, parentContext = {}, signal) {
        const startTime = Date.now();
        try {
            const result = await super.execute(task, parentContext, signal);
            const durationMs = Date.now() - startTime;
            if (this.skillsManager?.analytics) {
                this.skillsManager.analytics.recordTurnUsage({
                    skillName: this.skill.name,
                    durationMs,
                    success: Boolean(result?.success),
                });
            }
            return result;
        } catch (err) {
            const durationMs = Date.now() - startTime;
            if (this.skillsManager?.analytics) {
                this.skillsManager.analytics.recordTurnUsage({
                    skillName: this.skill.name,
                    durationMs,
                    success: false,
                });
            }
            throw err;
        }
    }
}

module.exports = { SkillSubAgent };
