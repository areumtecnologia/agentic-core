/**
 * Reasoning Tools Category
 * Provides structured thinking / scratchpad capabilities for models without native reasoning.
 * Follows the sequential thinking / test-time compute pattern.
 */

'use strict';

class ReasoningTools {
  /**
   * @param {object} [options={}]
   * @param {string} [options.toolName='record_thought_step'] Nome da ferramenta no catálogo
   * @param {number} [options.maxThoughtsPerSession=50] Limite de passos salvos no scratchpad
   * @param {Function} [options.onThought] Callback opcional invocado ao gravar um pensamento
   */
  constructor(options = {}) {
    this.toolName = options.toolName || 'record_thought_step';
    this.maxThoughtsPerSession = options.maxThoughtsPerSession || 50;
    this.onThought = typeof options.onThought === 'function' ? options.onThought : null;

    /** @type {Map<string, Array<{ step: number, thought: string, isRevision?: boolean, revisesThought?: number, needsMoreThinking?: boolean, timestamp: string }>>} */
    this.scratchpads = new Map();
    this.tools = new Map();

    this.initializeTools();
  }

  initializeTools() {
    this.tools.set(this.toolName, {
      name: this.toolName,
      category: 'reasoning',
      description: 'Ferramenta de raciocínio passo a passo (Sequential Thinking). Deve ser chamada para registrar deduções, planejar, calcular ou analisar problemas lógicos e matemáticos antes de fornecer a resposta final ao usuário. Use this tool to think step-by-step.',
      schema: {

        type: 'object',
        properties: {
          thought: {
            type: 'string',
            description: 'O pensamento, análise lógica, dedução ou cálculo detalhado do passo atual.'
          },
          step: {
            type: 'number',
            description: 'Número sequencial do passo de raciocínio atual (1, 2, 3...).'
          },
          is_revision: {
            type: 'boolean',
            description: 'Indica se este pensamento revisa ou corrige uma hipótese/cálculo anterior.'
          },
          revises_thought: {
            type: 'number',
            description: 'Número do passo anterior que está sendo revisado (obrigatório se is_revision for true).'
          },
          needs_more_thinking: {
            type: 'boolean',
            description: 'True se ainda for necessário desenvolver mais passos de raciocínio; False se a conclusão foi atingida.'
          }
        },
        required: ['thought']
      },
      execute: async (args, sessionContext = {}) => {
        const sessionId = sessionContext.sessionId || sessionContext.id || 'default';
        return this.recordThought(sessionId, args, sessionContext);
      }
    });
  }

  /**
   * Registra um passo de pensamento para uma sessão.
   * Tolerante a variações comuns em modelos locais menores (ex: passagem de string direta ou nomes alternativos de chaves).
   *
   * @param {string} sessionId
   * @param {object|string} rawArgs
   * @param {object} [context={}]
   * @returns {object}
   */
  recordThought(sessionId, rawArgs, context = {}) {
    let thought = '';
    let step = null;
    let isRevision = false;
    let revisesThought = null;
    let needsMoreThinking = false;

    if (typeof rawArgs === 'string') {
      thought = rawArgs;
    } else if (rawArgs && typeof rawArgs === 'object') {
      thought = rawArgs.thought || rawArgs.step_thought || rawArgs.reasoning || rawArgs.text || rawArgs.content || rawArgs.input || rawArgs.message || rawArgs.analysis || rawArgs.query || '';
      step = typeof rawArgs.step === 'number' ? rawArgs.step : (rawArgs.step_number || null);
      isRevision = Boolean(rawArgs.is_revision || rawArgs.isRevision);
      revisesThought = rawArgs.revises_thought || rawArgs.revisesThought || null;
      needsMoreThinking = Boolean(rawArgs.needs_more_thinking ?? rawArgs.needsMoreThinking ?? false);
    }

    if (!thought || !thought.trim()) {
      thought = 'Analisando e processando a solicitação do usuário passo a passo.';
    }

    let thoughts = this.scratchpads.get(sessionId);
    if (!thoughts) {
      thoughts = [];
      this.scratchpads.set(sessionId, thoughts);
    }

    if (step === null || isNaN(step)) {
      step = thoughts.length + 1;
    }

    const entry = {
      step,
      thought: thought.trim(),
      isRevision,
      revisesThought,
      needsMoreThinking,
      timestamp: new Date().toISOString()
    };

    thoughts.push(entry);

    // Mantém o limite de tamanho do scratchpad por sessão
    if (thoughts.length > this.maxThoughtsPerSession) {
      thoughts.shift();
    }

    if (this.onThought) {
      try {
        this.onThought(entry, { sessionId, ...context });
      } catch (e) {
        // Ignora erros no hook do usuário para não quebrar a execução
      }
    }

    return {
      status: 'recorded',
      step,
      totalThoughtsRecorded: thoughts.length,
      isRevision,
      nextInstruction: needsMoreThinking
        ? 'Passo de raciocínio registrado com sucesso. Prossiga para o próximo passo de dedução.'
        : 'Raciocínio concluído com sucesso. Agora prossiga emitindo a resposta final ao usuário ou a próxima ferramenta de ação baseada nas conclusões obtidas.'
    };
  }

  /**
   * Alias de conveniência para recordThought.
   */
  recordThoughtStep(rawArgs, sessionId = 'default') {
    return this.recordThought(sessionId, rawArgs);
  }

  /**
   * Obtém a lista de pensamentos registrados na sessão.
   * @param {string} sessionId
   * @returns {Array<object>}
   */
  getScratchpad(sessionId) {
    return this.scratchpads.get(sessionId) || [];
  }

  /**
   * Retorna os pensamentos formatados como texto contínuo ou em blocos.
   * @param {string} sessionId
   * @returns {string}
   */
  getFormattedReasoning(sessionId) {
    const thoughts = this.getScratchpad(sessionId);
    if (!thoughts || thoughts.length === 0) return '';

    return thoughts
      .map(t => {
        const prefix = t.isRevision && t.revisesThought
          ? `[Passo ${t.step} (Revisão do Passo ${t.revisesThought})]`
          : `[Passo ${t.step}]`;
        return `${prefix} ${t.thought}`;
      })
      .join('\n');
  }

  /**
   * Limpa o scratchpad de uma sessão.
   * @param {string} sessionId
   * @returns {boolean}
   */
  clearScratchpad(sessionId) {
    return this.scratchpads.delete(sessionId);
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  getTool(name) {
    return this.tools.get(name);
  }
}

module.exports = { ReasoningTools };
