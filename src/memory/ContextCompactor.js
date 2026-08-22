'use strict';

const EventEmitter = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// ContextCompactor — compacta turns antigos em um resumo textual via LLM.
//
// Quando a WorkingMemory atinge o limiar, os turns mais antigos são
// convertidos em um resumo estruturado para manter o contexto sem
// consumir tokens indefinidamente.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CompactionOptions
 * @property {number} [maxOutputTokens=1024]  Limite de tokens do resumo
 * @property {number} [temperature=0.3]       Baixa temperatura para fidelidade
 * @property {string} [language='en-US']       Idioma do resumo
 */

class ContextCompactor extends EventEmitter {
    #provider;
    #maxOutputTokens;
    #temperature;
    #language;

    /**
     * @param {object} opts
     * @param {import('../providers/BaseProvider').BaseProvider} opts.provider  Provedor de IA para gerar resumos
     * @param {CompactionOptions} [opts.compaction]
     */
    constructor({ provider, compaction = {} }) {
        super();
        if (!provider) throw new TypeError('[ContextCompactor] provider is required.');
        this.#provider = provider;
        this.#maxOutputTokens = compaction.maxOutputTokens ?? 1024;
        this.#temperature = compaction.temperature ?? 0.3;
        this.#language = compaction.language ?? 'en-US';
    }

    /**
     * Compacta um conjunto de turns em um resumo consolidado.
     * Utiliza scores de importância para priorizar turns críticos.
     *
     * @param {object[]} oldTurns        Turns a serem compactados
     * @param {string|null} existingSummary  Resumo anterior (se houver)
     * @param {number} [importanceThreshold=0.3]  Score mínimo para incluir um turn
     * @param {AbortSignal} [signal]    Sinal de cancelamento
     * @returns {Promise<string>} Novo resumo consolidado
     */
    async compact(oldTurns, existingSummary, signal, { importanceThreshold = 0.3 } = {}) {
        if (!oldTurns || oldTurns.length === 0) {
            return existingSummary || '';
        }

        // Filtra turns por importância, mantendo apenas os acima do threshold
        const importantTurns = this.#filterByImportance(oldTurns, importanceThreshold);

        if (importantTurns.length === 0 && existingSummary) {
            // Se não há turns importantes mas há um resumo existente, retorna o resumo
            return existingSummary;
        }

        // Se todos os turns foram filtrados fora e não há resumo anterior, compacta tudo
        const turnsToCompact = importantTurns.length > 0 ? importantTurns : oldTurns;

        const turnsText = this.#serializeTurns(turnsToCompact);
        const prompt = this.#buildPrompt(turnsText, existingSummary);

        const contents = [{ role: 'user', parts: [{ text: prompt }] }];

        const response = await this.#provider.generateContent({
            contents,
            systemInstruction: this.#buildSystemInstruction(),
            tools: [],
            config: {
                temperature: this.#temperature,
                topP: 0.9,
                maxOutputTokens: this.#maxOutputTokens,
            },
            signal,
        });

        const candidate = response.candidates?.[0];
        if (!candidate) {
            throw new Error('[ContextCompactor] Provider returned no candidates during compaction.');
        }

        const parts = candidate.content?.parts ?? [];
        const textParts = parts.filter(p => p.text && !p.thought);
        const summary = textParts.map(p => p.text).join('\n').trim();

        if (!summary) {
            throw new Error('[ContextCompactor] Provider returned empty summary.');
        }

        this.emit('compacted', {
            inputTurns: oldTurns.length,
            filteredTurns: importantTurns.length,
            outputSummaryLength: summary.length,
        });

        return summary;
    }

    #filterByImportance(turns, threshold) {
        return turns.filter(turn => {
            const importance = turn.importance;
            // Se o turn tem score de importância definido, usa-o
            if (importance !== undefined && importance >= threshold) {
                return true;
            }
            // Se não tem score, considera turns intermediários (mantém ~50%)
            return true;
        });
    }

    #serializeTurns(turns) {
        return turns.map((turn, i) => {
            const role = turn.role || 'unknown';
            const parts = turn.parts || [];
            const textParts = parts
                .filter(p => p.text)
                .map(p => p.text)
                .join(' ');
            const toolCalls = parts
                .filter(p => p.functionCall)
                .map(p => `[tool_call: ${p.functionCall.name}(${JSON.stringify(p.functionCall.args)})]`)
                .join(' ');
            const toolResults = parts
                .filter(p => p.functionResponse)
                .map(p => `[tool_result: ${p.functionResponse.name} → ${JSON.stringify(p.functionResponse.response)}]`)
                .join(' ');

            const segments = [textParts, toolCalls, toolResults].filter(Boolean);
            return `[${i + 1}] ${role}: ${segments.join(' ')}`;
        }).join('\n');
    }

    #buildSystemInstruction() {
        return `You are a conversation summarizer. Your job is to create a concise, factual summary of a customer service conversation that preserves:
1. Key facts about the user (name, contact, stated preferences)
2. The user's main request or problem
3. Actions taken so far (tools called, information provided)
4. Current status and any pending items
5. Important context that would be needed to continue the conversation

Write in ${this.#language}. Be factual — do not add information that was not in the conversation.
Output ONLY the summary, no meta-commentary.`;
    }

    #buildPrompt(turnsText, existingSummary) {
        const summarySection = existingSummary
            ? `\n\n<previous_summary>\n${existingSummary}\n</previous_summary>\n\nUpdate the previous summary with the new conversation turns below, producing a single consolidated summary.`
            : '';

        return `Summarize the following conversation turns, preserving all critical context.${summarySection}

<conversation_turns>
${turnsText}
</conversation_turns>

Produce a consolidated summary that captures all essential context for continuing this conversation.`;
    }
}

module.exports = { ContextCompactor };
