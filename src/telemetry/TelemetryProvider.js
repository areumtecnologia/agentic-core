'use strict';

// ---------------------------------------------------------------------------
// TelemetryProvider.js - Observability, metrics and span tracing for AgenticCore
// ---------------------------------------------------------------------------

const { EventEmitter } = require('events');

/**
 * @typedef {Object} Span
 * @property {string} id
 * @property {string|null} parentId
 * @property {string} name
 * @property {number} startTime
 * @property {number|null} endTime
 * @property {number|null} durationMs
 * @property {string} status 'OK' | 'ERROR'
 * @property {Record<string, any>} attributes
 * @property {Error|null} error
 */

/**
 * TelemetryProvider tracks execution spans, token consumption, and performance metrics
 * across agentic loops, LLM calls, and tool invocations.
 */
class TelemetryProvider extends EventEmitter {
  #enabled;
  #maxHistory;
  #spans;
  #activeSpans;
  #tokenUsage;

  /**
   * @param {Object} [options]
   * @param {boolean} [options.enabled=true]
   * @param {number} [options.maxHistory=1000] Maximum finished spans to keep in memory ring-buffer
   */
  constructor(options = {}) {
    super();
    this.#enabled = options.enabled ?? true;
    this.#maxHistory = options.maxHistory ?? 1000;
    this.#spans = [];
    this.#activeSpans = new Map();
    this.#tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  get isEnabled() {
    return this.#enabled;
  }

  setEnabled(val) {
    this.#enabled = Boolean(val);
  }

  /**
   * Start a new span
   * @param {string} name 
   * @param {Record<string, any>} [attributes={}]
   * @param {string|null} [parentId=null]
   * @returns {string} spanId
   */
  startSpan(name, attributes = {}, parentId = null) {
    if (!this.#enabled) return '';

    const id = `span_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const span = {
      id,
      parentId,
      name,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      status: 'OK',
      attributes: { ...attributes },
      error: null,
    };

    this.#activeSpans.set(id, span);
    this.emit('span:start', span);
    return id;
  }

  /**
   * End an active span
   * @param {string} id 
   * @param {'OK'|'ERROR'} [status='OK']
   * @param {Record<string, any>} [additionalAttributes={}]
   * @param {Error|null} [error=null]
   * @returns {Span|null}
   */
  endSpan(id, status = 'OK', additionalAttributes = {}, error = null) {
    if (!this.#enabled || !id) return null;

    const span = this.#activeSpans.get(id);
    if (!span) return null;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;
    if (error) span.error = error;
    Object.assign(span.attributes, additionalAttributes);

    this.#activeSpans.delete(id);

    // Keep ring-buffer bounded
    if (this.#spans.length >= this.#maxHistory) {
      this.#spans.shift();
    }
    this.#spans.push(span);

    this.emit('span:end', span);
    return span;
  }

  /**
   * Record token usage
   * @param {{ promptTokens?: number, completionTokens?: number, totalTokens?: number }} usage 
   */
  recordTokenUsage(usage = {}) {
    if (!this.#enabled) return;

    const prompt = Number(usage.promptTokens) || 0;
    const completion = Number(usage.completionTokens) || 0;
    const total = Number(usage.totalTokens) || (prompt + completion);

    this.#tokenUsage.promptTokens += prompt;
    this.#tokenUsage.completionTokens += completion;
    this.#tokenUsage.totalTokens += total;

    this.emit('metrics:tokens', {
      added: { prompt, completion, total },
      cumulative: { ...this.#tokenUsage },
    });
  }

  /**
   * Get accumulated token usage metrics
   */
  getTokenUsage() {
    return { ...this.#tokenUsage };
  }

  /**
   * Get finished spans history
   * @param {number} [limit]
   * @returns {Span[]}
   */
  getSpans(limit) {
    if (typeof limit === 'number' && limit > 0) {
      return this.#spans.slice(-limit);
    }
    return [...this.#spans];
  }

  /**
   * Clear accumulated metrics and spans
   */
  clear() {
    this.#spans = [];
    this.#activeSpans.clear();
    this.#tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
}

module.exports = {
  TelemetryProvider,
};
