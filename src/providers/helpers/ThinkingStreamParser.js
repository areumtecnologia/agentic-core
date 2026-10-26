'use strict';

/**
 * ThinkingStreamParser — Parser e buffer de streaming para extração de raciocínio (<think>...</think>).
 *
 * Suporta chunks fracionados (onde tags como <think> ou </think> são divididas entre pacotes de rede),
 * tags não-fechadas por interrupção de tokens, e higienização estática de texto.
 */
class ThinkingStreamParser {
    /**
     * @param {object} [options={}]
     * @param {string} [options.openTag='<think>'] Tag de abertura
     * @param {string} [options.closeTag='</think>'] Tag de fechamento
     * @param {boolean} [options.trimLeadingWhitespace=true] Remove espaços em branco antes de <think>
     */
    constructor(options = {}) {
        this.openTag = options.openTag || '<think>';
        this.closeTag = options.closeTag || '</think>';
        this.trimLeadingWhitespace = options.trimLeadingWhitespace !== false;

        // Estados: 'IDLE' -> 'THINKING' -> 'CONTENT'
        this.state = 'IDLE';

        this.buffer = '';
        this.accumulatedThought = '';
        this.accumulatedContent = '';
        this.hasStartedNonWhitespace = false;
    }

    /**
     * Processa um chunk de texto proveniente do stream do modelo.
     * Retorna uma lista de objetos padronizados:
     * - { type: 'thought', thought: string }
     * - { type: 'token', text: string }
     *
     * @param {string} incomingText
     * @returns {Array<{ type: 'thought'|'token', text?: string, thought?: string }>}
     */
    feed(incomingText) {
        if (!incomingText) return [];

        const outputs = [];
        this.buffer += incomingText;

        let progress = true;
        while (progress && this.buffer.length > 0) {
            progress = false;

            if (this.state === 'IDLE') {
                // Se ainda estamos no início e só recebemos espaços em branco
                if (this.trimLeadingWhitespace && !this.hasStartedNonWhitespace) {
                    const wsMatch = this.buffer.match(/^(\s+)/);
                    if (wsMatch) {
                        const ws = wsMatch[1];
                        const remainder = this.buffer.slice(ws.length);
                        // Se o restante puder ser o início de <think>, aguarda
                        if (remainder.length === 0 || this.openTag.startsWith(remainder) || remainder.startsWith(this.openTag)) {
                            // Mantém ws no buffer até termos certeza
                        } else {
                            // Não é <think>, emite os espaços como token e marca início
                            this.hasStartedNonWhitespace = true;
                            outputs.push({ type: 'token', text: ws });
                            this.accumulatedContent += ws;
                            this.buffer = remainder;
                            progress = true;
                            continue;
                        }
                    }
                }

                const openTagIndex = this.buffer.indexOf(this.openTag);

                if (openTagIndex !== -1) {
                    // Encontrou a tag de abertura
                    const before = this.buffer.slice(0, openTagIndex);
                    if (before.trim()) {
                        outputs.push({ type: 'token', text: before });
                        this.accumulatedContent += before;
                    }
                    this.state = 'THINKING';
                    this.hasStartedNonWhitespace = true;
                    this.buffer = this.buffer.slice(openTagIndex + this.openTag.length);
                    progress = true;
                } else {
                    // Verifica se o final do buffer é um prefixo parcial de <think>
                    let potentialPrefixLen = 0;
                    for (let len = Math.min(this.buffer.length, this.openTag.length - 1); len > 0; len--) {
                        if (this.openTag.startsWith(this.buffer.slice(-len))) {
                            potentialPrefixLen = len;
                            break;
                        }
                    }

                    if (potentialPrefixLen > 0) {
                        // Emite a parte segura antes do prefixo potencial
                        const safeText = this.buffer.slice(0, this.buffer.length - potentialPrefixLen);
                        if (safeText) {
                            this.hasStartedNonWhitespace = true;
                            outputs.push({ type: 'token', text: safeText });
                            this.accumulatedContent += safeText;
                            this.buffer = this.buffer.slice(this.buffer.length - potentialPrefixLen);
                        }
                        // Aguarda o próximo chunk para resolver o prefixo
                        break;
                    } else {
                        // Não há correspondência com <think>, emite todo o buffer como token
                        outputs.push({ type: 'token', text: this.buffer });
                        this.accumulatedContent += this.buffer;
                        this.hasStartedNonWhitespace = true;
                        this.buffer = '';
                    }
                }
            } else if (this.state === 'THINKING') {
                const closeTagIndex = this.buffer.indexOf(this.closeTag);

                if (closeTagIndex !== -1) {
                    // Encontrou a tag de fechamento
                    const thoughtChunk = this.buffer.slice(0, closeTagIndex);
                    if (thoughtChunk) {
                        outputs.push({ type: 'thought', thought: thoughtChunk });
                        this.accumulatedThought += thoughtChunk;
                    }
                    this.state = 'CONTENT';
                    this.buffer = this.buffer.slice(closeTagIndex + this.closeTag.length);
                    progress = true;
                } else {
                    // Verifica se o final do buffer é um prefixo parcial de </think>
                    let potentialPrefixLen = 0;
                    for (let len = Math.min(this.buffer.length, this.closeTag.length - 1); len > 0; len--) {
                        if (this.closeTag.startsWith(this.buffer.slice(-len))) {
                            potentialPrefixLen = len;
                            break;
                        }
                    }

                    if (potentialPrefixLen > 0) {
                        const safeThought = this.buffer.slice(0, this.buffer.length - potentialPrefixLen);
                        if (safeThought) {
                            outputs.push({ type: 'thought', thought: safeThought });
                            this.accumulatedThought += safeThought;
                            this.buffer = this.buffer.slice(this.buffer.length - potentialPrefixLen);
                        }
                        break;
                    } else {
                        // Não há correspondência com </think>, emite todo o buffer como thought
                        outputs.push({ type: 'thought', thought: this.buffer });
                        this.accumulatedThought += this.buffer;
                        this.buffer = '';
                    }
                }
            } else if (this.state === 'CONTENT') {
                // Após o fechamento do bloco de raciocínio, tudo é token de conteúdo final
                outputs.push({ type: 'token', text: this.buffer });
                this.accumulatedContent += this.buffer;
                this.buffer = '';
            }
        }

        return outputs;
    }

    /**
     * Esvazia o buffer remanescente no encerramento do stream.
     * Trata graciosamente tags não-fechadas ou fragmentos pendentes.
     *
     * @returns {Array<{ type: 'thought'|'token', text?: string, thought?: string }>}
     */
    flush() {
        if (!this.buffer) return [];

        const outputs = [];
        const rem = this.buffer;
        this.buffer = '';

        if (this.state === 'THINKING') {
            // Modelo encerrou sem fechar </think>
            outputs.push({ type: 'thought', thought: rem });
            this.accumulatedThought += rem;
        } else {
            outputs.push({ type: 'token', text: rem });
            this.accumulatedContent += rem;
        }

        return outputs;
    }

    /**
     * Retorna o resumo acumulado de raciocínio e conteúdo.
     * @returns {{ accumulatedThought: string, accumulatedContent: string, isThinking: boolean }}
     */
    getSummary() {
        return {
            accumulatedThought: this.accumulatedThought.trim(),
            accumulatedContent: this.accumulatedContent.trim(),
            isThinking: this.state === 'THINKING' || Boolean(this.accumulatedThought.trim()),
        };
    }

    /**
     * Extrai estaticamente blocos de raciocínio (<think>...</think> ou <thought>...</thought>) de um texto completo.
     *
     * @param {string} fullText
     * @param {object} [options={}]
     * @returns {{ thought: string, text: string, hasThinking: boolean }}
     */
    static extractThinking(fullText, options = {}) {
        if (!fullText || typeof fullText !== 'string') {
            return { thought: '', text: fullText || '', hasThinking: false };
        }

        const openPattern = options.openTag || '<(?:think|thought)>';
        const closePattern = options.closeTag || '<\\/(?:think|thought)>';

        const regex = new RegExp(`${openPattern}([\\s\\S]*?)${closePattern}`, 'gi');
        let match;
        const thoughts = [];
        let cleanedText = fullText;

        while ((match = regex.exec(fullText)) !== null) {
            if (match[1]?.trim()) {
                thoughts.push(match[1].trim());
            }
        }

        cleanedText = cleanedText.replace(regex, '').trim();

        // Tag aberta e não fechada no final da resposta (ex: interrupção por max_tokens)
        const unclosedRegex = new RegExp(`${openPattern}([\\s\\S]*)$`, 'i');
        const unclosedMatch = cleanedText.match(unclosedRegex);
        if (unclosedMatch) {
            if (unclosedMatch[1]?.trim()) {
                thoughts.push(unclosedMatch[1].trim());
            }
            cleanedText = cleanedText.replace(unclosedRegex, '').trim();
        }

        const thought = thoughts.join('\n\n').trim();
        return {
            thought,
            text: cleanedText,
            hasThinking: thoughts.length > 0,
        };
    }
}

module.exports = { ThinkingStreamParser };
