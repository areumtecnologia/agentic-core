require('dotenv').config();

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const IMAGE_BASE64 = process.env.IMAGE_BASE64;
const AUDIO_BASE64 = process.env.AUDIO_BASE64;
const VIDEO_BASE64 = process.env.VIDEO_BASE64;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const { AgenticCore, Type, AgentEvents, AgentConfig, OllamaProvider, NvidiaProvider } = require('../src') //require('@areumtecnologia/autonomouscustomerserviceagent');
const fs = require('fs');
const { Readable } = require('stream');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
// ─────────────────────────────────────────────────────────────────────────────
// Exemplo de uso completo (multi-turno com tool call real)
// 
// Recursos de Tratamento de Erros e Recovery:
//   • SERVICE_UNAVAILABLE: Emitido quando há erro irrecuperável
//   • RECOVERY_SCHEDULED: Tentativa automática agendada em X minutos
//   • RECOVERY_ATTEMPT: Tentativa de recuperação em execução
//   • inErrorState: Flag que marca sessão em erro (graceful degradation)
//   • Resposta de indisponibilidade customizável (errorMessages)
// ─────────────────────────────────────────────────────────────────────────────
// modelos NvidiaProvider multimodais somente imagem:
// "z-ai/glm-5.2", //"stepfun-ai/step-3.7-flash", //'google/diffusiongemma-26b-a4b-it' 
// modelos NvidiaProvider multimodais com audio:
// //'thinkingmachines/inkling', nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
async function example() {
  const customerAgent = new AgenticCore({
    // apiKey: GOOGLE_GEMINI_API_KEY,
    // model: 'gemma-4-31b-it', // 'gemma-4-26b-a4b-it',
    provider: new OllamaProvider({
      apiKey: NVIDIA_API_KEY,
      model: "LiquidAI/lfm2.5-1.2b-instruct:latest",
    }),
    agent: new AgentConfig(
      'Monnalisa',
      'Áreum Tecnologia',
      'Somos uma empresa de tecnologia especializada em soluções de Inteligência Artificial e Automação de Processos. Estamos localizados em Belém, Pará, Brasil.',
      'Assistente',
      'Fornecer respostas precisas e relevantes para as solicitações do usuário.',
      `Atenda o usuario da melhor forma possível, utilizando as tools disponíveis para obter dados atualizados.`,
      'pt-BR'
    ),
    temperature: 0.4,
    topP: 0.9,
    maxOutputTokens: 512,
    maxAgenticLoopTurns: 5,
    turnTimeoutMs: 60000
  });

  // ── Eventos ───────────────────────────────────────────────────────────────
  customerAgent
    .on(AgentEvents.SESSION_CREATED, ({ session }) => console.log(`[Sessão] Criada: ${session.id}`))
    .on(AgentEvents.SESSION_CLEARED, ({ session }) => console.log(`[Sessão] Limpa: ${session.id}`))
    .on(AgentEvents.TURN_START, ({ depth, session }) => console.log(`[Loop] Turno ${depth} — sessão ${session.id}`))
    .on(AgentEvents.TURN_END, ({ depth, session }) => console.log(`[Loop] Turno ${depth} finalizado — sessão ${session.id}`))
    .on(AgentEvents.RESPONSE, ({ response, reasoning, session, usageMetadata }) => {
      console.log(`[Reasoning] Sessão ${session.id}:`, reasoning);
      console.log('\x1b[32m%s\x1b[0m', `[Agente] Sessão ${session.id}:`, response);
      console.log(`[UsageMetadata] Sessão ${session.id}:`, usageMetadata);

    })
    // .on(AgentEvents.RAW_RESPONSE, ({ rawResponse, session }) => console.log(`[Raw Response] Sessão ${session.id}:`, rawResponse, rawResponse.candidates[0].content.parts))
    .on(AgentEvents.TOOL_CALL, ({ name, args }) => console.log(`[Tool →] ${name}`, args))
    .on(AgentEvents.TOOL_RESULT, ({ name, result }) => console.log(`[Tool ←] ${name}:`, result))
    .on(AgentEvents.RETRY, ({ attempt, delay, error }) => {
      const msg = error?.message || error?.error?.message || String(error);
      console.warn(`[Retry] Tentativa ${attempt} em ${Math.round(delay)}ms - ${msg}`);
    })
    .on(AgentEvents.VULNERABILITY_EXPLORATION_DETECTED, ({ session, attempts }) => {
      console.error(`\x1b[31m%s\x1b[0m`, `[Vulnerability Exploration Detected] - ${session.id} has made ${attempts} attempts. Session details: ${JSON.stringify(session)}`);
    })
    .on(AgentEvents.ERROR, ({ error, source }) => {
      const msg = error?.message || error?.error?.message || String(error);
      console.error(`\x1b[31m%s\x1b[0m`, `[Erro]${source ? ` [${source}]` : ''} - ${msg}`);
    });


  // ── Registra NOVA tool programaticamente (informando o Schema completo) ───
  customerAgent.registerTool({
    name: 'get_current_datetime',
    description: 'Retorna a data e hora atual no fuso horário do Brasil (America/Sao_Paulo).',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () =>
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  );

  customerAgent.registerTool({
    name: 'about_me',
    description: 'Retorna informações sobre você.',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () => {
    return 'Eu sou um assistente virtual chamado Monnalisa, criado pela Áreum Tecnologia para auxiliar clientes com suas solicitações.'
  });

  customerAgent.registerTool({
    name: 'calc',
    description: 'Executa calculos e retorna o resultado.',
    parameters: { 
      type: Type.OBJECT, 
      properties: {
        expression: {
          type: Type.STRING,
          description: 'Expressão matemática a ser calculada (ex: 2 + 2 * 3)'
        }
      } },
  }, async (expression) => {
    try {
      const result = eval(expression);
      return result;
    } catch (error) {
      console.error(`Erro ao calcular expressão: ${expression}`);
      throw new Error('Erro ao calcular expressão');
    }
  });

  const sid = Date.now();
  const session = customerAgent.createSession(sid.toString(), {
    name: 'Renan'
  });

  customerAgent.registerTool({
    name: 'end_chat',
    description: 'Finaliza a sessão de chat.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        sessionId: {
          type: Type.STRING,
          description: 'Retorna a ID da sessão a ser encerrada'
        },
        reason: {
          type: Type.STRING,
          description: 'Motivo pelo qual a sessão foi encerrada'
        }
      }
    },
  }, async (sessionId, reason) => {
    const result = customerAgent.clearSession(sessionId, { reason });
    return { success: result };
  });

  // const caminhoOgg = process.env.AUDIO_OGG_PATH; // Arquivo OGG de entrada (ex: áudio do WhatsApp)

  // if (!fs.existsSync(caminhoOgg)) {
  //   throw new Error(`Arquivo não encontrado no caminho: ${caminhoOgg}`);
  // }

  // console.log('🔄 Convertendo áudio OGG para formato WAV...');
  // // Realiza a conversão em memória e retorna os bytes brutos
  // const wavBuffer = await converterOggParaWavBuffer(caminhoOgg);

  // // Transforma o buffer final de WAV diretamente em Base64
  // const audioBase64 = wavBuffer.toString('base64');
  // console.log('✅ Conversão concluída com sucesso.');

  const questions = [{
    text: "Olá, quem é você?",
  }, {
    text: "Que horas são?",
  }, {
    text: "Qual é a capital do Brasil?",
  }, {
    text: "Explique o que é IA em uma frase.",
  }, {
    text: "Qual o resultado da expressão matemática 2 + 2 * 3?",
  }

  // {
  //   text: "O que é isso?",
  //   attachments: { base64: IMAGE_BASE64, mimeType: 'image/png' }
  // }, {
  //   text: "Transcreva este áudio:",
  //   attachments: { base64: audioBase64, mimeType: 'audio/wav' }
  // }
];
  // Marcar a hora de inicio do turno e quanto tempo ele durou
  const startTime = Date.now();
  for (const question of questions) {
    console.log(`[${new Date().toISOString()}]: ${question.text}`);
    await customerAgent.processMessage(session.id, question.text, question.attachments);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(`[Turno] Turno 1 finalizado em ${duration}ms`);
};


/**
 * Função utilitária que converte um arquivo .ogg local em um Buffer .wav (em memória)
 * usando FFmpeg e Promises.
 */
function converterOggParaWavBuffer(caminhoOgg) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    // Configura o fluxo de conversão do FFmpeg para a memória (Stream)
    ffmpeg(caminhoOgg)
      .toFormat('wav')
      .audioFrequency(16000) // Otimiza para 16kHz (excelente para reconhecimento de voz)
      .audioChannels(1)      // Converte para Mono (reduz o tamanho do payload)
      .on('error', (err) => reject(err))
      .pipe() // Cria um Stream de leitura com o resultado
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)));
  });
}

example();