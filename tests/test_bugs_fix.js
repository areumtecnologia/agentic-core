'use strict';

const assert = require('assert');
const { AgenticCore, AgentConfig, SubAgent, AgentEvents } = require('../src');
const { BaseProvider } = require('../src/providers/BaseProvider');

class MockProvider extends BaseProvider {
    constructor() {
        super({ model: 'mock-model' });
    }
    getName() { return 'mock'; }
    async generateContent({ contents }) {
        return {
            candidates: [{
                content: {
                    role: 'model',
                    parts: [{ text: 'Mock response' }]
                }
            }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 }
        };
    }
}

async function runBugFixTests() {
    console.log('🧪 Iniciando testes de verificação de correções de bugs...');

    const provider = new MockProvider();
    const config = new AgentConfig('TestAgent', 'TestCorp', 'Details', 'Tester', 'Testing', 'Instructions');
    const agent = new AgenticCore({ provider, agent: config });

    // Teste 1: clearSession com ID numérico
    console.log('Testando 1: clearSession com ID numérico (42)...');
    agent.createSession(42, { name: 'User 42' });
    assert.strictEqual(agent.activeSessionsCount(), 1, 'Sessão 42 deveria ter sido criada');
    const cleared = agent.clearSession(42);
    assert.strictEqual(cleared, true, 'clearSession(42) deveria retornar true');
    assert.strictEqual(agent.activeSessionsCount(), 0, 'Sessão 42 deveria ter sido removida do Map');
    console.log('✅ Teste 1 passou!');

    // Teste 2: unregisterTool
    console.log('Testando 2: unregisterTool...');
    const dummyTool = {
        name: 'dummy_tool',
        description: 'Tool de teste',
        parameters: { type: 'OBJECT', properties: {} }
    };
    agent.registerTool(dummyTool, async () => 'ok');
    const unregistered = agent.unregisterTool('dummy_tool');
    assert.strictEqual(unregistered, true, 'unregisterTool deveria retornar true para tool existente');
    const unregisterNonExistent = agent.unregisterTool('dummy_tool');
    assert.strictEqual(unregisterNonExistent, false, 'unregisterTool deveria retornar false para tool já removida');
    console.log('✅ Teste 2 passou!');

    // Teste 3: SubAgent limpeza de sessão e unregister de tools
    console.log('Testando 3: SubAgent limpeza de sessão e remoção de tools...');
    const subConfig = new AgentConfig('SubAgent', 'TestCorp', 'Details', 'SubTester', 'SubTesting', 'SubInstructions');
    const subTool = {
        name: 'sub_temp_tool',
        description: 'Tool temporária de subagente',
        parameters: { type: 'OBJECT', properties: {} }
    };
    const subAgent = new SubAgent({
        parent: agent,
        config: subConfig,
        name: 'test-subagent',
        tools: [{ declaration: subTool, handler: async () => 'sub ok' }]
    });

    const subResult = await subAgent.execute('Executar tarefa de teste');
    assert.strictEqual(subResult.success, true, 'SubAgent deveria ter executado com sucesso');
    assert.strictEqual(agent.activeSessionsCount(), 0, 'Sessão efêmera do subagente deveria ser limpa');
    assert.strictEqual(agent.unregisterTool('sub_temp_tool'), false, 'Tool temporária do subagente deveria ter sido removida');
    console.log('✅ Teste 3 passou!');

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
}

runBugFixTests().catch(err => {
    console.error('❌ Falha nos testes:', err);
    process.exit(1);
});
