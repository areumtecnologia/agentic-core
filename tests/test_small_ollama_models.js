'use strict';

const { execSync } = require('child_process');
const { AgenticCore, Type, AgentEvents, AgentConfig, OllamaProvider } = require('../src');

function listOllamaModelsWithSize() {
  try {
    const output = execSync('ollama ls', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').slice(1);
    const models = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const name = parts[0];
      const sizeStr = parts[2];
      let sizeMB = 0;
      if (sizeStr.endsWith('GB')) {
        sizeMB = parseFloat(sizeStr.replace('GB','')) * 1024;
      } else if (sizeStr.endsWith('MB')) {
        sizeMB = parseFloat(sizeStr.replace('MB',''));
      }
      models.push({ name, sizeMB, sizeStr });
    }
    return models;
  } catch (err) {
    console.error('Não foi possível executar `ollama ls`:', err.message);
    process.exit(1);
  }
}

function isSmallModel(m) {
  return m.sizeMB < 1024;
}

const QUESTIONS = [
  { text: 'Olá, quem é você?', expectTool: false },
  { text: 'Que horas são agora?', expectTool: true, toolName: 'get_current_datetime' },
  { text: 'Qual é a capital do Brasil?', expectTool: false },
];

async function testModel(modelName, configOverrides = {}) {
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
    config: configOverrides,
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
      temperature: configOverrides.temperature ?? 1,
      topP: configOverrides.topP ?? 0.95,
      maxOutputTokens: configOverrides.maxOutputTokens ?? 32768,
      maxAgenticLoopTurns: configOverrides.maxAgenticLoopTurns ?? 9,
      turnTimeoutMs: configOverrides.turnTimeoutMs ?? 90000,
    });
  } catch (err) {
    result.success = false;
    result.error = `Falha ao instanciar AgenticCore: ${err.message}`;
    return result;
  }

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
    await new Promise(r => setTimeout(r, 300));
  }

  result.avgLatencyMs = result.latencies.length
    ? Math.round(result.latencies.reduce((a, b) => a + b, 0) / result.latencies.length)
    : 0;

  const successRate = result.turns ? (result.turns - result.responses.filter(r => r.err).length) / result.turns : 0;
  const toolRate = result.expectedToolCalls ? result.toolCallSuccess / result.expectedToolCalls : 0;
  const coherenceRate = result.turns ? (result.turns - result.emptyResponses) / result.turns : 0;
  const speedPts = Math.max(0, Math.min(15, 15 - ((result.avgLatencyMs - 500) / 300)));

  let score = successRate * 40 + toolRate * 25 + coherenceRate * 20 + speedPts;

  if (result.expectedToolCalls > 0 && result.toolCalls > result.expectedToolCalls * 2) {
    const excess = result.toolCalls - result.expectedToolCalls;
    const penalty = Math.min(score, excess * 5);
    score -= penalty;
  }

  result.score = Math.max(0, Math.min(100, Math.round(score)));
  return result;
}

function printReport(results, title) {
  console.log('\n');
  console.log('═'.repeat(110));
  console.log(`  ${title}`);
  console.log('═'.repeat(110));

  const header = [
    'Modelo'.padEnd(38),
    'Tamanho'.padEnd(10),
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

  const sorted = [...results].sort((a, b) => b.score - a.score);
  for (const r of sorted) {
    const ok = r.success ? '✓' : '✗';
    const size = r.sizeStr || '';
    const line = [
      r.model.padEnd(38),
      size.padEnd(10),
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
    console.log(`   • Tamanho: ${best.sizeStr}`);
    console.log(`   • Latência média: ${best.avgLatencyMs}ms`);
    console.log(`   • Tool calls: ${best.toolCalls}/${best.expectedToolCalls} esperadas`);
  }
  console.log('\n');
}

(async () => {
  const allModels = listOllamaModelsWithSize();
  const smallModels = allModels.filter(isSmallModel);
  console.log(`\n🔍 Modelos < 1GB encontrados: ${smallModels.length}`);
  smallModels.forEach(m => console.log(`   • ${m.name} — ${m.sizeStr}`));

  const defaultConfig = {};
  const optimizedConfig = {
    temperature: 0.4,
    topP: 0.9,
    maxOutputTokens: 512,
    maxAgenticLoopTurns: 5,
    turnTimeoutMs: 60000,
  };

  console.log('\n=== TESTE COM PARÂMETROS PADRÃO ===\n');
  const resultsDefault = [];
  for (const m of smallModels) {
    console.log(`▶ Testando ${m.name} (${m.sizeStr}) - padrão`);
    const r = await testModel(m.name, defaultConfig);
    r.sizeStr = m.sizeStr;
    resultsDefault.push(r);
    console.log(`  → Score: ${r.score}/100 | Latência: ${r.avgLatencyMs}ms`);
  }
  printReport(resultsDefault, 'RELATÓRIO MODELOS <1GB - PARÂMETROS PADRÃO');

  console.log('\n=== TESTE COM PARÂMETROS OTIMIZADOS PARA MODELOS PEQUENOS ===\n');
  const resultsOptimized = [];
  for (const m of smallModels) {
    console.log(`▶ Testando ${m.name} (${m.sizeStr}) - otimizado`);
    const r = await testModel(m.name, optimizedConfig);
    r.sizeStr = m.sizeStr;
    resultsOptimized.push(r);
    console.log(`  → Score: ${r.score}/100 | Latência: ${r.avgLatencyMs}ms`);
  }
  printReport(resultsOptimized, 'RELATÓRIO MODELOS <1GB - PARÂMETROS OTIMIZADOS');

  // Comparação
  console.log('═'.repeat(110));
  console.log('  COMPARAÇÃO PADRÃO vs OTIMIZADO');
  console.log('═'.repeat(110));
  for (const m of smallModels) {
    const def = resultsDefault.find(r => r.model === m.name);
    const opt = resultsOptimized.find(r => r.model === m.name);
    if (def && opt) {
      const delta = opt.score - def.score;
      const sign = delta >= 0 ? '+' : '';
      console.log(`${m.name.padEnd(38)} | Padrão: ${String(def.score).padStart(3)} | Otimizado: ${String(opt.score).padStart(3)} | Δ ${sign}${delta}`);
    }
  }
  console.log('═'.repeat(110));

  process.exit(0);
})();
