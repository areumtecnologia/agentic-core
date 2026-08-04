'use strict';

/**
 * Teste de regressão: valida o comportamento de #isRetryableError.
 *
 * Antes da correção, a função retornava `true` para qualquer erro não
 * explicitamente excluído, fazendo com que erros permanentes (ex: "image
 * input is not supported") entrassem em retry loop infinito.
 *
 * Como #isRetryableError é privado, testamos pelo efeito observável:
 * invocamos #processSyncRetry (via processMessage com provider mockado)
 * e verificamos que erros permanentes NÃO geram múltiplas tentativas.
 */

const assert = require('assert');
const { AgenticCore, AgentEvents, AgentConfig, BaseProvider } = require('../src');

// ── Provider mockado que sempre falha com erro configurável ───────────────────

class MockErrorProvider extends BaseProvider {
    constructor({ errorMessage, status }) {
        super({ model: 'mock-model' });
        this._errorMessage = errorMessage;
        this._status = status;
    }
    getName() { return 'mock'; }
    async generateContent() {
        const err = new Error(this._errorMessage);
        if (this._status) err.status = this._status;
        throw err;
    }
}

// ── Helper: conta tentativas de retry via evento RETRY ───────────────────────

function countRetries(core, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve) => {
        let attempts = 0;
        const handler = () => { attempts += 1; };
        core.on(AgentEvents.RETRY, handler);
        setTimeout(() => {
            core.off(AgentEvents.RETRY, handler);
            resolve(attempts);
        }, timeoutMs);
    });
}

// ── Testes ────────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('=== Teste de regressão: #isRetryableError ===\n');

    // ── Caso 1: erro permanente ("not supported") NÃO deve gerar retry ──
    console.log('→ Caso 1: erro permanente "image input is not supported"...');
    {
        const provider = new MockErrorProvider({
            errorMessage: 'image input is not supported - hint: if this is unexpected',
            status: 500,
        });
        const core = new AgenticCore({
            provider,
            agent: new AgentConfig('TestBot', 'Empresa de Teste', 'ctx', 'missão', 'estilo', 'pt-BR'),
            retryScheduleAttempts: 5,
            retryScheduleWindowMs: 60_000,
        });

        const retryCounter = countRetries(core, { timeoutMs: 3000 });

        core.createSession('test_perm_1', { name: 'User', phone: '5511999999999', email: 'u@t.com' });
        await core.processMessage('test_perm_1', 'teste').catch(() => {});

        const retries = await retryCounter;
        assert.strictEqual(retries, 0, `Esperado 0 retries para erro permanente, mas foi ${retries}`);
        console.log(`  [PASS] 0 retries para erro permanente (recebido: ${retries})\n`);
    }

    // ── Caso 2: erro transiente (503 Service Unavailable) DEVE gerar retry ──
    console.log('→ Caso 2: erro transiente "503 Service Unavailable"...');
    {
        const provider = new MockErrorProvider({
            errorMessage: 'Service Unavailable',
            status: 503,
        });

        const core = new AgenticCore({
            provider,
            agent: new AgentConfig('TestBot', 'Empresa de Teste', 'ctx', 'missão', 'estilo', 'pt-BR'),
            retryScheduleAttempts: 3,
            retryScheduleWindowMs: 60_000,
        });

        const retryCounter = countRetries(core, { timeoutMs: 8000 });

        core.createSession('test_trans_1', { name: 'User', phone: '5511999999999', email: 'u@t.com' });
        await core.processMessage('test_trans_1', 'teste').catch(() => {});

        const retries = await retryCounter;
        assert.ok(retries >= 1, `Esperado >=1 retry para erro transiente, mas foi ${retries}`);
        console.log(`  [PASS] ${retries} retries para erro transiente 503\n`);
    }

    // ── Caso 3: erro de autenticação (401 Unauthorized) NÃO deve gerar retry ──
    console.log('→ Caso 3: erro permanente "Unauthorized"...');
    {
        const provider = new MockErrorProvider({
            errorMessage: 'Unauthorized: invalid API key',
            status: 401,
        });

        const core = new AgenticCore({
            provider,
            agent: new AgentConfig('TestBot', 'Empresa de Teste', 'ctx', 'missão', 'estilo', 'pt-BR'),
            retryScheduleAttempts: 5,
            retryScheduleWindowMs: 60_000,
        });

        const retryCounter = countRetries(core, { timeoutMs: 3000 });

        core.createSession('test_auth_1', { name: 'User', phone: '5511999999999', email: 'u@t.com' });
        await core.processMessage('test_auth_1', 'teste').catch(() => {});

        const retries = await retryCounter;
        assert.strictEqual(retries, 0, `Esperado 0 retries para erro 401, mas foi ${retries}`);
        console.log(`  [PASS] 0 retries para erro de autenticação 401\n`);
    }

    console.log('=== [SUCESSO] #isRetryableError classificando erros corretamente ===');
}

runTests().catch((err) => {
    console.error('\n[FALHA]', err);
    process.exit(1);
});
