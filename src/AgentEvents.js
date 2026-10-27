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
});

module.exports = { AgentEvents };