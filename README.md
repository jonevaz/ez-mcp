# ez-mcp

**Turn an OpenAPI or Swagger spec into an MCP server, without writing code.**

Point it at a spec, pick the operations you want to expose, publish. Agents like
Claude Code, Cursor and Codex connect over Streamable HTTP and discover the
operations as MCP tools.

> **What this is:** a faithful bridge between an HTTP API and the MCP protocol.
> One API operation becomes one MCP tool, with the parameters, enums and request
> body shape taken from the spec.
>
> **What this is not:** a layer that reinterprets your API. It does not merge
> endpoints into higher-level tools, paginate for the agent, summarise responses,
> or rewrite tool descriptions with an LLM. If the underlying API is awkward to
> use, the tools will be too. See [Roadmap](#roadmap).

## Status

Early. Single-user, self-hosted, **no authentication on the admin UI**. Run it on
your machine or behind something that handles access control — do not put it on
the open internet as-is. See [Security](#security).

## Features

- **Import a spec** — OpenAPI 3.x or Swagger 2.0, JSON or YAML, from a URL or
  pasted. If the URL points at a docs page (Swagger UI, Redoc) instead of the raw
  spec, it tries to locate the spec automatically.
- **Real schemas** — `$ref` is resolved (including recursive schemas and
  `allOf`), and `enum`, `format`, `default`, `items` and the request body shape
  are carried into each tool's `inputSchema`. Anything that could not be
  interpreted is reported at import time rather than dropped silently.
- **Source authentication** — Bearer, API key header, Basic, and OAuth 2.0
  client credentials (token fetched server-side and cached until it expires).
- **Argument validation** — arguments are checked against the tool schema before
  any request goes out, so the agent gets ``Missing required parameter `petId` ``
  instead of an opaque 404 from the API.
- **Published MCP servers** — each MCP is served at `/api/mcp/<slug>`
  (Streamable HTTP, stateless, JSON-RPC) behind its own Bearer token.
- **Usage dashboard** — calls, error rate and recent activity per MCP.

## Running

```bash
npm install
npm run dev
```

The SQLite database is created automatically at `data/app.db`.

## Connecting an agent

After publishing an MCP, copy the snippet from its detail page:

```bash
claude mcp add --transport http petstore http://localhost:3000/api/mcp/petstore --header "Authorization: Bearer <token>"
```

## Security

**The admin UI has no authentication.** Anyone who can reach the port can create
sources, publish MCPs and read the MCP access tokens. Bind it to localhost, or
put it behind a reverse proxy / VPN / SSO. Published MCP endpoints are separately
protected by a per-MCP Bearer token.

**Source credentials are encrypted at rest** (AES-256-GCM) and never sent to the
browser — the form shows a placeholder for stored secrets. The encryption key
comes from `EZ_MCP_SECRET_KEY`, or is generated into `data/.secret-key` on first
use. Since that key sits next to the database by default, this protects a leaked
*database file* (backup, copied volume, an accidental commit) — **not** a
compromised host. To keep secrets out of the database entirely, store the value
as `env:MY_API_TOKEN` and set that variable in the environment.

**No SSRF protection.** The server fetches whatever base URL and spec URL you
give it, including private network addresses. Treat the ability to create a
source as equivalent to the ability to make requests from the server.

## Known limitations

- No SSRF guard, no per-MCP rate limiting, no request retries.
- Argument validation is shallow by design: it checks top-level parameters
  (presence, type, enum) and the required top-level fields of the body. Nested
  rules are left to the source API.
- Responses are returned as raw text and truncated at 60k characters, with a
  marker. There is no pagination handling or field projection — a broad `list`
  call can still flood the agent's context.
- No `structuredContent` / `outputSchema` (MCP 2025-06-18), no `tools/list`
  pagination, no JSON-RPC batching.
- `multipart/form-data` and file uploads are not supported.
- External `$ref` (into another document) is not fetched; affected fields are
  reported as import warnings and left untyped.
- SQLite via `better-sqlite3` with a local file, and an in-memory OAuth token
  cache — this runs as a single long-lived process. It does not work on
  serverless platforms.
- Re-syncing a source after the upstream spec changes is not implemented yet.

## Roadmap

The gap between "protocol bridge" and "a good MCP server" is where the interesting
work is. Roughly in order:

1. Re-sync a source when its spec changes, with a diff of what moved.
2. Response shaping — field projection and auto-pagination, so a tool call
   returns an answer instead of a payload.
3. Composite tools — one tool spanning several operations (search then fetch).
4. Generated tool names and descriptions, so agents pick the right tool without
   inheriting whatever operation IDs the API happened to use.

## Stack

- Next.js (App Router, TypeScript) — UI, Server Actions and the MCP endpoint
- SQLite via better-sqlite3 + Drizzle ORM
- MCP protocol (Streamable HTTP, JSON-RPC) implemented directly in
  `src/app/api/mcp/[slug]/route.ts`, with no external adapter

## Development

```bash
npm test
```

Vitest covers the parser, argument validation, the request executor and secret
handling. The parser tests run against the real Petstore OpenAPI 3 and Swagger
2.0 specs in `tests/fixtures/`, plus a synthetic spec covering `$ref`, recursion,
`allOf` and unresolvable references.

## License

GPL-3.0 — see [LICENSE](LICENSE).
