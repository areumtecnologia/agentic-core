'use strict';

const EventEmitter = require('events');

/**
 * @typedef {object} StreamChunk
 * @property {('token'|'thought'|'tool_call'|'tool_result'|'response')} type
 * @property {string} [text]
 * @property {string} [thought]
 * @property {object} [toolCall]
 * @property {object} [toolResult]
 * @property {object} [response]
 */

/**
 * TokenStream — Stream assíncrono e EventEmitter para respostas em tempo real.
 * Suporta iteração com `for await (const chunk of stream)` e consumo via eventos.
 */
class TokenStream extends EventEmitter {
    #queue = [];
    #resolvers = [];
    #done = false;
    #error = null;
    #accumulatedText = '';
    #accumulatedThought = '';
    #finalResponse = null;
    #responsePromise;
    #resolveResponse;
    #rejectResponse;

    constructor() {
        super();
        this.#responsePromise = new Promise((resolve, reject) => {
            this.#resolveResponse = resolve;
            this.#rejectResponse = reject;
        });
    }

    /** Texto acumulado até o momento. */
    get text() {
        return this.#accumulatedText;
    }

    /** Pensamento / raciocínio acumulado até o momento. */
    get thought() {
        return this.#accumulatedThought;
    }

    /** Resposta final estruturada do agente (disponível quando concluído). */
    get finalResponse() {
        return this.#finalResponse;
    }

    /** Promise que resolve com a resposta final do agente ao término do processamento. */
    get response() {
        return this.#responsePromise;
    }

    /** Indica se o stream já foi encerrado. */
    get isDone() {
        return this.#done;
    }

    /**
     * Envia um chunk de texto (token).
     * @param {string} text
     */
    pushToken(text) {
        if (this.#done || !text) return;
        this.#accumulatedText += text;
        const chunk = { type: 'token', text };
        this.#push(chunk);
        this.emit('token', text);
    }

    /**
     * Envia um chunk de raciocínio (thought).
     * @param {string} thought
     */
    pushThought(thought) {
        if (this.#done || !thought) return;
        this.#accumulatedThought += thought;
        const chunk = { type: 'thought', thought };
        this.#push(chunk);
        this.emit('thought', thought);
    }

    /**
     * Notifica o início de execução de ferramenta.
     * @param {object} toolCall
     */
    pushToolCall(toolCall) {
        if (this.#done) return;
        const chunk = { type: 'tool_call', toolCall };
        this.#push(chunk);
        this.emit('tool_call', toolCall);
    }

    /**
     * Notifica o resultado de execução de ferramenta.
     * @param {object} toolResult
     */
    pushToolResult(toolResult) {
        if (this.#done) return;
        const chunk = { type: 'tool_result', toolResult };
        this.#push(chunk);
        this.emit('tool_result', toolResult);
    }

    // Aliases para compatibilidade flexível de API
    emitToken(text) { this.pushToken(text); }
    emitThought(thought) { this.pushThought(thought); }
    emitToolCall(toolCall) { this.pushToolCall(toolCall); }
    emitToolResult(toolResult) { this.pushToolResult(toolResult); }

    /**
     * Finaliza o stream com o resultado estruturado final.
     * @param {object} finalResponse
     */
    end(finalResponse) {
        if (this.#done) return;
        this.#done = true;
        this.#finalResponse = finalResponse;
        const chunk = { type: 'response', response: finalResponse };
        this.#push(chunk);
        this.emit('end', finalResponse);
        this.#resolveResponse(finalResponse);
        this.#flushResolvers();
    }

    /**
     * Sinaliza erro e encerra o stream.
     * @param {Error} error
     */
    destroy(error) {
        if (this.#done) return;
        this.#done = true;
        this.#error = error;
        this.emit('error', error);
        this.#rejectResponse(error);
        while (this.#resolvers.length > 0) {
            const { reject } = this.#resolvers.shift();
            reject(error);
        }
    }

    /** Alias para destroy */
    error(err) {
        this.destroy(err);
    }

    #push(chunk) {
        if (this.#resolvers.length > 0) {
            const { resolve } = this.#resolvers.shift();
            resolve({ value: chunk, done: false });
        } else {
            this.#queue.push(chunk);
        }
    }

    #flushResolvers() {
        while (this.#resolvers.length > 0) {
            const { resolve } = this.#resolvers.shift();
            resolve({ value: undefined, done: true });
        }
    }

    /**
     * Suporte a AsyncIterator: `for await (const chunk of stream)`
     */
    [Symbol.asyncIterator]() {
        return {
            next: () => {
                if (this.#queue.length > 0) {
                    return Promise.resolve({ value: this.#queue.shift(), done: false });
                }
                if (this.#done) {
                    if (this.#error) return Promise.reject(this.#error);
                    return Promise.resolve({ value: undefined, done: true });
                }
                return new Promise((resolve, reject) => {
                    this.#resolvers.push({ resolve, reject });
                });
            }
        };
    }
}

module.exports = { TokenStream };
