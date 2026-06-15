'use strict';

const assert = require('assert');
const { AutonomousCustomerServiceAgent, BaseProvider, AgentEvents, AgentConfig } = require('../src');

// ── Mock Provider para simular sucessos e erros ─────────────────────────────
class MockProvider extends BaseProvider {
    constructor({ model, shouldFail = false, failStatus = 500, responseText = 'Success' } = {}) {
        super({ model });
        this.shouldFail = shouldFail;
        this.failStatus = failStatus;
        this.responseText = responseText;
        this.callCount = 0;
    }

    getName() {
        return 'mock';
    }

    async generateContent({ contents, systemInstruction, tools, config, signal }) {
        this.callCount++;
        if (this.shouldFail) {
            const err = new Error(`Simulated API error ${this.failStatus}`);
            err.status = this.failStatus;
            throw err;
        }
        return {
            candidates: [{
                content: {
                    role: 'model',
                    parts: [{ text: this.responseText }]
                }
            }],
            usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 10,
                totalTokenCount: 20
            }
        };
    }
}

// ── Helpers ──
function createAgentConfig() {
    return new AgentConfig(
        'TestAgent',
        'TestCompany',
        'Details',
        'Objective',
        'Instructions',
        'pt-BR'
    );
}

// ── Suite de Testes ──
async function runTests() {
    console.log('=== Iniciando testes de Failover ===\n');

    const agentConfig = createAgentConfig();

    // ─────────────────────────────────────────────────────────────────────────
    // Teste 1: Valida que um único provedor saudável funciona normalmente
    // ─────────────────────────────────────────────────────────────────────────
    {
        console.log('Teste 1: Provedor único saudável...');
        const healthyProvider = new MockProvider({ model: 'gemma-4-26b-a4b-it', responseText: 'Olá do Gemma!' });
        
        const agent = new AutonomousCustomerServiceAgent({
            provider: healthyProvider,
            agent: agentConfig,
        });

        const session = agent.createSession('s1', { name: 'User1', phone: '123' });
        const res = await agent.processMessage(session.id, 'Oi');
        
        assert.strictEqual(res.response, 'Olá do Gemma!');
        assert.strictEqual(healthyProvider.callCount, 1);
        console.log('✅ Passou!');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Teste 2: Failover básico (Erro 500 no gemma-4-26b-a4b-it -> gemma-4-31b-it)
    // ─────────────────────────────────────────────────────────────────────────
    {
        console.log('\nTeste 2: Failover de erro 500 no gemma-4-26b-a4b-it para gemma-4-31b-it...');
        const failingProvider = new MockProvider({ model: 'gemma-4-26b-a4b-it', shouldFail: true, failStatus: 500 });
        const backupProvider = new MockProvider({ model: 'gemma-4-31b-it', responseText: 'Backup gemma-4-31b-it ativo!' });

        let fallbackEventEmitted = false;
        
        const agent = new AutonomousCustomerServiceAgent({
            providers: [failingProvider, backupProvider],
            agent: agentConfig,
            retryOptions: { maxAttempts: 1 } // Mantém retry curto para agilizar teste
        });

        agent.on(AgentEvents.PROVIDER_FALLBACK, (data) => {
            fallbackEventEmitted = true;
            assert.strictEqual(data.failedModel, 'gemma-4-26b-a4b-it');
            assert.strictEqual(data.nextModel, 'gemma-4-31b-it');
            assert.strictEqual(data.error.status, 500);
            console.log(`   [Evento] provider_fallback emitido com sucesso: ${data.failedModel} -> ${data.nextModel}`);
        });

        const session = agent.createSession('s2', { name: 'User2', phone: '123' });
        const res = await agent.processMessage(session.id, 'Oi');

        assert.strictEqual(res.response, 'Backup gemma-4-31b-it ativo!');
        assert.strictEqual(failingProvider.callCount, 1);
        assert.strictEqual(backupProvider.callCount, 1);
        assert.strictEqual(fallbackEventEmitted, true, 'Deveria ter emitido o evento de fallback');
        console.log('✅ Passou!');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Teste 3: Erro não-5xx (ex: 400 Bad Request) não deve acionar failover
    // ─────────────────────────────────────────────────────────────────────────
    {
        console.log('\nTeste 3: Erro não-5xx (ex: 400) não deve acionar failover...');
        const badRequestProvider = new MockProvider({ model: 'gemma-4-26b-a4b-it', shouldFail: true, failStatus: 400 });
        const backupProvider = new MockProvider({ model: 'gemma-4-31b-it', responseText: 'Não deve chamar isso' });

        let fallbackEventEmitted = false;

        const agent = new AutonomousCustomerServiceAgent({
            providers: [badRequestProvider, backupProvider],
            agent: agentConfig,
            retryOptions: { maxAttempts: 1 },
            retryScheduleAttempts: 1,
            retryScheduleMinutes: 0.0001
        });

        agent.on(AgentEvents.PROVIDER_FALLBACK, () => {
            fallbackEventEmitted = true;
        });

        agent.on(AgentEvents.ERROR, () => {
            // Ignora para o teste prosseguir normalmente
        });

        const session = agent.createSession('s3', { name: 'User3', phone: '123' });
        
        const res = await agent.processMessage(session.id, 'Oi');

        // Em caso de erro não-5xx e não-retentável (ou após esgotar retentativas configuradas),
        // o agente deve retornar a resposta de indisponibilidade padrão, não a resposta do backup.
        assert.strictEqual(res.response, 'We are experiencing a temporary outage. We will contact you as soon as the problem is resolved.');
        assert.strictEqual(badRequestProvider.callCount, 2);
        assert.strictEqual(backupProvider.callCount, 0);
        assert.strictEqual(fallbackEventEmitted, false, 'Não deveria ter emitido fallback');
        console.log('✅ Passou!');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Teste 4: Normalização de modelos no construtor (model como array)
    // ─────────────────────────────────────────────────────────────────────────
    {
        console.log('\nTeste 4: Normalização do construtor com model como array...');
        // Instancia com apiKey e model array, sem passar providers manualmente
        const agent = new AutonomousCustomerServiceAgent({
            apiKey: 'dummy-api-key',
            model: ['gemma-4-26b-a4b-it', 'gemma-4-31b-it'],
            agent: agentConfig
        });

        // Como o `#providers` é privado, vamos validar instanciando e testando as propriedades públicas se houver,
        // ou simulando um fluxo que confirme a existência dos dois modelos.
        // O construtor deve ter passado sem estourar erros.
        assert.ok(agent);
        console.log('✅ Passou!');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Teste 5: Normalização de objeto de configuração de providers
    // ─────────────────────────────────────────────────────────────────────────
    {
        console.log('\nTeste 5: Inicialização usando objetos de configuração de providers...');
        // Testando a passagem de objetos no campo providers
        const agent = new AutonomousCustomerServiceAgent({
            providers: [
                { type: 'google', apiKey: 'key1', model: 'gemma-4-26b-a4b-it' },
                { type: 'google', apiKey: 'key2', model: 'gemma-4-31b-it' }
            ],
            agent: agentConfig
        });

        assert.ok(agent);
        console.log('✅ Passou!');
    }

    console.log('\n=== Todos os testes passaram com sucesso! ===');
}

runTests().catch(err => {
    console.error('❌ Testes falharam:', err);
    process.exit(1);
});
