# Agentic Core

> **v4.4.0** — Framework profissional para orquestração de Agentes Autônomos em Node.js com suporte a múltiplos provedores redundantes (Google Gemini, OpenAI, Claude, Ollama, Nvidia), **Injeção Dinâmica de Turnos & Contexto (`injectTurn`, `injectSystemContext`) para propagandas e instruções mid-conversation**, **Observabilidade Corporativa OpenTelemetry GenAI (`OtelGenAIBridge`, `OtelExporter`)**, **Framework de Evals & Benchmarking de Trajetórias para CI/CD (`AgentBenchmarkHarness`, `TrajectoryEvaluator`, `EvalReportGenerator`)**, **Swarms Colaborativos Multi-Agente & Protocolo A2A (`AgentSwarm`, `SwarmMessageBus`, `SharedBlackboard`, topologias `Supervisor`, `Pipeline` e `Blackboard`)**, **Navegação Web Autônoma e Browser Use Segura (`BrowserActionTool`, `MockBrowserDriver`, `BaseBrowserDriver`)**, **Motor de Verificação Cognitiva Actor-Critic com Auto-Correção Reflexiva (`VerificationEngine`)**, **Memória em Grafo de Conhecimento Relacional Multi-Hop & GraphRAG (`KnowledgeGraph`, `GraphMemoryStore`)**, **Execução Durável com Checkpointing Transacional & Idempotência (`CheckpointManager` / `ExecutionJournal`)**, **Sandbox Seguro Isolado de Código e Suporte a WebAssembly (`SafeSandboxRunner`, `WasmSandboxRunner`, `E2BSandboxRunner`)**, **tratamento inteligente de estouro de tokens com auto-continuação transparente (`autoContinueOnLength`)**, **SLM Engine blindado (`OutputSanitizer` com regex Unicode e preservação de listas/links)**, **envio unificado multimodal via `processMessage` com suporte a áudio, voz e resposta TTS (`ttsResponse`)**, **provedores TTS de primeira classe (`GoogleTTS`, `PiperTTS`, `KokoroTTS`, `MagpieTTS`) e constantes enumeradas sem strings mágicas (`VoiceTypes`)**, **auto-extensão com o ecossistema Open Agent Skills (`npx skills` / skills.sh)**, **transbordo humano inteligente omnichannel (`escalate_to_human`)**, **persistência distribuída de sessões (`SessionStore`)**, **raciocínio passo a passo (`reasoningTool`)**, **cálculo determinístico em sandbox seguro (`calculatorTool`)**, **pesquisa web gratuita (`webSearchTool`)**, **streaming em tempo real com `TokenStream`**, **auto-RAG de memória**, observabilidade com `TelemetryProvider`, suporte nativo a MCP e failover automático.

---

## ✨ Características

| Recurso | Descrição |
|---|---|
| **Injeção de Turnos & Contexto Dinâmico (v4.4)** | Injeção de turnos arbitrários (`injectTurn` com `role: 'user'`, `'model'` ou `'tool'`) sem invocar o LLM e injeção de instruções/diretrizes dinâmicas (`injectSystemContext`) com controle de TTL por turnos ou persistência permanente. Ideal para propagandas contextualizadas, promoções sazonais, regras comportamentais temporárias e semeadura de histórico few-shot. |
| **Observabilidade OpenTelemetry GenAI (v4.3)** | Mapeamento automático para as Convenções Semânticas oficiais de GenAI do OpenTelemetry (`OtelGenAIBridge` / `OtelExporter` com payload OTLP v1 canônico). Rastreamento de spans hierárquicos para chamadas de LLM, execuções de ferramentas, verificação Actor-Critic e consultas em grafos, com exportação para coletores corporativos (Datadog, Dynatrace, LangSmith, Phoenix, Grafana Tempo) e buffer in-memory. |
| **Trajectory Evals & Benchmarking para CI/CD (v4.3)** | Framework automatizado de testes de regressão de agentes (`AgentBenchmarkHarness` e `TrajectoryEvaluator`). Avalia Goal Completion Rate (GCR), similaridade com Golden Trajectories, detecção algorítmica de loops repetitivos (*Loop Detection Score*) e métricas de eficiência de tokens e turnos. Gera relatórios executivos em Markdown (comentários em PRs) e JSON. |
| **Swarms Colaborativos & Protocolo A2A (v4.2)** | Orquestração de múltiplos agentes especialistas (`AgentSwarm`) com barramento de mensageria assíncrona (`SwarmMessageBus` com direct, broadcast, tópicos e RPC correlacionado) e quadro de estado concorrente (`SharedBlackboard` com locks otimistas e histórico de auditoria). Topologias nativas: **Supervisor-Workers (Hierárquica)**, **Pipeline Sequencial** e **Shared Blackboard**. |
| **Browser Use & Navegação Segura (v4.2)** | Automação e inspeção de páginas web via `BrowserActionTool` com contrato desacoplado `BaseBrowserDriver` e driver hermético nativo `MockBrowserDriver`. Ações: navegação, cliques, digitação, extração de texto, execução de scripts e captura de tela (screenshots). Blindagem estrita anti-SSRF (bloqueio de IPs de metadados de nuvem e loopback) e proibição de protocolos perigosos. |
| **Motor de Verificação Actor-Critic & Auto-Correção (v4.1)** | Loop cognitivo de crítica e refatoração (*Actor-Critic Self-Reflection*). Valida saídas sintáticas (JavaScript/Python via sandbox), esquemas estruturados JSON e regras de conformidade de negócio customizadas (`customVerifier`). Em caso de inconformidade, o agente gera um feedback de erro reflexivo e re-executa o turno até a aprovação ou o teto de `maxRetries`. |
| **Memória em Grafo de Conhecimento & GraphRAG (v4.1)** | Grafo relacional bidirecional nativo (`KnowledgeGraph`) com travessia multi-salto BFS (`multi-hop traversal`). Extração heurística automática de entidades e relações a partir da conversa natural ou chamadas explícitas (`extractAndIngestTriples`). Injeção transparente de subgrafos relacionais no prompt via `ContextAugmenter`. |
| **Resiliência Transacional & Execução Durável (v4.0)** | Diário de eventos imutável (`ExecutionJournal`) com chaves determinísticas de idempotência em SHA-256. Interceptação prévia de ferramentas concluídas via `tool.replayed` (evitando duplicação de efeitos colaterais como cobranças ou envio de mensagens). Salvamento de checkpoints a cada passo (`checkpointOnStep: true`), recuperação de sessão pós-falha com `agent.recoverAndResumeSession(sid)` e retomada resiliente de nós em grafos de tarefas (`ParallelExecutor`). |
| **Sandbox Seguro de Execução & WASM (v4.0)** | Isolamento hermético de código com `SafeSandboxRunner` (bloqueio estrito de prototype pollution, sem acesso ao host, interrupção por timeout de CPU), suporte nativo à execução de bytecode WebAssembly via `WasmSandboxRunner` com cotas de páginas de memória e conector para microVMs na nuvem (`E2BSandboxRunner`). Substituição e elevação da segurança do `MathTools`. |
| **Tratamento Inteligente de Tokens & Auto-continuação (v3.7.2)** | Detecção determinística de estouro de tokens via `finish_reason` dos provedores (`MAX_TOKENS`, `length`), emissão do evento `AgentEvents.TOKEN_LIMIT_REACHED`, metadados de resposta enriquecidos (`finish_reason`, `token_limit_reached`) e costura transparente de respostas truncadas com `autoContinueOnLength: true` (com proteção por `maxAutoContinuations`). |
| **OutputSanitizer Blindado & Preservação Visual (v3.7.2)** | Sanitização de enumerações repetidas com regex Unicode-aware sem truncamento de palavras, preservação estrita de quebras de linha (`\n`), listas e parágrafos, eliminação de cortes cegos por falta de ponto final, suporte a `sanitizeOutput: false` e restrição de correções fonéticas a interações de voz/áudio. |
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

Conecte um `SessionStore` (como `RedisSessionStore` ou `InMemorySessionStore`) diretamente ao `AgenticCore`:

```javascript
const { AgenticCore, RedisSessionStore } = require('@areumtecnologia/agentic-core');

// Adaptador persistente baseado em Redis com TTL e auto-rehidratação
const store = new RedisSessionStore({
  host: 'localhost',
  port: 6379,
  ttlSeconds: 1800, // 30 minutos de expiração automática no Redis
  keyPrefix: 'agentic:',
});

const agent = new AgenticCore({
  agent: myConfig,
  sessionStore: store, // Sincronização automática a cada turno
});

// Lazy Auto-Rehydration: Se uma mensagem chegar em qualquer instância/pod de um cluster
// para uma sessão que não está na RAM local, o AgenticCore restaura a sessão
// automaticamente do Redis com todo o histórico, contextos injetados, regras e guardrails!
const res = await agent.processMessage('session-123', 'Olá, gostaria de continuar nosso atendimento.');

// Salva e restaura manualmente quando necessário
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
  .on(AgentEvents.TOKEN_LIMIT_REACHED, ({ finishReason, depth, continuationCount, provider, model }) => {
    console.warn(`[${provider}/${model}] Teto de tokens atingido (${finishReason}) no turno ${depth}. Continuação #${continuationCount}`);
  })
  .on(AgentEvents.TOOL_REPLAYED, ({ name, args, result }) => console.log(`Tool reaproveitada via idempotência: ${name}`))
  .on(AgentEvents.CHECKPOINT_SAVED, ({ sessionId, idempotencyKey, toolName }) => console.log(`Checkpoint salvo: ${toolName} (${idempotencyKey.slice(0, 8)})`))
  .on(AgentEvents.CHECKPOINT_RESTORED, ({ sessionId, recovery }) => console.log(`Sessão restaurada: ${sessionId}. Ferramentas no diário: ${recovery.completedTools.size}`))
  .on(AgentEvents.VERIFICATION_START, ({ candidate, modes }) => console.log(`Verificando resposta candidata nos modos:`, modes))
  .on(AgentEvents.VERIFICATION_PASSED, ({ score }) => console.log(`Resposta aprovada pelo Verificador (Score: ${score})`))
  .on(AgentEvents.VERIFICATION_FAILED, ({ feedback, errors, score }) => console.warn(`Rejeitado pelo Verificador: ${feedback}`))
  .on(AgentEvents.VERIFICATION_RETRY, ({ retryCount, maxRetries }) => console.log(`Refletindo e tentando novamente (${retryCount}/${maxRetries})...`))
  .on(AgentEvents.GRAPH_ENTITY_CREATED, ({ entity }) => console.log(`Entidade aprendida no Grafo: ${entity.id} (${entity.type})`))
  .on(AgentEvents.GRAPH_RELATION_CREATED, ({ relation }) => console.log(`Relação no Grafo: ${relation.sourceId} -[${relation.type}]-> ${relation.targetId}`))
  .on(AgentEvents.GRAPH_CONTEXT_RETRIEVED, ({ query, subgraphsFound }) => console.log(`GraphRAG injetou ${subgraphsFound} relações para: "${query}"`))
  .on(AgentEvents.TURN_INJECTED, ({ sessionId, turns, count }) => console.log(`[Turn Injection] ${count} turno(s) injetado(s) na sessão ${sessionId}`))
  .on(AgentEvents.CONTEXT_INJECTED, ({ sessionId, label, ttlTurns, persistent }) => console.log(`[Context Injection] Contexto "${label || 'unlabeled'}" injetado na sessão ${sessionId} (TTL: ${persistent ? 'infinito' : ttlTurns} turnos)`))
  .on(AgentEvents.RULE_TRIGGERED, ({ sessionId, ruleId, match }) => console.log(`[Smart Rule] Regra "${ruleId}" ativada na sessão ${sessionId} via ${match.type}`))
  .on(AgentEvents.INJECTION_RENDERED, ({ sessionId, campaignId, pattern }) => console.log(`[Campaign Rendered] Campanha "${campaignId}" citada pelo LLM (${pattern})`))
  .on(AgentEvents.INJECTION_ENGAGED, ({ sessionId, campaignId, userText }) => console.log(`[Campaign Engaged] Cliente reagiu à campanha "${campaignId}": ${userText}`))
  .on(AgentEvents.INJECTION_CONVERTED, ({ sessionId, campaignId, toolName }) => console.log(`[Campaign Converted] Campanha "${campaignId}" convertida via ${toolName}`))
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

## 🧠 Tratamento Inteligente de Estouro de Tokens (v3.7.2)

Em versões anteriores, heurísticas baseadas em pontuação final tentavam inferir cortes de texto, o que acabava mutilando e-mails, URLs e respostas legítimas sem ponto final. Na **v3.7.2**, a gestão de estouro de tokens passa a ser orientada pelo **status determinístico retornado pelos provedores de IA** (`finish_reason` / `finishReason`):

- **Google Gemini**: `finishReason === 'MAX_TOKENS'`
- **OpenAI / Groq / Ollama / Nvidia**: `finish_reason === 'length'`
- **Anthropic Claude**: `stop_reason === 'max_tokens'` (normalizado para `'MAX_TOKENS'`)

### 1. Detecção, Telemetria & Evento Oficial

Sempre que um modelo atinge o teto configurado de tokens (`maxOutputTokens`), o `AgenticCore` emite o evento `AgentEvents.TOKEN_LIMIT_REACHED` e registra o evento no span de telemetria ativo:

```javascript
const { AgenticCore, AgentEvents } = require('@areumtecnologia/agentic-core');

agent.on(AgentEvents.TOKEN_LIMIT_REACHED, ({ finishReason, depth, continuationCount, provider, model }) => {
  console.warn(`[${provider}/${model}] Teto de tokens atingido (${finishReason}). Continuação #${continuationCount}`);
});
```

A resposta retornada por `processMessage()` inclui metadados explícitos sobre o status da geração:

```javascript
const result = await agent.processMessage(sessionId, 'Gere um relatório analítico detalhado');

console.log('Motivo de término:', result.finish_reason);              // 'STOP' ou 'MAX_TOKENS'
console.log('Limite de tokens atingido:', result.token_limit_reached); // true ou false
```

### 2. Auto-continuação Transparente (`autoContinueOnLength`)

Para fluxos onde respostas longas não devem ser cortadas pela metade (como geração de relatórios extensos ou documentações), o agente pode continuar a geração automaticamente nos bastidores, costurando as partes em uma única resposta limpa para o usuário final:

```javascript
const agent = new AgenticCore({
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o' }),
  autoContinueOnLength: true,   // Ativa continuação transparente nos bastidores
  maxAutoContinuations: 2       // Limite de segurança contra loops de tokens (padrão: 2)
});

// Ou ative por chamada individual em processMessage():
const result = await agent.processMessage(sessionId, 'Gere uma análise comparativa', {}, {
  autoContinueOnLength: true
});
```

### 3. Opções de Sanitização de Saída (`sanitizeOutput`)

O `OutputSanitizer` opera de maneira blindada com regex Unicode-aware, preservando estritamente quebras de linha (`\n`), listas markdown, URLs, e-mails e parágrafos sem cortes cegos. Caso sua aplicação necessite receber a resposta 100% crua (raw) gerada pelo LLM:

```javascript
const result = await agent.processMessage(sessionId, 'Gere um código em bloco', {}, {
  sanitizeOutput: false // Desativa qualquer rotina de pós-processamento de texto
});
```

---

## 🔄 Resiliência Transacional & Execução Durável (v4.0)

Em produção, agentes autônomos executam tarefas longas encadeando múltiplas ferramentas (consultas a APIs, cobranças, disparos de mensagens e gravações em banco). Caso o processo Node.js reinicie, sofra deploy ou encontre uma falha de rede temporária no meio do loop, arquiteturas tradicionais enfrentam dois riscos críticos: perda do estado intermediário ou duplicação indevida de efeitos colaterais externos.

A versão **v4.0** do Agentic-Core introduz **Durable Execution com Event Sourcing & Step Checkpointing**:

### 1. Diário de Execução Imutável (`ExecutionJournal`)
Cada intenção e conclusão de ferramenta é registrada de forma atômica no `SessionStore` (`TOOL_INVOKING` e `TOOL_COMMITTED`), com geração determinística de chaves de idempotência em **SHA-256**:

$$\text{idempotencyKey} = \text{SHA256}(\text{sessionId} + \text{turnIndex} + \text{toolName} + \text{JSON.stringify}(\text{sortedArgs}))$$

Se a mesma ferramenta for invocada novamente durante uma repetição ou retomada de fluxo:
1. O `CheckpointManager` intercepta a invocação antes que a função real seja executada.
2. O resultado prévio armazenado no diário é imediatamente retornado (*replay idempotente*).
3. O evento `AgentEvents.TOOL_REPLAYED` é emitido, evitando cobranças duplicadas ou requisições desnecessárias.

### 2. Configuração & Uso no `AgenticCore`

```javascript
const { AgenticCore, AgentConfig, InMemorySessionStore, AgentEvents } = require('@areumtecnologia/agentic-core');

const store = new InMemorySessionStore(); // Ou qualquer adaptador SessionStore (Redis, MySQL, etc.)

const agent = new AgenticCore({
  agent: new AgentConfig('FinanceAgent', 'Empresa', 'Detalhes', 'Assistente Financeiro', 'Processar Pagamentos', 'Instruções'),
  sessionStore: store,
  
  // Ativa a execução durável transacional (v4.0)
  durable: {
    enabled: true,
    checkpointOnStep: true // Persiste checkpoint a cada tool executada
  }
});

// Escuta eventos de resiliência e replay
agent.on(AgentEvents.TOOL_REPLAYED, ({ name, result }) => {
  console.log(`[Idempotência] Tool "${name}" retornada diretamente do cache do diário.`);
});

agent.on(AgentEvents.CHECKPOINT_SAVED, ({ toolName, idempotencyKey }) => {
  console.log(`[Checkpoint] Passo concluído com sucesso: ${toolName}`);
});
```

### 3. Recuperação Automática Pós-Queda (`recoverAndResumeSession`)

Caso o servidor caia ou seja reiniciado durante um atendimento, basta recuperar a sessão:

```javascript
// Recupera o histórico e reconstrói o mapa de ferramentas concluídas no diário
const { session, recovery } = await agent.recoverAndResumeSession('session-12345');

console.log(`Sessão restaurada! Ferramentas concluídas no diário: ${recovery.completedTools.size}`);
// O agente retoma de onde parou sem refazer passos já concluídos!
```

### 4. Resumabilidade em Grafos de Tarefas (`ParallelExecutor`)

O executor de DAGs do Agentic-Core também é durável. Ao executar um grafo passando `checkpointManager` e `sessionId`, nós finalizados são gravados no diário. Ao ser reiniciado após uma interrupção, o executor identifica os nós já concluídos e prossegue apenas com as etapas pendentes:

```javascript
const { TaskGraph, ParallelExecutor } = require('@areumtecnologia/agentic-core');

const graph = new TaskGraph();
graph.add({ id: 'consultar_api', fn: async () => ({ status: 'ok', data: 42 }) });
graph.add({ id: 'processar_dados', dependsOn: ['consultar_api'], fn: async (ctx) => ({ total: ctx.results.consultar_api.data * 2 }) });

const executor = new ParallelExecutor(graph);

// Nós concluídos são persistidos no CheckpointManager
const results = await executor.execute(graph, {
  checkpointManager: agent.checkpointManager,
  sessionId: 'job-pipeline-99'
});
```

---

## 🛡️ Sandbox Seguro de Execução & WebAssembly (v4.0)

A execução de scripts, códigos arbitrários e cálculos matemáticos gerados por LLMs apresenta riscos críticos de **Prototype Pollution** e **Remote Code Execution (RCE)**. A v4.0 eleva o patamar de segurança substituindo o uso isolado de `node:vm` por uma arquitetura desacoplada de **Sandboxing Hermético**:

```
                  ┌───────────────────────┐
                  │   BaseSandboxRunner   │
                  └───────────┬───────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌───────────────────────┐               ┌───────────────────────┐
│   SafeSandboxRunner   │               │   WasmSandboxRunner   │
│ (In-Memory Hermético) │               │ (WebAssembly Bytecode)│
│ - Zero acesso ao host │               │ - Quotas de memória   │
│ - Bloqueio de 10+ RCEs│               │ - Execução binária    │
│ - Timeout de CPU      │               │ - Isolamento total    │
└───────────────────────┘               └───────────────────────┘
```

### 1. `SafeSandboxRunner` (Isolamento em Memória)
- **Contexto Nulo:** Executa código em um ambiente `Object.create(null)`, impedindo acesso à cadeia de prototype da V8.
- **Análise Estática de Segurança:** Bloqueia automaticamente tokens e padrões maliciosos como `process`, `require`, `import`, `global`, `globalThis`, `constructor`, `__proto__`, `Function`, `eval`, `child_process`, `fs`, `Buffer` e `Proxy`.
- **Interrupção de Timeout Real:** Aborta laços infinitos como `while(true)` no limite exato configurado em milissegundos.

### 2. `WasmSandboxRunner` (Execução de WebAssembly)
Suporta a compilação e execução direta de bytecode WebAssembly (`Uint8Array` ou `Buffer`) com controle estrito do número de páginas de memória alocadas (`maxMemoryPages`), garantindo confinamento em nível de arquitetura de baixo nível.

### 3. Configuração no `AgenticCore` e `MathTools`

```javascript
const { AgenticCore, AgentConfig, SafeSandboxRunner, WasmSandboxRunner } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig('DataAgent', 'Empresa', 'Detalhes', 'Analista', 'Calcular Métricas', 'Instruções'),
  
  // Ativa o sandbox seguro para avaliações e ferramentas de código
  sandbox: {
    provider: 'safe', // 'safe' | 'wasm' | 'e2b'
    timeoutMs: 1500,  // Interrupção estrita após 1.5s
    memoryLimitMb: 64
  },
  
  calculatorTool: true // A MathTools passa a utilizar automaticamente o SandboxRunner
});
```

---

## 🧠 Motor de Verificação Actor-Critic & Self-Reflection (v4.1)

Modelos de linguagem frequentemente geram respostas que contêm pequenos deslizes de sintaxe, schemas JSON malformados ou violações de regras contratuais de negócio. O paradigma **Actor-Critic (Gerador-Verificador)** desacopla o processo: o modelo primário atua como **Actor** (propondo a solução) e o `VerificationEngine` atua como **Critic / Verifier** determinístico independente.

### 1. Modos de Verificação Embutidos

- **`code` (Sintaxe & Execução em Sandbox)**: Extrai blocos de código (` ```javascript ` / ` ```json `) e os avalia via `SandboxRunner` isolado. Se houver `SyntaxError` ou runtime exception, gera um relatório do erro com linha e mensagem.
- **`schema` (JSON Parsing & Validação Estruturada)**: Garante que blocos JSON estejam perfeitamente formados e atendam a campos obrigatórios.
- **`customVerifier` (Regras de Negócio Arbitrárias)**: Função síncrona ou assíncrona customizada `({ candidate, session }) => { valid: boolean, errors?: string[], feedback?: string, score?: number }`.

### 2. Auto-Correção Reflexiva no Agentic Loop

Quando `verification: { enabled: true }` está ativo, o `AgenticCore` intercepta a resposta candidata antes da entrega final:
1. Emite `AgentEvents.VERIFICATION_START`.
2. Se passar (`valid: true`), emite `AgentEvents.VERIFICATION_PASSED` e entrega a resposta aprovada.
3. Se falhar (`valid: false`), emite `AgentEvents.VERIFICATION_FAILED` e `AgentEvents.VERIFICATION_RETRY`.
4. Constrói um prompt de **auto-reflexão corretiva**, orientando o modelo com os erros exatos identificados, e dispara uma re-tentativa sem intervenção do usuário (até `maxRetries`, padrão: 2).

```javascript
const { AgenticCore, AgentConfig, GoogleProvider, VerificationEngine } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig('DevCriticAgent', 'Empresa', '...', 'Tech Lead', 'Revisar e gerar código', '...'),
  provider: new GoogleProvider({ apiKey: process.env.GOOGLE_GEMINI_API_KEY }),
  
  // Configuração nativa de Actor-Critic
  verification: {
    enabled: true,
    modes: ['code', 'schema'],
    maxRetries: 2,
    customVerifier: async (candidate, context) => {
      // Regra de negócio: não permitir respostas curtas demais em relatórios técnicos
      if (candidate.length < 50) {
        return {
          valid: false,
          errors: ['A resposta é excessivamente sucinta para um parecer técnico.'],
          feedback: 'Por favor, elabore sua resposta detalhando os componentes com pelo menos 100 caracteres.'
        };
      }
      return { valid: true, score: 1.0 };
    }
  }
});

const res = await agent.processMessage('sess-critic', 'Crie uma função em JavaScript para somar dois números.');
console.log(res.response); // Código syntaticamente verificado e aprovado pelo Verifier!
```

---

## 🕸️ Memória em Grafo de Conhecimento Multi-Hop & GraphRAG (v4.1)

O RAG vetorial clássico recupera pedaços de texto por similaridade semântica direta, mas falha em responder perguntas relacionais como: *"Quem é o gestor do projeto aprovado pelo cliente X?"*. O `KnowledgeGraph` e o `GraphMemoryStore` fornecem representação explícita de conhecimento relacional:

### 1. `KnowledgeGraph` (Grafo Bidirecional Multi-Hop)
- Representa nós como entidades (`Entity`: id, label, type, properties).
- Representa arestas como relações direcionadas com propriedades (`Relation`: sourceId, targetId, type, properties, weight).
- Indexação bidirecional `outgoing` e `incoming` para consultas instantâneas.
- **Travessia Multi-Hop (BFS)**: `graph.traverse(startId, maxHops)` percorre a rede de nós e arestas até `N` saltos de profundidade.

### 2. `GraphMemoryStore` & Extração Heurística
- Extração heurística automática a partir de padrões naturais em PT-BR e EN-US (`extrairTriplas`): `(A) gerencia (B)`, `(A) trabalha em (B)`, `(A) aprovou (B)`, `(A) é cliente de (B)`, ou notação explícita `(A) -[RELAÇÃO]-> (B)`.
- Exportação / importação JSON serializável para persistência durável (`toJSON` / `fromJSON`).

### 3. Integração Automática no `ContextAugmenter` (GraphRAG)
Quando `graphMemory: true` está ativo no `AgenticCore`:
- Todo turno do usuário e resposta gerada alimentam o grafo automaticamente.
- Antes de enviar o prompt ao LLM, o `ContextAugmenter` busca subgrafos relacionados às entidades citadas na mensagem e injeta a seção:
  ```markdown
  ### Relational Knowledge Graph (Multi-Hop Context):
  - (Renan Moreira [PERSON]) -[MANAGES]-> (Projeto Alfa [PROJECT])
  - (Projeto Alfa [PROJECT]) -[APPROVED_BY]-> (Diretoria [ORGANIZATION])
  ```

```javascript
const { AgenticCore, AgentConfig, KnowledgeGraph, GraphMemoryStore } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig('RelationalAgent', 'Empresa', '...', 'Analista de Conhecimento', 'Conectar Fatos', '...'),
  graphMemory: true, // Ativa extração e injeção automática de grafos relacionais
});

// Adiciona conhecimento explicitamente (ou deixa o agente extrair via chat)
agent.graphMemory.addTriple(
  { id: 'carlos', label: 'Carlos Drummond', type: 'PERSON' },
  'GERENCIA',
  { id: 'projeto_x', label: 'Projeto Ômega', type: 'PROJECT' }
);
agent.graphMemory.addTriple(
  { id: 'projeto_x', label: 'Projeto Ômega', type: 'PROJECT' },
  'CLIENTE',
  { id: 'acme_corp', label: 'Acme Corporation', type: 'ORGANIZATION' }
);

// Ao perguntar sobre "Carlos", o ContextAugmenter realiza a travessia multi-hop e injeta as relações no prompt!
const res = await agent.processMessage('sess-graph', 'Qual é a relação de Carlos com a Acme Corporation?');
console.log(res.response);
```

---

## 🐝 Swarms Colaborativos Multi-Agente & Protocolo A2A (v4.2)

Tarefas complexas de engenharia, pesquisa profunda e governança exigem a colaboração de múltiplos agentes especialistas. O módulo `swarm` introduz o protocolo **Agent-to-Agent (A2A)** com barramento de mensageria assíncrona (`SwarmMessageBus`), quadro negro de dados concorrente (`SharedBlackboard`) e três topologias nativas de coordenação:

### 1. Topologias Nativas de Coordenação

- **`SupervisorTopology` (Hierárquica)**: Um agente Líder recebe a meta global, planeja e divide o trabalho entre os membros mais capacitados e sintetiza o resultado final.
- **`PipelineTopology` (Esteira Sequencial)**: Passagem de bastão em cadeia onde cada especialista refina e enriquece a entrega do anterior (ex: *Pesquisador $\to$ Analista $\to$ Redator*).
- **`BlackboardTopology` (Colaboração Orientada a Estado)**: Múltiplos agentes leem e escrevem autonomamente no quadro de conhecimento compartilhado até o atingimento de condições de término globais.

### 2. Mensageria A2A e Locking Otimista
- **`SwarmMessageBus`**: Suporta mensagens diretas ponto a ponto, broadcasts globais (`to: '*'`), canais temáticos (`topics`) e o padrão RPC assíncrono correlacionado (`bus.request(from, to, payload, { timeoutMs })`).
- **`SharedBlackboard`**: Quadro central com locking otimista (`expectedVersion`), detecção de conflitos de concorrência, histórico completo de auditoria (`auditTrail`) e `appendToList()`.

```javascript
const { 
  AgentSwarm, 
  SupervisorTopology, 
  PipelineTopology, 
  SwarmMember,
  AgenticCore, 
  AgentConfig, 
  GoogleProvider 
} = require('@areumtecnologia/agentic-core');

// Criação do Enxame com Topologia de Pipeline
const swarm = new AgentSwarm({
  id: 'research-swarm',
  topology: new PipelineTopology()
});

// Registro de Especialistas com perfis e capacidades
swarm.registerMember('researcher', async (input) => {
  return { rawData: `Fatos levantados sobre: ${input}` };
}, { role: 'researcher', capabilities: ['web_search', 'data_gathering'] });

swarm.registerMember('analyst', async (input) => {
  return { analysis: `Análise Crítica: ${input.rawData} apresenta viabilidade técnica alta.` };
}, { role: 'analyst', capabilities: ['analysis', 'math'] });

swarm.registerMember('writer', async (input) => {
  return `Relatório Executivo Final:\n${input.analysis}`;
}, { role: 'writer', capabilities: ['copywriting'] });

// Execução Coletiva
const output = await swarm.execute('Computação Quântica em 2026');
console.log(output.result);
```

---

## 🌐 Browser Use & Navegação Autônoma Segura (v4.2)

O Agentic Core disponibiliza a ferramenta nativa `browser_action` para que agentes naveguem em páginas web, interajam com formulários, extraiam textos pós-renderização JavaScript e capturem screenshots visuais:

### 1. Ações Suportadas
- `navigate`: Abre uma URL após sanitização estrita.
- `click`: Clica em botões e links por seletores CSS ou texto.
- `type`: Preenche inputs e caixas de texto com dados dinâmicos.
- `extract`: Extrai o texto limpo de elementos da página ou do body completo.
- `screenshot`: Captura o estado visual da tela (retornado em Buffer e Base64 PNG).
- `evaluate`: Executa scripts de inspeção controlados.

### 2. Blindagem Anti-SSRF e Contrato de Drivers
- **Anti-SSRF Nativo**: Bloqueia automaticamente acessos a `localhost`, `127.0.0.1`, `::1`, IPs de metadados de nuvem (`169.254.169.254` AWS/GCP/Azure) e protocolos não permitidos (`file:`, `javascript:`, `chrome:`).
- **Driver Agnóstico**: Suporte a `BaseBrowserDriver` com conector leve hermético `MockBrowserDriver` (zero dependências de Chromium) ou drivers em nuvem/Puppeteer.

```javascript
const { AgenticCore, AgentConfig, GoogleProvider, MockBrowserDriver } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig('WebInspector', 'Empresa', '...', 'Auditor Web', 'Inspecionar Portais', '...'),
  provider: new GoogleProvider({ apiKey: process.env.GOOGLE_GEMINI_API_KEY }),
  
  // Ativa a ferramenta nativa de navegador
  browserTool: true // utiliza MockBrowserDriver hermético por padrão ou driver customizado
});

// Ações executadas pelo agente via tool call
const pageInfo = await agent.browserTool.execute({
  action: 'navigate',
  url: 'https://areum.com.br'
});
console.log(`Título: ${pageInfo.title}`);

const text = await agent.browserTool.execute({
  action: 'extract',
  selector: 'h1'
});
console.log(`Conteúdo extraído: ${text.text}`);
```

---

## 📡 Observabilidade Corporativa OpenTelemetry GenAI (v4.3)

O Agentic Core adota integralmente as [Convenções Semânticas Oficiais de GenAI do consórcio OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/gen-ai/), padronizando o rastreamento hierárquico de inferências de IA, custos de tokens, finish reasons e chamadas de ferramentas:

### 1. Atributos Semânticos Oficiais Mapeados
- **Sistema & Modelo**: `gen_ai.system` (`gemini`, `openai`, `anthropic`, `ollama`, `nvidia`), `gen_ai.request.model`.
- **Métricas de Tokens**: `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.total_tokens`.
- **Operação & Status**: `gen_ai.operation.name` (`chat`, `execute_tool`, `verify`, `graph_query`), `gen_ai.response.finish_reasons`.
- **Ferramentas Invocadas**: `gen_ai.tool.name`, `gen_ai.tool.input`, `gen_ai.tool.output`.

### 2. Exportação OTLP e Integração no `AgenticCore`
Compatível nativamente com coletores e APMs corporativos (**Datadog, Dynatrace, LangSmith, Phoenix/Arize, Grafana Tempo**) ou buffer em memória para testes:

```javascript
const { AgenticCore, AgentConfig, GoogleProvider, OtelGenAIBridge } = require('@areumtecnologia/agentic-core');

// Configuração da ponte OpenTelemetry GenAI
const otel = new OtelGenAIBridge({
  serviceName: 'atendimento-agente-ia',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT // opcional: omita para modo in-memory
});

const agent = new AgenticCore({
  agent: new AgentConfig('SupportAgent', 'Empresa', '...', 'Suporte', 'Atender', '...'),
  provider: new GoogleProvider({ apiKey: process.env.GOOGLE_GEMINI_API_KEY }),
  otel // Habilita o rastreamento OTLP GenAI de ponta a ponta
});

// Escuta os spans formatados que são exportados
agent.on('otel:span_exported', (span) => {
  console.log(`[OTel GenAI] Span "${span.name}" exportado com traceId: ${span.traceId}`);
});
```

---

## 🎯 Framework de Evals & Benchmarking para CI/CD (v4.3)

Garanta a qualidade de produção e evite regressões comportamentais em esteiras de integração contínua (GitHub Actions, GitLab CI). O `AgentBenchmarkHarness` executa cenários estruturados e avalia determinísticamente a qualidade das trajetórias:

### 1. Métricas Algorítmicas Avaliadas
- **Goal Completion Rate (GCR)**: Aferição objetiva da resposta contra `expectedContains`, regex `expectedPattern`, ausência de termos proibidos `forbiddenContains` e validadores de negócio customizados.
- **Trajectory Alignment**: Similaridade e ordenação das ferramentas executadas contra a trajetória dourada (*Golden Trajectory*).
- **Loop Detection Score**: Identificação precoce de armadilhas cognitivas, pensamentos circulares ou invocações repetitivas de ferramentas com os mesmos parâmetros.
- **Eficiência Computacional**: Consumo de tokens e turnos em relação aos limites orçados.

### 2. Execução da Suíte e Geração de Relatórios (Markdown & JSON)

```javascript
const { AgentBenchmarkHarness, AgenticCore, AgentConfig, GoogleProvider } = require('@areumtecnologia/agentic-core');

const harness = new AgentBenchmarkHarness({
  suiteName: 'Suíte de Regressão Financeira',
  agentFactory: () => new AgenticCore({
    agent: new AgentConfig('FinanceBot', 'Empresa', '...', 'Analista', 'Calcular', '...'),
    provider: new GoogleProvider({ apiKey: process.env.GOOGLE_GEMINI_API_KEY }),
    calculatorTool: true
  }),
  scenarios: [
    {
      id: 'tax_calculation',
      name: 'Cálculo de ICMS e Frete',
      prompt: 'Calcule o ICMS de 18% sobre R$ 1.500,00 e some frete de R$ 50,00.',
      expectedContains: ['320'],
      goldenTrajectory: ['calculate_expression'],
      maxAllowedTurns: 2,
      maxAllowedTokens: 500
    }
  ]
});

// Executa a bateria de benchmark
const results = await harness.run();

console.log(`Taxa de Aprovação: ${results.passRate}%`);

// Relatório em Markdown pronto para ser comentado em Pull Requests no GitHub!
console.log(results.markdownSummary);
```

---

## 💉 Injeção Dinâmica de Turnos & Contexto (v4.4)

O Agentic Core disponibiliza mecanismos nativos para enriquecer ou influenciar o comportamento do agente **durante uma conversa em andamento**, sem necessitar recriar sessões ou alterar as configurações globais:

### 1. `injectSystemContext(sessionId, context, options)` — Instruções & Propagandas Contextualizadas

Injeta diretrizes, promoções ou regras dinâmicas que são mescladas transparentemente ao prompt (`augmentedContext`) a cada turno do LLM, **sem poluir o histórico visual da conversa**:

- **Controle de TTL por Turnos (`ttlTurns`)**: O contexto é consumido automaticamente e decrementado a cada interação do usuário com o modelo. Ao atingir `0`, expira e é removido.
- **Modo Persistente (`persistent: true`)**: Permanece ativo por tempo indeterminado até remoção explícita.
- **Rótulo Identificador (`label`)**: Permite rastreamento e remoção seletiva via `clearInjectedContext(sid, label)`.
- **Compatibilidade Total**: Providers como Google Gemini não aceitam `role: 'system'` arbitrário no array `contents[]`. O `injectSystemContext()` resolve isso injetando a diretriz diretamente na camada contextual consolidada do turno.

```javascript
const { AgenticCore, AgentConfig, GoogleProvider, AgentEvents } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig('VendedorBot', 'TechShop', 'Atendimento e Vendas', 'Consultor', 'Ajudar clientes', 'Seja prestativo.'),
  provider: new GoogleProvider({ apiKey: process.env.GOOGLE_GEMINI_API_KEY })
});

const sessionId = 'cliente-123';
agent.createSession(sessionId, { name: 'Mariana' });

// Injeta uma propaganda sutil que ficará ativa durante as próximas 3 mensagens
agent.injectSystemContext(sessionId, `
[Diretriz de Campanhas Ativas - Parceria TechStore]
Temos uma promoção ativa: Cupom "TECH15" oferece 15% de desconto em notebooks para desenvolvedores.
Se o assunto da conversa tocar em computadores, trabalho ou compra de equipamentos,
contextualize e sugira naturalmente o cupom "TECH15".
Se o assunto não tiver relação, responda normalmente sem forçar o anúncio.
`, { ttlTurns: 3, label: 'campanha_notebooks' });

// O usuário conversa normalmente:
const res1 = await agent.processMessage(sessionId, 'Preciso de uma máquina potente para compilar projetos pesados.');
// → O modelo responde recomendando especificações E contextualiza a promoção de forma fluida!

// Consultar contextos ativos da sessão:
const ativos = agent.getInjectedContexts(sessionId);
console.log('Contextos ativos:', ativos);

// Remover manualmente se a campanha for cancelada:
agent.clearInjectedContext(sessionId, 'campanha_notebooks');
```

---

### 2. `injectTurn(sessionId, turns, options)` — Semeadura de Histórico e Few-Shot

Permite inserir turnos arbitrários (`user`, `model`, `tool`) diretamente na memória de trabalho (`WorkingMemory`) da sessão **sem invocar o LLM**:

- **String simples**: Converte automaticamente em `{ role: 'user', parts: [{ text }] }`.
- **Objeto estruturado ou Array**: Permite semear pares simulados `{ role: 'user' }` e `{ role: 'model' }` para criar exemplos contextuais (*few-shot in-context learning*) ou restaurar estados legados.
- **Disparo de Eventos**: Emite `AgentEvents.TURN_INJECTED` com auditoria dos turnos adicionados (desativável com `options.silent: true`).
- **Fluência Encadeável**: Retorna a própria instância `agent` para chamadas em cascata.

```javascript
// Injeta um par user/model simulado para condicionar o tom de resposta
agent.injectTurn(sessionId, [
  {
    role: 'user',
    parts: [{ text: 'Exemplo: Qual é o status do meu pedido?' }]
  },
  {
    role: 'model',
    parts: [{ text: 'Para consultar o status do seu pedido, por favor informe o número do rastreio ou seu CPF cadastrado!' }]
  }
]);

// Mensagem subsequente do usuário real aproveitará o padrão semeado:
const res = await agent.processMessage(sessionId, 'Quero saber onde está minha encomenda.');
```

---

### 💡 Casos de Uso: Reengajamento, Follow-up e Despertar de Usuário Inativo

Um dos casos de uso mais comuns em plataformas de atendimento (WhatsApp, Webchat, SAC) é quando **o cliente para de responder no meio de um atendimento, compra ou cotação**. 

A injeção dinâmica de contexto (`injectSystemContext`) permite despertar o agente e gerar lembretes ultra-personalizados baseados no histórico exato da conversa, **sem poluir o histórico com mensagens falsas do usuário**:

#### Cenário A: Despertar Automático em Tempo Real (`SESSION_IDLE_TIMEOUT`)

Configure um temporizador de inatividade (`idleTimeout`) na sessão. Quando o usuário ficar em silêncio pelo tempo estipulado, o evento `SESSION_IDLE_TIMEOUT` dispara:

```javascript
const { AgenticCore, AgentEvents } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({ agent: myConfig });

// 1. Cria a sessão com idleTimeout de 3 minutos (180.000 ms)
const session = agent.createSession('user_whatsapp_123', {
  user: { name: 'João' },
  idleTimeout: 3 * 60 * 1000, // 3 minutos sem resposta do cliente
  idleRepeat: false,          // se true, repete se o cliente continuar em silêncio
});

// 2. Escuta quando o usuário ficou inativo
agent.on(AgentEvents.SESSION_IDLE_TIMEOUT, async ({ session }) => {
  console.log(`[Follow-up] Cliente ${session.user.name} parou de responder.`);

  // Injeta a diretriz contextualizada sem poluir o histórico visual da conversa
  agent.injectSystemContext(session.id, `
[DIRETRIZ DE DESPERTAR / FOLLOW-UP DE INATIVIDADE]
O cliente ${session.user.name} parou de responder há alguns minutos.
Verifique educadamente se ele ainda está aí, se teve alguma dúvida sobre a proposta anterior ou se prefere retomar mais tarde.
Seja breve (máximo 2 frases) e acolhedor.
  `, {
    ttlTurns: 1, // Consumido exclusivamente neste turno de lembrete
    label: 'idle_reengagement',
  });

  // Desperta o LLM para gerar a mensagem de lembrete
  const res = await agent.processMessage(session.id, '[SYSTEM: Envie uma mensagem de follow-up cordial]');
  
  // Envia a resposta personalizada para o WhatsApp / Canal do cliente:
  await whatsappClient.sendMessage(session.id, res.response);
});
```

#### Cenário B: Recuperação de Carrinho Abandonado / Follow-up Tardio (Fila BullMQ / Cron)

Para follow-ups após 2 horas ou 24 horas — mesmo quando a sessão já foi descarregada da memória RAM local e está persistida no **Redis** ou **MySQL** (`RedisSessionStore`):

Graças à **Lazy Auto-Rehydration**, o `AgenticCore` re-hidrata todo o histórico e contexto da conversa automaticamente ao receber a mensagem:

```javascript
// Disparado por um Cron Job ou Fila BullMQ 2 horas após a inatividade do cliente:
async function triggerAbandonedCartFollowup(sessionId) {
  // 1. Injeta a instrução com oferta de recuperação de carrinho
  agent.injectSystemContext(sessionId, `
[AÇÃO DE RECUPERAÇÃO DE CARRINHO ABANDONADO]
O cliente não responde há 2 horas. Ele demonstrou forte interesse no plano Pro.
Envie uma mensagem amigável perguntando se precisa de ajuda para concluir a assinatura e ofereça o cupom VOLTE10 para 10% de desconto na primeira mensalidade.
  `, {
    ttlTurns: 1,
    label: 'cart_recovery',
    tracking: {
      campaignId: 'camp_recuperacao_2h',
      renderPatterns: ['VOLTE10'],
      engagementPatterns: ['gostei do cupom', 'como uso'],
    }
  });

  // 2. O AgenticCore restaura a sessão do Redis/MySQL automaticamente e gera a mensagem
  const res = await agent.processMessage(sessionId, '[SYSTEM_TRIGGER: Disparar reengajamento de carrinho abandonado]');

  // 3. Dispara a mensagem gerada para o cliente
  await messagingService.send(sessionId, res.response);
}
```

---

### 3. Smart Rules Engine (Injeção Declarativa e Automática)

O **Smart Rules Engine** permite registrar regras declarativas que monitoram as mensagens do usuário e aplicam diretrizes automaticamente via `injectSystemContext()`, liberando o desenvolvedor de ter que avaliar e injetar instruções manualmente em cada requisição.

O método manual `injectSystemContext()` **permanece 100% ativo e disponível** para disparos pontuais ou intervenções humanas (operador/handover).

- **Gatilhos de Ativação**: Suporta `keywords` (strings ou `RegExp`), `intents` semânticas e `predicate` funcional assíncrono `({ session, text, normalized, history })`.
- **Contexto Dinâmico**: O campo `context` aceita tanto uma string estática quanto uma função geradora `({ session, match }) => string`.
- **Frequency Capping & Anti-Spam**: Protege o cliente de propagandas repetitivas através de `maxPerSession` (máximo de disparos por sessão) e `cooldownTurns` (turnos mínimos de resfriamento entre ativações).
- **Janela de Validade**: Suporta datas de início (`startsAt`) e expiração (`expiresAt`).
- **Evento em Tempo Real**: Emite `AgentEvents.RULE_TRIGGERED` contendo os detalhes do match e o contexto gerado.

```javascript
const { AgenticCore, AgentConfig, GoogleProvider, AgentEvents } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  agent: new AgentConfig('Monnalisa', 'Áreum', '...', 'Consultor', 'Atender', '...'),
  apiKey: process.env.GOOGLE_GEMINI_API_KEY
});

// Registra regra declarativa global (uma única vez no startup)
agent.registerContextRule({
  id: 'promo_workstations',
  description: 'Oferece cupom da TechStore quando o cliente falar sobre notebooks ou computadores',
  match: {
    keywords: ['notebook', 'computador', /workstation/i],
    predicate: ({ session }) => !session.user.tags?.includes('ja_comprou')
  },
  context: ({ session }) => `
  [Campanha Ativa - TechStore Belém]
  O cliente ${session.user.name} tem direito a 20% de desconto em notebooks com o cupom TECHDEV20.
  Mencione com naturalidade se o assunto for compra ou upgrade de hardware.
  `,
  options: {
    ttlTurns: 2,
    label: 'promo_techstore'
  },
  limits: {
    maxPerSession: 1, // Não repete na mesma conversa
    cooldownTurns: 3  // Intervalo de resfriamento
  }
});

// Escuta a ativação automática
agent.on(AgentEvents.RULE_TRIGGERED, ({ ruleId, sessionId, match }) => {
  console.log(`[Regra Ativada] Regra "${ruleId}" disparou na sessão ${sessionId} via ${match.type}`);
});

const sessionId = 'cli-101';
agent.createSession(sessionId, { name: 'Renan' });

// Uso concomitante: o operador ainda pode injetar instruções manuais a qualquer momento!
agent.injectSystemContext(sessionId, 'Aviso de suporte: sistema em manutenção às 23h.', { ttlTurns: 1 });

// Quando o usuário perguntar algo que case com a regra, o Smart Rules Engine injetará o contexto automaticamente:
const res = await agent.processMessage(sessionId, 'Estou pesquisando um notebook potente para compilar códigos de IA.');
```

---

### 4. Analytics de Campanhas & Atribuição Conversacional (CTR de IA)

O **CampaignAnalyticsEngine** monitora o ciclo de vida completo de cada propaganda ou diretriz injetada, medindo a real eficácia comercial e comportamental da IA:

- **Funil de Atribuição em 4 Etapas**:
  1. `INJETADO`: A regra ou injeção entrou no prompt consolidado.
  2. `RENDERIZADO`: O LLM citou os termos-chave ou cupom na resposta final (`renderPatterns`).
  3. `ENGAJADO`: O cliente interagiu sobre a proposta na mensagem imediatamente seguinte (`engagementPatterns`).
  4. `CONVERTIDO`: O cliente realizou a ação esperada (ex: invocação da ferramenta `conversionTool`).
- **Métricas & KPIs Automáticos**:
  - `Render Rate`: Percentual de vezes que o LLM seguiu a instrução e citou a campanha.
  - `Engagement Rate (Conversational CTR)`: Percentual de clientes que demonstraram interesse.
  - `Conversion Rate (CVR)`: Percentual de conversões concretas sobre as exibições.
- **Relatório Executivo em Markdown**: Gerado via `agent.campaignAnalytics.generateMarkdownReport()`.

```javascript
// Registra regra com especificação de rastreamento (tracking)
agent.registerContextRule({
  id: 'promo_nuvem',
  match: { keywords: ['servidor', 'cloud', 'hospedagem'] },
  context: 'Ofereça 30 dias grátis de Cloud com cupom NUVEM30.',
  options: {
    ttlTurns: 2,
    tracking: {
      campaignId: 'cloud_q4',
      renderPatterns: ['NUVEM30', '30 dias grátis'],
      engagementPatterns: ['preço', 'como funciona', 'quero', 'cupom', 'ativar'],
      conversionTool: 'provision_cloud_account'
    }
  }
});

// Eventos de telemetria analítica
agent
  .on(AgentEvents.INJECTION_RENDERED, ({ campaignId, pattern }) => {
    console.log(`[Campanha Renderizada] IA citou o termo "${pattern}" da campanha ${campaignId}`);
  })
  .on(AgentEvents.INJECTION_ENGAGED, ({ campaignId, userText }) => {
    console.log(`[Campanha Engajada] Usuário reagiu à campanha ${campaignId}: "${userText}"`);
  })
  .on(AgentEvents.INJECTION_CONVERTED, ({ campaignId, toolName }) => {
    console.log(`[Conversão!] Campanha ${campaignId} converteu via tool "${toolName}"`);
  });

// Gerando relatório consolidado
console.log(agent.campaignAnalytics.generateMarkdownReport());
```

---

### 5. Métodos Auxiliares de Gestão de Contexto, Regras e Analytics

---

### 5. Guardrails Adaptativos & Defesa Dinâmica por Risco (Adaptive Guardrails)

O **AdaptiveGuardrailsEngine** monitora continuamente a conduta do usuário e eleva o nível de risco da sessão (*Risk Tiers*) ao detectar tentativas de *prompt injection*, *jailbreaks* (como DAN mode), extração de *system prompt* ou furto de credenciais/API keys.

Em vez de apenas abortar bruscamente a conversa, o motor adota uma **defesa adaptativa em camadas**:
1. **Níveis de Risco Dinâmicos (`RiskTiers`)**:
   - `NORMAL` (Tier 0): Sessão padrão com acesso completo a todas as ferramentas autorizadas.
   - `ELEVATED` (Tier 1): Injeção imediata de diretriz de blindagem de persona e recusa de simulações.
   - `HIGH` (Tier 2): Restrição imediata de ferramentas sensíveis (`execute_script`, `sql_query`, etc.) e diretriz de resposta curta e protocolar.
   - `QUARANTINE` (Tier 3): Isolamento de sessão e mitigação rigorosa de segurança.
2. **Mitigação Transparente**: As diretrizes de blindagem são injetadas no próprio ciclo de vida via `injectSystemContext()`.
3. **Bloqueio Ativo de Tools**: Se um ataque tentar forçar chamadas de ferramentas de alto risco, o `AgenticCore` intercepta a execução, emite `AgentEvents.ERROR` (source: `adaptive_guardrails`) e impede que comandos maliciosos alcancem o ambiente.
4. **Desescalonamento Gradual**: Se o usuário retomar uma conduta legítima por 3 turnos seguros consecutivos, o nível de risco desce automaticamente e as diretrizes defensivas são limpas.

```javascript
const { AgenticCore, RiskTiers } = require('@areumtecnologia/agentic-core');

// Cadastra um guardrail customizado corporativo
agent.registerGuardrail({
    id: 'anti_competitor_smear',
    category: 'brand_protection',
    detector: {
        keywords: ['concorrente é melhor', 'sistema lixo'],
    },
    action: {
        elevateToTier: RiskTiers.TIER_1_ELEVATED,
        defenseDirective: '[DIRETRIZ DE CONDUTA] Mantenha a compostura, elogie a concorrência cordialmente e destaque nossos diferenciais.',
    }
});

// Acompanha mudanças de risco em tempo real
agent.on(AgentEvents.GUARDRAIL_TIER_CHANGED, ({ sessionId, previousTier, newTier, reason }) => {
    console.log(`[Segurança] Sessão ${sessionId} migrou de ${previousTier} para ${newTier} (${reason})`);
});
```

---

---

### 6. Context A/B Testing & Multi-Armed Bandit (Otimização Contínua de Mensagens)

O **ContextExperimentEngine** permite testar e otimizar variações de copy, abordagens de vendas, tons de voz e mensagens injetadas usando algoritmos de **Multi-Armed Bandit (MAB)**:

- **Estratégias Suportadas**:
  - `epsilon-greedy` *(Padrão)*: Explora aleatoriamente com probabilidade $\epsilon$ (ex: 15%) e explora a melhor variante com probabilidade $1 - \epsilon$.
  - `softmax` (Boltzmann): Distribui probabilidades de escolha de forma proporcional ao histórico relativo de recompensas.
  - `round-robin`: Alternância estrita e uniforme entre variantes.
  - `static-split`: Divisão ponderada por pesos customizados.
- **Integração Declarativa com Regras**: O `ContextRuleEngine` aceita `experimentId`, selecionando a variante vencedora automaticamente no momento do disparo.
- **Ciclo Fechado com Analytics**: O `CampaignAnalyticsEngine` retroalimenta recompensas quando o usuário engaja ou quando aciona a ferramenta de conversão (`conversionGoal`).
- **Coerência de Sessão (`stickToSession`)**: Garante que o mesmo cliente receba a mesma variação durante toda a conversa.

```javascript
const { AgenticCore } = require('@areumtecnologia/agentic-core');

// Cadastra um experimento Multi-Armed Bandit
agent.createExperiment({
    id: 'promo_workstation_copy',
    name: 'Teste de Copy para Linha Workstation',
    strategy: 'epsilon-greedy',
    epsilon: 0.15,
    stickToSession: true,
    variants: [
        { id: 'v_economia', text: 'Mencione o cupom TECHDEV20 focando em 20% de economia.' },
        { id: 'v_performance', text: 'Mencione o cupom TECHDEV20 focando em dobro de velocidade para programar.' },
    ],
    conversionGoal: {
        toolName: 'checkout_order',
        rewardValue: 1.0,
        engagementReward: 0.3,
    }
});

// Vincula o experimento a uma regra automática
agent.registerContextRule({
    id: 'rule_workstation',
    match: { keywords: ['computador', 'workstation'] },
    experimentId: 'promo_workstation_copy',
});
```

---

### Resumo dos Métodos da v4.4

| Método | Descrição |
|---|---|
| `agent.registerContextRule(rule)` | Cadastra uma regra declarativa no Smart Rules Engine (suporta `experimentId`). |
| `agent.unregisterContextRule(id)` | Remove uma regra declarativa cadastrada pelo ID. |
| `agent.getContextRules()` | Retorna a lista de todas as regras declarativas cadastradas. |
| `agent.clearContextRules()` | Remove todas as regras declarativas registradas. |
| `agent.createExperiment(config)` | Registra um experimento A/B ou Multi-Armed Bandit de copy/mensagens. |
| `agent.selectExperimentVariant(expId, sid)` | Obtém a variante sorteada ou vinculada à sessão pelo Bandit. |
| `agent.recordExperimentReward(expId, varId, val)` | Credita recompensa manual ou customizada para alimentar o algoritmo MAB. |
| `agent.getExperimentStats(expId?)` | Retorna estatísticas consolidadas (impressões, engajamentos, conversões e CVR). |
| `agent.experimentEngine.generateMarkdownReport()` | Gera relatório executivo com ranking e status da variante líder em Markdown. |
| `agent.registerGuardrail(guardrail)` | Cadastra um guardrail adaptativo de segurança no motor. |
| `agent.unregisterGuardrail(id)` | Remove um guardrail adaptativo pelo identificador. |
| `agent.getGuardrails()` | Retorna a lista de guardrails adaptativos ativos. |
| `agent.getSessionRiskTier(sid)` | Obtém o nível de risco atual da sessão (`NORMAL`, `ELEVATED`, `HIGH`, `QUARANTINE`). |
| `agent.resetSessionRisk(sid)` | Reseta manualmente o risco da sessão para `NORMAL` e limpa restrições. |
| `agent.injectSystemContext(sid, text, options)` | Adiciona contexto dinâmico manualmente com suporte a `ttlTurns`, `persistent`, `label` e `tracking`. |
| `agent.injectTurn(sid, turns, options)` | Injeta turnos (`role: 'user'`, `'model'`, `'tool'`) diretamente no histórico sem chamar a API. |
| `agent.getInjectedContexts(sid)` | Retorna todos os contextos dinâmicos ativos na sessão com seus turnos restantes. |
| `agent.clearInjectedContext(sid, label?)` | Remove contextos dinâmicos. Remove todos se omitido o `label`, ou apenas o correspondente. |
| `agent.campaignAnalytics.getMetrics(id?)` | Retorna métricas analíticas detalhadas de campanhas (injections, renders, engagements, CVR). |
| `agent.campaignAnalytics.generateMarkdownReport()` | Gera relatório analítico consolidado pronto em formato Markdown. |

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
│   ├── telemetry/                        # Observabilidade e tracing (TelemetryProvider, OtelGenAIBridge, OtelExporter)
│   ├── evaluation/                       # Trajectory Evals & CI/CD Benchmarking (v4.3)
│   │   ├── index.js                      # Exportações do módulo de avaliação
│   │   ├── TrajectoryEvaluator.js        # Métricas algorítmicas de GCR, alinhamento e detecção de loops
│   │   ├── EvalReportGenerator.js        # Gerador de relatórios executivos em Markdown e JSON
│   │   └── AgentBenchmarkHarness.js      # Orquestrador de testes de regressão contínua
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
│   │   ├── graph/                        # Knowledge Graph & GraphRAG (KnowledgeGraph, GraphMemoryStore)
│   │   │   ├── index.js                  # Exportações do módulo de grafo
│   │   │   ├── KnowledgeGraph.js         # Grafo bidirecional em memória e travessia BFS multi-hop
│   │   │   └── GraphMemoryStore.js       # Extração heurística de triplas e enriquecimento de subgrafos
│   │   ├── ContextAugmenter.js           # Injeção automática de memórias e subgrafos relacionais
│   │   └── ...
│   ├── verification/                     # Motor de Verificação Actor-Critic & Self-Reflection
│   │   ├── index.js                      # Exportações do módulo de verificação
│   │   └── VerificationEngine.js         # Verificador determinístico de código, schemas e regras customizadas
│   ├── swarm/                            # Swarms Colaborativos & Protocolo A2A (v4.2)
│   │   ├── index.js                      # Exportações do módulo de swarm
│   │   ├── AgentSwarm.js                 # Orquestrador central do enxame de agentes
│   │   ├── SwarmMessageBus.js            # Barramento de mensageria assíncrona A2A (Direct, Broadcast, Topics, RPC)
│   │   ├── SharedBlackboard.js           # Quadro compartilhado com locking otimista e auditoria
│   │   ├── SwarmMember.js                # Wrapper de membro do enxame com perfil de competência
│   │   └── topologies/                   # Topologias de coordenação (Pipeline, Supervisor, Blackboard)
│   ├── browser/                          # Browser Use & Navegação Autônoma Segura (v4.2)
│   │   ├── index.js                      # Exportações do módulo de browser
│   │   ├── BaseBrowserDriver.js          # Contrato abstrato para drivers de navegador
│   │   ├── MockBrowserDriver.js          # Driver hermético nativo sem dependências de Chromium
│   │   └── BrowserActionTool.js          # Ferramenta nativa do agente protegida com anti-SSRF
│   ├── orchestrator/                     # Orquestração (TaskGraph, TaskNode, ParallelExecutor, Orchestrator)
│   ├── persistence/                      # Persistência (SessionStore, InMemorySessionStore, RedisSessionStore)
│   ├── platform/                         # Multi-tenancy (PlatformManager)
│   ├── providers/                        # Providers (Google, OpenAI, Anthropic, Ollama, Nvidia)
│   ├── durable/                          # Execução Durável & Resiliência (ExecutionJournal, CheckpointManager)
│   │   ├── index.js                      # Exportações do módulo durável
│   │   ├── ExecutionJournal.js           # Event sourcing imutável e chaves de idempotência em SHA-256
│   │   └── CheckpointManager.js          # Interceptação de replay idempotente e recuperação de sessão
│   ├── sandbox/                          # Sandbox Seguro de Execução & WASM (Safe, Wasm, E2B)
│   │   ├── index.js                      # Exportações do módulo sandbox
│   │   ├── BaseSandboxRunner.js          # Contrato abstrato de execução isolada
│   │   ├── SafeSandboxRunner.js          # Isolamento em memória (null-prototype, proteção anti-RCE e timeout)
│   │   ├── WasmSandboxRunner.js          # Compilação e execução nativa de bytecode WebAssembly
│   │   └── E2BSandboxRunner.js           # Conector para microVMs descartáveis na nuvem (Python/Bash)
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
│   ├── test_otel_genai.js                # Validação de OtelGenAIBridge, convenções semânticas GenAI e OtelExporter
│   ├── test_trajectory_evals.js          # Validação de TrajectoryEvaluator, AgentBenchmarkHarness e relatórios CI/CD
│   ├── test_swarm.js                     # Validação de AgentSwarm, SwarmMessageBus, SharedBlackboard e topologias A2A
│   ├── test_browser_action.js            # Validação de MockBrowserDriver, blindagem anti-SSRF e ferramenta browser_action
│   ├── test_graph_memory.js              # Validação de KnowledgeGraph, travessia BFS multi-hop e GraphRAG
│   ├── test_verification_engine.js       # Validação de VerificationEngine, verificação de código e loop Actor-Critic
│   ├── test_durable_execution.js         # Validação de idempotência SHA-256, CheckpointManager e resumabilidade de grafos
│   ├── test_sandbox.js                   # Validação de SafeSandboxRunner, bloqueio de prototype escape e WASM bytecode
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
# Executar suíte padrão completa (23 baterias de testes integradas)
npm test

# Executar suíte da Fase 4: OpenTelemetry GenAI e Trajectory Evals (v4.3)
npm run test:otel     # Valida convenções semânticas OTel GenAI e exportador OTLP
npm run test:evals    # Valida harness de benchmark, detecção de loops e relatórios

# Executar suíte da Fase 3: Swarms Colaborativos e Browser Use (v4.2)
node tests/test_swarm.js
node tests/test_browser_action.js

# Executar suíte da Fase 2: Actor-Critic e Graph Memory (v4.1)
node tests/test_verification_engine.js
node tests/test_graph_memory.js

# Executar suíte da Fase 1: Execução durável e sandbox v4.0
node tests/test_durable_execution.js
node tests/test_sandbox.js

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
