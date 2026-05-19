require('dotenv').config();

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const { AutonomousCustomerServiceAgent, Type, AgentEvents } = require('../src/index');

// ─────────────────────────────────────────────────────────────────────────────
// Exemplo de uso completo (multi-turno com tool call real)
// ─────────────────────────────────────────────────────────────────────────────

async function example() {
  const productCategories = ['Passeios', 'Trilhas', 'Hospedagem', 'VIP', 'Noturno', 'Luxo', 'Econômico', 'Iniciantes', 'Barco'];

  const customerAgent = new AutonomousCustomerServiceAgent({
    apiKey: GOOGLE_GEMINI_API_KEY,
    model: 'gemma-4-26b-a4b-it',
    company: {
      name:    'Poranduba Amazônia Turismo',
      details: 'Ecoturismo premium na Amazônia. Especialistas em turismo sustentável desde 2010.',
    },
    agent: {
      name:                            'Monnalisa',
      identity:          'especialista em qualificação de leads.',
      mission: {
        objective: 'Sua missão é atuar como agente de atendimento especializado em qualificação e conversão de leads.',
        instructions: `
        ATENÇÃO: Siga rigorosamente estas etapas para ter sucesso na missão. A penalidade por não seguir as etapas estabelecidas é a falha na missão.
        1. Cumprimente o lead de forma imediata, profissional e acolhedora usando expressões comuns do dia-a-dia (Bom dia, Boa tarde, Boa noite, etc). 
          Nota: Obedecer a essa diretiva demonstra alta disponibilidade e criar conexão emocional, aumentando a confiança do lead no atendimento.
        2. Descubra as necessidades e interesses do lead, antes de chamar ferramentas. 
          Nota: Obedecer a essa diretiva aumenta a eficiência do atendimento permitindo o uso adequado de ferramentas tornando a experiência do lead mais fluida e satisfatória.
        3. Após o lead expressar claramente suas necessidades ou questões, utilize as ferramentas disponíveis para obter dados atualizados.
        4. Forneça respostas precisas e contextualizadas, incorporando os resultados das tools de forma natural.
        5. Classifique o lead com base nas informações coletadas.
        6. Efetive a venda, se aplicável, utilizando as ferramentas de checkout disponíveis.
        7. Encerre a conversa de forma profissional, agradecendo o contato e informando os próximos passos, se aplicável.
      `,
      }
    },
    sessionTTL:               20 * 60 * 1_000,    // 20 min
    turnTimeoutMs:            90_000,             // 90 segundos (aumentado de 30s)
    maxVulnerabilityAttempts: 3,
    retryOptions:             { maxAttempts: 5, baseDelayMs: 800, maxDelayMs: 8000 },
  });

  // ── Eventos ───────────────────────────────────────────────────────────────
  customerAgent
    .on(AgentEvents.SESSION_CREATED, ({ sessionId }) => console.log(`[Sessão] Criada: ${sessionId}`))
    .on(AgentEvents.SESSION_CLEARED, ({ sessionId }) => console.log(`[Sessão] Limpa: ${sessionId}`))
    .on(AgentEvents.TURN_START,      ({ depth, sessionId }) => console.log(`[Loop] Turno ${depth} — sessão ${sessionId}`))
    .on(AgentEvents.TURN_END,        ({ depth, sessionId }) => console.log(`[Loop] Turno ${depth} finalizado — sessão ${sessionId}`))
    .on(AgentEvents.RESPONSE,     ({ response, sessionId, purchase_probability }) => {
      console.log('\x1b[32m%s\x1b[0m',`[Agente] Sessão ${sessionId}:`, response);
      if (purchase_probability !== undefined) {
        console.log(`  → Probabilidade de compra estimada: ${(purchase_probability * 100).toFixed(1)}%`);
      }
    })
    .on(AgentEvents.TOOL_CALL,       ({ name, args }) => console.log(`[Tool →] ${name}`, args))
    .on(AgentEvents.TOOL_RESULT,     ({ name, result }) => console.log(`[Tool ←] ${name}:`, result))
    .on(AgentEvents.RETRY,           ({ attempt, delay, error }) => {
      const msg = error?.message || error?.error?.message || String(error);
      console.warn(`[Retry] Tentativa ${attempt} em ${Math.round(delay)}ms - ${msg}`);
    })    
    .on(AgentEvents.VULNERABILITY_EXPLORATION_DETECTED, ({ error }) => {
      const msg = error?.message || error?.error?.message || String(error);
      console.error(`\x1b[31m%s\x1b[0m`, `[Vulnerability Exploration Detected] - ${msg}`);
    })
    .on(AgentEvents.ERROR,           ({ error, source }) => {
      const msg = error?.message || error?.error?.message || String(error);
      console.error(`\x1b[31m%s\x1b[0m`, `[Erro]${source ? ` [${source}]` : ''} - ${msg}`);
    });



  // ── Registra NOVA tool programaticamente (informando o Schema completo) ───
  customerAgent.registerTool({
      name:        'get_current_datetime',
      description: 'Retorna a data e hora atual no fuso horário do Brasil (America/Sao_Paulo).',
      parameters:  { type: Type.OBJECT, properties: {} },
    }, async () =>
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  );

  customerAgent.registerTool({
    name:        'get_product_data',
    description: 'Obtém informações de produtos e serviços da empresa (preços, disponibilidade, detalhes) com base em tags ou palavras-chave.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tags: {
          type:        Type.ARRAY,
          items:       { type: Type.STRING, enum: productCategories },
          description: 'Categorias a consultar. Null ou omitido retorna todas.',
        },
      },
    },
  }, async ({ tags } = {}) => {
    const categories = tags?.length ? tags : productCategories;
    const products = [
      { id: 1, name: 'Passeios de Barco', price: 'R$ 200', details: 'Passeio de 4 horas pelos igarapés.', tags: ['Passeios', 'Barco'] },
      { id: 2, name: 'Trilhas', price: 'R$ 150', details: 'Trilha de 3 horas na floresta.', tags: ['Trilhas'] },
      { id: 3, name: 'Hospedagem', price: 'R$ 500/noite', details: 'Quarto confortável com vista para o rio.', tags: ['Hospedagem'] },
      { id: 4, name: 'Passeios de Barco VIP', price: 'R$ 400', details: 'Passeio exclusivo de 6 horas com guia privado.', tags: ['Passeios', 'Barco', 'VIP'] },
      { id: 5, name: 'Trilhas Noturnas', price: 'R$ 180', details: 'Trilha de 2 horas para observar a vida noturna da floresta.', tags: ['Trilhas', 'Noturno'] },
      { id: 6, name: 'Hospedagem Luxo', price: 'R$ 800/noite', details: 'Suíte de luxo com todas as comodidades.', tags: ['Hospedagem', 'Luxo'] },
      { id: 7, name: 'Passeios de Barco Econômico', price: 'R$ 100', details: 'Passeio de 2 horas pelos igarapés.', tags: ['Passeios', 'Barco', 'Econômico'] },
      { id: 8, name: 'Trilhas para Iniciantes', price: 'R$ 120', details: 'Trilha de 1 hora para iniciantes.', tags: ['Trilhas', 'Iniciantes'] },
      { id: 9, name: 'Hospedagem Econômica', price: 'R$ 300/noite', details: 'Quarto econômico com vista para o jardim.', tags: ['Hospedagem', 'Econômica'] },
    ];
    return JSON.stringify(products.filter(p => categories.some(category => p.tags.includes(category))));
  });

  customerAgent.registerTool({
    name: 'check_availability',
    description: 'Verifica a disponibilidade de vagas para uma reserva em determinada data.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING, enum: productCategories },
          description: 'Categorias a consultar. Null ou omitido retorna todas.',
        },
        date: { type: Type.STRING, description: 'Data desejada no formato YYYY-MM-DD' }
      },
      required: ['tags', 'date']
    }
  }, async ({ tags, date }, _signal) => {
    return JSON.stringify({ servico: tags, data: date, disponivel: true, vagas_restantes: 5 });
  });

  customerAgent.registerTool({
      name:        'checkout',
      description: 'Finaliza a compra usando informacoes do lead e retorna os detalhes da transação.',
      parameters:  { 
        type: Type.OBJECT, 
        properties: {
          product_id: { 
            type: Type.INTEGER, 
            description: 'ID do produto a ser comprado.' 
          },
          customer_info: { 
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Nome do cliente.' },
              phone: { type: Type.STRING, description: 'Telefone do cliente.' },
              email: { type: Type.STRING, description: 'Email do cliente.' },
            },
          } 
        }
      },
    }, async () =>
    { 
      /* Lógica de checkout */ 
      return JSON.stringify({ success: true, order_id: 'ABC123', message: 'Compra finalizada com sucesso!' });
    }
  );

  customerAgent.registerTool({
      name:        'clear_session',
      description: 'Limpa a sessão atual, após concluir a conversa.',
      parameters:  { type: Type.OBJECT, properties: {} },
    }, async () =>
    customerAgent.clearSession(sessionId)
  );

  // ── Conversa multi-turno ──────────────────────────────────────────────────
  const sessionId = customerAgent.createSession({
    name:   'Renan',
    phone:  '5591981648646',
    origin: { id: '12345', type: 'whatsapp', description: 'Lead via WhatsApp.' }
  });

  try {
    // Turno 1 → agente atenderá o lead com boas-vindas
    console.log('\x1b[33m%s\x1b[0m', `\n[Lead]: Olá!`); // Simula mensagem do lead
    const r1 = await customerAgent.processMessage('Olá!', sessionId);

    // Turno 2 → agente usará get_product_data
    console.log('\x1b[33m%s\x1b[0m', `\n[Lead]: Quais os valores dos passeios de barco?`); // Simula mensagem do lead
    const r2 = await customerAgent.processMessage('Quais os valores dos passeios de barco?', sessionId);

    // Turno 3 → agente usará a tool recém criada programaticamente 'check_availability'
    console.log('\x1b[33m%s\x1b[0m', `\n[Lead]: Tem disponibilidade para o dia 20 de maio?`); // Simula mensagem do lead
    const r3 = await customerAgent.processMessage('Tem disponibilidade para o dia 20 de maio?', sessionId);

    // Turno 4 - Cliente aceita a oferta
    console.log('\x1b[33m%s\x1b[0m', `\n[Lead]: Perfeito, quero reservar!`); // Simula mensagem do lead
    const r4 = await customerAgent.processMessage('Perfeito, quero reservar!', sessionId);

    // Turno 5 - Cliente fornece informações para checkout
    console.log('\x1b[33m%s\x1b[0m', `\n[Lead]: Meu nome é Renan, meu telefone é 5591981648646 e meu email é renan@example.com`); // Simula mensagem do lead
    const r5 = await customerAgent.processMessage('Meu nome é Renan, meu telefone é 5591981648646 e meu email é renan@example.com', sessionId);

  } catch (err) {
    const msg = err?.message || String(err);
    console.error('\x1b[31m%s\x1b[0m', `[Erro Capturado] ${msg}`);
  } finally {
    customerAgent.clearSession(sessionId);
  }
}
// Delay entre execuções
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Executa o teste consecutivamente para validar estabilidade e performance
(async () => {
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < 5; i++) {
    try {
      console.log(`\n\x1b[36m%s\x1b[0m`, `\n=== Execução de Teste ${i + 1} ===`);
      await example();
      successCount++;
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('\x1b[31m%s\x1b[0m', `[Erro Fatal] ${msg}`);
      failureCount++;
    }
    // Aguarda 2 segundos entre testes para evitar rate limiting
    if (i < 4) {
      console.log('\x1b[90m%s\x1b[0m', '[Aguardando 2s antes do próximo teste...]');
      await delay(2000);
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log('\n\x1b[36m%s\x1b[0m', '\n=== Testes Concluídos ===');
  console.log(`✓ Sucessos: ${successCount}`);
  console.log(`✗ Falhas: ${failureCount}`);
  console.log(`⏱ Duração: ${duration.toFixed(1)}s`);
})();