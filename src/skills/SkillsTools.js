'use strict';

const { Type } = require('../types');

/**
 * Registra ferramentas de gerenciamento e ativação de skills em uma instância do AgenticCore.
 *
 * @param {AgenticCore} agent Instância do agente
 * @param {SkillsManager} skillsManager Gerenciador de skills
 * @param {object} [options]
 * @param {boolean} [options.allowInstall=true] Se o agente pode instalar novas skills
 * @param {boolean} [options.allowExecuteScripts=true] Se o agente pode rodar scripts de skills
 */
function registerSkillsTools(agent, skillsManager, options = {}) {
    const allowInstall = options.allowInstall !== false;
    const allowExecuteScripts = options.allowExecuteScripts !== false;

    // ── 1. skills_search ───────────────────────────────────────────────────────
    agent.registerTool({
        name: 'skills_search',
        description: 'Search for specialized agent skills in the open ecosystem (skills.sh) or locally. Use this when the user needs specialized domain guidelines (e.g., React, Next.js, security, testing, CI/CD).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: 'Keywords to search for (e.g. "react performance", "security audit", "kubernetes")',
                },
                owner: {
                    type: Type.STRING,
                    description: 'Optional GitHub organization/owner to scope the search (e.g. "vercel-labs", "anthropics")',
                },
            },
            required: ['query'],
        },
    }, async (args) => {
        const query = args?.query || '';
        const owner = args?.owner;
        const results = await skillsManager.search(query, { owner });

        return {
            query,
            localFound: results.local.map(s => ({
                name: s.name,
                description: s.description,
                installed: true,
            })),
            ecosystemFound: results.remote.map(r => ({
                name: r.name,
                package: r.package,
                description: r.description,
                installCommand: `skills_install({ package: "${r.name}" })`,
            })),
            tip: 'If an ecosystem skill fits the task, call skills_install({ package }) to install it, then skills_load to read its instructions.',
        };
    });

    // ── 2. skills_install (se permitido) ──────────────────────────────────────
    if (allowInstall) {
        agent.registerTool({
            name: 'skills_install',
            description: 'Download and install a skill package from the open agent skills ecosystem (e.g. "vercel-labs/agent-skills@react-best-practices" or "owner/repo").',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    package: {
                        type: Type.STRING,
                        description: 'The package name or repository identifier to install',
                    },
                },
                required: ['package'],
            },
        }, async (args) => {
            const pkg = args?.package;
            if (!pkg) {
                return { success: false, error: 'Package parameter is required.' };
            }

            try {
                const res = await skillsManager.install(pkg);
                return {
                    success: true,
                    installedSkill: res.skillName,
                    message: `Skill "${res.skillName || pkg}" installed successfully. Call skills_load({ skillName: "${res.skillName || pkg}" }) to activate its guidelines.`,
                };
            } catch (err) {
                return {
                    success: false,
                    package: pkg,
                    error: err.message,
                };
            }
        });
    }

    // ── 3. skills_list ────────────────────────────────────────────────────────
    agent.registerTool({
        name: 'skills_list',
        description: 'List all currently installed skills in the workspace, along with brief descriptions.',
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    }, async () => {
        const list = skillsManager.listSkills();
        return {
            totalInstalled: list.length,
            skills: list.map(s => ({
                name: s.name,
                version: s.version,
                description: s.description,
                scriptsCount: s.scripts ? s.scripts.length : 0,
            })),
        };
    });

    // ── 4. skills_load ────────────────────────────────────────────────────────
    agent.registerTool({
        name: 'skills_load',
        description: 'Load the complete workflow, guidelines, engineering rules, and available scripts for an installed skill into this active session.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                skillName: {
                    type: Type.STRING,
                    description: 'The exact name of the installed skill to load (e.g. "react-best-practices")',
                },
            },
            required: ['skillName'],
        },
    }, async (args) => {
        const name = args?.skillName;
        if (!name) {
            return { error: 'skillName parameter is required.' };
        }

        const data = skillsManager.loadSkillInstructions(name);
        return data;
    });

    // ── 5. skills_execute_script (se permitido) ──────────────────────────────
    if (allowExecuteScripts) {
        agent.registerTool({
            name: 'skills_execute_script',
            description: 'Run an auxiliary automation script provided by an installed skill (e.g., benchmark, lint, analysis).',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    skillName: {
                        type: Type.STRING,
                        description: 'Name of the skill that owns the script',
                    },
                    scriptName: {
                        type: Type.STRING,
                        description: 'Name of the script file to run',
                    },
                    args: {
                        type: Type.ARRAY,
                        description: 'Optional command line arguments to pass to the script',
                    },
                },
                required: ['skillName', 'scriptName'],
            },
        }, async (args) => {
            const skillName = args?.skillName;
            const scriptName = args?.scriptName;
            const scriptArgs = Array.isArray(args?.args) ? args.args.map(String) : [];

            try {
                const execResult = await skillsManager.executeScript(skillName, scriptName, scriptArgs);
                return execResult;
            } catch (err) {
                return {
                    success: false,
                    error: err.message,
                };
            }
        });
    }

    // ── 6. skills_create (se permitido) ──────────────────────────────────────
    if (options.allowCreate !== false) {
        agent.registerTool({
            name: 'skills_create',
            description: 'Create and save a new local skill with custom workflows, guidelines, rules, and optional scripts.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    name: {
                        type: Type.STRING,
                        description: 'Unique kebab-case name of the skill (e.g. "aws-deploy-checklist")',
                    },
                    description: {
                        type: Type.STRING,
                        description: 'Concise 1-sentence description of what this skill does',
                    },
                    workflow: {
                        type: Type.STRING,
                        description: 'Step-by-step instructions and guidelines',
                    },
                    rules: {
                        type: Type.ARRAY,
                        description: 'List of mandatory rules/constraints for this skill',
                    },
                    tags: {
                        type: Type.ARRAY,
                        description: 'Optional keywords/tags for search discovery',
                    },
                    scripts: {
                        type: Type.OBJECT,
                        description: 'Optional map of filename -> code content for scripts/ directory',
                    },
                },
                required: ['name', 'description', 'workflow'],
            },
        }, async (args) => {
            try {
                const res = await skillsManager.createSkill(args);
                return {
                    success: true,
                    skillName: res.name,
                    message: `Skill "${res.name}" created and indexed successfully. You can load it anytime with skills_load({ skillName: "${res.name}" }).`,
                };
            } catch (err) {
                return {
                    success: false,
                    error: err.message,
                };
            }
        });
    }

    // ── 7. skills_analytics ──────────────────────────────────────────────────
    agent.registerTool({
        name: 'skills_analytics',
        description: 'Inspect skill efficiency telemetry, execution latency, success rates, token usage, and generate an impact analytics report.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                skillName: {
                    type: Type.STRING,
                    description: 'Optional name of a specific skill to filter metrics',
                },
                format: {
                    type: Type.STRING,
                    description: 'Output format: "markdown" (default, formatted table), "summary" (concise), "json", or "object"',
                },
                reset: {
                    type: Type.BOOLEAN,
                    description: 'Optional flag to reset telemetry metrics',
                },
            },
        },
    }, async (args) => {
        const skillName = args?.skillName;
        const format = args?.format || 'markdown';
        const shouldReset = Boolean(args?.reset);

        if (shouldReset) {
            skillsManager.analytics.reset(skillName || null);
            return {
                success: true,
                message: skillName
                    ? `Telemetry metrics for skill "${skillName}" have been reset.`
                    : 'All skill telemetry metrics have been reset.',
            };
        }

        const report = skillsManager.generateImpactReport({ format, skillName });
        if (typeof report === 'string') {
            return { report, format };
        }
        return report;
    });
}

module.exports = { registerSkillsTools };
