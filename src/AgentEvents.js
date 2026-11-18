// ─────────────────────────────────────────────────────────────────────────────
// AgentEvents — fonte única de verdade para nomes de eventos
// ─────────────────────────────────────────────────────────────────────────────

const AgentEvents = Object.freeze({
    RESPONSE: 'response',               // Resposta final estruturada
    RAW_RESPONSE: 'raw_response',           // Resposta bruta do modelo (candidatos)
    TOOL_CALL: 'tool_call',               // Antes de executar uma tool
    TOOL_RESULT: 'tool_result',             // Após a tool resolver
    VULNERABILITY_EXPLORATION_DETECTED: 'vulnerability_exploration_detected',  // Tentativa de exploração detectada
    ERROR: 'error',                   // Erro irrecuperável
    TURN_START: 'turn_start',              // Início de um turno do loop
    TURN_END: 'turn_end',               // Fim de um turno do loop
    SESSION_CREATED: 'session_created',         // Nova sessão criada
    SESSION_EXPIRED: 'session_expired',         // Sessão expirou por TTL
    SESSION_CLEARED: 'session_cleared',         // Sessão removida manualmente
    RETRY: 'retry',                  // Retry após falha na API
    ASYNC_RETRY_SCHEDULED: 'async_retry_scheduled',   // Retry assíncrono agendado
    ASYNC_RETRY_COMPLETED: 'async_retry_completed',   // Retry assíncrono concluído
    SYNC_RETRY_STARTED: 'sync_retry_started',      // Retry síncrono iniciado
    SYNC_RETRY_COMPLETED: 'sync_retry_completed',    // Retry síncrono concluído
    PROVIDER_FALLBACK: 'provider_fallback',          // Transição automática de provedor por erro 5xx
    SESSION_IDLE_TIMEOUT: 'session_idle_timeout',    // Sessão ficou ociosa (usuário demorou a responder)
    SESSION_UPDATED: 'session_updated',             // Sessão atualizada (ex: após compactação)
    TOKEN: 'token',                                 // Chunk de texto parcial emitido durante streaming
    REASONING_CHUNK: 'reasoning_chunk',             // Chunk de raciocínio / pensamento emitido durante streaming
    TOOL_STREAM_START: 'tool_stream_start',         // Início de chamada de ferramenta em streaming
    TOOL_STREAM_END: 'tool_stream_end',             // Fim de execução de ferramenta em streaming
    HUMAN_HANDOVER: 'human_handover',               // Transbordo para atendente humano solicitado
    SESSION_PAUSED: 'session_paused',               // Sessão pausada (ex: aguardando atendimento humano)
    SESSION_RESUMED: 'session_resumed',             // Sessão retomada após pausa/transbordo
    // ── Ciclo de Vida de Skills (npx skills) ──
    SKILL_SEARCHED: 'skill_searched',               // Busca de skills realizada
    SKILL_INSTALLED: 'skill_installed',             // Nova skill instalada
    SKILL_ACTIVATED: 'skill_activated',             // Instruções de skill carregadas na sessão
    SKILL_EXECUTION: 'skill_execution',             // Script de skill executado
    SKILL_TELEMETRY: 'skill_telemetry',             // Telemetria e métricas de impacto de skills registradas
    SKILL_REPORT_GENERATED: 'skill_report_generated', // Relatório de eficiência de skills gerado
    // ── Áudio & Síntese de Voz (Kokoro-82M / Nemotron Omni) ──
    AUDIO_OUTPUT: 'audio_output',                   // Áudio de resposta gerado via TTS (Kokoro 82M)
    AUDIO_INPUT_PROCESSED: 'audio_input_processed', // Áudio de entrada transcrito e processado
    // ── Limite de Tokens & Geração ──
    TOKEN_LIMIT_REACHED: 'token_limit_reached',     // Modelo atingiu o limite de tokens da geração
    // ── Execução Durável & Resiliência (v4.0) ──
    CHECKPOINT_SAVED: 'checkpoint_saved',           // Snapshot do estado ou diário salvo com sucesso
    CHECKPOINT_RESTORED: 'checkpoint_restored',     // Sessão restaurada a partir de um checkpoint
    TOOL_REPLAYED: 'tool_replayed',                 // Resultado de tool retornado do cache do diário (idempotência)
    // ── Sandbox Seguro de Execução (v4.0) ──
    SANDBOX_EXECUTE: 'sandbox_execute',             // Código/script despachado para ambiente de sandbox
    SANDBOX_RESULT: 'sandbox_result',               // Retorno de execução em sandbox
    SANDBOX_VIOLATION: 'sandbox_violation',         // Violação de segurança, timeout ou memória no sandbox
    // ── Actor-Critic & Verificação Cognitiva (v4.1) ──
    VERIFICATION_START: 'verification_start',       // Início de validação de resposta candidata
    VERIFICATION_PASSED: 'verification_passed',     // Resposta aprovada pelo validador/Critic
    VERIFICATION_FAILED: 'verification_failed',     // Violação ou inconsistência detectada na resposta
    VERIFICATION_RETRY: 'verification_retry',       // Actor refazendo turno com a crítica construtiva
    // ── Memória em Grafo de Conhecimento / GraphRAG (v4.1) ──
    GRAPH_ENTITY_CREATED: 'graph_entity_created',   // Nova entidade registrada no grafo
    GRAPH_RELATION_CREATED: 'graph_relation_created', // Nova aresta relacional registrada
    GRAPH_CONTEXT_RETRIEVED: 'graph_context_retrieved', // Subgrafo multi-hop recuperado para o prompt
    // ── Swarms Colaborativos & A2A (v4.2) ──
    SWARM_STARTED: 'swarm:started',                 // Enxame iniciado sob uma topologia
    SWARM_MESSAGE_SENT: 'swarm:message_sent',       // Mensagem enviada entre membros do swarm
    SWARM_BLACKBOARD_UPDATED: 'swarm:blackboard_updated', // Quadro compartilhado atualizado
    SWARM_TASK_DISPATCHED: 'swarm:task_dispatched', // Tarefa atribuída a um especialista
    SWARM_TASK_COMPLETED: 'swarm:task_completed',   // Especialista concluiu tarefa
    SWARM_COMPLETED: 'swarm:completed',             // Execução global do swarm finalizada
    // ── Navegação Web & Browser Use (v4.2) ──
    BROWSER_NAVIGATE: 'browser:navigate',           // Navegação em URL iniciada
    BROWSER_ACTION: 'browser:action',               // Ação executada na página (clique, digitação, extração)
    BROWSER_SCREENSHOT: 'browser:screenshot',       // Captura de tela realizada
    // ── Observabilidade OpenTelemetry GenAI (v4.3) ──
    OTEL_SPAN_EXPORTED: 'otel:span_exported',       // Span OpenTelemetry GenAI serializado e exportado
    // ── Trajectory Evals & CI/CD Benchmarking (v4.3) ──
    EVAL_SUITE_STARTED: 'eval:suite_started',       // Início de bateria de regressão
    EVAL_SCENARIO_COMPLETED: 'eval:scenario_completed', // Cenário de avaliação concluído
    EVAL_SUITE_COMPLETED: 'eval:suite_completed',   // Suíte completa de benchmark finalizada
    // ── Injeção Dinâmica de Turnos & Contexto (v4.4) ──
    TURN_INJECTED: 'turn_injected',                 // Turno(s) injetado(s) manualmente no histórico da sessão
    CONTEXT_INJECTED: 'context_injected',           // Contexto dinâmico injetado no system prompt da sessão
    RULE_TRIGGERED: 'rule_triggered',               // Regra declarativa disparou e injetou contexto automaticamente
    RULE_COOLDOWN_BLOCKED: 'rule_cooldown_blocked', // Disparo de regra suprimido por frequency cap ou cooldown
    // ── Analytics de Campanhas & Atribuição Conversacional (v4.4) ──
    INJECTION_RENDERED: 'injection:rendered',       // LLM citou os termos/cupom da campanha na resposta final
    INJECTION_ENGAGED: 'injection:engaged',         // Cliente reagiu/perguntou sobre a campanha no turno seguinte
    INJECTION_CONVERTED: 'injection:converted',     // Ação de sucesso ou ferramenta de conversão alcançada
    // ── Guardrails Adaptativos & Defesa Dinâmica (v4.4) ──
    GUARDRAIL_TRIGGERED: 'guardrail:triggered',     // Violação de segurança detectada e mitigação aplicada
    GUARDRAIL_TIER_CHANGED: 'guardrail:tier_changed', // Nível de risco da sessão alterado (ex: NORMAL -> ELEVATED -> HIGH)
    // ── A/B Testing & Multi-Armed Bandit (v4.4) ──
    EXPERIMENT_VARIANT_SELECTED: 'experiment:variant_selected', // Variante escolhida para a sessão pelo Bandit
    EXPERIMENT_REWARD_RECORDED: 'experiment:reward_recorded',   // Recompensa atribuída à variante após engajamento/conversão
});

module.exports = { AgentEvents };