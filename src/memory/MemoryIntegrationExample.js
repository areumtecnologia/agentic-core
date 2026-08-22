'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Exemplo de integração de todas as melhorias de memória
// ─────────────────────────────────────────────────────────────────────────────

const { InMemoryStore } = require('./InMemoryStore');
const { SharedMemory } = require('./SharedMemory');
const { OptimizedContextCompactor } = require('./OptimizedContextCompactor');
const { SemanticMemoryEnhanced } = require('./SemanticMemoryEnhanced');
const { WorkingMemory } = require('./WorkingMemory');
const { EpisodicMemory } = require('./EpisodicMemory');

/**
 * Exemplo de uso integrado das melhorias de memória
 */
class MemoryIntegrationExample {
    constructor(provider) {
        this.store = new InMemoryStore();
        this.sharedMemory = new SharedMemory(this.store, {
            namespace: 'global',
            importanceThreshold: 0.7
        });
        
        this.semanticMemory = new SemanticMemoryEnhanced(
            this.store,
            provider,
            { search: { similarityThreshold: 0.6 } }
        );
        
        this.contextCompactor = new OptimizedContextCompactor({
            provider,
            compaction: {
                maxOutputTokens: 1024,
                enableHierarchical: true,
                cacheSize: 100
            }
        });
        
        this.workingMemory = new WorkingMemory({
            maxTurns: 20,
            keepRecent: 10
        });
        
        this.episodicMemory = new EpisodicMemory(this.store);
    }

    /**
     * Fluxo completo de exemplo
     */
    async runExample() {
        console.log('=== Exemplo de Integração de Memória ===\n');

        // 1. Aprender fatos semânticos
        console.log('1. Aprendendo fatos semânticos...');
        await this.semanticMemory.learn({
            sessionId: 'session-1',
            subject: 'user',
            predicate: 'prefers',
            object: 'dark mode',
            confidence: 0.9,
            tags: ['preferences', 'ui']
        });

        await this.semanticMemory.learn({
            sessionId: 'session-1',
            subject: 'user',
            predicate: 'name',
            object: 'João Silva',
            confidence: 1.0,
            tags: ['identity']
        });

        // 2. Busca semântica
        console.log('\n2. Buscando por similaridade...');
        const results = await this.semanticMemory.search('preferências de interface do usuário', {
            sessionId: 'session-1',
            limit: 5
        });
        console.log(`Encontrados ${results.length} fatos relacionados`);

        // 3. Compartilhamento de memória
        console.log('\n3. Compartilhando memória...');
        const sharedId = await this.sharedMemory.share({
            id: 'fact-1',
            sessionId: 'session-1',
            type: 'semantic',
            content: { subject: 'user', predicate: 'prefers', object: 'dark mode' },
            importance: 0.9,
            tags: ['preferences', 'ui']
        }, { tags: ['preferences', 'ui'] });
        console.log(`Memória compartilhada com ID: ${sharedId}`);

        // 4. Recuperação para outra sessão
        console.log('\n4. Recuperando memória compartilhada...');
        const shared = await this.sharedMemory.retrieveForSession('session-2', {
            tags: ['preferences'],
            limit: 10
        });
        console.log(`Recuperadas ${shared.length} memórias compartilhadas`);

        // 5. Compactação de contexto
        console.log('\n5. Compactando contexto...');
        const turns = [
            { role: 'user', parts: [{ text: 'Olá, como vai?' }], importance: 0.5 },
            { role: 'assistant', parts: [{ text: 'Olá! Estou bem, obrigado!' }], importance: 0.3 },
            { role: 'user', parts: [{ text: 'Preciso de ajuda com meu projeto' }], importance: 0.8 },
            { role: 'assistant', parts: [{ text: 'Claro, como posso ajudar?' }], importance: 0.4 }
        ];

        const summary = await this.contextCompactor.compact(turns, null);
        console.log('Resumo gerado:', summary.substring(0, 100) + '...');

        // 6. Estatísticas
        console.log('\n6. Estatísticas...');
        const stats = await this.semanticMemory.getStats();
        console.log('Estatísticas da memória semântica:', stats);

        const compactorStats = this.contextCompactor.getStats();
        console.log('Estatísticas do compactador:', compactorStats);

        console.log('\n=== Exemplo concluído ===');
    }
}

module.exports = { MemoryIntegrationExample };
