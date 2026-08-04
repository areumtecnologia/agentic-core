'use strict';

/**
 * Testes de regressão para as Fases 1-5 do Agentic-Core.
 * Valida: memória, compactação, SubAgent, orquestração, persistência e plataforma.
 */

const assert = require('assert');
const {
    AgenticCore,
    AgentConfig,
    WorkingMemory,
    ContextCompactor,
    InMemoryStore,
    EpisodicMemory,
    SemanticMemory,
    SubAgent,
    Orchestrator,
    TaskGraph,
    ParallelExecutor,
    PlatformManager,
    SessionStore,
    InMemorySessionStore,
    BaseProvider,
} = require('../src');

// ── Mock Provider para testes sem chamadas reais de IA ──────────────────────

class MockProvider extends BaseProvider {
    constructor() {
        super({ model: 'mock-model' });
    }

    async generateContent({ contents, config, signal }) {
        const lastUser = [...contents].reverse().find(t => t.role === 'user');
        const promptText = lastUser?.parts?.map(p => p.text).join(' ') || '';
        const text = `Mock response to: ${promptText.slice(0, 50)}`;
        return {
            candidates: [{
                content: { parts: [{ text }] },
                finishReason: 'STOP',
            }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
        };
    }

    async *generateContentStream({ contents, config, signal }) {
        const lastUser = [...contents].reverse().find(t => t.role === 'user');
        const promptText = lastUser?.parts?.map(p => p.text).join(' ') || '';
        yield { type: 'text', text: `Mock response to: ${promptText.slice(0, 50)}` };
        yield { type: 'finish', usage: { inputTokens: 10, outputTokens: 10 } };
    }
}

// ── Helper: cria AgentConfig mínimo ─────────────────────────────────────────

function createAgentConfig(name = 'TestAgent') {
    return new AgentConfig(
        name,           // agentName
        'TestCorp',     // agentCompanyName
        'Test details', // agentCompanyDetails
        'assistant',    // missionRole
        'Help the user', // missionObjective
        'Be helpful',   // missionInstructions
        'en-US'         // reasoningLanguage
    );
}

// ── Testes ──────────────────────────────────────────────────────────────────

async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        tests.push({ name, fn });
    }

    // ── Fase 1: Memória ──

    test('WorkingMemory: append e getTurns', () => {
        const wm = new WorkingMemory({ maxTurns: 20, keepRecent: 10, minTurnsToCompact: 5 });
        wm.append({ role: 'user', content: [{ type: 'text', text: 'hello' }] });
        wm.append({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
        const turns = wm.getTurns();
        assert.strictEqual(turns.length, 2, 'Deve ter 2 turns');
        assert.strictEqual(turns[0].role, 'user');
        assert.strictEqual(turns[1].role, 'assistant');
    });

    test('WorkingMemory: needsCompaction retorna false com poucos turns', () => {
        const wm = new WorkingMemory({ maxTurns: 20, keepRecent: 10, minTurnsToCompact: 5 });
        wm.append({ role: 'user', content: [{ type: 'text', text: 'a' }] });
        assert.strictEqual(wm.needsCompaction(), false, 'Não deve precisar compactação com 1 turn');
    });

    test('WorkingMemory: needsCompaction retorna true com muitos turns', () => {
        const wm = new WorkingMemory({ maxTurns: 5, keepRecent: 2, minTurnsToCompact: 2 });
        for (let i = 0; i < 5; i++) {
            wm.append({ role: i % 2 === 0 ? 'user' : 'assistant', parts: [{ text: `msg ${i}` }] });
        }
        assert.strictEqual(wm.needsCompaction(), true, 'Deve precisar compactação com 5 turns e max 5');
    });

    test('WorkingMemory: applyCompaction substitui turns antigos por resumo', () => {
        const wm = new WorkingMemory({ maxTurns: 10, keepRecent: 4, minTurnsToCompact: 2 });
        for (let i = 0; i < 8; i++) {
            wm.append({ role: i % 2 === 0 ? 'user' : 'assistant', parts: [{ text: `msg ${i}` }] });
        }
        wm.applyCompaction('Resumo consolidado da conversa');
        const turns = wm.getTurns();
        assert.ok(turns.length <= 4, 'Após compactação deve ter no máximo keepRecent turns');
        assert.ok(wm.compactedSummary !== null, 'Deve ter resumo compactado');
    });

    test('InMemoryStore: save/get/findBySession/delete', async () => {
        const store = new InMemoryStore();
        const record = { id: 'rec1', sessionId: 'sess1', type: 'episodic', content: { data: 'test' }, createdAt: new Date() };
        await store.save(record);
        const loaded = await store.get('rec1');
        assert.strictEqual(loaded.content.data, 'test');
        const results = await store.findBySession('sess1');
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].id, 'rec1');
        await store.delete('rec1');
        const afterDelete = await store.get('rec1');
        assert.strictEqual(afterDelete, null);
    });

    test('EpisodicMemory: remember e recall', async () => {
        const store = new InMemoryStore();
        const ep = new EpisodicMemory(store);
        await ep.remember({
            sessionId: 's1',
            turn: { role: 'user', parts: [{ text: 'hello' }] },
            importance: 0.8,
            tags: ['greeting'],
        });
        const results = await ep.recall('s1', { limit: 10 });
        assert.ok(results.length > 0, 'Deve retornar pelo menos 1 resultado');
        assert.strictEqual(results[0].type, 'episodic');
    });

    test('SemanticMemory: learn e recall', async () => {
        const store = new InMemoryStore();
        const sem = new SemanticMemory(store);
        await sem.learn({
            sessionId: 's1',
            subject: 'user',
            predicate: 'likes',
            object: 'pizza',
            confidence: 0.9,
            tags: ['preference'],
        });
        const results = await sem.recall('s1', { subject: 'user' });
        assert.ok(results.length > 0, 'Deve retornar pelo menos 1 fato');
        assert.strictEqual(results[0].content.object, 'pizza');
    });

    test('ContextCompactor: compact gera resumo', async () => {
        const provider = new MockProvider();
        const compactor = new ContextCompactor({
            provider,
            compaction: { maxOutputTokens: 500 },
        });
        const turns = [
            { role: 'user', parts: [{ text: 'Oi' }] },
            { role: 'assistant', parts: [{ text: 'Olá!' }] },
        ];
        const summary = await compactor.compact(turns, null);
        assert.ok(typeof summary === 'string', 'Resumo deve ser string');
        assert.ok(summary.length > 0, 'Resumo não deve ser vazio');
    });

    // ── Fase 2: SubAgent ──

    test('SubAgent: construtor valida parâmetros', () => {
        const provider = new MockProvider();
        const agent = new AgenticCore({ agent: createAgentConfig(), provider });
        assert.throws(() => new SubAgent({}), /parent must be/);
        assert.throws(() => new SubAgent({ parent: agent }), /config must be/);
        assert.throws(() => new SubAgent({ parent: agent, config: createAgentConfig() }), /name must be/);
    });

    test('SubAgent: execute retorna resultado', async () => {
        const provider = new MockProvider();
        const agent = new AgenticCore({ agent: createAgentConfig(), provider });
        const sub = new SubAgent({
            parent: agent,
            config: createAgentConfig('SubAgent1'),
            name: 'researcher',
            context: { domain: 'test' },
        });
        const result = await sub.execute('Pesquise sobre X');
        assert.strictEqual(result.success, true, 'Deve executar com sucesso');
        assert.ok(result.durationMs >= 0, 'Deve ter duração');
    });

    // ── Fase 3: Orquestração ──

    test('TaskGraph: add e topologicalSort', () => {
        const graph = new TaskGraph();
        graph.add('A', { agent: {}, task: 'task A' });
        graph.add('B', { agent: {}, task: 'task B', dependsOn: ['A'] });
        graph.add('C', { agent: {}, task: 'task C', dependsOn: ['A'] });
        graph.add('D', { agent: {}, task: 'task D', dependsOn: ['B', 'C'] });
        const sorted = graph.topologicalSort();
        assert.strictEqual(sorted.length, 4);
        // A deve vir antes de B e C
        const aIdx = sorted.findIndex(n => n.id === 'A');
        const bIdx = sorted.findIndex(n => n.id === 'B');
        const cIdx = sorted.findIndex(n => n.id === 'C');
        const dIdx = sorted.findIndex(n => n.id === 'D');
        assert.ok(aIdx < bIdx, 'A antes de B');
        assert.ok(aIdx < cIdx, 'A antes de C');
        assert.ok(bIdx < dIdx, 'B antes de D');
        assert.ok(cIdx < dIdx, 'C antes de D');
    });

    test('TaskGraph: detecta ciclo', () => {
        const graph = new TaskGraph();
        graph.add('A', { agent: {}, task: 'task A', dependsOn: ['B'] });
        graph.add('B', { agent: {}, task: 'task B', dependsOn: ['A'] });
        assert.throws(() => graph.topologicalSort(), /Cycle detected/);
    });

    test('ParallelExecutor: executa tarefas em ordem', async () => {
        const mockAgent = {
            async execute(task, context, signal) {
                return { success: true, output: `done: ${task}`, durationMs: 1 };
            },
        };
        const graph = new TaskGraph();
        graph.add('A', { agent: mockAgent, task: 'task A' });
        graph.add('B', { agent: mockAgent, task: 'task B', dependsOn: ['A'] });
        const executor = new ParallelExecutor();
        const results = await executor.execute(graph);
        assert.strictEqual(results.size, 2);
        assert.ok(results.get('A').output.includes('task A'));
        assert.ok(results.get('B').output.includes('task B'));
    });

    test('Orchestrator: addTask e execute', async () => {
        const mockAgent = {
            async execute(task, context, signal) {
                return { success: true, output: `executed: ${task}`, durationMs: 1 };
            },
        };
        const orch = new Orchestrator();
        orch.addTask('T1', { agent: mockAgent, task: 'first' });
        orch.addTask('T2', { agent: mockAgent, task: 'second', dependsOn: ['T1'] });
        const results = await orch.execute();
        assert.strictEqual(results.size, 2);
        assert.ok(results.get('T1').success);
        assert.ok(results.get('T2').success);
    });

    // ── Fase 5: Persistência ──

    test('SessionStore: métodos abstratos lançam erro', async () => {
        const store = new SessionStore();
        await assert.rejects(() => store.save('x', {}), /must be implemented/);
        await assert.rejects(() => store.load('x'), /must be implemented/);
        await assert.rejects(() => store.delete('x'), /must be implemented/);
        await assert.rejects(() => store.exists('x'), /must be implemented/);
    });

    test('InMemorySessionStore: CRUD completo', async () => {
        const store = new InMemorySessionStore();
        await store.save('s1', { history: [], user: { name: 'John' } });
        assert.strictEqual(await store.exists('s1'), true);
        const loaded = await store.load('s1');
        assert.strictEqual(loaded.user.name, 'John');
        assert.ok(loaded.savedAt, 'Deve ter timestamp');
        await store.delete('s1');
        assert.strictEqual(await store.exists('s1'), false);
    });

    // ── Fase 4: Plataforma multi-tenant ──

    test('PlatformManager: registerTenant e getTenant', () => {
        const pm = new PlatformManager();
        const tenant = pm.registerTenant('acme', { plan: 'pro' });
        assert.strictEqual(tenant.id, 'acme');
        assert.strictEqual(tenant.config.plan, 'pro');
        assert.strictEqual(pm.getTenant('acme'), tenant);
    });

    test('PlatformManager: registerTenant duplicado lança erro', () => {
        const pm = new PlatformManager();
        pm.registerTenant('acme');
        assert.throws(() => pm.registerTenant('acme'), /already exists/);
    });

    test('PlatformManager: createAgent e getAgent', () => {
        const pm = new PlatformManager();
        pm.registerTenant('acme');
        const provider = new MockProvider();
        const config = createAgentConfig('Agent1');
        const agent = pm.createAgent('acme', config, { provider });
        assert.ok(agent instanceof AgenticCore);
        assert.strictEqual(pm.getAgent('acme', 'Agent1'), agent);
    });

    test('PlatformManager: createAgent em tenant inexistente', () => {
        const pm = new PlatformManager();
        assert.throws(() => pm.createAgent('unknown', createAgentConfig()), /not found/);
    });

    test('PlatformManager: getMetrics', () => {
        const pm = new PlatformManager();
        pm.registerTenant('acme');
        const provider = new MockProvider();
        pm.createAgent('acme', createAgentConfig('A1'), { provider });
        pm.createAgent('acme', createAgentConfig('A2'), { provider });
        const metrics = pm.getMetrics('acme');
        assert.strictEqual(metrics.agentCount, 2);
        assert.strictEqual(metrics.sessionCount, 0);
    });

    // ── Teste de integração: AgenticCore com compactação ──

    test('AgenticCore: inicializa com compaction e memoryStore', () => {
        const provider = new MockProvider();
        const agent = new AgenticCore({
            agent: createAgentConfig(),
            provider,
            compaction: { maxTokens: 500 },
        });
        assert.ok(agent.memoryStore, 'Deve ter memoryStore');
        assert.ok(agent.episodicMemory, 'Deve ter episodicMemory');
        assert.ok(agent.semanticMemory, 'Deve ter semanticMemory');
    });

    test('AgenticCore: createSession e getSession', () => {
        const provider = new MockProvider();
        const agent = new AgenticCore({
            agent: createAgentConfig(),
            provider,
        });
        const sid = agent.createSession('test-sess', { name: 'User', phone: '123' });
        const session = agent.getSession('test-sess');
        assert.ok(session, 'Sessão deve existir');
        assert.strictEqual(session.user.name, 'User');
    });

    // ── Executa todos os testes ──

    console.log('\n🧪 Iniciando testes de regressão (Fases 1-5)...\n');

    for (const { name, fn } of tests) {
        try {
            await fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ ${name}`);
            console.error(`     ${err.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Resultado: ${passed} passaram, ${failed} falharam de ${tests.length} testes.\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

// Executa se chamado diretamente
if (require.main === module) {
    runTests().catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
    });
}

module.exports = { runTests };
