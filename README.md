# Agentic Core

> **v3.2.0** — Framework profissional para orquestração de Agentes Autônomos em Node.js com suporte a múltiplos provedores redundantes (Google Gemini, OpenAI, Claude, Ollama, Nvidia), suporte nativo ao protocolo MCP (Model Context Protocol) como Cliente e Servidor, failover automático em caso de falhas 5xx, suporte a mídias (imagens, áudio, vídeo), gerenciamento concorrente transparente (debounce + abort), sessões integradas, **memória hierárquica com compactação de contexto**, **SubAgentes com delegação**, **orquestração paralela de tarefas (DAG)**, **plataforma multi-tenant**, **persistência de sessões** e **sistema de ferramentas embutidas com validação, composição e marketplace**.

---

## ✨ Características

| Recurso | Descrição |
|---|---|
| **Multi-Provider Nativo** | Suporte a **Google Gemini**, **OpenAI GPT**, **Anthropic Claude**, **Ollama** (modelos locais) e **Nvidia NIM**. |
| **Redundância e Failover** | Possibilidade de configurar múltiplos modelos/provedores com `currentIndex` atômico. Transição automática imediata em caso de indisponibilidade (erro 5xx/rate limit/timeout). |
| **Suporte Nativo a MCP** | Conecte-se a servidores MCP externos (Stdio/SSE) e importe ferramentas dinamicamente no agente, ou exponha o próprio agente como um MCP Server. |
| **Memória Hierárquica** | `WorkingMemory` (janela deslizante), `ContextCompactor` (resumos via LLM), `EpisodicMemory` (episódios significativos) e `SemanticMemory` (fatos e preferências). |
| **SubAgentes Isolados** | `SubAgent` para execução de tarefas especializadas em segundo plano, com gestão efêmera de sessão e desregistro automático de ferramentas temporárias. |
| **Orquestração DAG** | `Orchestrator`, `TaskGraph` e `ParallelExecutor` para execução paralela de tarefas com grafos de dependências acíclicos. |
| **Plataforma Multi-Tenant** | `PlatformManager` para gestão de múltiplos tenants, agentes e sessões isoladas. |
| **Persistência de Sessões** | `SessionStore` e `InMemorySessionStore` para salvamento, restauração e exclusão persistente de estado. |
| **Suporte Multimídia** | Envio de anexos (imagens, áudio, vídeo) em Base64 no processamento de mensagens. |
| **Concorrência Transparente** | Gerenciamento automático de mensagens consecutivas (`debounceMs`) com cancelamento ativo no LLM. |
| **Agentic Loop Completo** | Tool calls encadeados com execução recursiva e contextualizada. |
| **Gerenciamento de Sessões** | TTL configurável com renovação automática por atividade e normalização transparente de chaves (string/número). |
| **Registro Dinâmico de Tools** | Schema JSON completo, handlers assíncronos e desregistro dinâmico via `unregisterTool()`. |
| **Retry com Backoff Exponencial** | Recuperação automática de falhas com jitter configurável e classificação centralizada de erros. |
| **Timeouts Granulares** | AbortController por turno (padrão 90s) e por ferramenta (70% do turno). |
| **Detecção de Vulnerabilidades** | Rastreamento via ferramenta interna de segurança e encerramento automático de sessões suspeitas. |
| **Eventos Estruturados** | `EventEmitter` completo para monitoramento (`SESSION_CREATED`, `SESSION_UPDATED`, `PROVIDER_FALLBACK`, `RESPONSE`, etc.). |
| **Sistema de Ferramentas** | **15+ ferramentas embutidas** organizadas em categorias (web, file, database, system, communication) com validação de schema, composição, chaining e marketplace. |

---

## 📦 Instalação

### Via npm (GitHub Packages)

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
# Se usar outros provedores:
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
  AgentEvents, 
  Type, 
  GoogleProvider 
} = require('@areumtecnologia/agentic-core');

// 1. Configurar o agente
const agentConfig = new AgentConfig(
  'Monnalisa',                                          // Nome do agente
  'Áreum Tecnologia',                                   // Nome da empresa
  'Soluções em IA e Automação de Processos.',           // Detalhes da empresa
  'Agente de Vendas',                                   // Papel da missão
  'Atuar como assistente virtual e agente de vendas.',  // Objetivo da missão
  `1. Cumprimente o lead de forma acolhedora.
   2. Identifique as necessidades do cliente.
   3. Utilize as ferramentas disponíveis para obter dados.
   4. Efetive o atendimento de forma humanizada.`,      // Instruções da missão
  'pt-BR'                                               // Idioma do raciocínio interno
);

// 2. Instanciar o agente com provedor
const agent = new AgenticCore({
  providers: [
    new GoogleProvider({
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      model: 'gemma-4-26b-a4b-it'
    })
  ],
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

## 🔮 Provedores de IA Suportados

A biblioteca suporta múltiplos provedores de IA de forma intercambiável e resiliente.

### Redundância e Failover Automático

Você pode configurar múltiplos modelos e/ou provedores para failover automático em caso de indisponibilidade (erro 5xx, rate limit ou timeout).

```javascript
const { GoogleProvider, OpenAIProvider, AgenticCore } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  providers: [
    new GoogleProvider({ apiKey: 'key1', model: 'gemma-4-26b-a4b-it' }),
    { type: 'google', apiKey: 'key1', model: 'gemma-4-31b-it' },
    { type: 'openai', apiKey: 'key2', model: 'gpt-4o' }
  ],
  agent: agentConfig
});
```

---

## 🧠 Memória Hierárquica e Compactação de Contexto

O Agentic Core possui uma camada de memória dividida em 4 níveis:

1. **`WorkingMemory`**: Mantém a janela deslizante de $N$ turns recentes enviados ao LLM.
2. **`ContextCompactor`**: Compacta automaticamente turns antigos em resumos estruturados via LLM. Suporta filtragem por importância (`importanceThreshold`) para manter apenas as turns mais críticas.
3. **`EpisodicMemory`**: Armazena episódios significativos da conversa para recuperação de contexto. Suporta **compartilhamento de sessões** (`shareSession`) e **esvaziamento de sessões** (`forgetSession`).
4. **`SemanticMemory`**: Armazena fatos, preferências e conhecimento factual (`subject`, `predicate`, `object`). Suporta **busca por predicate**, **filtro por confiança** (`recallByConfidence`) e **recuperação global**.

```javascript
const { AgenticCore, InMemoryStore } = require('@areumtecnologia/agentic-core');

const memoryStore = new InMemoryStore();

const agent = new AgenticCore({
  provider: new GoogleProvider({ apiKey: process.env.GOOGLE_GEMINI_API_KEY, model: 'gemma-4-26b-a4b-it' }),
  agent: agentConfig,
  memoryStore,
  compaction: {
    maxOutputTokens: 1024,
    temperature: 0.3,
    language: 'pt-BR'
  }
});

// EpisodicMemory - compartilhar episódios entre sessões
await episodicMemory.shareSession('session_1', 'session_2', { limit: 100 });

// EpisodicMemory - esquecer sessão
await episodicMemory.forgetSession('session_1');

// SemanticMemory - buscar por predicate
await semanticMemory.recallByPredicate('prefers', { subject: 'user' });

// SemanticMemory - filtrar por confiança
await semanticMemory.recallByConfidence(0.85, { limit: 10 });
```

---

## 🤖 SubAgentes com Delegação de Tarefas

O `SubAgent` permite executar tarefas especializadas em segundo plano utilizando a infraestrutura do agente pai.

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

## 🌐 Orquestração de Tarefas em Grafo (DAG)

Orquestre tarefas complexas com dependências paralelas via `Orchestrator`, `TaskGraph` e `ParallelExecutor`:

```javascript
const { Orchestrator } = require('@areumtecnologia/agentic-core');

const orchestrator = new Orchestrator({ maxConcurrent: 4 });

orchestrator.addTask('task-1', { agent: subAgentA, task: 'Coletar dados' });
orchestrator.addTask('task-2', { agent: subAgentB, task: 'Processar dados', dependsOn: ['task-1'] });

const results = await orchestrator.execute();
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

## 📋 API de Referência

### Métodos Principais do `AgenticCore`

- **`createSession(id, user, options?)`**: Cria uma nova sessão. `id` pode ser string ou número.
- **`processMessage(sessionId, text, attachment?, options?)`**: Processa mensagens com suporte a anexos Base64 e `AbortSignal`.
- **`registerTool(declaration, handler)`**: Registra ou sobrescreve uma ferramenta.
- **`unregisterTool(name)`**: Remove uma ferramenta do registro por nome e invalida o cache de configuração.
- **`clearSession(sessionId, options?)`**: Remove a sessão e limpa timers de TTL/Idle e buffers de debounce.
- **`getSession(sessionId)`**: Retorna o objeto da sessão.
- **`getSessionByUser(filter)`**: Busca sessão por nome, telefone ou origem.

---

## 🎯 Eventos

Escute eventos com `agent.on(AgentEvents.EVENT_NAME, callback)`:

```javascript
const { AgentEvents } = require('@areumtecnologia/agentic-core');

agent
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
│   ├── tools/                            # Sistema de ferramentas embutidas
│   │   ├── index.js                      # Exportações do sistema de ferramentas
│   │   ├── ToolRegistry.js               # Registro e descoberta de ferramentas
│   │   ├── ToolComposer.js               # Composição e chaining de ferramentas
│   │   ├── ToolValidator.js              # Validação de schema e segurança
│   │   ├── ToolMarketplace.js            # Marketplace e descoberta
│   │   └── categories/                   # Categorias de ferramentas
│   │       ├── web.js                    # Ferramentas web (search, fetch, validate)
│   │       ├── file.js                   # Ferramentas de arquivo
│   │       ├── database.js               # Ferramentas de banco de dados
│   │       ├── system.js                 # Ferramentas de sistema
│   │       └── communication.js          # Ferramentas de comunicação
│   ├── mcp/                              # Protocolo MCP (Client, Server, Manager)
│   ├── memory/                           # Memória (Working, Compactor, Episodic, Semantic)
│   ├── orchestrator/                     # Orquestração (TaskGraph, ParallelExecutor, Orchestrator)
│   ├── persistence/                      # Persistência (SessionStore, InMemorySessionStore)
│   ├── platform/                         # Multi-tenancy (PlatformManager)
│   └── providers/                        # Providers (Google, OpenAI, Anthropic, Ollama, Nvidia)
├── tests/
│   ├── test_bugs_fix.js                  # Suíte de teste para correções de bugs
│   ├── test_no_mutation.js               # Teste de regressão para imutabilidade de contents
│   ├── test_retry_classification.js      # Validação de erros retentáveis vs permanentes
│   ├── test_mcp.js                       # Testes do protocolo MCP
│   ├── test_debounce_abort.js            # Concorrência e cancelamento
│   └── ...                               # Outros testes de serviço e integração
├── package.json
└── README.md
```

---

## 🛠️ Sistema de Ferramentas Embutidas

O Agentic Core inclui um sistema completo de ferramentas embutidas com **15+ ferramentas** organizadas em 5 categorias:

### Categorias de Ferramentas

| Categoria | Ferramentas | Descrição |
|-----------|-------------|-----------|
| **Web** | `web_search`, `http_fetch`, `validate_url` | Busca web, requisições HTTP e validação de URLs |
| **File** | `read_file`, `write_file`, `list_directory`, `file_exists` | Operações de arquivo e diretório |
| **Database** | `sql_query`, `db_schema`, `db_health` | Consultas SQL e gerenciamento de banco |
| **System** | `system_info`, `execute_command`, `get_env`, `current_datetime` | Informações do sistema e execução de comandos |
| **Communication** | `send_email`, `send_sms`, `send_notification`, `trigger_webhook` | Comunicação e notificações |

### Recursos do Sistema de Ferramentas

- **Validação de Schema**: Validação automática de argumentos com JSON Schema
- **Composição**: Chain de ferramentas com transformação de dados
- **Execução Paralela**: Execução simultânea de múltiplas ferramentas
- **Marketplace**: Descoberta, rating e reviews de ferramentas
- **Segurança**: Validação de segurança e sanitização de inputs

### Exemplo de Uso

```javascript
const { registry, composer } = require('@areumtecnologia/agentic-core');

// Usar ferramenta diretamente
const result = await registry.executeTool('web_search', {
  query: 'artificial intelligence'
});

// Compor ferramentas
const workflow = composer.compose('research', [
  { name: 'web_search', transform: args => ({ query: args.topic }) },
  { name: 'write_file', transform: (results) => ({
    filePath: 'research.md',
    content: JSON.stringify(results, null, 2)
  })}
]);

await workflow.execute({ topic: 'AI trends' });
```

---

## 🧪 Testes

```bash
# Executar suíte padrão
npm test

# Executar testes específicos de regressão e correções
node tests/test_bugs_fix.js
node tests/test_no_mutation.js
node tests/test_retry_classification.js

# Testar sistema de ferramentas
node src/tools/examples/complete_example.js
```

---

## 📄 Licença

ISC

## 👤 Autor

**Áreum Tecnologia** — Software and AI Development Team
