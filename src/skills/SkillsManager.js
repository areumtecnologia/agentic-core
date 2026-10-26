'use strict';

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { SkillsCliWrapper } = require('./SkillsCliWrapper');
const { SkillsLoader } = require('./SkillsLoader');
const { SkillImpactAnalytics } = require('./SkillImpactAnalytics');

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
     * @param {string} [options.lockfilePath] Caminho do lockfile skills-lock.json
     * @param {boolean} [options.verifyIntegrity=false] Se deve verificar hash SHA-256 antes de carregar ou executar
     */
    constructor({
        skillsDirs = [],
        primaryInstallDir = null,
        cli = null,
        trustedOwners = [],
        allowAnyOwner = true,
        scriptTimeoutMs = 30000,
        lockfilePath = null,
        verifyIntegrity = false,
    } = {}) {
        super();
        // Listener padrão defensivo para prevenir ERR_UNHANDLED_ERROR no Node.js
        this.on('error', () => {});

        const defaultLocalDir = path.resolve(process.cwd(), '.skills');
        const defaultHomeDir = path.resolve(os.homedir(), '.skills');

        this.skillsDirs = Array.from(new Set([
            ...skillsDirs.map(d => path.resolve(d)),
            defaultLocalDir,
            defaultHomeDir,
        ]));

        this.primaryInstallDir = primaryInstallDir ? path.resolve(primaryInstallDir) : defaultLocalDir;
        this.scriptTimeoutMs = scriptTimeoutMs;
        this.lockfilePath = lockfilePath ? path.resolve(lockfilePath) : path.join(this.primaryInstallDir, 'skills-lock.json');
        this.verifyIntegrity = Boolean(verifyIntegrity);

        this.cli = cli || new SkillsCliWrapper({
            cwd: process.cwd(),
            trustedOwners,
            allowAnyOwner,
        });

        this.analytics = new SkillImpactAnalytics();
        this.analytics.on('metric:recorded', (data) => {
            this.emit('telemetry', data);
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

        if (loadedSkill) {
            this.updateLockfile(loadedSkill.name, {
                version: loadedSkill.version || '1.0.0',
                hash: loadedSkill.hash,
                source: pkg,
            });
        }

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
     * Cria uma nova skill localmente com estrutura padronizada e atualiza o lockfile.
     * @param {object} options
     * @param {string} options.name Nome identificador da skill (kebab-case)
     * @param {string} options.description Descrição concisa
     * @param {string} [options.version='1.0.0'] Versão da skill
     * @param {string} [options.author='agent'] Autor da skill
     * @param {string[]} [options.tags=[]] Palavras-chave e tags
     * @param {string} [options.workflow=''] Passo a passo e instruções detalhadas
     * @param {string[]} [options.rules=[]] Regras e restrições obrigatórias
     * @param {Record<string, string>} [options.scripts={}] Scripts auxiliares (filename -> content)
     * @param {Record<string, string>} [options.customSections={}] Seções Markdown adicionais
     * @param {boolean} [options.overwrite=false] Se deve sobrescrever skill existente
     * @returns {Promise<{ success: boolean, name: string, skill: object, dirPath: string }>}
     */
    async createSkill({
        name,
        description,
        version = '1.0.0',
        author = 'agent',
        tags = [],
        workflow = '',
        rules = [],
        scripts = {},
        customSections = {},
        overwrite = false,
    } = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('[SkillsManager] Skill name is required.');
        }

        const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        const skillDir = path.join(this.primaryInstallDir, cleanName);

        if (fs.existsSync(skillDir) && !overwrite) {
            throw new Error(`[SkillsManager] Skill "${cleanName}" already exists. Set overwrite: true to replace.`);
        }

        fs.mkdirSync(skillDir, { recursive: true });

        // Gera e grava o SKILL.md
        const skillMdContent = SkillsLoader.generateSkillMarkdown({
            name: cleanName,
            description,
            version,
            author,
            tags,
            workflow,
            rules,
            customSections,
        });
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMdContent, 'utf8');

        // Cria scripts auxiliares se fornecidos
        if (scripts && typeof scripts === 'object') {
            const scriptsDir = path.join(skillDir, 'scripts');
            fs.mkdirSync(scriptsDir, { recursive: true });

            for (const [scriptFile, scriptContent] of Object.entries(scripts)) {
                const safeName = path.basename(scriptFile);
                fs.writeFileSync(path.join(scriptsDir, safeName), String(scriptContent), 'utf8');
            }
        }

        // Sincroniza em memória
        this.sync();

        const createdSkill = this.getSkill(cleanName);
        if (createdSkill) {
            this.updateLockfile(cleanName, {
                version,
                hash: createdSkill.hash,
                source: 'autonomous_creation',
            });
        }

        this.emit('created', { name: cleanName, skill: createdSkill });
        return {
            success: true,
            name: cleanName,
            skill: createdSkill,
            dirPath: skillDir,
        };
    }

    /**
     * Carrega o arquivo skills-lock.json.
     * @returns {{ version: number, updatedAt: string, skills: Record<string, object> }}
     */
    loadLockfile() {
        if (!fs.existsSync(this.lockfilePath)) {
            return { version: 1, updatedAt: new Date().toISOString(), skills: {} };
        }
        try {
            const raw = fs.readFileSync(this.lockfilePath, 'utf8');
            return JSON.parse(raw);
        } catch (_) {
            return { version: 1, updatedAt: new Date().toISOString(), skills: {} };
        }
    }

    /**
     * Registra ou atualiza uma entrada no skills-lock.json.
     * @param {string} skillName
     * @param {object} metadata
     * @returns {boolean}
     */
    updateLockfile(skillName, { version = '1.0.0', hash = null, source = 'local' } = {}) {
        try {
            const lockfile = this.loadLockfile();
            lockfile.updatedAt = new Date().toISOString();
            lockfile.skills = lockfile.skills || {};
            lockfile.skills[skillName] = {
                version,
                hash,
                source,
                installedAt: lockfile.skills[skillName]?.installedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const dir = path.dirname(this.lockfilePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.lockfilePath, JSON.stringify(lockfile, null, 2), 'utf8');
            return true;
        } catch (err) {
            this.emit('error', { source: 'lockfile_update', error: err });
            return false;
        }
    }

    /**
     * Valida a integridade criptográfica (SHA-256) de uma skill contra o lockfile.
     * @param {string} skillName
     * @returns {{ valid: boolean, reason?: string, hash?: string, expectedHash?: string, actualHash?: string }}
     */
    verifySkillIntegrity(skillName) {
        const skill = this.getSkill(skillName);
        if (!skill) {
            return { valid: false, reason: `Skill "${skillName}" not found.` };
        }

        const lockfile = this.loadLockfile();
        const lockedEntry = lockfile.skills?.[skillName];
        if (!lockedEntry || !lockedEntry.hash) {
            return { valid: true, unverified: true, hash: skill.hash };
        }

        const currentHash = SkillsLoader.computeSkillHash(skill.dirPath);
        if (currentHash !== lockedEntry.hash) {
            return {
                valid: false,
                reason: `Integrity check failed for skill "${skillName}". Expected SHA-256 ${lockedEntry.hash}, but got ${currentHash}. Files may have been modified.`,
                expectedHash: lockedEntry.hash,
                actualHash: currentHash,
            };
        }

        return { valid: true, hash: currentHash };
    }

    /**
     * Analisa o texto do usuário e identifica se há correspondência heurística/semântica com alguma skill instalada.
     * Usado para auto-ativação no Turno 0 sem necessidade de uma chamada LLM adicional.
     * @param {string} text Mensagem do usuário
     * @returns {{ skill: object, score: number, name: string }|null}
     */
    matchSkill(text) {
        if (!text || typeof text !== 'string' || this.skills.size === 0) {
            return null;
        }

        const normalized = text.toLowerCase();
        let bestMatch = null;
        let highestScore = 0;

        for (const skill of this.skills.values()) {
            let score = 0;
            const skillName = skill.name.toLowerCase();
            const nameTokens = skillName.split(/[-_]/);

            // Nome exato da skill mencionado
            if (normalized.includes(skillName)) {
                score += 10;
            }

            // Tokens do nome mencionados (ex: "react", "perf")
            for (const token of nameTokens) {
                if (token.length > 2 && normalized.includes(token)) {
                    score += 3;
                }
            }

            // Tags da skill mencionadas
            if (Array.isArray(skill.tags)) {
                for (const tag of skill.tags) {
                    const cleanTag = String(tag).toLowerCase().trim();
                    if (cleanTag.length > 2 && normalized.includes(cleanTag)) {
                        score += 2;
                    }
                }
            }

            // Palavras-chave da descrição mencionadas
            if (skill.description) {
                const descTokens = skill.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
                for (const token of descTokens) {
                    if (normalized.includes(token)) {
                        score += 0.5;
                    }
                }
            }

            if (score > highestScore) {
                highestScore = score;
                bestMatch = { skill, score };
            }
        }

        // Limiar de relevância mínima para auto-ativação
        if (bestMatch && bestMatch.score >= 4) {
            return {
                skill: bestMatch.skill,
                score: bestMatch.score,
                name: bestMatch.skill.name,
            };
        }

        return null;
    }

    /**
     * Carrega as instruções detalhadas de uma skill para a sessão do agente.
     * @param {string} skillName
     * @returns {{ found: boolean, name: string, instructions?: string, sections?: object, scripts?: object[], error?: string }}
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

        if (this.verifyIntegrity) {
            const integrity = this.verifySkillIntegrity(skillName);
            if (!integrity.valid) {
                this.emit('error', { source: 'skill_integrity', skillName, error: integrity.reason });
                return {
                    found: false,
                    name: skillName,
                    error: integrity.reason,
                    tampered: true,
                };
            }
        }

        this.emit('activated', { skillName: skill.name });
        this.analytics.recordActivation({
            skillName: skill.name,
            type: 'explicit_load',
        });

        return {
            found: true,
            name: skill.name,
            version: skill.version,
            description: skill.description,
            instructions: skill.instructions,
            sections: skill.sections,
            hash: skill.hash,
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

        if (this.verifyIntegrity) {
            const integrity = this.verifySkillIntegrity(skillName);
            if (!integrity.valid) {
                throw new Error(`[SkillsManager] Execution blocked: ${integrity.reason}`);
            }
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

        const startTime = Date.now();

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
                    const durationMs = Date.now() - startTime;
                    this.analytics.recordExecution({
                        skillName,
                        scriptName,
                        durationMs,
                        success: false,
                        exitCode: -1,
                        error: `Timeout after ${this.scriptTimeoutMs}ms`,
                    });
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
                    const durationMs = Date.now() - startTime;
                    this.analytics.recordExecution({
                        skillName,
                        scriptName,
                        durationMs,
                        success: false,
                        exitCode: -1,
                        error: err.message,
                    });
                    this.emit('execution', {
                        skillName,
                        scriptName,
                        durationMs,
                        success: false,
                        exitCode: -1,
                        error: err.message,
                    });
                    reject(err);
                }
            });

            child.on('close', code => {
                if (!finished) {
                    finished = true;
                    clearTimeout(timer);
                    const durationMs = Date.now() - startTime;
                    const success = code === 0;
                    this.analytics.recordExecution({
                        skillName,
                        scriptName,
                        durationMs,
                        success,
                        exitCode: code,
                        error: success ? null : (stderr || `Exit code ${code}`),
                    });
                    this.emit('execution', {
                        skillName,
                        scriptName,
                        durationMs,
                        success,
                        exitCode: code,
                        stdout,
                        stderr,
                    });
                    resolve({
                        success,
                        stdout,
                        stderr,
                        exitCode: code,
                        durationMs,
                    });
                }
            });
        });
    }

    /**
     * Retorna métricas de impacto e eficiência de uma skill específica.
     * @param {string} skillName
     * @returns {object|null}
     */
    getSkillMetrics(skillName) {
        return this.analytics.getSkillMetrics(skillName);
    }

    /**
     * Retorna métricas consolidadas de todas as skills.
     * @returns {object[]}
     */
    getAllSkillMetrics() {
        return this.analytics.getAllMetrics();
    }

    /**
     * Gera relatório de telemetria e impacto das skills.
     * @param {object} [options]
     * @returns {string|object}
     */
    generateImpactReport(options = {}) {
        return this.analytics.generateImpactReport(options);
    }
}

module.exports = { SkillsManager };
