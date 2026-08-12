# Recomendações para Modelos Ollama < 1GB

## Modelos Disponíveis

Com base no `ollama ls`, os modelos menores que 1GB são:

| Modelo | Tamanho | Observações |
|--------|---------|-------------|
| `functiongemma:latest` | 300 MB | Excelente para tool calling, score 100 |
| `qwen2.5-coder:0.5b` | 397 MB | Rápido (1.3s), mas falha em tool calling |
| `qwen2.5:0.5b` | 397 MB | **Melhor custo-benefício** - score 94 otimizado, latência 2.3s |
| `IHA089/drana-infinity-0.5b:0.5b` | 397 MB | Similar ao qwen2.5:0.5b |
| `LiquidAI/lfm2.5-350m:latest` | 379 MB | **Top 3** - score 94 otimizado, latência 2.2s |
| `qwen3:0.6b` | 522 MB | Bom equilíbrio, score 86-88 |
| `LiquidAI/lfm2.5-1.2b-instruct:latest` | 730 MB | ~730MB, tool calling fraco |
| `lfm2.5-thinking:latest` | 731 MB | Degrada com parâmetros otimizados |

## Melhores Modelos por Critério

### 1. Melhor Geral (< 500MB)
**`qwen2.5:0.5b` (397 MB)**
- Score padrão: 71 → Otimizado: **94** (+23)
- Latência: 1.6s → 2.3s
- Tool calling: Funciona corretamente
- **Recomendado para produção leve**

### 2. Melhor para Tool Calling
**`functiongemma:latest` (300 MB)**
- Score: 100/100
- Especializado em function calling
- Latência alta (18-73s) mas consistente
- **Ideal para automação com tools**

### 3. Melhor Velocidade
**`qwen2.5-coder:0.5b` (397 MB)**
- Latência média: 1.3s
- Score: 72
- **Para respostas rápidas sem tools**

### 4. Melhor Custo-Benefício
**`LiquidAI/lfm2.5-350m:latest` (379 MB)**
- Score padrão: 91 → Otimizado: **94** (+3)
- Latência: 3.1s → 2.2s
- Tool calling estável
- **Mais consistente entre configs**

## Parâmetros Otimizados para Modelos < 1B

Baseado nos testes, os parâmetros que maximizam performance:

```javascript
{
  temperature: 0.4,        // Reduzido de 1.0 → menos alucinações
  topP: 0.9,               // Reduzido de 0.95 → mais focado
  maxOutputTokens: 512,    // Reduzido de 32768 → resposta mais rápida
  maxAgenticLoopTurns: 5,  // Reduzido de 9 → evita loops
  turnTimeoutMs: 60000     // Reduzido de 90000 → timeout mais agressivo
}
```

### Impacto dos Parâmetros

**Ganhos positivos:**
- `qwen2.5:0.5b`: +23 pontos
- `ornith:latest`: +15 pontos  
- `LiquidAI/lfm2.5-350m`: +3 pontos

**Perdas:**
- `qwen3.5:0.8b`: -15 pontos (prefere parâmetros padrão)
- `lfm2.5-thinking`: -25 pontos (modelo de raciocínio precisa de mais tokens)
- `lfm2.5:latest`: -15 pontos

## Configuração Recomendada por Modelo

### Para `qwen2.5:0.5b` e `LiquidAI/lfm2.5-350m`
```javascript
new AgenticCore({
  provider: new OllamaProvider({ model: 'qwen2.5:0.5b' }),
  temperature: 0.4,
  topP: 0.9,
  maxOutputTokens: 512,
  maxAgenticLoopTurns: 5,
  turnTimeoutMs: 60000
})
```

### Para `functiongemma:latest`
```javascript
// Manter parâmetros padrão - modelo especializado
new AgenticCore({
  provider: new OllamaProvider({ model: 'functiongemma:latest' }),
  temperature: 1.0,
  maxOutputTokens: 1024,
  maxAgenticLoopTurns: 7
})
```

### Para `qwen3:0.6b`
```javascript
new AgenticCore({
  provider: new OllamaProvider({ model: 'qwen3:0.6b' }),
  temperature: 0.6,
  topP: 0.92,
  maxOutputTokens: 768,
  maxAgenticLoopTurns: 6
})
```

## Observações Importantes

1. **Modelos < 400MB**: Precisam de `temperature` baixo (0.3-0.5) para evitar alucinações
2. **Tool calling**: Modelos menores que 500MB têm dificuldade com tools complexas
3. **Latência vs Qualidade**: Reduzir `maxOutputTokens` melhora latência em 40-60%
4. **Loops de tool**: `maxAgenticLoopTurns: 5` previne loops patológicos em modelos pequenos

## Próximos Passos

1. Testar `qwen2.5:0.5b` com `temperature: 0.3` para verificar melhora
2. Avaliar `functiongemma` com timeout maior para tool calling complexo
3. Testar batch de perguntas para medir throughput real
4. Comparar com modelos 1-2GB para definir limite de viabilidade
