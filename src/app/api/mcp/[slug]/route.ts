import { eq, and } from "drizzle-orm";
import {
  db,
  mcps,
  mcpTools,
  endpoints,
  sources,
  usageLogs,
  type EndpointParam,
} from "@/db";
import { executeEndpoint } from "@/lib/executor";

export const dynamic = "force-dynamic";

/**
 * Endpoint MCP público — Streamable HTTP em modo stateless.
 * Cada MCP publicado responde JSON-RPC em POST /api/mcp/<slug>,
 * protegido por token Bearer próprio.
 */

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "ez-mcp", version: "1.0.0" };

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function rpcError(id: number | string | null, code: number, message: string, status = 200) {
  return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, status);
}

function rpcResult(id: number | string | null | undefined, result: unknown) {
  return jsonResponse({ jsonrpc: "2.0", id: id ?? null, result });
}

function paramsToInputSchema(params: EndpointParam[]) {
  const properties: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];
  for (const p of params) {
    properties[p.name] = {
      type: p.type,
      description:
        [p.description, p.in !== "body" ? `(${p.in})` : undefined]
          .filter(Boolean)
          .join(" ") || undefined,
    };
    if (p.required) required.push(p.name);
  }
  return { type: "object" as const, properties, required };
}

function loadMcpBySlug(slug: string) {
  return db
    .select()
    .from(mcps)
    .where(and(eq(mcps.slug, slug), eq(mcps.published, true)))
    .all()[0];
}

function loadTools(mcpId: number) {
  return db
    .select({
      tool: mcpTools,
      endpoint: endpoints,
      source: sources,
    })
    .from(mcpTools)
    .innerJoin(endpoints, eq(mcpTools.endpointId, endpoints.id))
    .innerJoin(sources, eq(endpoints.sourceId, sources.id))
    .where(and(eq(mcpTools.mcpId, mcpId), eq(mcpTools.enabled, true)))
    .all()
    .filter((row) => row.endpoint.enabled);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const mcp = loadMcpBySlug(slug);
  if (!mcp) {
    return jsonResponse({ error: "MCP not found or not published." }, 404);
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!mcp.token || authHeader !== `Bearer ${mcp.token}`) {
    return jsonResponse({ error: "Invalid or missing Bearer token." }, 401);
  }

  let message: JsonRpcMessage;
  try {
    message = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  if (Array.isArray(message)) {
    return rpcError(null, -32600, "Batches are not supported.", 400);
  }

  const { id, method, params: rpcParams } = message;

  // Notificações (sem id) → 202 Accepted sem corpo
  if (id === undefined && method?.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  switch (method) {
    case "initialize": {
      const requested = String(
        (rpcParams?.protocolVersion as string) || SUPPORTED_PROTOCOL_VERSIONS[0]
      );
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: mcp.description || undefined,
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list": {
      const rows = loadTools(mcp.id);
      return rpcResult(id, {
        tools: rows.map(({ tool, endpoint }) => ({
          name: tool.toolName,
          description:
            tool.toolDescription || `${endpoint.method} ${endpoint.path}`,
          inputSchema: paramsToInputSchema(
            endpoint.paramsSchema ? JSON.parse(endpoint.paramsSchema) : []
          ),
        })),
      });
    }

    case "tools/call": {
      const toolName = String(rpcParams?.name || "");
      const args = (rpcParams?.arguments ?? {}) as Record<string, unknown>;
      const row = loadTools(mcp.id).find((r) => r.tool.toolName === toolName);
      if (!row) {
        return rpcError(id ?? null, -32602, `Unknown tool: ${toolName}`);
      }

      const started = Date.now();
      try {
        const result = await executeEndpoint(row.source, row.endpoint, args);
        db.insert(usageLogs)
          .values({
            mcpId: mcp.id,
            toolName,
            status: result.ok ? "ok" : "error",
            httpStatus: result.httpStatus,
            durationMs: result.durationMs,
            createdAt: Date.now(),
          })
          .run();

        return rpcResult(id, {
          content: [
            {
              type: "text",
              text: `HTTP ${result.httpStatus}\n${result.body}`,
            },
          ],
          isError: !result.ok,
        });
      } catch (err) {
        db.insert(usageLogs)
          .values({
            mcpId: mcp.id,
            toolName,
            status: "error",
            httpStatus: null,
            durationMs: Date.now() - started,
            createdAt: Date.now(),
          })
          .run();
        const msg = err instanceof Error ? err.message : "Failed to call the source API.";
        return rpcResult(id, {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id ?? null, -32601, `Unsupported method: ${method}`);
  }
}

// Sem stream SSE no modo stateless
export async function GET() {
  return jsonResponse({ error: "Method not allowed. Use POST (Streamable HTTP)." }, 405);
}

export async function DELETE() {
  // Encerramento de sessão — stateless, nada a encerrar
  return new Response(null, { status: 200 });
}
