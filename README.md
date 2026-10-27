# Agentic Core

> **v3.7.0** — Framework profissional para orquestração de Agentes Autônomos em Node.js com suporte a múltiplos provedores redundantes (Google Gemini, OpenAI, Claude, Ollama, Nvidia), **envio unificado multimodal via `processMessage` com suporte a áudio, voz e resposta TTS (`ttsResponse`)**, **provedores TTS de primeira classe (`GoogleTTS`, `PiperTTS`, `KokoroTTS`, `MagpieTTS`) e constantes enumeradas sem strings mágicas (`VoiceTypes`)**, **auto-extensão com o ecossistema Open Agent Skills (`npx skills` / skills.sh)**, **transbordo humano inteligente omnichannel (`escalate_to_human`)**, **SLM Engine modularizado (`IntentRouter` e `OutputSanitizer`)**, **persistência distribuída de sessões (`SessionStore`)**, **raciocínio passo a passo (`reasoningTool`)**, **cálculo determinístico em sandbox (`calculatorTool`)**, **pesquisa web gratuita (`webSearchTool`)**, **streaming em tempo real com `TokenStream`**, **auto-RAG de memória**, observabilidade com `TelemetryProvider`, suporte nativo a MCP e failover automático.

---

## ✨ Características

| Recurso | Descrição |
|---|---|
| **Voz, Áudio & TTS de Primeira Classe (v3.7)** | Envio unificado de texto, áudio e anexos diretamente via `processMessage()`. Geração de objeto `ttsResponse` no evento `AgentEvents.RESPONSE` com `.toBase64(true)` (OGG) e `.toBase64()` (WAV). Provedores flexíveis com herança de `BaseTTSProvider` (`model`, `apiKey`, `url`, `voice`): `GoogleTTS` (nuvem, zero consumo de RAM em servidores de 1 a 4 GB), `PiperTTS` (< 50 MB RAM na CPU), `KokoroTTS` (neural 82M) e `MagpieTTS` (NVIDIA NIM). Constantes e enumeradores tipados (`GoogleVoice`, `KokoroVoice`, `PiperVoice`, `MagpieVoice`, `Voice`, `AudioEncoding`, `AudioFormat`, `AudioMimeType`, `TTSProvider`). |
| **Open Agent Skills (`npx skills`)** | Suporte nativo ao ecossistema aberto de skills ([skills.sh](https://skills.sh/)). O agente pesquisa (`skills_search`), instala dinamicamente pacotes (`skills_install`), injeta instruções especializadas sob demanda via *lazy loading* (`skills_load`) e executa scripts de automação (`skills_execute_script`) com allowlist de repositórios confiáveis (`trustedOwners`). |
| **Human-in-the-Loop & Handover (v3.4)** | `handoverTool: true` fornece a ferramenta `escalate_to_human`. Gera briefing executivo automático para atendentes humanos, pausa a sessão (`session.isPaused`), bloqueia consumo desnecessário de tokens do LLM e emite eventos `AgentEvents.HUMAN_HANDOVER`. |
| **SLM Engine Modularizado (v3.4)** | Arquitetura desacoplada com `IntentRouter` (detecção de intenções e poda dinâmica bilíngue PT-BR/EN-US) e `OutputSanitizer` (eliminação de loops repetitivos em SLMs e extração limpa de resultados sem vazamento de JSON). |
| **State Store Pluggable Integrado (v3.4)** | Conexão nativa do `AgenticCore` com `SessionStore` (como `InMemorySessionStore` e futuros adaptadores Redis/MySQL), com sincronização automática de turnos, `agent.saveSession(sid)` e `agent.loadSession(sid)`. |
| **Raciocínio Passo a Passo (v3.3.1)** | `reasoningTool: true` ativa a ferramenta de *Sequential Thinking* (`record_thought_step`). O agente decompõe problemas complexos em etapas, hipóteses e revisões com emissão de eventos `AgentEvents.REASONING_CHUNK`. |
| **Cálculo Determinístico PAL (v3.3.1)** | `calculatorTool: true` (ou `mathTool`) disponibiliza a ferramenta `calculate_expression`. Avalia expressões matemáticas em sandbox isolada `node:vm` protegida contra RCE com timeout de 1.500ms e precisão exata. |
| **Pesquisa Web Nativa e Gratuita (v3.3.1)** | `webSearchTool: true` (ou `searchTool`) fornece a ferramenta `web_search`. Realiza buscas em tempo real na internet via DuckDuckGo sem chaves de API, com extração limpa de snippets e proteção anti-SSRF. |
| **Compatibilidade com SLMs (v3.3.1)** | Roteamento inteligente de intenção e parser resiliente de chamadas XML/JSON, garantindo **100% de precisão de acerto** comprovado em modelos ultracompactos locais como **`qwen3:0.6b`**. |
| **Streaming & Realtime (v3.3)** | `processMessageStream()` e `TokenStream` com suporte a `for await (const chunk of stream)` e eventos para tokens parciais, raciocínio (`thought`), chamadas e retornos de ferramentas. |
| **Auto-RAG de Memória (v3.3)** | `ContextAugmenter` para recuperação e injeção automática de fatos duradouros e episódios passados no contexto do agente (`autoRetrieveMemory: true`). |
| **Segurança & Sandboxing (v3.3)** | `ToolSecurityPolicy` com rate limiting por sessão, listas de bloqueio/permissão de ferramentas, proteção anti-SSRF em `WebTools` e confinamento de caminho contra path traversal em `FileTools`. |
| **DAG Condicional & Reativo (v3.3)** | `TaskGraph` e `ParallelExecutor` com suporte a branches condicionais (`condition`), transformação de contexto entre nós (`transformContext`) e tarefas via funções diretas (`fn`). |
| **Telemetria & Observabilidade (v3.3)** | `TelemetryProvider` com rastreamento hierárquico de spans (`startSpan`/`endSpan`), latência (`durationMs`), status e contabilidade acumulada de tokens (`prompt`, `completion`, `total`). |
| **Multi-Provider Nativo** | Suporte a **Google Gemini**, **OpenAI GPT**, **Anthropic Claude**, **Ollama** (modelos locais) e **Nvidia NIM**. |
| **Redundância e Failover** | Múltiplos modelos/provedores com `currentIndex` atômico. Transição imediata em falhas 5xx, rate limits ou timeouts. |
| **Suporte Nativo a MCP** | Integração completa com o protocolo MCP (Model Context Protocol), atuando tanto como Cliente MCP quanto Servidor MCP via Stdio/SSE. |
| **Memória Hierárquica** | `WorkingMemory` (janela deslizante), `ContextCompactor` (resumos via LLM), `EpisodicMemory` (episódios significativos) e `SemanticMemory` (fatos e preferências). |
| **SubAgentes Isolados** | `SubAgent` para execução de tarefas especializadas em segundo plano, com gestão efêmera de sessão e desregistro automático de ferramentas temporárias. |
| **Plataforma Multi-Tenant** | `PlatformManager` para gestão de múltiplos tenants, agentes e sessões isoladas. |
| **Suporte Multimídia** | Envio de anexos (imagens, áudio, vídeo, PDFs) em Base64 no processamento de mensagens. |
| **Concorrência Transparente** | Gerenciamento automático de mensagens consecutivas (`debounceMs`) com cancelamento ativo no LLM. |
| **Agentic Loop Completo** | Tool calls encadeados com execução recursiva e contextualizada. |
| **Gerenciamento de Sessões** | TTL configurável com renovação automática por atividade e normalização transparente de chaves (string/número). |
| **Sistema de Ferramentas** | **19+ ferramentas embutidas** organizadas em categorias (handover, reasoning, web, file, database, system, communication) com validação de schema, composição, chaining e marketplace. |

---

## 📦 Instalação

### Via npm (Registro Público Oficial)

```bash
npm install @areumtecnologia/agentic-core
```

### Via GitHub Packages

```bash
npm install github:areumtecnologia/agentic-core
```

### Via clone local

```bash
git clone https://github.com/areumtecnologia/agentic-core.git
cd agentic-core
npm install
```

### Pré-requisitos

- Node.js `>=18.0.0`
- Chave de API de um provedor compatível (Google Gemini, OpenAI, Anthropic, Nvidia) ou Ollama rodando localmente

---

## ⚙️ Configuração

Copie o arquivo de exemplo e configure suas credenciais:

```bash
cp .env.example .env
```

```env
# .env
GOOGLE_GEMINI_API_KEY=sua-chave-aqui
OPENAI_API_KEY=sua-chave-openai-aqui
ANTHROPIC_API_KEY=sua-chave-anthropic-aqui
NVIDIA_API_KEY=sua-chave-nvidia-aqui
```

---

## 🚀 Quickstart

### Exemplo Básico com Google Gemini

```javascript
require('dotenv').config();
const { 
  AgenticCore, 
  AgentConfig, 
  Type, 
  GoogleProvider 
} = require('@areumtecnologia/agentic-core');

// 1. Configurar o agente (suporta construtor direto ou encadeamento fluente)
const agentConfig = new AgentConfig()
  .setName('Monnalisa')
  .setCompany('Áreum Tecnologia', 'Soluções em IA e Automação de Processos.')
  .setMission('Agente de Vendas', 'Atuar como assistente virtual e agente de vendas.', 'Atenda os clientes cordialmente.')
  .setReasoningLanguage('pt-BR');

// 2. Instanciar o agente com provedor
const agent = new AgenticCore({
  provider: new GoogleProvider({
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    model: 'gemma-4-26b-a4b-it'
  }),
  debounceMs: 1500,
  agent: agentConfig,
});

// 3. Registrar ferramentas
agent.registerTool({
  name: 'get_product_info',
  description: 'Obtém informações de produtos disponíveis.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: 'Categoria do produto.' },
    },
  },
}, async ({ category }, signal) => {
  return JSON.stringify({ products: ['Produto A', 'Produto B'] });
});

// 4. Criar sessão (aceita string ou número como ID)
const session = agent.createSession('session-001', {
  name: 'João Silva',
  phone: '+55 11 98765-4321',
  email: 'joao@exemplo.com',
});

// 5. Processar mensagens
const response = await agent.processMessage(session.id, 'Olá!');
console.log(response.response);
```

---

## 🛠️ Ferramentas Nativas Embutidas (v3.3.1)

A versão 3.3.1 adiciona **três ferramentas nativas de primeira classe** que podem ser ativadas diretamente via flags no construtor do `AgenticCore`, sem necessidade de configuração manual ou chaves de API externas:

```javascript
const agent = new AgenticCore({
  agent: agentConfig,
  provider: new OllamaProvider({ model: 'qwen3:0.6b' }),
  calculatorTool: true, // Avaliação matemática determinística isolada
  reasoningTool: true,  // Pensamento sequencial estruturado (scratchpad)
  webSearchTool: true   // Pesquisa na Web gratuita em tempo real
});
```

### 1. 🧮 Cálculo Matemático Determinístico (`calculatorTool`)

Modelos de linguagem frequentemente alucinam em operações aritméticas ou cálculos encadeados. Com `calculatorTool: true` (ou `mathTool: true`), o agente recebe a ferramenta `calculate_expression`, delegando cálculos para um motor determinístico seguro baseado em `node:vm`:

- **Sandbox Blindada**: Escopo isolado sem acesso a `process`, `require`, `fs`, `global` ou protótipos de execução (proteção anti-RCE).
- **Timeout Estrito**: Interrupção forçada em no máximo 1.500ms contra loops infinitos.
- **Funções Matemáticas Suportadas**: Todas as funções do objeto padrão `Math` (`Math.sqrt`, `Math.pow`, `Math.sin`, `Math.round`, etc.) e operadores padrão (`+`, `-`, `*`, `/`, `%`, `**`).

```javascript
// O agente chama automaticamente calculate_expression para responder:
const res = await agent.processMessage(session.id, 'Quanto é (45 * 12) + (130 / 2) - 15?');
console.log(res.response); // "O resultado é 590."
```

### 2. 🧩 Raciocínio Sequencial Passo a Passo (`reasoningTool`)

Inspirado no paradigma *Sequential Thinking*, a flag `reasoningTool: true` ativa a ferramenta `record_thought_step` (alias `recordThoughtStep`). O agente utiliza um scratchpad dinâmico para estruturar problemas complexos antes de sintetizar a resposta final:

- **Metadados Estruturados**: Cada passo registra `thoughtNumber`, `totalThoughts`, `isRevision`, `revisesThought` e `hypothesis`.
- **Emissão em Tempo Real**: Cada etapa de pensamento emite o evento `AgentEvents.REASONING_CHUNK` no agente e eventos do tipo `thought` no streaming.
- **Histórico Consolidado**: O raciocínio acumulado é retornado em `result.reasoning` e salvo no histórico da sessão.

```javascript
agent.on(AgentEvents.REASONING_CHUNK, ({ thought, thoughtNumber, totalThoughts }) => {
  console.log(`[Pensamento ${thoughtNumber}/${totalThoughts}]: ${thought}`);
});

const res = await agent.processMessage(
  session.id, 
  'Analise os prós e contras de migrar uma arquitetura monolítica para microsserviços passo a passo.'
);
```

### 3. 🌐 Pesquisa na Web Nativa e Gratuita (`webSearchTool`)

Com `webSearchTool: true` (ou `searchTool: true`), o agente ganha a capacidade de consultar a internet em tempo real através da ferramenta `web_search`:

- **100% Gratuita e sem API Keys**: Utiliza o motor de busca do DuckDuckGo HTML com raspagem semântica robusta.
- **Decodificação de Links**: Resolve automaticamente URLs de redirecionamento interno (`//duckduckgo.com/l/?uddg=...`).
- **Segurança Anti-SSRF Integrada**: Bloqueia endereços IP privados, localhost e metadados de nuvem.

```javascript
const res = await agent.processMessage(
  session.id, 
  'Pesquise as novidades mais recentes lançadas no Node.js 22 e resuma os principais pontos.'
);
console.log(res.response);
```

### ⚡ 100% de Precisão Comprovada com Modelos Compactos (SLMs)

O `AgenticCore` conta com roteamento inteligente de intenção e parser resiliente de chamadas XML/JSON (`<tool_call>...`), garantindo que até mesmo modelos ultracompactos locais rodem ferramentas com 100% de assertividade:

- **Bateria de Testes com `qwen3:0.6b` (Ollama local)**:
  - 🧮 Cálculo Matemático: **10/10 (100% de sucesso)**
  - 🧩 Raciocínio Sequencial: **10/10 (100% de sucesso)**
  - 🌐 Pesquisa na Web: **10/10 (100% de sucesso)**
  - **Total Geral: 30/30 (100% de aprovação)**

### 🧠 Raciocínio (Thinking) para Modelos sem Suporte Nativo no Ollama

Modelos menores ou padrão no Ollama (como `llama3.2`, `mistral`, `gemma2`, `phi3/4` e `qwen2.5` não-R1) não geram deltas nativos de raciocínio. O `OllamaProvider` agora conta com emulação de raciocínio e streaming estruturado com **state machine de tags `<think>...</think>`**:

```javascript
const { OllamaProvider, AgenticCore } = require('@areumtecnologia/agentic-core');

// 1. Ativação contínua (always)
const provider = new OllamaProvider({
  model: 'llama3.2:1b',
  thinking: true, // ou emulateThinking: true
});

// 2. Ou ativação inteligente sob demanda (apenas quando a pergunta requer lógica/dedução)
const smartProvider = new OllamaProvider({
  model: 'llama3.2:3b',
  thinking: {
    mode: 'auto',       // IntentRouter ativa apenas quando há raciocínio necessário
    language: 'pt-BR',  // 'pt-BR' ou 'en'
  }
});

// 3. Durante o streaming, o agente emite eventos de pensamento em tempo real
agent.on(AgentEvents.REASONING_CHUNK, ({ thought }) => {
  process.stdout.write(`[Pensamento]: ${thought}\n`);
});
```

- **Streaming Sem Ruído**: Tags `<think>` e `</think>` fracionadas entre pacotes de rede são capturadas pelo `ThinkingStreamParser` e despachadas exclusivamente como `{ type: 'thought' }`.
- **Resposta Final Limpa**: O bloco de pensamento é automaticamente extraído e higienizado, mantendo a resposta do usuário livre de poluição e salvando os passos nas `parts` do candidato.
- **Tolerância a Falhas**: Tags não fechadas por esgotamento de tokens são recuperadas graciosamente, e chamadas de ferramenta executadas após o bloco `</think>` são reparadas automaticamente.

#### 📊 Benchmark Comparativo de Modelos < 1B (Ollama Local)

Testado com o prompt analítico: *"Em uma sala há 3 gatos. Cada gato vê 2 gatos. Quantos gatos há na sala no total? Pense passo a passo antes de responder."*

| Modelo | Tamanho | Latência | Raciocínio Capturado? | Volume Thinking | Destaque |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`qwen3:0.6b`** 🏆 | **522 MB** | **1.7s** | **Sim (100%)** | **1.512 chars** | **Campeão Geral**. Monólogo interno analítico profundo com latência ultra-baixa. |
| **`qwen2.5-coder:0.5b`** | 397 MB | 8.6s | **Sim** | 362 chars | Planejamento dedutivo de premissas antes de emitir a resposta. |
| **`qwen3.5:0.8b`** | 1.0 GB | 86.0s | **Sim** | 1.387 chars | Raciocínio CoT detalhado (*Thinking Process*). |
| **`LiquidAI/lfm2.5-350m`** | 379 MB | 0.5s | Não (Direto) | 0 | Responde imediatamente em passos numerados no corpo do texto. |
| **`qwen2.5:0.5b`** | 397 MB | 0.7s | Não (Direto) | 0 | Responde diretamente enumerando as etapas no texto final. |
| **`functiongemma:latest`** | 300 MB | 3.5s | Parcial | 3 chars | Especialista em tool calling (não recomendado para CoT abstrato). |

---

## 🧩 Ecossistema Open Agent Skills (`npx skills` & skills.sh)

O `AgenticCore` possui suporte nativo e bidirecional ao ecossistema aberto de **Agent Skills** ([skills.sh](https://skills.sh/)), padronizado através do CLI `npx skills` e arquivos de especificação `SKILL.md` (YAML frontmatter + instruções de engenharia).

Essa capacidade transforma o agente em um sistema **auto-extensível em tempo de execução (*Self-Extending Agent*)**:
- **Descoberta Dinâmica**: O agente identifica lacunas em seu conhecimento especializado (ex: React 19, regras de CI/CD para Kubernetes, otimização Next.js, auditorias de segurança) e pesquisa no catálogo aberto com `skills_search`.
- **Instalação Sob Demanda**: Instala pacotes oficiais ou comunitários diretamente no workspace com `skills_install`.
- **Injeção Inteligente de Contexto (*Lazy Loading*)**: Para não inflar a janela de contexto, o catálogo inicial injeta no System Prompt apenas resumos compactos de 1 linha (`<skills_protocol>`). O agente invoca `skills_load` para puxar os passos e regras detalhados somente quando a skill for ativada na sessão.
- **Execução Controlada de Scripts**: Skills que fornecem scripts auxiliares em sua pasta `scripts/` (benchmarks, linters, geradores de código) podem ser executadas com `skills_execute_script`.
- **Governança & Segurança**: Suporte a *allowlist* de organizações confiáveis (`trustedOwners`, ex: `vercel-labs`, `anthropics`, `areumtecnologia`) para mitigar riscos de pacotes maliciosos.

### 🛠️ Configuração e Inicialização

```javascript
const { AgenticCore, AgentConfig, AgentEvents } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
  agent: new AgentConfig(
    'DevArchitect',
    'Áreum Tecnologia',
    'Empresa de IA',
    'Tech Lead de Engenharia',
    'Desenvolver código resiliente e de alto padrão',
    'Consulte suas skills instaladas sempre que necessário.',
    'pt-BR'
  ),
  skills: {
    enabled: true,              // Habilita o gerenciador de skills
    autoPrompt: true,           // Injeta resumo das skills no System Prompt (<skills_protocol>)
    allowAutoInstall: true,     // Permite ao agente baixar skills dinamicamente
    allowExecuteScripts: true,  // Permite executar scripts de skills instaladas
    trustedOwners: ['vercel-labs', 'anthropics', 'areumtecnologia'], // Allowlist de segurança
    skillsDirs: ['./.skills'],  // Diretórios locais adicionais para busca
  }
});

// Eventos de ciclo de vida de skills
agent
  .on(AgentEvents.SKILL_INSTALLED, ({ package, skillName }) => console.log(`[Skills] Instalada: ${skillName || package}`))
  .on(AgentEvents.SKILL_ACTIVATED, ({ skillName }) => console.log(`[Skills] Ativada na sessão: ${skillName}`))
  .on(AgentEvents.SKILL_EXECUTION, ({ skillName, scriptName }) => console.log(`[Skills] Script rodando: ${scriptName}`));

const session = agent.createSession('session_dev_01', { name: 'Renan' });

const response = await agent.processMessage(
  'session_dev_01',
  'Como otimizar os Server Components e a renderização no Next.js?'
);

console.log(response.response);
```

### 🔧 Ferramentas Nativas Disponíveis para o Agente

| Ferramenta | Parâmetros | Descrição |
|---|---|---|
| `skills_search` | `{ query: string, owner?: string }` | Pesquisa skills no registro público do `skills.sh` ou nas pastas locais do workspace. |
| `skills_install` | `{ package: string }` | Instala um pacote do repositório (ex: `vercel-labs/agent-skills@react-best-practices`). |
| `skills_list` | `{}` | Lista todas as skills atualmente instaladas no projeto com suas versões e contagem de scripts. |
| `skills_load` | `{ skillName: string }` | Carrega o conteúdo completo do `SKILL.md` (workflows, regras e checklists) para a memória de trabalho da sessão. |
| `skills_execute_script` | `{ skillName: string, scriptName: string, args?: string[] }` | Executa com segurança um script auxiliar contido na pasta `scripts/` da skill. |
| `skills_create` | `{ name: string, description: string, workflow: string, rules?: string[], scripts?: object }` | Cria dinamicamente uma nova skill local com workflows, regras e scripts (*Self-Learning*). |
| `skills_analytics` | `{ skillName?: string, format?: string, reset?: boolean }` | Inspeciona a telemetria, latência de scripts, taxa de sucesso, consumo de tokens e eficiência por skill. |

### 📁 Anatomia de uma Skill (`SKILL.md`)

Qualquer pasta dentro de `./.skills/` contendo um arquivo `SKILL.md` é catalogada automaticamente:

```markdown
---
name: nextjs-best-practices
description: Diretrizes de otimização de performance e Server Components para Next.js.
version: 1.0.0
author: vercel-labs
tags: [nextjs, react, performance]
---

# Next.js Best Practices

## When to Use This Skill
Use esta skill quando o usuário solicitar desenvolvimento, refatoração ou auditoria de componentes Next.js.

## Rules
- Prefira React Server Components por padrão.
- Nunca carregue bibliotecas pesadas de forma síncrona no cliente.
- Isole interatividade em arquivos com diretiva "use client".
```

---

## 🤝 Human-in-the-Loop & Handover Omnichannel (v3.4)

O `AgenticCore v3.4` introduz suporte nativo a transbordo humano inteligente (`handoverTool: true`, habilitado por padrão) com auto-briefing e pausa defensiva de processamento:

- **Ferramenta `escalate_to_human`**: Invocada pelo modelo quando o cliente solicita atendimento humano explicitamente ou quando a solicitação ultrapassa os limites autônomos.
- **Briefing Executivo**: Gera resumo automático contendo motivo, nível de prioridade (`low`, `medium`, `high`, `urgent`) e a última mensagem do cliente.
- **Pausa Defensiva**: A sessão entra em status `paused` (`session.isPaused = true`), bloqueando chamadas ao LLM e evitando desperdício de tokens até que o atendente finalize ou devolva o atendimento.
- **Eventos em Tempo Real**: Emite `AgentEvents.HUMAN_HANDOVER`, `AgentEvents.SESSION_PAUSED` e `AgentEvents.SESSION_RESUMED`.

```javascript
const { AgenticCore, AgentConfig, AgentEvents } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig('SupportAgent', 'Corp', 'Details', 'Role', 'Obj', 'Inst'),
  handoverTool: true, // ativo por padrão
});

// Escuta solicitações de transbordo para fila humana
agent.on(AgentEvents.HUMAN_HANDOVER, ({ sessionId, reason, priority, briefing, user }) => {
  console.log(`[HANDOVER] Sessão ${sessionId} transferida para atendente humano.`);
  console.log(`Prioridade: ${priority} | Motivo: ${reason}`);
  console.log(`Briefing executivo: ${briefing}`);
});

// Retoma o atendimento automático pela IA após a intervenção humana
agent.resumeSession(sessionId);
```

---

## 💾 Persistência de Sessões Pluggable (v3.4)

Conecte um `SessionStore` (como `InMemorySessionStore` ou adaptadores Redis/MySQL) diretamente ao `AgenticCore`:

```javascript
const { AgenticCore, InMemorySessionStore } = require('@areumtecnologia/agentic-core');

const store = new InMemorySessionStore();
const agent = new AgenticCore({
  agent: myConfig,
  sessionStore: store, // Sincronização automática a cada turno
});

// Salva e restaura sessões entre diferentes instâncias ou pods
await agent.saveSession('session-123');
const restoredSession = await agent.loadSession('session-123');
```

---

## 🧠 SLM Engine Modularizado (v3.4)

As heurísticas de intenção determinísticas e a sanitização de respostas foram desacopladas para testes isolados e alta performance em modelos compactos:

```javascript
const { IntentRouter, OutputSanitizer } = require('@areumtecnologia/agentic-core');

// Roteamento determinístico bilíngue (PT/EN)
IntentRouter.shouldEnforceMath('Quanto é 250 + 15?'); // true
IntentRouter.shouldEnforceDatetime('What time is it now?'); // true

// Poda dinâmica de ferramentas (Tool Pruning) para economizar tokens em saudações
const pruned = IntentRouter.pruneToolsForTurn(tools, 'Olá, bom dia!');

// Sanitização de loops repetitivos e extração limpa de JSON
const clean = OutputSanitizer.extractCleanToolResult('{"success":true,"result":42}'); // 42
```

---

## ⚡ Streaming em Tempo Real (v3.3)

O Agentic Core v3.3 introduz suporte nativo a streaming completo de tokens e pensamentos em tempo real através do `TokenStream`:

```javascript
const { AgenticCore, AgentConfig, OpenAIProvider } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig().setName('StreamAgent').setReasoningLanguage('pt-BR'),
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o' })
});

const session = agent.createSession('sess-stream-1', { name: 'Cliente' });

// Inicia streaming em tempo real
const stream = agent.processMessageStream(session.id, 'Explique a teoria da relatividade resumidamente.');

// Consumo via iteração assíncrona
for await (const chunk of stream) {
  if (chunk.type === 'token') {
    process.stdout.write(chunk.text);
  } else if (chunk.type === 'thought') {
    console.log(`\n[Raciocínio interno: ${chunk.thought}]\n`);
  } else if (chunk.type === 'tool_call') {
    console.log(`\n[Executando ferramenta: ${chunk.toolCall.name}]...\n`);
  }
}

// A resposta final estruturada pode ser obtida ao final
const finalResult = await stream.response;
console.log('\nFinalizado:', finalResult.sent_at);
```

---

## 🧠 Memória & Auto-RAG (v3.3)

Com `autoRetrieveMemory: true`, o `ContextAugmenter` pesquisa automaticamente memórias semânticas e episódicas antes de cada turno e enriquece a mensagem enviada ao modelo:

```javascript
const { AgenticCore, InMemoryStore, AgentConfig, GoogleProvider } = require('@areumtecnologia/agentic-core');

const store = new InMemoryStore();
const core = new AgenticCore({
  agent: new AgentConfig().setName('SupportAgent'),
  provider: new GoogleProvider({ apiKey: process.env.GOOGLE_GEMINI_API_KEY }),
  memoryStore: store,
  autoRetrieveMemory: true // Ativa RAG automático de memória
});

// Ensina fatos à memória duradoura do cliente
await core.semanticMemory.learn({
  sessionId: 'sess-001',
  subject: 'plano_usuario',
  predicate: 'tipo',
  object: 'Plano Enterprise VIP'
});

const session = core.createSession('sess-001', { name: 'Carlos' });

// O modelo recebe automaticamente o contexto histórico relevante!
const response = await core.processMessage(session.id, 'Qual é o meu plano?');
console.log(response.response);
```

---

## 🛡️ Segurança, Sandboxing e Políticas de Ferramentas (v3.3)

### 1. `ToolSecurityPolicy` (Rate Limiting e Listas de Bloqueio)

Controle quais ferramentas podem ser chamadas e com que frequência:

```javascript
const { ToolSecurityPolicy, AgenticCore } = require('@areumtecnologia/agentic-core');

const securityPolicy = new ToolSecurityPolicy({
  blockedTools: ['execute_command', 'delete_database'],
  maxInvocationsPerMinute: 20 // Limite de chamadas por minuto por sessão
});

const core = new AgenticCore({
  agent,
  provider,
  securityPolicy // Aplicado globalmente em todas as execuções de tools
});
```

### 2. Confinamento de Diretório em `FileTools`

Evita ataques de *path traversal* (como `../../etc/passwd`) e bloqueia leitura de arquivos confidenciais (`.env`, `.git`, chaves privadas, certificados):

```javascript
const { FileTools } = require('@areumtecnologia/agentic-core');

const fileTools = new FileTools({
  baseDir: './workspace/safe_dir' // Apenas caminhos dentro de safe_dir são permitidos
});
```

### 3. Proteção Anti-SSRF em `WebTools`

Bloqueia chamadas para endereços de rede privada, `localhost` e metadados de nuvem (`169.254.169.254`, `metadata.google.internal`):

```javascript
const { WebTools } = require('@areumtecnologia/agentic-core');

const webTools = new WebTools();
// URLs privadas ou de metadados disparam SecurityViolation e são bloqueadas automaticamente
```

---

## 📊 Observabilidade e Telemetria (v3.3)

Monitore spans de execução, duração em milissegundos e consumo acumulado de tokens com o `TelemetryProvider`:

```javascript
const { TelemetryProvider, AgenticCore } = require('@areumtecnologia/agentic-core');

const telemetry = new TelemetryProvider();

telemetry.on('span:end', (span) => {
  console.log(`[Trace] Span "${span.name}" concluído em ${span.durationMs}ms com status: ${span.status}`);
});

telemetry.on('metrics:tokens', ({ added, cumulative }) => {
  console.log(`[Tokens] +${added.total} tokens (Acumulado: ${cumulative.totalTokens})`);
});

const core = new AgenticCore({
  agent,
  provider,
  telemetry // Registra automaticamente spans de mensagens, geração de modelo e execução de ferramentas
});
```

---

## 🌐 Orquestração de Tarefas em Grafo (DAG)

Orquestre grafos de tarefas com dependências, condições de branch e transformação dinâmica de dados:

```javascript
const { TaskGraph, ParallelExecutor } = require('@areumtecnologia/agentic-core');

const graph = new TaskGraph();

// Tarefa base
graph.add({
  id: 'analise_credito',
  fn: async () => ({ score: 850, aprovado: true })
});

// Tarefa condicional (só executa se aprovado)
graph.add({
  id: 'gerar_contrato',
  deps: ['analise_credito'],
  condition: (ctx) => ctx.results.analise_credito.aprovado === true,
  transformContext: (ctx) => ({ scoreCliente: ctx.results.analise_credito.score }),
  fn: async (transformedContext) => ({ contratoId: 'CTR-9988', dados: transformedContext })
});

// Tarefa de rejeição (será ignorada/skipped)
graph.add({
  id: 'notificar_recusa',
  deps: ['analise_credito'],
  condition: (ctx) => ctx.results.analise_credito.aprovado === false,
  fn: async () => ({ emailEnviado: true })
});

const executor = new ParallelExecutor(graph);
const results = await executor.run();

console.log('Contrato gerado:', results.gerar_contrato);
console.log('Recusa:', results.notificar_recusa.status); // 'skipped'
```

---

## 🤖 SubAgentes com Delegação de Tarefas

O `SubAgent` permite executar tarefas especializadas em segundo plano utilizando a infraestrutura do agente pai:

- Possui **sessão efêmera própria** limpa automaticamente ao finalizar.
- Suporta **ferramentas temporárias** desregistradas automaticamente no bloco `finally`.

```javascript
const { SubAgent, AgentConfig } = require('@areumtecnologia/agentic-core');

const subConfig = new AgentConfig('Pesquisador', 'Áreum', '...', 'Pesquisador', 'Buscar dados', '...');

const researcher = new SubAgent({
  parent: mainAgent,
  config: subConfig,
  name: 'researcher-subagent',
  tools: [/* ferramentas exclusivas do subagente */]
});

const result = await researcher.execute('Pesquisar relatório financeiro do setor');
console.log(result.output);
```

---

## 🏢 Plataforma Multi-Tenant e Persistência

### `PlatformManager`
Gerencie múltiplos tenants com instâncias de agentes e métricas isoladas:

```javascript
const { PlatformManager } = require('@areumtecnologia/agentic-core');

const platform = new PlatformManager();
platform.registerTenant('tenant-empresa-a');
const tenantAgent = platform.createAgent('tenant-empresa-a', agentConfig, { provider });
```

### `SessionStore` & `InMemorySessionStore`
Persista e restaure o estado das sessões:

```javascript
const { InMemorySessionStore } = require('@areumtecnologia/agentic-core');

const store = new InMemorySessionStore();
await store.save(session.id, session.toJSON());
```

---

## 🎯 Eventos do Agente

Escute eventos através de `agent.on(AgentEvents.EVENT_NAME, callback)`:

```javascript
const { AgentEvents } = require('@areumtecnologia/agentic-core');

agent
  .on(AgentEvents.TOKEN, ({ token }) => process.stdout.write(token))
  .on(AgentEvents.REASONING_CHUNK, ({ thought, thoughtNumber, totalThoughts }) => console.log('Pensando:', thought))
  .on(AgentEvents.TOOL_STREAM_START, ({ toolCall }) => console.log('Iniciando tool:', toolCall.name))
  .on(AgentEvents.TOOL_STREAM_END, ({ toolResult }) => console.log('Tool finalizada:', toolResult.name))
  .on(AgentEvents.HUMAN_HANDOVER, ({ sessionId, reason, priority, briefing }) => console.log(`Transbordo [${priority}]:`, briefing))
  .on(AgentEvents.SESSION_PAUSED, ({ session }) => console.log(`Sessão pausada: ${session.id}`))
  .on(AgentEvents.SESSION_RESUMED, ({ session }) => console.log(`Sessão retomada: ${session.id}`))
  .on(AgentEvents.SKILL_SEARCHED, ({ query, items }) => console.log('Skills pesquisadas:', items?.length || 0))
  .on(AgentEvents.SKILL_INSTALLED, ({ package, skillName }) => console.log('Skill instalada:', skillName || package))
  .on(AgentEvents.SKILL_ACTIVATED, ({ skillName }) => console.log('Skill ativada na sessão:', skillName))
  .on(AgentEvents.SKILL_EXECUTION, ({ skillName, scriptName }) => console.log('Script executado:', scriptName))
  .on(AgentEvents.SESSION_CREATED, ({ session }) => console.log(`Sessão criada: ${session.id}`))
  .on(AgentEvents.SESSION_UPDATED, ({ session, reason }) => console.log(`Sessão atualizada: ${session.id} (${reason})`))
  .on(AgentEvents.SESSION_EXPIRED, ({ session }) => console.log(`Sessão expirada: ${session.id}`))
  .on(AgentEvents.SESSION_CLEARED, ({ session, reason }) => console.log(`Sessão limpa: ${session.id}`))
  .on(AgentEvents.TURN_START, ({ depth, session }) => console.log(`Turno ${depth} iniciado`))
  .on(AgentEvents.RESPONSE, ({ response, reasoning, usageMetadata }) => console.log('Resposta:', response))
  .on(AgentEvents.TOOL_CALL, ({ name, args }) => console.log(`Tool chamada: ${name}`, args))
  .on(AgentEvents.TOOL_RESULT, ({ name, result }) => console.log(`Tool resultado: ${name}`, result))
  .on(AgentEvents.PROVIDER_FALLBACK, ({ failedProvider, nextProvider, error }) => console.warn(`Fallback: ${failedProvider} -> ${nextProvider}`))
  .on(AgentEvents.ERROR, ({ error, source }) => console.error(`Erro [${source}]:`, error.message));
```

---

## 🔌 Suporte ao Protocolo MCP (Model Context Protocol)

O `McpManager` e o `McpServer` oferecem suporte nativo ao protocolo MCP (JSON-RPC 2.0 via Stdio):

```javascript
// MCP Client (Importando ferramentas externas)
const { McpManager } = require('@areumtecnologia/agentic-core');
const mcp = new McpManager(agent);
await mcp.registerServer('db', { command: 'node', args: ['mcp-server.js'] });

// MCP Server (Expondo o agente como servidor MCP)
const { McpServer } = require('@areumtecnologia/agentic-core');
const server = new McpServer(agent);
server.start();
```

---

## 🎙️ Áudio, Voz & Síntese Text-to-Speech (STT / TTS) (v3.6)

O **Agentic Core** introduz uma arquitetura de áudio de primeira classe, pensada tanto para produção em nuvem quanto para servidores Linux de baixo custo (**1 a 4 GB de RAM**). Todos os motores de voz implementam o contrato abstrato [`BaseTTSProvider`](file:///k:/Projects/Agentic-Core/src/audio/BaseTTSProvider.js), permitindo injeção transparente, inicialização sob demanda (*lazy-loading*) e eliminação de strings mágicas através de constantes e enumeradores tipados (`Object.freeze`).

### 1. Provedores de TTS Suportados

| Provedor | Classe | Consumo de RAM | Cenário Recomendado | Voz Padrão |
|---|---|---|---|---|
| **Google Cloud TTS** | `GoogleTTS` | **0 MB extra** | Servidores de 1 a 4 GB, alta definição neural em nuvem, síntese em ~600ms | `GoogleVoice.PT_BR_NEURAL2_A` |
| **Piper TTS (ONNX)** | `PiperTTS` | **< 50 MB** | Execução 100% local em Linux/CPU sem GPU, ultra-leve e rápida | `PiperVoice.PT_BR_FABER_MEDIUM` |
| **Kokoro 82M** | `KokoroTTS` | **~180 MB** | Modelo neural compacto local, compatível com endpoint OpenAI `/v1/audio/speech` | `KokoroVoice.AF_BELLA` |
| **NVIDIA Magpie** | `MagpieTTS` | GPU dedicada | Contêiner Docker NVIDIA NIM (`localhost:9000`) com Zero-Shot Voice Cloning | `MagpieVoice.ZEROSHOT_MULTILINGUAL_FEMALE` |

---

### 2. Sem Strings Mágicas: Enumeradores de Voz (`VoiceTypes`)

Todas as vozes, formatos e MIME types são expostos como constantes e enums imutáveis:

```javascript
const {
  GoogleVoice, // ou Voice.Google
  KokoroVoice, // ou Voice.Kokoro
  PiperVoice,  // ou Voice.Piper
  MagpieVoice, // ou Voice.Magpie
  Voice,
  AudioEncoding,
  AudioFormat,
  AudioMimeType,
  TTSProvider
} = require('@areumtecnologia/agentic-core');

// Exemplo de vozes tipadas disponíveis:
// Google: GoogleVoice.PT_BR_NEURAL2_A, GoogleVoice.PT_BR_NEURAL2_B, GoogleVoice.PT_BR_WAVENET_A...
// Kokoro: KokoroVoice.AF_BELLA, KokoroVoice.AM_ADAM, KokoroVoice.PF_DORA...
// Piper:  PiperVoice.PT_BR_FABER_MEDIUM, PiperVoice.PT_BR_EDRESSON_LOW...
// Magpie: MagpieVoice.ZEROSHOT_MULTILINGUAL_FEMALE, MagpieVoice.ZEROSHOT_MULTILINGUAL_MALE...
```

---

### 3. Configurando o `ttsProvider` no `AgenticCore`

Todos os provedores de TTS implementam a mesma interface flexível, aceitando `voice`, `model`, `apiKey` e `url` para permitir apontamento customizado para APIs externas ou contêineres:

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `voice` | `string` | Constante ou enumerador da voz (`GoogleVoice`, `PiperVoice`, `KokoroVoice`, etc.) |
| `model` | `string` | Nome ou identificador do modelo de síntese |
| `apiKey` | `string` | Chave de API de autenticação para serviços externos (se aplicável) |
| `url` | `string` | Endpoint customizado da API externa ou micro-serviço (ex: `'https://api.meu-tts.com/v1'`) |

#### Exemplo A — Google Cloud TTS (Ideal para servidores de 1 a 4 GB / Zero RAM extra)
```javascript
const {
  AgenticCore,
  AgentConfig,
  NvidiaProvider,
  GoogleTTS,
  GoogleVoice,
  AgentEvents
} = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  provider: new NvidiaProvider({
    apiKey: process.env.NVIDIA_API_KEY,
    model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' // Transcrição multimodal (STT) + Raciocínio
  }),
  ttsProvider: new GoogleTTS({
    voice: GoogleVoice.PT_BR_NEURAL2_A, // Voz feminina neural em pt-BR
    model: 'google-cloud-tts',
    apiKey: process.env.GOOGLE_TTS_API_KEY, // Opcional (usa fallback zero-config se omitida)
    url: 'https://texttospeech.googleapis.com/v1/text:synthesize' // Customizável
  }),
  agent: new AgentConfig(
    'Monnalisa',
    'Áreum Tecnologia',
    'Atendimento',
    'Assistente de Voz',
    'Responder com simpatia e clareza.'
  )
});
```

#### Exemplo B — Kokoro 82M com API Externa Customizada
```javascript
const { AgenticCore, KokoroTTS, KokoroVoice } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  provider: new NvidiaProvider({ ... }),
  ttsProvider: new KokoroTTS({
    voice: KokoroVoice.AF_BELLA,
    model: 'kokoro',
    url: 'https://meu-servidor-kokoro.com/v1', // Endpoint externo customizado
    apiKey: 'meu-bearer-token'
  }),
  agent: ...
});
```

---

### 4. `AgentEvents.RESPONSE` com `ttsResponse` & `.toBase64(true)`

Sempre que houver um `ttsProvider` configurado, a resposta do evento `AgentEvents.RESPONSE` incluirá a variável `ttsResponse`:

```javascript
agent.on(AgentEvents.RESPONSE, (evt) => {
  console.log('Texto respondido:', evt.response);

  if (evt.ttsResponse) {
    // 1. Buffer binário bruto do áudio
    const rawAudioBuffer = evt.ttsResponse.buffer;

    // 2. Base64 em formato WAV (padrão)
    const base64Wav = evt.ttsResponse.toBase64(); // ou .toBase64(false)

    // 3. Base64 em formato OGG (passando 'true')
    const base64Ogg = evt.ttsResponse.toBase64(true);

    // 4. Data URI pronta para uso web/HTML5
    const dataUri = evt.ttsResponse.toDataUri(true); // data:audio/ogg;base64,...
  }
});
```

---

### 5. Envio Unificado Multimodal via `processMessage` (Texto, Áudio e Imagens)

O método `processMessage` é o ponto de entrada centralizado e único da biblioteca para qualquer modalidade (texto puro, mensagens de áudio, imagens ou documentos), **eliminando a necessidade de métodos separados como `processVoiceTurn`**:

```javascript
// A. Envio de mensagem de texto simples (com síntese de áudio automática)
const resText = await agent.processMessage('sessao-1', 'Olá, quais são os horários de atendimento?');
console.log('Resposta em texto:', resText.response);
if (resText.ttsResponse) {
  const oggBase64 = resText.ttsResponse.toBase64(true); // Base64 em OGG
}

// B. Envio direto de arquivo de áudio recebido do usuário (.ogg, .wav, .mp3)
const resAudio = await agent.processMessage(
  'sessao-1',
  'Transcreva com atenção e responda amigavelmente', // Prompt contextual opcional
  'caminho/do/audio_usuario.ogg'                     // Caminho direto, Buffer ou { base64, mimeType }
);
console.log('Resposta do agente:', resAudio.response);
const audioParaWhatsApp = resAudio.ttsResponse.toBase64(true); // Pronto para envio em OGG

// C. Envio de imagem ou documento
const resImage = await agent.processMessage(
  'sessao-1',
  'O que você vê nesta imagem?',
  'caminho/do/comprovante.jpg'
);
```

---

### 6. Orquestração Direta com `VoiceGateway`

Caso queira orquestrar síntese e transcrição de forma desacoplada ou independente do loop principal do agente:

```javascript
const { VoiceGateway, GoogleTTS, GoogleVoice } = require('@areumtecnologia/agentic-core');

const gateway = new VoiceGateway({
  ttsProvider: new GoogleTTS({ voice: GoogleVoice.PT_BR_NEURAL2_B })
});

// Síntese direta
const audioBuffer = await gateway.textToSpeech('Olá, seu pedido foi confirmado com sucesso!');
```

---

## 📁 Estrutura do Projeto

```
agentic-core/
├── src/
│   ├── index.js                          # Entry point com exportações completas
│   ├── AgenticCore.js                    # Core do agente e agentic loop
│   ├── AgentConfig.js                    # Builder de configuração do agente
│   ├── AgentSession.js                   # Estado e histórico da sessão
│   ├── AgentEvents.js                    # Fonte única de verdade de eventos
│   ├── AgentManager.js                   # Gerenciador de múltiplos agentes
│   ├── SubAgent.js                       # Agente especializado efêmero
│   ├── types.js                          # Tipos neutros (Type, ThinkingLevel)
│   ├── utils.js                          # withRetry com backoff e jitter
│   ├── slm/                              # SLM Engine (IntentRouter, OutputSanitizer)
│   │   ├── index.js                      # Exportações do módulo SLM
│   │   ├── IntentRouter.js               # Heurísticas e tool pruning bilíngue PT/EN
│   │   └── OutputSanitizer.js            # Sanitização de loops e unboxing limpo de tools
│   ├── skills/                           # Ecossistema Open Agent Skills (npx skills)
│   │   ├── index.js                      # Exportações do módulo de skills
│   │   ├── SkillsCliWrapper.js           # Interface assíncrona segura com o CLI npx skills
│   │   ├── SkillsLoader.js               # Parser de SKILL.md (YAML Frontmatter + Markdown)
│   │   ├── SkillsManager.js              # Ciclo de vida, busca, cache e script runner
│   │   ├── SkillsTools.js                # Ferramentas nativas do agente (search, install, load, execute, analytics)
│   │   ├── SkillSubAgent.js              # Sub-agente especialista ancorado em diretrizes de skill
│   │   └── SkillImpactAnalytics.js       # Telemetria, latência de scripts, tokens e scoring de eficiência
│   ├── streaming/                        # Streaming em tempo real (TokenStream)
│   ├── telemetry/                        # Observabilidade e tracing (TelemetryProvider)
│   ├── tools/                            # Sistema de ferramentas embutidas
│   │   ├── index.js                      # Exportações do sistema de ferramentas
│   │   ├── ToolRegistry.js               # Registro e descoberta unificada de ferramentas
│   │   ├── ToolComposer.js               # Composição e chaining de ferramentas
│   │   ├── ToolValidator.js              # Validação de schema e segurança
│   │   ├── ToolMarketplace.js            # Marketplace e descoberta
│   │   ├── ToolSecurityPolicy.js         # Políticas de segurança e rate limiting
│   │   └── categories/                   # Categorias de ferramentas
│   │       ├── reasoning.js              # Sequential thinking (record_thought_step)
│   │       ├── web.js                    # Ferramentas web com busca DuckDuckGo e anti-SSRF
│   │       ├── file.js                   # Ferramentas de arquivo com path confinement
│   │       ├── database.js               # Ferramentas de banco de dados
│   │       ├── system.js                 # Ferramentas de sistema (com sanitização e vm sandbox)
│   │       └── communication.js          # Ferramentas de comunicação
│   ├── mcp/                              # Protocolo MCP (Client, Server, Manager)
│   ├── memory/                           # Memória (Working, Compactor, Episodic, Semantic, ContextAugmenter)
│   ├── orchestrator/                     # Orquestração (TaskGraph, TaskNode, ParallelExecutor, Orchestrator)
│   ├── persistence/                      # Persistência (SessionStore, InMemorySessionStore)
│   ├── platform/                         # Multi-tenancy (PlatformManager)
│   ├── providers/                        # Providers (Google, OpenAI, Anthropic, Ollama, Nvidia)
│   └── audio/                            # Áudio, Voz & TTS (GoogleTTS, PiperTTS, KokoroTTS, MagpieTTS, VoiceGateway, VoiceTypes, TTSResponse)
│       ├── index.js                      # Exportações do módulo de áudio
│       ├── BaseTTSProvider.js            # Contrato abstrato para provedores de voz (model, apiKey, url, voice)
│       ├── GoogleTTS.js                  # Provedor Google Cloud TTS (0 MB RAM)
│       ├── PiperTTS.js                   # Provedor Piper TTS (<50 MB RAM para Linux/CPU)
│       ├── KokoroTTS.js                  # Provedor neural Kokoro 82M
│       ├── MagpieTTS.js                  # Provedor NVIDIA Magpie Zero-Shot
│       ├── TTSResponse.js                # Objeto de resposta com buffer e .toBase64(true) (OGG/WAV)
│       ├── VoiceGateway.js               # Orquestrador bidirecional (STT + TTS)
│       └── VoiceTypes.js                 # Constantes e enums tipados (GoogleVoice, KokoroVoice, PiperVoice, MagpieVoice, etc.)
├── tests/
│   ├── test_tts_response_and_unified_process_message.js # Validação de TTSResponse, parâmetros url/model/apiKey e processMessage unificado
│   ├── test_google_tts.js                # Validação de síntese em nuvem com GoogleTTS e GoogleVoice
│   ├── test_piper_tts.js                 # Validação de motor ultra-leve com PiperTTS e PiperVoice
│   ├── test_voice_turn_kokoro.js         # Validação end-to-end de STT (Nemotron Omni) + TTS (Kokoro)
│   ├── test_real_audio_samples.js        # Teste com amostras reais de áudio (Gleicy Moreira e Renan Moreira)
│   ├── test_magpie_tts.js                # Validação do pipeline NVIDIA Magpie NIM
│   ├── test_skills_agent_flow.js         # Validação end-to-end do loop agentic com skills
│   ├── test_skills_parser.js             # Validação de parsing de SKILL.md e YAML frontmatter
│   ├── test_skills_cli_mock.js           # Validação do wrapper CLI e políticas de segurança
│   ├── test_skills_advanced.js           # Validação de SHA-256 lockfile, skills_create, Turn 0 e SubAgentes
│   ├── test_skills_telemetry.js          # Validação de telemetria, scoring de eficiência e impact analytics
│   ├── test_next_level_v34.js            # Validação do SLM Engine, State Store e Handover v3.4
│   ├── test_code_review_fixes.js         # Validação de correções da revisão de código
│   ├── test_ten_each.js                  # Bateria de 30 testes de ferramentas nativas (100% de aprovação)
│   ├── test_evolution_v33.js             # Suíte completa de testes da v3.3.0 (Streaming, RAG, Segurança, DAG, Telemetria)
│   ├── test_v32_improvements.js          # Validação das melhorias da v3.2.0
│   ├── test_bugs_fix.js                  # Suíte de teste para correções de bugs
│   ├── test_retry_classification.js      # Validação de erros retentáveis vs permanentes
│   └── ...                               # Outros testes de serviço e integração
├── package.json
└── README.md
```

---

## 🧪 Testes

```bash
# Executar suíte padrão completa
npm test

# Executar suíte de testes de voz e áudio
npm run test:tts      # Valida TTSResponse (.toBase64 OGG/WAV), parâmetros url/apiKey e processMessage unificado
npm run test:google   # Valida Google Cloud TTS (Nuvem / Zero RAM)
npm run test:piper    # Valida Piper TTS (<50MB RAM para Linux)
npm run test:voice    # Valida STT multimodal + Kokoro 82M TTS
npm run test:samples  # Valida processamento com amostras reais de áudio

# Executar suíte de testes do ecossistema de skills (npx skills)
npm run test:skills

# Executar suíte de novidades da v3.4.0 (SLM, Handover, State Store)
node tests/test_next_level_v34.js

# Executar bateria de 30 testes das ferramentas nativas v3.3.1
node tests/test_ten_each.js

# Executar suíte de novidades da versão 3.3.0
npm run test:evolution

# Executar testes específicos de regressão e correções
node tests/test_code_review_fixes.js
node tests/test_v32_improvements.js
node tests/test_bugs_fix.js
node tests/test_retrocompatibility.js
node tests/test_retry_classification.js
```

---

## 📄 Licença

ISC

## 👤 Autor

**Áreum Tecnologia** — Software and AI Development Team
