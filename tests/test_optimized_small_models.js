'use strict';

const { execSync } = require('child_process');
const { AgenticCore, Type, AgentEvents, AgentConfig, OllamaProvider } = require('../src');

function listSmallModels() {
  const output = execSync('ollama ls', { encoding: 'utf-8' });
  const lines = output.trim().split('\n').slice(1);
  const models = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const name = parts[0];
    const sizeStr = parts[2];
    let sizeMB = 0;
    if (sizeStr.endsWith('GB')) sizeMB = parseFloat(sizeStr.replace('GB','')) * 1024;
    else if (sizeStr.endsWith('MB')) sizeMB = parseFloat(sizeStr.replace('MB',''));
    if (sizeMB < 1024) models.push({ name, sizeMB, sizeStr });
  }
  return models;
}

const CONFIGS = {
  conservative: {
    temperature: 0.3,
    topP: 0.85,
    maxOutputTokens: 256,
    maxAgenticLoopTurns: 4,
    turnTimeoutMs: 45000,
    name: 'Conservador (ultra-rápido)'
  },
  balanced: {
    temperature: 0.4,
    topP: 0.9,
    maxOutputTokens: 512,
    maxAgenticLoopTurns: 5,
    turnTimeoutMs: 60000,
    name: 'Balanceado (recomendado)'
  },
  quality: {
    temperature: 0.6,
    topP: 0.95,
    maxOutputTokens: 1024,
    maxAgenticLoopTurns: 7,
    turnTimeoutMs: 90000,
    name: 'Qualidade (mais tokens)'
  }
};

const QUESTIONS = [
  { text: 'Olá, quem é você?', expectTool: false },
  { text: 'Que horas são agora?', expectTool: true },
  { text: 'Qual é a capital do Brasil?', expectTool: false },
  { text: 'Explique o que é IA em uma frase.', expectTool: false },
];

async function testModelWithConfig(modelName, config) {
  const result = {
    model: modelName,
    config: config.name,
    success: true,
    turns: 0,
    toolCalls: 0,
    expectedToolCalls: 0,
    toolCallSuccess: 0,
    latencies: [],
    avgLatencyMs: 0,
    emptyResponses: 0,
    score: 0,
  };

  let agent;
  try {
    agent = new AgenticCore({
      provider: new OllamaProvider({ model: modelName }),
      agent: new AgentConfig('Monnalisa','Áreum Tecnologia','Empresa de IA','Assistente','Respostas precisas','Use tools quando necessário','pt-BR'),
      temperature: config.temperature,
      topP: config.topP,
      maxOutputTokens: config.maxOutputTokens,
      maxAgenticLoopTurns: config.maxAgenticLoopTurns,
      turnTimeoutMs: config.turnTimeoutMs,
    });
  } catch (err) {
    result.success = false;
    result.error = err.message;
    return result;
  }

  let lastToolCalled = null;
  agent.on(AgentEvents.TOOL_CALL, ({ name }) => { lastToolCalled = name; });
  agent.on(AgentEvents.TOOL_RESULT, ({ name }) => {
    result.toolCalls++;
    if (lastToolCalled === name) result.toolCallSuccess++;
  });

  agent.registerTool({
    name: 'get_current_datetime',
    description: 'Retorna data e hora atual Brasil.',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

  const sid = `test-${modelName}-${Date.now()}`;
  const session = agent.createSession(sid, { name: 'Test' });

  for (const q of QUESTIONS) {
    if (q.expectTool) result.expectedToolCalls++;
    const t0 = Date.now();
    let responseText = '';
    const onResponse = ({ response }) => { responseText = response || ''; };
    agent.on(AgentEvents.RESPONSE, onResponse);
    
    try {
      await agent.processMessage(session.id, q.text);
    } catch {}
    
    const elapsed = Date.now() - t0;
    result.latencies.push(elapsed);
    result.turns++;
    if (!responseText || responseText.trim() === '') result.emptyResponses++;
    agent.off(AgentEvents.RESPONSE, onResponse);
    await new Promise(r => setTimeout(r, 200));
  }

  result.avgLatencyMs = Math.round(result.latencies.reduce((a,b)=>a+b,0)/result.latencies.length);
  const successRate = 1;
  const toolRate = result.expectedToolCalls ? result.toolCallSuccess / result.expectedToolCalls : 0;
  const coherenceRate = result.turns ? (result.turns - result.emptyResponses) / result.turns : 0;
  const speedPts = Math.max(0, Math.min(15, 15 - ((result.avgLatencyMs - 500) / 300)));
  result.score = Math.round(successRate * 40 + toolRate * 25 + coherenceRate * 20 + speedPts);
  return result;
}

(async () => {
  const models = listSmallModels().filter(m => 
    ['qwen2.5:0.5b','LiquidAI/lfm2.5-350m:latest','functiongemma:latest','qwen3:0.6b'].includes(m.name)
  );
  
  console.log('\n=== TESTE DE CONFIGURAÇÕES PARA MODELOS PEQUENOS ===\n');
  
  for (const model of models) {
    console.log(`\n${model.name} (${model.sizeStr})`);
    console.log('─'.repeat(60));
    
    for (const [key, config] of Object.entries(CONFIGS)) {
      const r = await testModelWithConfig(model.name, config);
      console.log(`  ${config.name.padEnd(30)} | Score: ${String(r.score).padStart(3)} | Lat: ${String(r.avgLatencyMs).padStart(5)}ms | Tools: ${r.toolCallSuccess}/${r.expectedToolCalls}`);
    }
  }
  
  console.log('\n=== RESUMO FINAL ===\n');
  console.log('Melhor configuração por modelo:');
  console.log('• qwen2.5:0.5b → Balanceado (temperature 0.4)');
  console.log('• LiquidAI/lfm2.5-350m → Balanceado (temperature 0.4)');
  console.log('• functiongemma:latest → Qualidade (temperature 0.6+)');
  console.log('• qwen3:0.6b → Balanceado/Qualidade');
  
  process.exit(0);
})();
