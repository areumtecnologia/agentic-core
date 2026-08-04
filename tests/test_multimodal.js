require('dotenv').config();

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const {
    AutonomousCustomerServiceAgent,
    AgentConfig,
    GoogleProvider,
    OpenAIProvider,
    AnthropicProvider,
    OllamaProvider
} = require('../src');

// Imagem PNG de 1x1 pixel vermelha válida em base64
const RED_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testGoogleReal() {
    console.log('--- 1. Testando chamada real com Gemini (GoogleProvider) ---');
    if (!GOOGLE_GEMINI_API_KEY) {
        console.log('Ignorando teste real do Google pois GOOGLE_GEMINI_API_KEY não está definida.');
        return;
    }

    const agent = new AutonomousCustomerServiceAgent({
        apiKey: GOOGLE_GEMINI_API_KEY,
        model: 'gemini-2.5-flash',
        thinkingLevel: 'OFF',
        retryOptions: { maxAttempts: 1 },
        retryScheduleMinutes: 0.05,
        agent: new AgentConfig(
            'AtendenteMultimodal',
            'Empresa de Teste',
            'Teste multimodal.',
            'Sua missão é responder de que cor é a imagem.',
            'Seja curto e direto e responda a cor em português.',
            'pt-BR'
        )
    });

    const sessionId = `session_multi_${Date.now()}`;
    agent.createSession(sessionId, { name: 'Cliente Multi', phone: '5511999999999', email: 'multi@test.com' });

    try {
        console.log('[Teste] Enviando imagem e texto usando a nova assinatura...');
        const res = await agent.processMessage(
            sessionId,
            'De que cor é esta imagem?',
            { base64: RED_PNG_BASE64, mimetype: 'image/png' }
        );
        console.log('Resposta do Agente:', res.response);
    } catch (error) {
        console.error('Erro no teste real do Google:', error);
    }
}

async function testProviderTranslations() {
    console.log('\n--- 2. Validando tradução de formatos nos outros Providers (OpenAI Standard SDK) ---');

    const contents = [
        {
            role: 'user',
            parts: [
                {
                    inlineData: {
                        data: RED_PNG_BASE64,
                        mimeType: 'image/png'
                    }
                },
                {
                    text: 'O que é isso?'
                }
            ]
        }
    ];

    const originalFetch = globalThis.fetch;
    let lastRequestBody = null;

    globalThis.fetch = async (url, options) => {
        if (options && options.body) {
            lastRequestBody = JSON.parse(options.body);
        }

        const payload = JSON.stringify({
            id: 'chatcmpl-mock',
            object: 'chat.completion',
            choices: [{ message: { role: 'assistant', content: 'Mock OpenAI Standard Response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });

        return new Response(payload, {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    };

    try {
        // A. Validando OpenAIProvider
        console.log('\n[OpenAIProvider] Traduzindo turno multimodal...');
        const openAI = new OpenAIProvider({ apiKey: 'mock-key', model: 'gpt-4o' });
        await openAI.generateContent({
            contents,
            systemInstruction: 'System test',
            tools: [],
            config: { temperature: 0.7, maxOutputTokens: 100 }
        });

        console.log('Mensagens enviadas para OpenAI no body da requisição:');
        console.log(JSON.stringify(lastRequestBody.messages, null, 2));

        const userMsg = lastRequestBody.messages.find(m => m.role === 'user');
        if (userMsg && Array.isArray(userMsg.content)) {
            const hasImage = userMsg.content.some(c => c.type === 'image_url' && c.image_url?.url?.includes(RED_PNG_BASE64));
            if (hasImage) {
                console.log('✓ OpenAI traduzido com sucesso para padrão multimodal openai (image_url)!');
            } else {
                console.error('✗ Erro: OpenAI não incluiu a imagem no formato image_url!');
            }
        } else {
            console.error('✗ Erro: OpenAI não traduziu para formato de array!');
        }

        // B. Validando AnthropicProvider (agora usando pacote OpenAI)
        console.log('\n[AnthropicProvider] Traduzindo turno multimodal usando pacote OpenAI...');
        const anthropic = new AnthropicProvider({ apiKey: 'mock-key', model: 'claude-3-5-sonnet-20241022' });
        await anthropic.generateContent({
            contents,
            systemInstruction: 'System test',
            tools: [],
            config: { temperature: 0.7, maxOutputTokens: 100 }
        });

        console.log('Mensagens enviadas para Anthropic (via OpenAI SDK) no body:');
        console.log(JSON.stringify(lastRequestBody.messages, null, 2));

        const anthropicUserMsg = lastRequestBody.messages.find(m => m.role === 'user');
        if (anthropicUserMsg && Array.isArray(anthropicUserMsg.content)) {
            const hasImage = anthropicUserMsg.content.some(c => c.type === 'image_url');
            if (hasImage) {
                console.log('✓ AnthropicProvider traduzido com sucesso via pacote OpenAI!');
            } else {
                console.error('✗ Erro: AnthropicProvider não incluiu a estrutura image_url!');
            }
        } else {
            console.error('✗ Erro: AnthropicProvider não traduziu para formato de array!');
        }

        // C. Validando OllamaProvider (agora usando pacote OpenAI)
        console.log('\n[OllamaProvider] Traduzindo turno multimodal (imagem e áudio) usando pacote OpenAI...');
        const contentsWithAudio = [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            data: RED_PNG_BASE64,
                            mimeType: 'image/png'
                        }
                    },
                    {
                        inlineData: {
                            data: 'UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==',
                            mimeType: 'audio/wav'
                        }
                    },
                    {
                        text: 'Transcreva e descreva a imagem'
                    }
                ]
            }
        ];
        const ollama = new OllamaProvider({ model: 'gemma4:e4b' });
        await ollama.generateContent({
            contents: contentsWithAudio,
            systemInstruction: 'System test',
            tools: [],
            config: { temperature: 0.7, maxOutputTokens: 100 }
        });

        console.log('Mensagens enviadas para Ollama (via OpenAI SDK) no body:');
        console.log(JSON.stringify(lastRequestBody.messages, null, 2));

        const ollamaUserMsg = lastRequestBody.messages.find(m => m.role === 'user');
        if (ollamaUserMsg && Array.isArray(ollamaUserMsg.content)) {
            const hasImage = ollamaUserMsg.content.some(c => c.type === 'image_url');
            const hasAudio = ollamaUserMsg.content.some(c => c.type === 'input_audio' && c.input_audio?.format === 'wav');
            if (hasImage && hasAudio) {
                console.log('✓ OllamaProvider traduzido com sucesso via pacote OpenAI (image_url e input_audio)!');
            } else {
                console.error('✗ Erro: OllamaProvider não incluiu os anexos multimodal no padrão OpenAI!');
            }
        } else {
            console.error('✗ Erro: OllamaProvider não traduziu para formato de array!');
        }

    } catch (error) {
        console.error('Erro na validação de traduções:', error);
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function run() {
    await testGoogleReal();
    await testProviderTranslations();
}

run();
