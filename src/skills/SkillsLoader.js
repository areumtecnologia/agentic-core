'use strict';

const fs = require('fs');
const path = require('path');

/**
 * SkillsLoader
 * Parser e carregador de pacotes de skills baseados na especificação SKILL.md.
 * Extrai metadados em YAML frontmatter, seções markdown e cataloga scripts auxiliares.
 */
class SkillsLoader {
    /**
     * @param {object} [options]
     * @param {string[]} [options.skillsDirs] Diretórios adicionais para busca de skills
     */
    constructor({ skillsDirs = [] } = {}) {
        this.skillsDirs = skillsDirs;
    }

    /**
     * Faz o parse do conteúdo textual de um arquivo SKILL.md.
     * @param {string} content Conteúdo do arquivo SKILL.md
     * @returns {{ metadata: object, body: string, sections: Record<string, string> }}
     */
    static parseSkillContent(content) {
        if (!content || typeof content !== 'string') {
            return { metadata: {}, body: '', sections: {} };
        }

        const normalized = content.replace(/\r\n/g, '\n');
        let metadata = {};
        let body = normalized;

        // Extrai bloco YAML frontmatter delimitado por --- no início do arquivo
        const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        if (frontmatterMatch) {
            const rawYaml = frontmatterMatch[1];
            body = (frontmatterMatch[2] || '').trim();
            metadata = SkillsLoader._parseYamlFrontmatter(rawYaml);
        }

        // Divide o corpo do Markdown em seções principais (headings nível 2: ## )
        const sections = SkillsLoader._extractSections(body);

        return {
            metadata,
            body,
            sections,
        };
    }

    /**
     * Carrega e analisa uma skill a partir do caminho do seu diretório.
     * @param {string} skillDirPath Caminho absoluto ou relativo do diretório da skill
     * @returns {object|null} Objeto da skill carregada ou null se inválida
     */
    static loadSkillFromDir(skillDirPath) {
        if (!skillDirPath || !fs.existsSync(skillDirPath)) {
            return null;
        }

        const stat = fs.statSync(skillDirPath);
        if (!stat.isDirectory()) {
            return null;
        }

        const skillMdPath = path.join(skillDirPath, 'SKILL.md');
        if (!fs.existsSync(skillMdPath)) {
            return null;
        }

        const rawContent = fs.readFileSync(skillMdPath, 'utf8');
        const parsed = SkillsLoader.parseSkillContent(rawContent);

        // Se o frontmatter não definiu o name, usa o nome da pasta
        const dirName = path.basename(skillDirPath);
        const name = parsed.metadata.name || dirName;
        const description = parsed.metadata.description || SkillsLoader._extractFallbackDescription(parsed.body);

        // Descobre scripts, referências e exemplos no diretório da skill
        const scripts = SkillsLoader._discoverScripts(skillDirPath);
        const references = SkillsLoader._discoverFiles(path.join(skillDirPath, 'references'));
        const examples = SkillsLoader._discoverFiles(path.join(skillDirPath, 'examples'));
        const resources = SkillsLoader._discoverFiles(path.join(skillDirPath, 'resources'));

        return {
            name,
            description,
            version: parsed.metadata.version || '1.0.0',
            author: parsed.metadata.author || 'unknown',
            tags: parsed.metadata.tags || [],
            metadata: parsed.metadata,
            instructions: parsed.body,
            sections: parsed.sections,
            dirPath: path.resolve(skillDirPath),
            skillFilePath: path.resolve(skillMdPath),
            scripts,
            references,
            examples,
            resources,
            loadedAt: new Date().toISOString(),
        };
    }

    /**
     * Escaneia um diretório base em busca de todas as subpastas contendo SKILL.md.
     * @param {string} baseDir Diretório base (ex: "./.skills", "./skills", "~/.skills")
     * @param {number} [maxDepth=3] Profundidade máxima de busca
     * @returns {Map<string, object>} Mapa com name -> SkillDefinition
     */
    static scanSkillsDirectory(baseDir, maxDepth = 3) {
        const skillsMap = new Map();
        if (!baseDir || !fs.existsSync(baseDir)) {
            return skillsMap;
        }

        function walk(currentDir, currentDepth) {
            if (currentDepth > maxDepth) return;

            let entries = [];
            try {
                entries = fs.readdirSync(currentDir, { withFileTypes: true });
            } catch (_) {
                return;
            }

            // Se o diretório atual tem SKILL.md, registra como skill
            const hasSkillMd = entries.some(e => e.isFile() && e.name.toLowerCase() === 'skill.md');
            if (hasSkillMd) {
                const skill = SkillsLoader.loadSkillFromDir(currentDir);
                if (skill && skill.name) {
                    skillsMap.set(skill.name, skill);
                }
                // Não precisa descer mais se já é uma pasta de skill
                return;
            }

            // Desce nas subpastas
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    walk(path.join(currentDir, entry.name), currentDepth + 1);
                }
            }
        }

        walk(path.resolve(baseDir), 1);
        return skillsMap;
    }

    /**
     * Gera um resumo compacto da skill formatado para injeção no system instruction ou catálogo de LLM.
     * @param {object} skill
     * @returns {string}
     */
    static formatSkillSummary(skill) {
        const name = skill.name || 'unnamed-skill';
        const desc = skill.description || 'No description provided.';
        const scriptsCount = skill.scripts ? skill.scripts.length : 0;
        const scriptNote = scriptsCount > 0 ? ` (${scriptsCount} script${scriptsCount > 1 ? 's' : ''} available)` : '';
        return `- **${name}**: ${desc}${scriptNote}`;
    }

    /**
     * Parser leve de YAML frontmatter sem dependências externas.
     * @private
     */
    static _parseYamlFrontmatter(yamlString) {
        const result = {};
        const lines = yamlString.split('\n');
        let currentArrayKey = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            // Item de lista (ex: "- react" ou "  - item")
            if (trimmed.startsWith('-') && currentArrayKey) {
                const itemVal = trimmed.replace(/^-\s*/, '').trim();
                result[currentArrayKey].push(SkillsLoader._cleanScalar(itemVal));
                continue;
            }

            // Chave-valor (ex: "name: my-skill" ou "tags: [a, b]")
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx !== -1) {
                const key = trimmed.slice(0, colonIdx).trim();
                const rawVal = trimmed.slice(colonIdx + 1).trim();

                if (rawVal === '') {
                    // Possível início de lista na linha seguinte
                    currentArrayKey = key;
                    result[key] = [];
                } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
                    // Lista inline (ex: [a, b, c])
                    currentArrayKey = null;
                    const items = rawVal
                        .slice(1, -1)
                        .split(',')
                        .map(i => SkillsLoader._cleanScalar(i.trim()))
                        .filter(Boolean);
                    result[key] = items;
                } else {
                    currentArrayKey = null;
                    result[key] = SkillsLoader._cleanScalar(rawVal);
                }
            }
        }

        return result;
    }

    /**
     * Limpa aspas e converte tipos primitivos (boolean, number).
     * @private
     */
    static _cleanScalar(val) {
        if (typeof val !== 'string') return val;
        const str = val.trim();
        if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
        }
        if (str === 'true') return true;
        if (str === 'false') return false;
        if (!isNaN(Number(str)) && str !== '') return Number(str);
        return str;
    }

    /**
     * Extrai blocos h2 (## Título) em um dicionário.
     * @private
     */
    static _extractSections(markdown) {
        const sections = {};
        const lines = markdown.split('\n');
        let currentSection = 'Overview';
        let sectionLines = [];

        for (const line of lines) {
            const h2Match = line.match(/^##\s+(.+)$/);
            if (h2Match) {
                if (sectionLines.length > 0) {
                    sections[currentSection] = sectionLines.join('\n').trim();
                }
                currentSection = h2Match[1].trim();
                sectionLines = [];
            } else {
                sectionLines.push(line);
            }
        }

        if (sectionLines.length > 0) {
            sections[currentSection] = sectionLines.join('\n').trim();
        }

        return sections;
    }

    /**
     * Procura por scripts executáveis na pasta scripts/ da skill.
     * @private
     */
    static _discoverScripts(skillDirPath) {
        const scriptsDir = path.join(skillDirPath, 'scripts');
        if (!fs.existsSync(scriptsDir)) return [];

        try {
            return fs.readdirSync(scriptsDir, { withFileTypes: true })
                .filter(e => e.isFile())
                .map(e => ({
                    name: path.parse(e.name).name,
                    filename: e.name,
                    ext: path.extname(e.name).toLowerCase(),
                    path: path.join(scriptsDir, e.name),
                }));
        } catch (_) {
            return [];
        }
    }

    /**
     * Lista arquivos auxiliares em uma subpasta.
     * @private
     */
    static _discoverFiles(dirPath) {
        if (!fs.existsSync(dirPath)) return [];
        try {
            return fs.readdirSync(dirPath, { withFileTypes: true })
                .filter(e => e.isFile())
                .map(e => path.join(dirPath, e.name));
        } catch (_) {
            return [];
        }
    }

    /**
     * Extrai a primeira frase ou parágrafo como descrição fallback.
     * @private
     */
    static _extractFallbackDescription(body) {
        const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        if (lines.length > 0) {
            const first = lines[0];
            return first.length > 180 ? `${first.slice(0, 177)}...` : first;
        }
        return '';
    }
}

module.exports = { SkillsLoader };
