require('dotenv').config();
const fs = require('fs');
const { Readable } = require('stream');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');

// 1. Inicializa o cliente OpenAI/NVIDIA NIM
const client = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  defaultHeaders: {
    'NVCF-POLL-SECONDS': '1800'
  }
});

const MODEL_NAME = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

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

async function processarEEnviarAudio() {
  try {
    const caminhoOgg = process.env.AUDIO_OGG_PATH; // Arquivo OGG de entrada (ex: áudio do WhatsApp)

    if (!fs.existsSync(caminhoOgg)) {
      throw new Error(`Arquivo não encontrado no caminho: ${caminhoOgg}`);
    }

    console.log('🔄 Convertendo áudio OGG para formato WAV...');
    // Realiza a conversão em memória e retorna os bytes brutos
    const wavBuffer = await converterOggParaWavBuffer(caminhoOgg);

    // Transforma o buffer final de WAV diretamente em Base64
    const audioBase64 = wavBuffer.toString('base64');
    console.log('✅ Conversão concluída com sucesso.');

    console.log('🚀 Enviando dados multimodais para o Nemotron...');

    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0.2, // Mantido baixo devido à limitação de áudio do modelo
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcreva o áudio fornecido e extraia os pontos principais.'
            },
            {
              // CORREÇÃO: Utilizando a estrutura de URL com Data URI (Base64) esperada pelo NIM da NVIDIA
              type: 'audio_url',
              audio_url: {
                url: `data:audio/wav;base64,${audioBase64}`
              }
            }
          ]
        }
      ]
    });

    console.log('\n--- Resposta do Modelo ---');
    console.log(response);
    console.log(response.choices?.[0]?.message?.content);

  } catch (error) {
    console.error('\n❌ Erro durante a execução:', error.message);
  }
}

// Executa o fluxo completo
processarEEnviarAudio();
