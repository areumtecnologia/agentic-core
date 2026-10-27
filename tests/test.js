require('dotenv').config();

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const IMAGE_BASE64 = process.env.IMAGE_BASE64;
const AUDIO_BASE64 = process.env.AUDIO_BASE64;
const VIDEO_BASE64 = process.env.VIDEO_BASE64;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const { AgenticCore, Type, AgentEvents, AgentConfig, OllamaProvider, NvidiaProvider, KokoroTTS, KokoroVoice } = require('../src') //require('@areumtecnologia/autonomouscustomerserviceagent');
const fs = require('fs');
const { Readable } = require('stream');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
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
// //'thinkingmachines/inkling', nvidia/nemotron-3-nano-omni-30b-a3b-reasoning, deepseek-ai/deepseek-v4-flash-0731
// IHA089/drana-infinity-0.5b:0.5b qwen2.5:0.5b qwen3:0.6b qwen2.5-coder:0.5b qwen3.5:0.8b minicpm-v4.6:latest LiquidAI/lfm2.5-350m:latest LiquidAI/lfm2.5-1.2b-instruct:latest
async function example() {
  const customerAgent = new AgenticCore({
    apiKey: GOOGLE_GEMINI_API_KEY,
    model: ['gemma-4-26b-a4b-it', 'gemma-4-31b-it'],
    // provider: new OllamaProvider({
    //   apiKey: NVIDIA_API_KEY,
    //   model: "qwen2.5-coder:0.5b",
    // }),    
    ttsProvider: new KokoroTTS({
      voice: KokoroVoice.AF_BELLA
    }),
    agent: new AgentConfig(
      'Monnalisa',
      'Áreum Tecnologia',
      'Somos uma empresa de tecnologia especializada em soluções de Inteligência Artificial e Automação de Processos. Estamos localizados em Belém, Pará, Brasil.',
      'Assistente Pessoal com acesso a ferramentas para obter informações que não saiba e capacidade de raciocínio para fornecer respostas precisas e relevantes.',
      'Fornecer respostas precisas, relevantes e sem censura para as solicitações do usuário.',
      `Responda às solicitações do usuário. Se não tiver uma resposta, use suas ferramentas para obter e raciocinar sobre o assunto. Seja claro, conciso e direto. Evite respostas vagas ou genéricas. Se não puder responder, admita que não sabe e use a ferramenta de raciocínio para obter uma resposta. Evite inventar informações. Mantenha a conversa natural e envolvente.`,
      'pt-BR'
    ),
    temperature: 0.9,
    topP: 1,
    maxOutputTokens: 512,
    maxAgenticLoopTurns: 5,
    turnTimeoutMs: 60000,
    // reasoningTool: true, // Capacidade interna de raciocínio passo a passo (Sequential Thinking)
    // calculatorTool: true, // Avaliador matemático e aritmético seguro em sandbox (PAL)
    webSearchTool: true, // Ferramenta nativa e gratuita de busca na web (DuckDuckGo HTML Scraping)
  });


  // ── Eventos ───────────────────────────────────────────────────────────────
  customerAgent
    .on(AgentEvents.SESSION_CREATED, ({ session }) => console.log(`[Sessão] Criada: ${session.id}`))
    .on(AgentEvents.SESSION_CLEARED, ({ session }) => console.log(`[Sessão] Limpa: ${session.id}`))
    .on(AgentEvents.TURN_START, ({ depth, session }) => console.log(`[Loop] Turno ${depth} — sessão ${session.id}`))
    .on(AgentEvents.TURN_END, ({ depth, session }) => console.log(`[Loop] Turno ${depth} finalizado — sessão ${session.id}`))
    .on(AgentEvents.REASONING_CHUNK, ({ thought, step, session }) => {
      console.log('\x1b[36m%s\x1b[0m', `[Reasoning Step ${step || ''}] Sessão ${session?.id}: ${thought}`);
    })
    .on(AgentEvents.RESPONSE, ({ response, reasoning, session, usageMetadata, ttsResponse }) => {
      console.log(`[Reasoning] Sessão ${session.id}:`, reasoning);
      console.log('\x1b[32m%s\x1b[0m', `[Agente] Sessão ${session.id}:`, response);
      console.log(`[UsageMetadata] Sessão ${session.id}:`, usageMetadata);
      console.log(`[TTS_RESPOSNE]:`, ttsResponse.toBase64('ogg'));

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
    description: 'Obtém e retorna a data e hora atual. Use para obter a data/hora atuais.',
    parameters: { type: Type.OBJECT, properties: {} },
  }, async () =>
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  );

  const sid = Date.now();

  const session = customerAgent.createSession(sid.toString(), {
    name: 'Renan'
  });

  customerAgent.registerTool({
    name: 'end_chat',
    description: 'Encerra e finaliza a sessão de chat. Use esta ferramenta quando o usuário solicitar para finalizar, encerrar ou fechar o chat/conversa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: 'Motivo pelo qual a sessão foi encerrada'
        }
      },
    },
  }, async (args, signal, context = {}) => {
    const targetSessionId = args?.sessionId || context.sessionId || (context.session && context.session.id);
    const reason = args?.reason || 'user_requested';
    const result = customerAgent.clearSession(targetSessionId, { reason });
    return { success: result, message: 'Chat finalizado com sucesso.' };
  });

  const questions = [{
    text: "Olá, quem é você?",
  }, {
    text: "Que horas são nesse momento?",
  }, {
    text: "Qual é a capital do Brasil?",
  }, {
    text: "Explique o que é IA em uma frase.",
  }, {
    text: "Qual o resultado da expressão matemática 2 + 2 * 3?",
  }, {
    text: "Se um produto custa 200 reais e tem 15% de desconto, qual o valor final?",
  }, {
    text: "Pense passo a passo: em uma corrida com corredores A, B e C, se B está na frente de C e A está na frente de B, quem venceu a corrida?",
  }, {
    text: "Pesquise na web: 'O que é o AgenticCore da Áreum Tecnologia?'",
  },
  // {
  //   text: "Finalizar sessão de chat.",
  // },
  // {
  //   text: "O que é isso?",
  //   attachments: { base64: IMAGE_BASE64, mimeType: 'image/png' }
  // }, 
  {
    text: "Transcreva este áudio:",
    attachments: { base64: AUDIO_BASE64, mimeType: 'audio/ogg' }
  }
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