'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// OptimizedContextCompactor — versão otimizada com compressão hierárquica
// e cache de resumos para reduzir chamadas ao LLM
// ─────────────────────────────────────────────────────────────────────────────

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * @typedef {object} OptimizedCompactionOptions
 * @property {number} [maxOutputTokens=1024]
 * @property {number} [temperature=0.3]
 * @property {string} [language='en-US']
 * @property {number} [compressionRatio=0.3] Ratio de compressão
 * @property {boolean} [enableHierarchical=true] Habilita compactação hierárquica
 * @property {number} [cacheSize=100] Tamanho do cache de resumos
 * @property {boolean} [enableSemanticDedup=true] Remove duplicatas semânticas
 */

class OptimizedContextCompactor extends EventEmitter {
    #provider;
    #maxOutputTokens;
    #temperature;
    #language;
    #compressionRatio;
    #enableHierarchical;
    #cacheSize;
    #enableSemanticDedup;
    
    #summaryCache = new Map();
    #compressionStats = {
        totalCalls: 0,
        cacheHits: 0,
        tokensSaved: 0
    };

    constructor({ provider, compaction = {} }) {
        super();
        if (!provider) throw new TypeError('[OptimizedContextCompactor] provider is required.');
        
        this.#provider = provider;
        this.#maxOutputTokens = compaction.maxOutputTokens ?? 1024;
        this.#temperature = compaction.temperature ?? 0.3;
        this.#language = compaction.language ?? 'en-US';
        this.#compressionRatio = compaction.compressionRatio ?? 0.3;
        this.#enableHierarchical = compaction.enableHierarchical !== false;
        this.#cacheSize = compaction.cacheSize ?? 100;
        this.#enableSemanticDedup = compaction.enableSemanticDedup !== false;
    }

    /**
     * Compacta turns com otimizações
     */
    async compact(oldTurns, existingSummary, signal, options = {}) {
        if (!oldTurns || oldTurns.length === 0) {
            return existingSummary || '';
        }

        this.#compressionStats.totalCalls++;

        // 1. Deduplicação semântica
        let turnsToProcess = oldTurns;
        if (this.#enableSemanticDedup) {
            turnsToProcess = this.#removeSemanticDuplicates(turnsToProcess);
        }

        // 2. Filtragem por importância com pesos
        const importanceThreshold = options.importanceThreshold ?? 0.3;
        const importantTurns = this.#filterByImportanceWeighted(turnsToProcess, importanceThreshold);

        // 3. Verifica cache
        const cacheKey = this.#generateCacheKey(importantTurns, existingSummary);
        if (this.#summaryCache.has(cacheKey)) {
            this.#compressionStats.cacheHits++;
            return this.#summaryCache.get(cacheKey);
        }

        // 4. Compactação hierárquica
        let summary;
        if (this.#enableHierarchical && importantTurns.length > 50) {
            summary = await this.#hierarchicalCompact(importantTurns, existingSummary, signal);
        } else {
            summary = await this.#standardCompact(importantTurns, existingSummary, signal);
        }

        // 5. Cache do resultado
        this.#cacheSummary(cacheKey, summary);

        // 6. Estatísticas
        const originalTokens = this.#estimateTokens(oldTurns);
        const compressedTokens = this.#estimateTokens(summary);
        this.#compressionStats.tokensSaved += (originalTokens - compressedTokens);

        this.emit('compacted', {
            inputTurns: oldTurns.length,
            filteredTurns: importantTurns.length,
            outputSummaryLength: summary.length,
            cacheHit: false,
            compressionRatio: compressedTokens / originalTokens
        });

        return summary;
    }

    /**
     * Compactação hierárquica em múltiplos níveis
     */
    async #hierarchicalCompact(turns, existingSummary, signal) {
        const chunkSize = 20;
        const chunks = [];
        
        for (let i = 0; i < turns.length; i += chunkSize) {
            chunks.push(turns.slice(i, i + chunkSize));
        }

        // Compacta cada chunk
        const chunkSummaries = [];
        for (const chunk of chunks) {
            const chunkSummary = await this.#standardCompact(chunk, null, signal);
            chunkSummaries.push(chunkSummary);
        }

        // Compacta os resumos dos chunks
        const intermediateTurns = chunkSummaries.map((summary, i) => ({
            role: 'system',
            parts: [{ text: `[Chunk ${i + 1} Summary]\n${summary}` }]
        }));

        return await this.#standardCompact(intermediateTurns, existingSummary, signal);
    }

    /**
     * Compactação padrão otimizada
     */
    async #standardCompact(turns, existingSummary, signal) {
        // Pré-processamento: remove informações redundantes
        const optimizedTurns = this.#optimizeTurns(turns);
        
        const turnsText = this.#serializeTurnsOptimized(optimizedTurns);
        const prompt = this.#buildOptimizedPrompt(turnsText, existingSummary);

        const contents = [{ role: 'user', parts: [{ text: prompt }] }];

        const response = await this.#provider.generateContent({
            contents,
            systemInstruction: this.#buildOptimizedSystemInstruction(),
            config: {
                temperature: this.#temperature,
                topP: 0.9,
                maxOutputTokens: this.#maxOutputTokens,
            },
            signal,
        });

        const candidate = response.candidates?.[0];
        if (!candidate) {
            throw new Error('[OptimizedContextCompactor] Provider returned no candidates.');
        }

        const parts = candidate.content?.parts ?? [];
        const textParts = parts.filter(p => p.text && !p.thought);
        const summary = textParts.map(p => p.text).join('\n').trim();

        if (!summary) {
            throw new Error('[OptimizedContextCompactor] Provider returned empty summary.');
        }

        return summary;
    }

    /**
     * Remove duplicatas semânticas
     */
    #removeSemanticDuplicates(turns) {
        const seen = new Set();
        const deduped = [];

        for (const turn of turns) {
            const text = this.#extractText(turn);
            if (!text) {
                deduped.push(turn);
                continue;
            }

            // Hash simples do conteúdo
            const hash = crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
            
            // Verifica similaridade com turns anteriores
            let isDuplicate = false;
            for (const existing of deduped.slice(-5)) { // Verifica apenas últimos 5
                const existingText = this.#extractText(existing);
                if (existingText && this.#similarity(text, existingText) > 0.8) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                deduped.push(turn);
            }
        }

        return deduped;
    }

    /**
     * Filtragem por importância com pesos
     */
    #filterByImportanceWeighted(turns, threshold) {
        return turns.filter(turn => {
            const importance = turn.importance ?? 0.5;
            
            // Pesos adicionais
            let weight = importance;
            
            // Turnos do usuário têm mais peso
            if (turn.role === 'user') weight *= 1.2;
            
            // Turnos com tool calls têm mais peso
            const hasToolCalls = turn.parts?.some(p => p.functionCall);
            if (hasToolCalls) weight *= 1.3;
            
            // Turnos recentes têm mais peso
            const age = turn.timestamp ? Date.now() - new Date(turn.timestamp).getTime() : 0;
            const ageWeight = Math.max(0.5, 1 - (age / (24 * 60 * 60 * 1000))); // Decai em 24h
            weight *= ageWeight;

            return weight >= threshold;
        });
    }

    /**
     * Otimiza turns removendo redundâncias
     */
    #optimizeTurns(turns) {
        return turns.map(turn => {
            const parts = turn.parts || [];
            
            // Remove partes vazias
            const filteredParts = parts.filter(p => {
                if (p.text && p.text.trim().length < 5) return false;
                return true;
            });

            return { ...turn, parts: filteredParts };
        }).filter(turn => turn.parts && turn.parts.length > 0);
    }

    /**
     * Serialização otimizada
     */
    #serializeTurnsOptimized(turns) {
        return turns.map((turn, i) => {
            const role = turn.role || 'unknown';
            const parts = turn.parts || [];
            
            // Extrai apenas texto relevante
            const text = parts
                .filter(p => p.text)
                .map(p => p.text.trim())
                .filter(t => t.length > 0)
                .join(' ');

            // Extrai tool calls de forma compacta
            const toolCalls = parts
                .filter(p => p.functionCall)
                .map(p => `${p.functionCall.name}(${Object.keys(p.functionCall.args || {}).join(',')})`)
                .join('; ');

            const segments = [];
            if (text) segments.push(text);
            if (toolCalls) segments.push(`[tools: ${toolCalls}]`);

            return `[${i + 1}] ${role}: ${segments.join(' ')}`;
        }).join('\n');
    }

    /**
     * Prompt otimizado
     */
    #buildOptimizedPrompt(turnsText, existingSummary) {
        const summarySection = existingSummary
            ? `\n\n<previous_summary>\n${existingSummary}\n</previous_summary>\n\nUpdate with new turns, preserving only essential information.`
            : '';

        return `Create a concise, factual summary preserving critical context only.

Focus on:
1. Key facts about user
2. Main request/problem
3. Actions taken
4. Current status
5. Pending items

Remove redundant information and focus on what matters for continuation.

${summarySection}

<conversation_turns>
${turnsText}
</conversation_turns>

Output ONLY the summary.`;
    }

    /**
     * Instrução de sistema otimizada
     */
    #buildOptimizedSystemInstruction() {
        return `You are a conversation summarizer. Create concise, factual summaries that preserve essential context for continuation.

Rules:
- Be factual, no additions
- Remove redundancy
- Preserve key facts, requests, actions, status
- Use ${this.#language}
- Output ONLY summary, no commentary
- Target compression ratio: ${this.#compressionRatio}`;
    }

    /**
     * Gera chave de cache
     */
    #generateCacheKey(turns, existingSummary) {
        const content = JSON.stringify({
            turns: turns.map(t => this.#extractText(t)).join('|'),
            summary: existingSummary?.substring(0, 500)
        });
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
    }

    /**
     * Cache de resumo
     */
    #cacheSummary(key, summary) {
        if (this.#summaryCache.size >= this.#cacheSize) {
            const firstKey = this.#summaryCache.keys().next().value;
            this.#summaryCache.delete(firstKey);
        }
        this.#summaryCache.set(key, summary);
    }

    /**
     * Extrai texto de um turn
     */
    #extractText(turn) {
        const parts = turn.parts || [];
        return parts
            .filter(p => p.text)
            .map(p => p.text)
            .join(' ')
            .trim();
    }

    /**
     * Calcula similaridade simples
     */
    #similarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    /**
     * Estima tokens
     */
    #estimateTokens(text) {
        if (typeof text === 'string') {
            return Math.ceil(text.length / 4);
        }
        if (Array.isArray(text)) {
            return text.reduce((sum, t) => sum + this.#estimateTokens(this.#extractText(t)), 0);
        }
        return 0;
    }

    /**
     * Estatísticas de compressão
     */
    getStats() {
        const hitRate = this.#compressionStats.totalCalls > 0
            ? this.#compressionStats.cacheHits / this.#compressionStats.totalCalls
            : 0;

        return {
            ...this.#compressionStats,
            cacheSize: this.#summaryCache.size,
            hitRate,
            averageTokensSaved: this.#compressionStats.totalCalls > 0
                ? this.#compressionStats.tokensSaved / this.#compressionStats.totalCalls
                : 0
        };
    }

    /**
     * Limpa cache
     */
    clearCache() {
        this.#summaryCache.clear();
        this.#compressionStats = {
            totalCalls: 0,
            cacheHits: 0,
            tokensSaved: 0
        };
    }
}

module.exports = { OptimizedContextCompactor };
