
// ──────────────────────────────────────────────────────────────────────────────
// AgentConfig — construtor de configuração para o agente, usado internamente para complementar o prompt de sistema
// ──────────────────────────────────────────────────────────────────────────────
class AgentConfig {
    constructor(agentName, agentCompanyName, agentCompanyDetails, missionRole, missionObjective, missionInstructions, reasoningLanguage = 'en-US') {
        this.agentName = agentName;
        this.agentCompanyName = agentCompanyName;
        this.agentCompanyDetails = agentCompanyDetails;
        this.missionRole = missionRole;
        this.missionObjective = missionObjective;
        this.missionInstructions = missionInstructions;
        this.reasoningLanguage = reasoningLanguage;
    }

    setName(name) {
        this.agentName = name;
        return this;
    }

    setCompany(name, details) {
        this.agentCompanyName = name;
        this.agentCompanyDetails = details;
        return this;
    }

    setMission(role, objective, instructions) {
        this.missionRole = role;
        this.missionObjective = objective;
        this.missionInstructions = instructions;
        return this;
    }

    setReasoningLanguage(language) {
        this.reasoningLanguage = language;
        return this;
    }

    build() {
        return {
            name: this.agentName,
            company: {
                name: this.agentCompanyName,
                details: this.agentCompanyDetails
            },
            mission: {
                role: this.missionRole,
                objective: this.missionObjective,
                instructions: this.missionInstructions
            },
            reasoningLanguage: this.reasoningLanguage
        };
    }
}

module.exports = { AgentConfig };
