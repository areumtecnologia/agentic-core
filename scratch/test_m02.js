'use strict';
require('dotenv').config();

const { AgenticCore, AgentConfig, OllamaProvider, AgentEvents } = require('../src');

async function testM02() {
  const core = new AgenticCore({
    provider: new OllamaProvider({
      apiKey: process.env.NVIDIA_API_KEY,
      model: 'qwen3:0.6b',
    }),
    agent: new AgentConfig(
      'Monnalisa',
      'Áreum Tecnologia',
      'Empresa de tecnologia e IA.',
      'Assistente',
      'Responder com precisão',
      'Use suas ferramentas.',
      'pt-BR'
    ),
    calculatorTool: true,
    reasoningTool: true,
    webSearchTool: true,
  });

  core.on(AgentEvents.TOOL_CALL, (data) => console.log('[TOOL_CALL]', data));
  core.on(AgentEvents.TOOL_RESULT, (data) => console.log('[TOOL_RESULT]', data));
  core.on(AgentEvents.ERROR, (data) => console.error('[ERROR]', data));

  const session = core.createSession('test-m02', { name: 'Dev' });
  console.log('Testando M02: "Qual o resultado da expressão 10 + 5 * 4 - 8 / 2?"');
  try {
    const res = await core.processMessage(session.id, 'Qual o resultado da expressão 10 + 5 * 4 - 8 / 2?');
    console.log('Resposta final:', res);
  } catch (e) {
    console.error('Erro:', e);
  }
}

testM02();
