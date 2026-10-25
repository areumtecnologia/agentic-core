'use strict';

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { SkillsCliWrapper } = require('./SkillsCliWrapper');
const { SkillsLoader } = require('./SkillsLoader');

/**
 * SkillsManager
 * Gerenciador central de ciclo de vida de skills no AgenticCore.
 * Orquestra descoberta, instalação, cache em memória, injeção de contexto e execução de scripts.
 */
class SkillsManager extends EventEmitter {
    /**
     * @param {object} [options]
     * @param {string[]} [options.skillsDirs] Diretórios onde as skills estão armazenadas
     * @param {string} [options.primaryInstallDir] Diretório preferencial para novas instalações
     * @param {SkillsCliWrapper} [options.cli] Instância customizada do CLI wrapper
     * @param {string[]} [options.trustedOwners] Lista de proprietários permitidos
     * @param {boolean} [options.allowAnyOwner=true] Permitir qualquer repositório
     * @param {number} [options.scriptTimeoutMs=30000] Timeout para scripts auxiliares
     */
    constructor({
        skillsDirs = [],
        primaryInstallDir = null,
        cli = null,
        trustedOwners = [],
        allowAnyOwner = true,
        scriptTimeoutMs = 30000,
    } = {}) {
        super();

        const defaultLocalDir = path.resolve(process.cwd(), '.skills');
        const defaultHomeDir = path.resolve(os.homedir(), '.skills');

        this.skillsDirs = Array.from(new Set([
            ...skillsDirs.map(d => path.resolve(d)),
            defaultLocalDir,
            defaultHomeDir,
        ]));

        this.primaryInstallDir = primaryInstallDir ? path.resolve(primaryInstallDir) : defaultLocalDir;
        this.scriptTimeoutMs = scriptTimeoutMs;

        this.cli = cli || new SkillsCliWrapper({
            cwd: process.cwd(),
            trustedOwners,
            allowAnyOwner,
        });

        /** @type {Map<string, object>} */
        this.skills = new Map();
        this.initialized = false;
    }

    /**
     * Inicializa e sincroniza todas as skills locais dos diretórios configurados.
     */
    async initialize() {
        this.sync();
        this.initialized = true;
        this.emit('initialized', { totalSkills: this.skills.size });
        return this;
    }

    /**
     * Escaneia os diretórios locais e atualiza o mapa de skills em memória.
     * @returns {Map<string, object>}
     */
    sync() {
        this.skills.clear();

        for (const dir of this.skillsDirs) {
            if (fs.existsSync(dir)) {
                const scanned = SkillsLoader.scanSkillsDirectory(dir);
                for (const [name, skill] of scanned) {
                    if (!this.skills.has(name)) {
                        this.skills.set(name, skill);
                    }
                }
            }
        }

        this.emit('synced', { totalSkills: this.skills.size });
        return this.skills;
    }

    /**
     * Busca skills no repositório público ou na base local.
     * @param {string} query Termo de busca
     * @param {object} [options]
     * @returns {Promise<{ local: object[], remote: object[] }>}
     */
    async search(query = '', options = {}) {
        const lower = query.toLowerCase();

        // 1. Busca local na memória
        const localMatches = Array.from(this.skills.values()).filter(skill => {
            if (!query) return true;
            return skill.name.toLowerCase().includes(lower) ||
                (skill.description && skill.description.toLowerCase().includes(lower)) ||
                (skill.tags && skill.tags.some(t => String(t).toLowerCase().includes(lower)));
        });

        // 2. Busca remota via npx skills find
        let remoteMatches = [];
        try {
            const findResult = await this.cli.find(query, options);
            remoteMatches = findResult.items;
        } catch (err) {
            this.emit('error', { source: 'search_remote', error: err });
        }

        return {
            local: localMatches,
            remote: remoteMatches,
        };
    }

    /**
     * Instala uma nova skill através do npx skills e a carrega no catálogo.
     * @param {string} pkg Nome do pacote (ex: "vercel-labs/agent-skills@react-best-practices")
     * @param {object} [options]
     * @returns {Promise<{ success: boolean, skillName?: string, skill?: object, stdout: string }>}
     */
    async install(pkg, options = {}) {
        // Garante que o diretório de destino existe
        if (!fs.existsSync(this.primaryInstallDir)) {
            fs.mkdirSync(this.primaryInstallDir, { recursive: true });
        }

        this.emit('installing', { package: pkg });

        const addResult = await this.cli.add(pkg, {
            cwd: this.primaryInstallDir,
            ...options,
        });

        // Re-sincroniza o catálogo local
        this.sync();

        // Tenta inferir o nome da skill a partir do pacote ou do argumento @skill
        let skillName = null;
        if (pkg.includes('@')) {
            skillName = pkg.split('@')[1];
        } else {
            const parts = pkg.split('/');
            skillName = parts[parts.length - 1];
        }

        const loadedSkill = this.getSkill(skillName) || Array.from(this.skills.values()).find(s => s.name.toLowerCase() === skillName.toLowerCase());

        this.emit('installed', {
            package: pkg,
            skillName: loadedSkill ? loadedSkill.name : skillName,
            skill: loadedSkill,
        });

        return {
            success: true,
            package: pkg,
            skillName: loadedSkill ? loadedSkill.name : skillName,
            skill: loadedSkill,
            stdout: addResult.stdout,
        };
    }

    /**
     * Retorna a definição completa de uma skill por nome.
     * @param {string} name
     * @returns {object|null}
     */
    getSkill(name) {
        if (!name) return null;
        return this.skills.get(name) || null;
    }

    /**
     * Retorna todas as skills carregadas.
     * @returns {object[]}
     */
    listSkills() {
        return Array.from(this.skills.values());
    }

    /**
     * Retorna um resumo conciso formatado para ser injetado no prompt de sistema do agente.
     * @returns {string}
     */
    getPromptSummary() {
        if (this.skills.size === 0) {
            return '';
        }

        const lines = [
            '### Available Agent Skills:',
            'You have access to specialized skills that provide step-by-step workflows and engineering rules.',
            'To load a skill\'s detailed rules into this session, call `skills_load({ skillName })`.',
            '',
        ];

        for (const skill of this.skills.values()) {
            lines.push(SkillsLoader.formatSkillSummary(skill));
        }

        return lines.join('\n');
    }

    /**
     * Carrega as instruções detalhadas de uma skill para a sessão do agente.
     * @param {string} skillName
     * @returns {{ found: boolean, name: string, instructions?: string, sections?: object, scripts?: object[] }}
     */
    loadSkillInstructions(skillName) {
        const skill = this.getSkill(skillName);
        if (!skill) {
            return {
                found: false,
                name: skillName,
                error: `Skill "${skillName}" is not installed. You can search with skills_search and install it with skills_install.`,
            };
        }

        this.emit('activated', { skillName: skill.name });

        return {
            found: true,
            name: skill.name,
            version: skill.version,
            description: skill.description,
            instructions: skill.instructions,
            sections: skill.sections,
            scripts: skill.scripts.map(s => ({ name: s.name, filename: s.filename })),
        };
    }

    /**
     * Executa um script auxiliar localizado na pasta scripts/ da skill de forma controlada.
     * @param {string} skillName Nome da skill
     * @param {string} scriptName Nome do script (sem ou com extensão)
     * @param {string[]} [args=[]] Argumentos passados ao script
     * @returns {Promise<{ success: boolean, stdout: string, stderr: string, exitCode: number }>}
     */
    async executeScript(skillName, scriptName, args = []) {
        const skill = this.getSkill(skillName);
        if (!skill) {
            throw new Error(`Skill "${skillName}" not found.`);
        }

        const targetScript = skill.scripts.find(s => s.name === scriptName || s.filename === scriptName);
        if (!targetScript) {
            const available = skill.scripts.map(s => s.name).join(', ') || 'none';
            throw new Error(`Script "${scriptName}" not found in skill "${skillName}". Available: [${available}].`);
        }

        const scriptPath = targetScript.path;
        const ext = targetScript.ext;

        let cmd = null;
        let cmdArgs = [];

        if (ext === '.js' || ext === '.cjs' || ext === '.mjs') {
            cmd = process.execPath; // node
            cmdArgs = [scriptPath, ...args];
        } else if (ext === '.py') {
            cmd = 'python';
            cmdArgs = [scriptPath, ...args];
        } else if (ext === '.sh') {
            cmd = 'bash';
            cmdArgs = [scriptPath, ...args];
        } else {
            // Executável nativo
            cmd = scriptPath;
            cmdArgs = [...args];
        }

        return new Promise((resolve, reject) => {
            const child = spawn(cmd, cmdArgs, {
                cwd: skill.dirPath,
                env: {
                    ...process.env,
                    SKILL_DIR: skill.dirPath,
                },
            });

            let stdout = '';
            let stderr = '';
            let finished = false;

            const timer = setTimeout(() => {
                if (!finished) {
                    finished = true;
                    try { child.kill('SIGTERM'); } catch (_) {}
                    reject(new Error(`Execution of script "${scriptName}" timed out after ${this.scriptTimeoutMs}ms`));
                }
            }, this.scriptTimeoutMs);

            child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
            child.stderr?.on('data', chunk => { stderr += chunk.toString(); });

            child.on('error', err => {
                if (!finished) {
                    finished = true;
                    clearTimeout(timer);
                    reject(err);
                }
            });

            child.on('close', code => {
                if (!finished) {
                    finished = true;
                    clearTimeout(timer);
                    resolve({
                        success: code === 0,
                        stdout,
                        stderr,
                        exitCode: code,
                    });
                }
            });
        });
    }
}

module.exports = { SkillsManager };
