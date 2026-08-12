'use strict';

/**
 * Teste comparativo de todos os modelos Ollama disponíveis localmente.
 *
 * Para cada modelo, o script:
 *   1. Cria um AgenticCore com OllamaProvider apontando para o modelo
 *   2. Registra tools (get_current_datetime, about_me)
 *   3. Envia uma sequência de perguntas (texto + tool call)
 *   4. Mede latência, sucesso/falha, uso de tools e qualidade da resposta
 *   5. Gera um relatório final indicando o(s) melhor(es) modelo(s)
 *
 * Critérios de avaliação:
 *   - Sucesso (respondeu sem erro)
 *   - Latência média por turno
 *   - Capacidade de tool calling (chamou get_current_datetime?)
 *   - Coerência da resposta (não vazia, no idioma correto)
 *
 * Uso:  node tests/test_all_ollama_models.js
 */

const { execSync } = require('child_process');
const { AgenticCore, Type, AgentEvents, AgentConfig, OllamaProvider } = require('../src');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Descobrir modelos disponíveis via `ollama ls`
// ─────────────────────────────────────────────────────────────────────────────
function listOllamaModels() {
  try {
    const output = execSync('ollama ls', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').slice(1); // descarta cabeçalho
    return lines
      .map(line => line.split(/\s+/)[0])
      .filter(Boolean);
  } catch (err) {
    console.error('Não foi possível executar `ollama ls`:', err.message);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Perguntas de teste (texto puro + tool call)
// ─────────────────────────────────────────────────────────────────────────────
const QUESTIONS = [
  { text: 'Olá, quem é você?', expectTool: false },
  { text: 'Que horas são agora?', expectTool: true, toolName: 'get_current_datetime' },
  { text: 'Qual é a capital do Brasil?', expectTool: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Executa o teste para um único modelo
// ─────────────────────────────────────────────────────────────────────────────
async function testModel(modelName) {
  const result = {
    model: modelName,
    success: true,
    error: null,
    turns: 0,
    toolCalls: 0,
    expectedToolCalls: 0,
    toolCallSuccess: 0,
    latencies: [],
    avgLatencyMs: 0,
    responses: [],
    emptyResponses: 0,
    score: 0,
  };

  let agent;
  try {
    agent = new AgenticCore({
      provider: new OllamaProvider({ model: modelName }),
      agent: new AgentConfig(
        'Monnalisa',
        'Áreum Tecnologia',
        'Somos uma empresa de tecnologia especializada em soluções de IA.',
        'Assistente',
        'Fornecer respostas precisas e relevantes.',
        'Atenda o usuário da melhor forma possível, utilizando as tools disponíveis para obter dados atualizados.',
        'pt-BR'
      ),
    });
  } catch (err) {
    result.success = false;
    result.error = `Falha ao instanciar AgenticCore: ${err.message}`;
    return result;
  }

  // Captura de tool calls
  let lastToolCalled = null;
  agent.on(AgentEvents.TOOL_CALL, ({ name }) => { lastToolCalled = name; });
  agent.on(AgentEvents.TOOL_RESULT, ({ name }) => {
    result.toolCalls++;
    if (lastToolCalled === name) result.toolCallSuccess++;
  });
  agent.on(AgentEvents.ERROR, ({ error, source }) => {
    const msg = error?.message || error?.error?.message || String(error);
    console.error(`    [Erro][${modelName}][${source}] ${msg}`);
  });

  // Registra tools
  agent.registerTool({
    name: 'get_current_datetime',
    description: 'Retorna a data e hora atual no fuso horário do Brasil (America/Sao_Paulo).',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

  agent.registerTool({
    name: 'about_me',
    description: 'Retorna informações sobre você.',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () => 'Eu sou um assistente virtual chamado Monnalisa, criado pela Áreum Tecnologia.');

  const sid = `test-${modelName}-${Date.now()}`;
  const session = agent.createSession(sid, { name: 'Renan' });

  for (const q of QUESTIONS) {
    if (q.expectTool) result.expectedToolCalls++;
    const t0 = Date.now();
    let responseText = '';
    let turnError = null;

    // Listener temporário para capturar a resposta deste turno
    const onResponse = ({ response }) => { responseText = response || ''; };
    agent.on(AgentEvents.RESPONSE, onResponse);

    try {
      await agent.processMessage(session.id, q.text);
    } catch (err) {
      turnError = err.message;
      result.success = false;
    }

    const elapsed = Date.now() - t0;
    result.latencies.push(elapsed);
    result.turns++;

    if (!responseText || responseText.trim() === '') result.emptyResponses++;
    result.responses.push({ q: q.text, a: responseText, ms: elapsed, err: turnError });

    agent.off(AgentEvents.RESPONSE, onResponse);

    // Pequeno intervalo para não sobrecarregar
    await new Promise(r => setTimeout(r, 300));
  }

  // Calcula latência média
  result.avgLatencyMs = result.latencies.length
    ? Math.round(result.latencies.reduce((a, b) => a + b, 0) / result.latencies.length)
    : 0;

  // ── Score (0-100) ──────────────────────────────────────────────────────────
  // 40 pts: sucesso geral (proporção de turnos sem erro)
  // 25 pts: tool calling (proporção de tools esperadas que funcionaram)
  // 20 pts: coerência (proporção de respostas não vazias)
  // 15 pts: velocidade (quanto menor a latência média, maior a pontuação)
  // Penalidade: loops de tool calls (toolCalls >> esperados) indicam comportamento patológico
  const successRate = result.turns ? (result.turns - result.responses.filter(r => r.err).length) / result.turns : 0;
  const toolRate = result.expectedToolCalls ? result.toolCallSuccess / result.expectedToolCalls : 0;
  const coherenceRate = result.turns ? (result.turns - result.emptyResponses) / result.turns : 0;
  // Velocidade: 5000ms -> 0 pts, 500ms -> 15 pts (linear)
  const speedPts = Math.max(0, Math.min(15, 15 - ((result.avgLatencyMs - 500) / 300)));

  let score = successRate * 40 + toolRate * 25 + coherenceRate * 20 + speedPts;

  // Penaliza loops de tool calls: se toolCalls > 2x o esperado, aplica penalidade proporcional
  if (result.expectedToolCalls > 0 && result.toolCalls > result.expectedToolCalls * 2) {
    const excess = result.toolCalls - result.expectedToolCalls;
    const penalty = Math.min(score, excess * 5); // cada tool call excedente custa 5 pts
    score -= penalty;
  }

  result.score = Math.max(0, Math.min(100, Math.round(score)));

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Relatório final
// ─────────────────────────────────────────────────────────────────────────────
function printReport(results) {
  console.log('\n');
  console.log('═'.repeat(110));
  console.log('  RELATÓRIO COMPARATIVO DE MODELOS OLLAMA');
  console.log('═'.repeat(110));

  const header = [
    'Modelo'.padEnd(38),
    'OK'.padStart(4),
    'Turnos'.padStart(7),
    'Tools'.padStart(6),
    'ExpTools'.padEnd(8),
    'Lat Méd'.padStart(8),
    'Vazias'.padStart(7),
    'Score'.padStart(6),
  ].join(' | ');
  console.log(header);
  console.log('─'.repeat(110));

  // Ordena por score decrescente
  const sorted = [...results].sort((a, b) => b.score - a.score);

  for (const r of sorted) {
    const ok = r.success ? '✓' : '✗';
    const line = [
      r.model.padEnd(38),
      ok.padStart(4),
      String(r.turns).padStart(7),
      String(r.toolCalls).padStart(6),
      String(r.expectedToolCalls).padEnd(8),
      `${r.avgLatencyMs}ms`.padStart(8),
      String(r.emptyResponses).padStart(7),
      String(r.score).padStart(6),
    ].join(' | ');
    console.log(line);
    if (r.error) console.log(`    ↳ ERRO: ${r.error}`);
  }

  console.log('═'.repeat(110));

  const best = sorted[0];
  if (best) {
    console.log(`\n🏆 MELHOR MODELO: ${best.model} (score ${best.score}/100)`);
    console.log(`   • Turnos bem-sucedidos: ${best.turns - best.responses.filter(r => r.err).length}/${best.turns}`);
    console.log(`   • Tool calls: ${best.toolCalls}/${best.expectedToolCalls} esperadas`);
    console.log(`   • Latência média: ${best.avgLatencyMs}ms`);
    console.log(`   • Respostas vazias: ${best.emptyResponses}`);

    // Lista modelos recomendados (score >= 70)
    const recommended = sorted.filter(r => r.score >= 70);
    if (recommended.length > 1) {
      console.log(`\n⭐ MODELOS RECOMENDADOS (score >= 70):`);
      for (const r of recommended) {
        console.log(`   • ${r.model} — score ${r.score}`);
      }
    }
  }

  // Detalhes das respostas
  console.log('\n');
  console.log('─'.repeat(110));
  console.log('  DETALHES DAS RESPOSTAS');
  console.log('─'.repeat(110));
  for (const r of sorted) {
    console.log(`\n┌─ ${r.model} (score ${r.score})`);
    for (const t of r.responses) {
      console.log(`│  P: ${t.q}`);
      const ans = (t.a || '(sem resposta)').replace(/\n/g, ' ').slice(0, 120);
      console.log(`│  R: ${ans}${t.a && t.a.length > 120 ? '...' : ''}  [${t.ms}ms]${t.err ? ' ⚠ ' + t.err : ''}`);
    }
    console.log('└─');
  }
  console.log('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const models = listOllamaModels();
  console.log(`\n🔍 Encontrados ${models.length} modelos Ollama:`);
  models.forEach(m => console.log(`   • ${m}`));
  console.log('\nIniciando testes...\n');

  const results = [];
  for (const model of models) {
    console.log(`\n▶ Testando modelo: ${model}`);
    try {
      const r = await testModel(model);
      results.push(r);
      console.log(`  → Score: ${r.score}/100 | Latência média: ${r.avgLatencyMs}ms | Tools: ${r.toolCalls}/${r.expectedToolCalls}`);
    } catch (err) {
      console.error(`  → Falha crítica: ${err.message}`);
      results.push({ model, success: false, error: err.message, turns: 0, toolCalls: 0, expectedToolCalls: 0, avgLatencyMs: 0, emptyResponses: 0, responses: [], score: 0 });
    }
  }

  printReport(results);
  process.exit(0);
})();
