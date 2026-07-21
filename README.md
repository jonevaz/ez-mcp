# ez-mcp

Micro-SaaS que transforma qualquer API (ou conjunto de APIs) em um **MCP server**
pronto para ser consumido por Claude Code, Cursor, Codex e outros agentes.

Visual baseado em design system próprio (tokens em
`src/app/tokens/`, componentes em `src/components/ds/`).

## Telas

- **Home** — dashboard de consumo: chamadas (30 dias/hoje), MCPs publicados,
  taxa de erro, chamadas por MCP e atividade recente.
- **Fontes** — CRUD das APIs de origem. Importe uma spec OpenAPI/Swagger
  (URL ou colando o conteúdo, JSON ou YAML) ou cadastre endpoints manualmente.
  Suporta auth da API de origem: Bearer, API Key (header) e Basic.
- **MCPs** — CRUD dos MCP servers. Selecione endpoints das fontes como tools,
  edite nome/descrição de cada tool e **publique**: o MCP fica disponível em
  `/api/mcp/<slug>` (Streamable HTTP, stateless), protegido por token Bearer
  próprio, com snippets prontos para Claude Code e Cursor.

Sem autenticação na ferramenta nesta versão.

## Rodando

```bash
npm install
npm run dev
```

O banco SQLite é criado automaticamente em `data/app.db`.

## Conectando um agente

Depois de publicar um MCP, copie o snippet da tela de detalhe. Exemplo:

```bash
claude mcp add --transport http petstore http://localhost:3000/api/mcp/petstore \
  --header "Authorization: Bearer <token>"
```

## Stack

- Next.js (App Router, TypeScript) — UI + Server Actions + endpoint MCP
- SQLite via better-sqlite3 + Drizzle ORM
- Protocolo MCP (Streamable HTTP, JSON-RPC) implementado direto na rota
  `src/app/api/mcp/[slug]/route.ts`, sem adapter externo
