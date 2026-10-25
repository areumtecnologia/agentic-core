# Integração do AgenticCore com o Ecossistema Open Agent Skills (`npx skills`)

> **Disponível a partir da versão 3.4.0** do `@areumtecnologia/agentic-core`.

---

## 📖 Visão Geral

O ecossistema **Agent Skills** ([skills.sh](https://skills.sh/)) é um padrão aberto para empacotamento, distribuição e execução de instruções especializadas, regras de engenharia e scripts de automação para agentes autônomos de IA.

Através do módulo `skills` e do CLI oficial `npx skills`, o **AgenticCore** ganha a capacidade de se auto-estender em tempo de execução (*Self-Extending Agent*). O agente é capaz de identificar quando não possui domínio sobre um framework ou tarefa específica, pesquisar no repositório público, instalar o pacote de regras e carregá-lo contextualmente na sessão ativa via *lazy loading*.

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário
    participant Agent as AgenticCore
    participant Tools as SkillsTools
    participant SM as SkillsManager
    participant CLI as npx skills CLI
    participant FS as Local Filesystem (.skills/)

    User->>Agent: "Como configuro cache agressivo no Next.js 15?"
    Agent->>Tools: skills_search({ query: "nextjs cache" })
    Tools->>SM: search("nextjs cache")
    SM->>CLI: npx skills find "nextjs cache"
    CLI-->>SM: ["vercel-labs/agent-skills@next-cache"]
    SM-->>Tools: Resultados
    Tools-->>Agent: Pacotes encontrados

    Agent->>Tools: skills_install({ package: "vercel-labs/agent-skills@next-cache" })
    Tools->>SM: install(...)
    SM->>CLI: npx skills add vercel-labs/agent-skills@next-cache -y
    CLI->>FS: Download do pacote em .skills/
    SM-->>Tools: Skill instalada com sucesso
    Tools-->>Agent: Confirmação de instalação

    Agent->>Tools: skills_load({ skillName: "next-cache" })
    Tools->>SM: loadSkillInstructions("next-cache")
    SM->>FS: Lê SKILL.md e extrai seções
    SM-->>Tools: Retorna regras e checklist detalhado
    Tools-->>Agent: Instruções carregadas na memória ativa

    Agent-->>User: Resposta precisa com base nas diretrizes oficiais da Vercel
```

---

## ⚙️ Configuração no `AgenticCore`

Você pode habilitar o ecossistema de skills passando o objeto `skills` diretamente no construtor do `AgenticCore`:

```javascript
const { AgenticCore, AgentConfig, AgentEvents } = require('@areumtecnologia/agentic-core');

const agent = new AgenticCore({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
  agent: new AgentConfig(
    'SoftwareArchitect',
    'Áreum Tecnologia',
    'Empresa de IA e Automação',
    'Especialista em Arquitetura de Software',
    'Construir aplicações resilientes e de alta performance',
    'Consulte suas skills instaladas para seguir os melhores padrões da indústria.',
    'pt-BR'
  ),
  skills: {
    enabled: true,                       // Ativa o gerenciamento nativo de skills
    autoPrompt: true,                    // Injeta sumário no System Prompt (<skills_protocol>)
    allowAutoInstall: true,              // Permite ao agente baixar skills dinamicamente
    allowExecuteScripts: true,           // Permite ao agente executar scripts de skills
    trustedOwners: [                     // Allowlist de segurança para instalação
      'vercel-labs',
      'anthropics',
      'areumtecnologia'
    ],
    skillsDirs: ['./.skills', './skills'], // Diretórios para varredura de skills locais
    primaryInstallDir: './.skills',       // Diretório onde novas skills serão salvas
    scriptTimeoutMs: 30000,              // Timeout para execução de scripts auxiliares
  }
});
```

---

## 🔧 Ferramentas Registradas no Agente

Quando `skills` está habilitado, o agente recebe automaticamente as seguintes ferramentas em seu catálogo:

### 1. `skills_search`
Permite ao agente buscar skills tanto na base local quanto no registro público online.
- **Parâmetros**:
  - `query` (*string*, obrigatório): Termos de busca (ex: `"react performance"`, `"kubernetes deploy"`, `"security"`).
  - `owner` (*string*, opcional): Filtra a busca para um proprietário específico no GitHub (ex: `"vercel-labs"`).

### 2. `skills_install`
Faz o download e a instalação de uma skill a partir do ecossistema aberto via CLI.
- **Parâmetros**:
  - `package` (*string*, obrigatório): Identificador do pacote (ex: `"vercel-labs/agent-skills@react-best-practices"` ou `"owner/repo"`).

### 3. `skills_list`
Lista todas as skills atualmente instaladas e disponíveis no workspace com versão, descrição e scripts disponíveis.
- **Parâmetros**: Nenhum.

### 4. `skills_load`
Carrega o conteúdo do arquivo `SKILL.md` (metadados, workflows, regras de qualidade e scripts disponíveis) diretamente para a memória de trabalho da sessão.
- **Parâmetros**:
  - `skillName` (*string*, obrigatório): Nome exato da skill a ser carregada.

### 5. `skills_execute_script`
Executa um script de suporte contido na pasta `scripts/` da skill (ex: scripts em `.js`, `.py`, `.sh`).
- **Parâmetros**:
  - `skillName` (*string*, obrigatório): Nome da skill detentora do script.
  - `scriptName` (*string*, obrigatório): Nome do arquivo ou identificador do script.
  - `args` (*array de strings*, opcional): Argumentos passados via linha de comando.

---

## 📁 Especificação do `SKILL.md`

Uma skill é um diretório contendo obrigatoriamente um arquivo `SKILL.md` e, opcionalmente, subpastas de suporte:

```
minha-skill/
├── SKILL.md                 # Arquivo principal com frontmatter e instruções
├── scripts/                 # Scripts executáveis (.js, .py, .sh)
│   └── validate_schema.js
├── references/              # Documentações de referência e cheatsheets
│   └── api_spec.md
└── examples/                # Exemplos práticos de código
    └── sample_config.json
```

### Exemplo de `SKILL.md`

```markdown
---
name: react-modern-patterns
description: Guia avançado de padrões e hooks modernos para React 19.
version: 1.2.0
author: areumtecnologia
tags: [react, frontend, hooks, clean-code]
---

# React Modern Patterns

Diretrizes arquiteturais para componentes modernos.

## When to Use This Skill
Use esta skill sempre que o usuário solicitar criação, refatoração ou auditoria de componentes React.

## Workflow
1. Verifique a necessidade de estado local vs. gerenciamento global.
2. Utilize Server Components sempre que possível.
3. Execute o script de validação de imports antes de concluir.

## Rules
- Nunca use `useEffect` para sincronização que pode ser computada no render.
- Evite prop drilling acima de 3 níveis de profundidade.
```

---

## 🎯 Eventos no `AgentEvents`

O ciclo de vida das skills emite eventos em tempo real no `AgenticCore`:

```javascript
const { AgentEvents } = require('@areumtecnologia/agentic-core');

agent
  // Emitido quando uma busca por skills é realizada
  .on(AgentEvents.SKILL_SEARCHED, ({ query, items }) => {
    console.log(`[Skills] Busca por "${query}" retornou ${items.length} itens.`);
  })

  // Emitido quando uma nova skill é instalada com sucesso
  .on(AgentEvents.SKILL_INSTALLED, ({ package, skillName, status }) => {
    console.log(`[Skills] Pacote ${package} (${status}): ${skillName}`);
  })

  // Emitido quando o agente carrega as instruções de uma skill na sessão
  .on(AgentEvents.SKILL_ACTIVATED, ({ skillName }) => {
    console.log(`[Skills] Diretrizes ativadas na sessão: ${skillName}`);
  })

  // Emitido na execução de scripts de automação
  .on(AgentEvents.SKILL_EXECUTION, ({ skillName, scriptName }) => {
    console.log(`[Skills] Executando script: ${skillName} -> ${scriptName}`);
  });
```

---

## 🛡️ Segurança e Governança

1. **Allowlist de Proprietários (`trustedOwners`)**:
   - Se configurado, qualquer tentativa do agente ou de terceiros de instalar pacotes de autores desconhecidos é interceptada e bloqueada antes de qualquer chamada externa.
2. **Execução Não-Interativa (`CI=true` e `-y`)**:
   - Todos os comandos do CLI são executados com flags que suprimem prompts interativos que poderiam travar o processo.
3. **Timeouts Rígidos**:
   - Tanto o CLI quanto scripts auxiliares possuem timeouts configuráveis (`scriptTimeoutMs`, padrão 30s) com sinalização de encerramento (`SIGTERM`).
4. **Isolamento de Ambiente**:
   - Scripts executados recebem uma variável de ambiente `SKILL_DIR` apontando para o diretório raiz da skill correspondente.
