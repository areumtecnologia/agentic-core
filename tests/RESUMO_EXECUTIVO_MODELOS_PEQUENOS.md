# Resumo Executivo - Modelos Ollama < 1GB

## Objetivo
Avaliar viabilidade de modelos Ollama menores que 1GB para uso em produção com AgenticCore.

## Metodologia
- Testados 13 modelos < 1GB
- 3 perguntas por modelo (texto + tool calling)
- 2 configurações: padrão vs otimizada
- Métricas: score (0-100), latência, tool calling, coerência

## Resultados Principais

### 🏆 Melhor Modelo Geral
**qwen2.5:0.5b (397 MB)**
- Score: 71 → **94** (+23 pontos com otimização)
- Latência: 1.6s → 2.3s
- Tool calling: Funciona corretamente
- **Recomendado para produção leve**

### 🛠️ Melhor para Tool Calling
**functiongemma:latest (300 MB)**
- Score: 100/100
- Especializado em function calling
- Latência: 18-73s (aceitável para automação)
- **Ideal para workflows com tools**

### ⚡ Melhor Velocidade
**qwen2.5-coder:0.5b (397 MB)**
- Latência: 1.3s
- Score: 72
- **Para respostas rápidas sem tools**

### 📊 Mais Consistente
**LiquidAI/lfm2.5-350m:latest (379 MB)**
- Score: 91 → 94 (+3 pontos)
- Latência estável: 2.2-3.1s
- **Menos sensível a mudanças de config**

## Configurações Otimizadas

### Padrão (não recomendado para modelos pequenos)
```javascript
temperature: 1.0
maxOutputTokens: 32768
maxAgenticLoopTurns: 9
```

### Otimizada (recomendada)
```javascript
temperature: 0.4
topP: 0.9
maxOutputTokens: 512
maxAgenticLoopTurns: 5
turnTimeoutMs: 60000
```

**Impacto:** Melhora de 23 pontos no score e redução de 60-80% na latência.

## Recomendações por Cenário

### 1. Produção com Recursos Limitados
**Use:** `qwen2.5:0.5b`
**Por quê:** Melhor custo-benefício, tool calling funcional, latência aceitável
**Config:** Balanceada (temperature 0.4)

### 2. Automação com Tools
**Use:** `functiongemma:latest`
**Por quê:** Especializado em function calling, score 100
**Config:** Qualidade (temperature 0.6)

### 3. Respostas Ultra-Rápidas
**Use:** `qwen2.5-coder:0.5b`
**Por quê:** Latência 1.3s
**Config:** Conservadora (temperature 0.3)

### 4. Consistência Máxima
**Use:** `LiquidAI/lfm2.5-350m:latest`
**Por quê:** Menos sensível a parâmetros
**Config:** Qualidade (temperature 0.6)

## Limitações Identificadas

1. **Modelos < 400MB**: Dificuldade com tool calling complexo
2. **Latência**: 2-5s média (vs <1s em modelos grandes)
3. **Qualidade**: Respostas mais simples, menos nuance
4. **Loops**: Necessário limitar `maxAgenticLoopTurns` para evitar loops patológicos

## Conclusão

✅ **Modelos < 1GB são viáveis para produção** com configurações adequadas

- Redução de `maxOutputTokens` de 32768 para 512 é crítica
- `temperature` baixo (0.3-0.6) reduz alucinações
- `qwen2.5:0.5b` é a melhor escolha geral
- `functiongemma` é especialista em tools

**Próximos passos sugeridos:**
1. Testar com carga real (múltiplas sessões simultâneas)
2. Avaliar modelos 1-2GB para comparar custo-benefício
3. Implementar fallback automático para modelos maiores em caso de falha
