'use strict';

/**
 * OutputSanitizer — Sanitização de respostas textuais e extração limpa de resultados de ferramentas.
 * 
 * Previne loops repetitivos infinitos (comuns em modelos SLM < 1B), vazamentos de JSON bruto
 * e formatações inconsistentes.
 */
class OutputSanitizer {
    /**
     * Remove padrões repetitivos e loops de geração em modelos pequenos.
     * @param {string} text
     * @returns {string}
     */
    static sanitizeRepetitiveText(text) {
        if (!text || typeof text !== 'string') return text;

        let cleaned = text;

        // 1. Remove vazamento de objetos JSON de ferramentas caso o modelo tenha colado verbatim
        cleaned = cleaned.replace(/\{"success":\s*true,\s*"expression":\s*".*?",\s*"result":\s*([\d\.\-]+)\}/g, '$1');
        cleaned = cleaned.replace(/\{"success":\s*true,\s*"result":\s*([\d\.\-]+)\}/g, '$1');

        // 2. Remove itens repetidos em enumerações/listas (ex: "São Paulo, São Paulo, São Paulo...")
        cleaned = cleaned.replace(/([^,\.;\n]+)(?:,\s*\1)+/gi, '$1');

        // 3. Trunca repetição consecutiva de qualquer frase/bloco com 10+ caracteres (2+ vezes consecutivas)
        cleaned = cleaned.replace(/(.{10,}?)(?:\s*,?\s*\1){2,}/gis, '$1');

        // 4. Limita sentenças redundantes repetidas dentro do mesmo texto
        const sentences = cleaned.split(/(?<=[.!?])\s+/);
        if (sentences.length > 3) {
            const seen = new Map();
            const deduplicated = [];
            for (const s of sentences) {
                const trimmed = s.trim().toLowerCase();
                if (trimmed.length > 15) {
                    const count = seen.get(trimmed) || 0;
                    if (count >= 2) continue;
                    seen.set(trimmed, count + 1);
                }
                deduplicated.push(s);
            }
            cleaned = deduplicated.join(' ');
        }

        // 5. Se o texto foi interrompido abruptamente sem pontuação final no final da geração (estouro de tokens)
        if (cleaned.length > 40 && !/[.!?]$/.test(cleaned.trim())) {
            const lastPeriod = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf('!'), cleaned.lastIndexOf('?'));
            if (lastPeriod > cleaned.length * 0.6) {
                cleaned = cleaned.substring(0, lastPeriod + 1);
            }
        }

        return cleaned.trim();
    }

    /**
     * Extrai um valor limpo e apresentável de um retorno bruto de ferramenta.
     * @param {any} toolResult
     * @returns {any}
     */
    static extractCleanToolResult(toolResult) {
        if (!toolResult) return undefined;
        let val = toolResult?.functionResponse?.response?.result ?? toolResult?.response?.result ?? toolResult?.response ?? toolResult;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && typeof parsed === 'object') {
                        if (parsed.result !== undefined) return parsed.result;
                        if (parsed.output !== undefined) return parsed.output;
                        if (parsed.datetime !== undefined) return parsed.datetime;
                        if (parsed.message !== undefined && !parsed.error) return parsed.message;
                    }
                } catch {}
            }
            return trimmed;
        } else if (typeof val === 'object' && val !== null) {
            if (val.result !== undefined) return val.result;
            if (val.output !== undefined) return val.output;
            if (val.datetime !== undefined) return val.datetime;
            if (val.message !== undefined && !val.error) return val.message;
            return JSON.stringify(val);
        }
        return val;
    }

    /**
     * Detecta se o idioma ativo configurado para a resposta ou raciocínio é inglês.
     * @param {object} agentOrSession
     * @returns {boolean}
     */
    static isEnglish(agentOrSession) {
        const lang = agentOrSession?.config?.responseLanguage ||
                     agentOrSession?.config?.reasoningLanguage ||
                     agentOrSession?.responseLanguage ||
                     agentOrSession?.reasoningLanguage ||
                     'pt-BR';
        return typeof lang === 'string' && lang.toLowerCase().startsWith('en');
    }
}

module.exports = { OutputSanitizer };
