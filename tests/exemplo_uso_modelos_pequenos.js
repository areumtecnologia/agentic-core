'use strict';

const { AgenticCore, Type, AgentEvents, AgentConfig, OllamaProvider } = require('../src');

// Exemplo de uso otimizado para modelos pequenos Ollama

// Configuração recomendada para qwen2.5:0.5b (melhor custo-benefício)
const configQwen250 = {
  provider: new OllamaProvider({ model: 'qwen2.5:0.5b' }),
  agent: new AgentConfig(
    'Monnalisa',
    'Áreum Tecnologia',
    'Somos uma empresa de tecnologia especializada em soluções de IA.',
    'Assistente',
    'Fornecer respostas precisas e relevantes.',
    'Atenda o usuário da melhor forma possível, utilizando as tools disponíveis.',
    'pt-BR'
  ),
  temperature: 0.4,
  topP: 0.9,
  maxOutputTokens: 512,
  maxAgenticLoopTurns: 5,
  turnTimeoutMs: 60000
};

// Configuração para functiongemma (especialista em tools)
const configFunctionGemma = {
  provider: new OllamaProvider({ model: 'functiongemma:latest' }),
  agent: new AgentConfig(
    'Monnalisa',
    'Áreum Tecnologia',
    'Somos uma empresa de tecnologia especializada em soluções de IA.',
    'Assistente',
    'Fornecer respostas precisas e relevantes.',
    'Atenda o usuário da melhor forma possível, utilizando as tools disponíveis.',
    'pt-BR'
  ),
  temperature: 0.6,
  topP: 0.95,
  maxOutputTokens: 1024,
  maxAgenticLoopTurns: 7,
  turnTimeoutMs: 90000
};

async function exemploUso() {
  console.log('=== Exemplo de uso com modelo pequeno otimizado ===\n');
  
  const agent = new AgenticCore(configQwen250);
  
  // Registrar tools
  agent.registerTool({
    name: 'get_current_datetime',
    description: 'Retorna a data e hora atual no Brasil.',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  
  agent.registerTool({
    name: 'about_me',
    description: 'Retorna informações sobre o assistente.',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () => 'Sou Monnalisa, assistente da Áreum Tecnologia.');
  
  // Criar sessão
  const session = agent.createSession('demo-session', { name: 'Usuário' });
  
  // Processar mensagens
  const perguntas = [
    'Olá, quem é você?',
    'Que horas são agora?',
    'Qual é a capital do Brasil?'
  ];
  
  for (const pergunta of perguntas) {
    console.log(`\n👤 Usuário: ${pergunta}`);
    const t0 = Date.now();
    
    await agent.processMessage(session.id, pergunta);
    
    const elapsed = Date.now() - t0;
    console.log(`⏱️  Tempo: ${elapsed}ms`);
  }
  
  console.log('\n✅ Exemplo concluído!');
  console.log('\nDicas para modelos pequenos:');
  console.log('1. Use temperature entre 0.3-0.6');
  console.log('2. Limite maxOutputTokens para 512-1024');
  console.log('3. Reduza maxAgenticLoopTurns para 5');
  console.log('4. qwen2.5:0.5b é o melhor custo-benefício');
  console.log('5. functiongemma é especialista em tool calling');
}

exemploUso().catch(console.error);
