'use strict';

const { spawn } = require('child_process');
const path = require('path');

/**
 * SkillsCliWrapper
 * Interface programática segura em Node.js para o CLI do npx skills.
 * Permite buscar, instalar, listar e atualizar pacotes de skills do ecossistema aberto (skills.sh).
 */
class SkillsCliWrapper {
    /**
     * @param {object} [options]
     * @param {string} [options.cwd] Diretório de trabalho para execução dos comandos
     * @param {number} [options.timeoutMs=60000] Timeout para execução dos comandos (default: 60s)
     * @param {string[]} [options.trustedOwners=[]] Lista de proprietários confiáveis (ex: ['vercel-labs', 'anthropics'])
     * @param {boolean} [options.allowAnyOwner=true] Se falso, restringe add/install a trustedOwners
     */
    constructor({
        cwd = process.cwd(),
        timeoutMs = 60000,
        trustedOwners = [],
        allowAnyOwner = true,
    } = {}) {
        this.cwd = cwd;
        this.timeoutMs = timeoutMs;
        this.trustedOwners = new Set(trustedOwners.map(o => o.toLowerCase()));
        this.allowAnyOwner = allowAnyOwner;
    }

    /**
     * Valida se um pacote pode ser instalado com base nas políticas de proprietários confiáveis.
     * @param {string} pkg Identificador do pacote (ex: "vercel-labs/agent-skills" ou "owner/repo@skill")
     * @returns {{ allowed: boolean, reason?: string, owner?: string }}
     */
    validatePackageTrust(pkg) {
        if (!pkg || typeof pkg !== 'string') {
            return { allowed: false, reason: 'Invalid package name provided.' };
        }

        const trimmed = pkg.trim();
        // Extrai o proprietário (antes da primeira barra)
        const match = trimmed.match(/^([a-zA-Z0-9_\-\.]+)\//);
        const owner = match ? match[1].toLowerCase() : null;

        if (this.allowAnyOwner) {
            return { allowed: true, owner };
        }

        if (!owner || !this.trustedOwners.has(owner)) {
            return {
                allowed: false,
                reason: `Package owner "${owner || 'unknown'}" is not in the trusted owners whitelist (${Array.from(this.trustedOwners).join(', ')}).`,
                owner,
            };
        }

        return { allowed: true, owner };
    }

    /**
     * Executa um comando do npx skills via child_process.
     * @private
     */
    async _exec(args, { timeoutMs = this.timeoutMs, cwd = this.cwd } = {}) {
        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            const cmd = isWindows ? 'npx.cmd' : 'npx';
            const fullArgs = ['skills', ...args];

            let stdoutData = '';
            let stderrData = '';
            let timedOut = false;

            const child = spawn(cmd, fullArgs, {
                cwd,
                shell: isWindows,
                env: {
                    ...process.env,
                    CI: 'true', // Garante modo não interativo
                    FORCE_COLOR: '0',
                },
            });

            const timer = setTimeout(() => {
                timedOut = true;
                try {
                    child.kill('SIGTERM');
                } catch (_) {}
            }, timeoutMs);

            child.stdout?.on('data', (chunk) => {
                stdoutData += chunk.toString();
            });

            child.stderr?.on('data', (chunk) => {
                stderrData += chunk.toString();
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Failed to spawn skills CLI: ${err.message}`));
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                if (timedOut) {
                    return reject(new Error(`Skills CLI execution timed out after ${timeoutMs}ms (command: skills ${args.join(' ')})`));
                }

                if (code !== 0) {
                    const errorMsg = stderrData.trim() || stdoutData.trim() || `Command failed with exit code ${code}`;
                    const err = new Error(`Skills CLI error (exit ${code}): ${errorMsg}`);
                    err.exitCode = code;
                    err.stdout = stdoutData;
                    err.stderr = stderrData;
                    return reject(err);
                }

                resolve({
                    stdout: stdoutData,
                    stderr: stderrData,
                    exitCode: code,
                });
            });
        });
    }

    /**
     * Busca skills no repositório público (skills find).
     * @param {string} query Termo de busca (ex: "react", "testing")
     * @param {object} [options]
     * @param {string} [options.owner] Filtrar por proprietário GitHub
     * @returns {Promise<{ raw: string, query: string, items: Array<{ name: string, description: string, package?: string }> }>}
     */
    async find(query = '', options = {}) {
        const args = ['find'];
        if (query) args.push(query);
        if (options.owner) {
            args.push('--owner', options.owner);
        }

        const result = await this._exec(args, options);
        const parsedItems = this._parseFindOutput(result.stdout);

        return {
            query,
            raw: result.stdout,
            items: parsedItems,
        };
    }

    /**
     * Instala uma skill ou conjunto de skills de um repositório (skills add).
     * @param {string} pkg Pacote a instalar (ex: "vercel-labs/agent-skills" ou "owner/repo@skill")
     * @param {object} [options]
     * @param {boolean} [options.global=false] Instala em escopo global (-g)
     * @param {string|string[]} [options.skill] Nome(s) da skill a instalar (-s)
     * @param {string|string[]} [options.agent] Agentes alvo (-a)
     * @param {boolean} [options.all=false] Instala todas as skills para todos os agentes (--all)
     * @param {boolean} [options.copy=false] Copia arquivos em vez de criar symlinks (--copy)
     * @returns {Promise<{ success: boolean, package: string, stdout: string, json?: object }>}
     */
    async add(pkg, options = {}) {
        const trustCheck = this.validatePackageTrust(pkg);
        if (!trustCheck.allowed) {
            throw new Error(`[SkillsCliWrapper] Installation blocked by security policy: ${trustCheck.reason}`);
        }

        const args = ['add', pkg, '-y']; // Pula confirmações interativas
        if (options.global) args.push('-g');
        if (options.copy) args.push('--copy');
        if (options.all) {
            args.push('--all');
        } else {
            if (options.skill) {
                const skills = Array.isArray(options.skill) ? options.skill.join(',') : options.skill;
                args.push('--skill', skills);
            }
            if (options.agent) {
                const agents = Array.isArray(options.agent) ? options.agent.join(',') : options.agent;
                args.push('--agent', agents);
            }
        }

        // Tenta pedir formato JSON para parsing estruturado
        args.push('--json');

        try {
            const result = await this._exec(args, options);
            let jsonParsed = null;
            try {
                // Tenta extrair bloco JSON da saída
                const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonParsed = JSON.parse(jsonMatch[0]);
                }
            } catch (_) {}

            return {
                success: true,
                package: pkg,
                stdout: result.stdout,
                json: jsonParsed,
            };
        } catch (err) {
            // Se o erro ocorreu porque a versão do CLI não aceitou --json, tenta sem --json
            if (err.stdout && err.stdout.includes('unknown option') && args.includes('--json')) {
                const fallbackArgs = args.filter(a => a !== '--json');
                const fallbackResult = await this._exec(fallbackArgs, options);
                return {
                    success: true,
                    package: pkg,
                    stdout: fallbackResult.stdout,
                };
            }
            throw err;
        }
    }

    /**
     * Lista as skills instaladas (skills list).
     * @param {object} [options]
     * @param {boolean} [options.global=false] Listar do escopo global (-g)
     * @param {string} [options.agent] Filtrar por agente específico
     * @returns {Promise<{ raw: string, skills: Array<{ name: string, package?: string, path?: string }> }>}
     */
    async list(options = {}) {
        const args = ['list', '--json'];
        if (options.global) args.push('-g');
        if (options.agent) args.push('-a', options.agent);

        try {
            const result = await this._exec(args, options);
            let parsed = [];
            try {
                const jsonMatch = result.stdout.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsedJson = JSON.parse(jsonMatch[0]);
                    parsed = Array.isArray(parsedJson) ? parsedJson : (parsedJson.skills || []);
                }
            } catch (_) {
                parsed = this._parseListOutput(result.stdout);
            }

            return {
                raw: result.stdout,
                skills: parsed,
            };
        } catch (err) {
            // Fallback sem --json se o CLI não suportar
            const fallbackArgs = ['list'];
            if (options.global) fallbackArgs.push('-g');
            if (options.agent) fallbackArgs.push('-a', options.agent);
            const fallbackResult = await this._exec(fallbackArgs, options);
            return {
                raw: fallbackResult.stdout,
                skills: this._parseListOutput(fallbackResult.stdout),
            };
        }
    }

    /**
     * Remove uma skill instalada (skills remove).
     * @param {string|string[]} skills Nome(s) da skill a remover
     * @param {object} [options]
     * @param {boolean} [options.global=false]
     * @returns {Promise<{ success: boolean, stdout: string }>}
     */
    async remove(skills, options = {}) {
        const args = ['remove'];
        if (Array.isArray(skills)) {
            args.push(...skills);
        } else if (skills) {
            args.push(skills);
        } else if (options.all) {
            args.push('--all');
        }
        args.push('-y');
        if (options.global) args.push('-g');

        const result = await this._exec(args, options);
        return {
            success: true,
            stdout: result.stdout,
        };
    }

    /**
     * Atualiza as skills instaladas (skills update).
     * @param {string[]} [skills] Nomes específicos para atualizar
     * @param {object} [options]
     * @param {boolean} [options.global=false]
     * @param {boolean} [options.project=false]
     * @returns {Promise<{ success: boolean, stdout: string }>}
     */
    async update(skills = [], options = {}) {
        const args = ['update'];
        if (Array.isArray(skills) && skills.length > 0) {
            args.push(...skills);
        }
        args.push('-y');
        if (options.global) args.push('-g');
        if (options.project) args.push('-p');

        const result = await this._exec(args, options);
        return {
            success: true,
            stdout: result.stdout,
        };
    }

    /**
     * Parser auxiliar para a saída textual do comando find.
     * @private
     */
    _parseFindOutput(stdout) {
        const items = [];
        const lines = stdout.split(/\r?\n/);
        let currentItem = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const isBullet = /^[•\-\*]\s+/.test(trimmed);
            const isPackageIdentifier = /^[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+(?:@[a-zA-Z0-9_\-\.]+)?$/.test(trimmed);

            // Linha com título/nome (ex: "vercel-labs/agent-skills@react-best-practices" ou "• skill-name")
            if (isBullet || isPackageIdentifier) {
                if (currentItem) items.push(currentItem);
                const cleanName = trimmed.replace(/^[•\-\*]\s*/, '').trim();
                currentItem = {
                    name: cleanName,
                    description: '',
                    package: cleanName.split('@')[0],
                };
            } else if (currentItem) {
                currentItem.description = currentItem.description
                    ? `${currentItem.description} ${trimmed}`
                    : trimmed;
            }
        }

        if (currentItem) items.push(currentItem);
        return items;
    }

    /**
     * Parser auxiliar para a saída textual do comando list.
     * @private
     */
    _parseListOutput(stdout) {
        const items = [];
        const lines = stdout.split(/\r?\n/);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('===') || trimmed.startsWith('Installed skills:')) continue;

            const match = trimmed.match(/^([a-zA-Z0-9_\-\.\/]+)(?:\s+(.*))?$/);
            if (match) {
                items.push({
                    name: match[1],
                    description: (match[2] || '').trim(),
                });
            }
        }

        return items;
    }
}

module.exports = { SkillsCliWrapper };
