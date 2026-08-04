'use strict';

/**
 * Teste de regressão: valida que os providers NÃO mutam o array `contents`
 * passado pelo caller (Bug 1.3 — Mutação de input `contents`).
 *
 * Antes da correção, AnthropicProvider/OpenAIProvider/NvidiaProvider adicionavam
 * propriedades `_anthropicToolUseIds` / `_openAIToolCallIds` / `_nvidiaToolCallIds`
 * diretamente nos objetos do turno `tool` do array de entrada.
 */

const assert = require('assert');
const { OpenAIProvider, AnthropicProvider, NvidiaProvider } = require('../src/providers');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Snapshot congelado (deep) dos turnos para comparação posterior.
 * Serializa apenas as chaves "públicas" conhecidas (role, parts).
 */
function snapshotContents(contents) {
    return contents.map(t => ({
        role: t.role,
        parts: t.parts.map(p => ({ ...p })),
    }));
}

/**
 * Verifica se algum turno do array possui chaves "privadas" injetadas pelos providers.
 */
function hasInjectedKeys(contents) {
    const badKeys = ['_openAIToolCallIds', '_anthropicToolUseIds', '_nvidiaToolCallIds'];
    return contents.some(t => badKeys.some(k => Object.prototype.hasOwnProperty.call(t, k)));
}

// ── Conteúdo de exemplo com tool call + tool result ─────────────────────────

function buildContents() {
    return [
        {
            role: 'user',
            parts: [{ text: 'Qual o desconto para o cliente João?' }],
        },
        {
            role: 'model',
            parts: [
                { text: 'Vou verificar o desconto.' },
                { functionCall: { name: 'calcular_desconto', args: { cliente: 'João', valor: 100 } } },
            ],
        },
        {
            role: 'tool',
            parts: [
                { functionResponse: { name: 'calcular_desconto', response: { result: '15' } } },
            ],
        },
    ];
}

// ── Acesso aos métodos privados via reflexão ─────────────────────────────────

function callTranslate(provider, contents, systemInstruction) {
    // Os métodos #translateContentsToMessages são privados; acessamos via nome interno.
    // Em Node, campos privados não são acessíveis via reflexão, então testamos pelo
    // efeito colateral: chamamos generateContent com fetch mockado e inspecionamos contents.
    // Aqui usamos uma abordagem mais direta: stub do método interno via prototype não funciona
    // para campos privados. Então validamos pelo contrato público.
    return null;
}

// ── Teste principal: chamar generateContent com fetch mockado ─────────────────

async function runNoMutationTest() {
    console.log('=== Teste de regressão: providers não devem mutar contents ===\n');

    const providers = [
        { name: 'OpenAIProvider', Ctor: OpenAIProvider, opts: { apiKey: 'sk-test', model: 'gpt-4' } },
        { name: 'AnthropicProvider', Ctor: AnthropicProvider, opts: { apiKey: 'sk-ant-test', model: 'claude-3' } },
        { name: 'NvidiaProvider', Ctor: NvidiaProvider, opts: { apiKey: 'nv-test', model: 'meta/llama' } },
    ];

    for (const { name, Ctor, opts } of providers) {
        console.log(`→ Testando ${name}...`);

        const provider = new Ctor(opts);
        const contents = buildContents();
        const before = snapshotContents(contents);

        // Mock do fetch / SDK para evitar chamadas reais à API.
        // Interceptamos a chamada e deixamos falhar — o que importa é inspecionar
        // `contents` APÓS a tentativa, para garantir que nenhuma chave foi injetada.
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [{ message: { content: 'ok' } }],
                    content: [{ type: 'text', text: 'ok' }],
                }),
                text: async () => '',
            };
        };

        // Para o GoogleProvider usamos SDK; aqui só testamos os baseados em fetch.
        try {
            await provider.generateContent({
                contents,
                systemInstruction: 'Você é um assistente de teste.',
                tools: [],
                config: { temperature: 0.5, maxOutputTokens: 100, topP: 0.9 },
                signal: undefined,
            }).catch(() => { /* ignoramos erros de parsing da resposta mock */ });
        } finally {
            globalThis.fetch = originalFetch;
        }

        // Validação 1: nenhuma chave privada foi injetada
        assert.ok(!hasInjectedKeys(contents), `${name} injetou chaves privadas em contents!`);
        console.log(`  [PASS] Nenhuma chave privada injetada em contents.`);

        // Validação 2: o snapshot antes/depois é idêntico
        const after = snapshotContents(contents);
        assert.deepStrictEqual(after, before, `${name} modificou a estrutura de contents!`);
        console.log(`  [PASS] Estrutura de contents preservada (deep equal).`);

        console.log();
    }

    console.log('=== [SUCESSO] Nenhum provider mutou o array de entrada ===');
}

runNoMutationTest().catch((err) => {
    console.error('\n[FALHA]', err);
    process.exit(1);
});
