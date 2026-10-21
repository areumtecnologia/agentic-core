'use strict';
require('dotenv').config();

const { AgenticCore, AgentConfig, OllamaProvider } = require('../src');

async function testR04() {
  const core = new AgenticCore({
    provider: new OllamaProvider({
      apiKey: process.env.NVIDIA_API_KEY,
      model: 'qwen3:0.6b',
    }),
    agent: new AgentConfig(
      'Monnalisa',
      'Áreum Tecnologia',
      'Empresa de tecnologia e IA.',
      'Assistente de validação',
      'Responder com precisão',
      'Use suas ferramentas para responder.',
      'pt-BR'
    ),
    calculatorTool: true,
    reasoningTool: true,
    webSearchTool: true,
  });

  const session = core.createSession('test-r04', { name: 'Dev' });
  console.log('Testando pergunta R04...');
  try {
    const res = await core.processMessage(session.id, 'Pense passo a passo: A mãe de Maria tem 4 filhas: Lalá, Lelé, Lili e quem é a quarta filha?');
    console.log('Resposta:', res);
  } catch (e) {
    console.error('Erro em R04:', e);
  }
}

testR04();
