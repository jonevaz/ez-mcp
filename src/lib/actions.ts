"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { db, sources, endpoints, mcps, mcpTools } from "@/db";
import { parseOpenApiSpec, toToolName } from "@/lib/openapi";

export type ActionResult = { ok: boolean; error?: string; id?: number };

const tokenGen = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  40
);
const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "mcp"
  );
}

function authConfigFrom(formData: FormData): string | null {
  const authType = String(formData.get("authType") || "none");
  switch (authType) {
    case "bearer":
      return JSON.stringify({ token: String(formData.get("authToken") || "") });
    case "api_key":
      return JSON.stringify({
        header: String(formData.get("authHeader") || "X-API-Key"),
        value: String(formData.get("authValue") || ""),
      });
    case "basic":
      return JSON.stringify({
        username: String(formData.get("authUsername") || ""),
        password: String(formData.get("authPassword") || ""),
      });
    default:
      return null;
  }
}

// ---------------- Fontes ----------------

export async function createSource(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  if (!name || !baseUrl) return { ok: false, error: "Nome e URL base são obrigatórios." };

  const [row] = db
    .insert(sources)
    .values({
      name,
      description: String(formData.get("description") || "").trim() || null,
      baseUrl,
      authType: String(formData.get("authType") || "none"),
      authConfig: authConfigFrom(formData),
      createdAt: Date.now(),
    })
    .returning({ id: sources.id })
    .all();

  revalidatePath("/fontes");
  return { ok: true, id: row.id };
}

export async function updateSource(id: number, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  if (!name || !baseUrl) return { ok: false, error: "Nome e URL base são obrigatórios." };

  db.update(sources)
    .set({
      name,
      description: String(formData.get("description") || "").trim() || null,
      baseUrl,
      authType: String(formData.get("authType") || "none"),
      authConfig: authConfigFrom(formData),
    })
    .where(eq(sources.id, id))
    .run();

  revalidatePath("/fontes");
  return { ok: true };
}

export async function deleteSource(id: number): Promise<ActionResult> {
  db.delete(sources).where(eq(sources.id, id)).run();
  revalidatePath("/fontes");
  revalidatePath("/mcps");
  return { ok: true };
}

export async function importOpenApi(formData: FormData): Promise<ActionResult> {
  const specUrl = String(formData.get("specUrl") || "").trim();
  const specText = String(formData.get("specText") || "").trim();

  let raw = specText;
  try {
    if (!raw && specUrl) {
      const res = await fetch(specUrl, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        return { ok: false, error: `Não conseguimos baixar a spec (HTTP ${res.status}).` };
      }
      raw = await res.text();
    }
    if (!raw) return { ok: false, error: "Informe a URL da spec ou cole o conteúdo." };

    const parsed = parseOpenApiSpec(raw);
    const name = String(formData.get("name") || "").trim() || parsed.title;
    let baseUrl = String(formData.get("baseUrl") || "").trim() || parsed.baseUrl;
    // servers[] relativo (ex.: "/api/v3") → resolve contra a URL da spec
    if (baseUrl && !/^https?:\/\//i.test(baseUrl) && specUrl) {
      baseUrl = new URL(baseUrl, specUrl).toString().replace(/\/$/, "");
    }
    if (!baseUrl) {
      return {
        ok: false,
        error: "A spec não define `servers`. Informe a URL base manualmente.",
      };
    }

    const [row] = db
      .insert(sources)
      .values({
        name,
        description: parsed.description || null,
        baseUrl,
        authType: String(formData.get("authType") || "none"),
        authConfig: authConfigFrom(formData),
        specRaw: raw,
        createdAt: Date.now(),
      })
      .returning({ id: sources.id })
      .all();

    for (const ep of parsed.endpoints) {
      db.insert(endpoints)
        .values({
          sourceId: row.id,
          name: ep.name,
          method: ep.method,
          path: ep.path,
          description: ep.description || null,
          paramsSchema: JSON.stringify(ep.params),
          enabled: true,
        })
        .run();
    }

    revalidatePath("/fontes");
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao importar a spec." };
  }
}

// ---------------- Endpoints ----------------

export async function createEndpoint(sourceId: number, formData: FormData): Promise<ActionResult> {
  const method = String(formData.get("method") || "GET").toUpperCase();
  const path = String(formData.get("path") || "").trim();
  if (!path.startsWith("/")) return { ok: false, error: "O path deve começar com `/`." };

  db.insert(endpoints)
    .values({
      sourceId,
      name: String(formData.get("name") || "").trim() || `${method} ${path}`,
      method,
      path,
      description: String(formData.get("description") || "").trim() || null,
      paramsSchema: String(formData.get("paramsJson") || "[]"),
      enabled: true,
    })
    .run();

  revalidatePath("/fontes");
  return { ok: true };
}

export async function deleteEndpoint(id: number): Promise<ActionResult> {
  db.delete(endpoints).where(eq(endpoints.id, id)).run();
  revalidatePath("/fontes");
  revalidatePath("/mcps");
  return { ok: true };
}

export async function toggleEndpoint(id: number, enabled: boolean): Promise<ActionResult> {
  db.update(endpoints).set({ enabled }).where(eq(endpoints.id, id)).run();
  revalidatePath("/fontes");
  return { ok: true };
}

// ---------------- MCPs ----------------

export async function createMcp(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "O nome é obrigatório." };

  let slug = slugify(String(formData.get("slug") || "").trim() || name);
  const existing = db.select().from(mcps).where(eq(mcps.slug, slug)).all();
  if (existing.length > 0) slug = `${slug}-${slugSuffix()}`;

  const [row] = db
    .insert(mcps)
    .values({
      name,
      slug,
      description: String(formData.get("description") || "").trim() || null,
      published: false,
      createdAt: Date.now(),
    })
    .returning({ id: mcps.id })
    .all();

  revalidatePath("/mcps");
  return { ok: true, id: row.id };
}

export async function updateMcp(id: number, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "O nome é obrigatório." };

  const slug = slugify(String(formData.get("slug") || "").trim() || name);
  const clash = db
    .select({ id: mcps.id })
    .from(mcps)
    .where(eq(mcps.slug, slug))
    .all()
    .filter((m) => m.id !== id);
  if (clash.length > 0) return { ok: false, error: "Já existe um MCP com esse slug." };

  db.update(mcps)
    .set({
      name,
      slug,
      description: String(formData.get("description") || "").trim() || null,
    })
    .where(eq(mcps.id, id))
    .run();

  revalidatePath("/mcps");
  revalidatePath(`/mcps/${id}`);
  return { ok: true };
}

export async function deleteMcp(id: number): Promise<ActionResult> {
  db.delete(mcps).where(eq(mcps.id, id)).run();
  revalidatePath("/mcps");
  return { ok: true };
}

export async function publishMcp(id: number): Promise<ActionResult> {
  const toolCount = db
    .select({ id: mcpTools.id })
    .from(mcpTools)
    .where(and(eq(mcpTools.mcpId, id), eq(mcpTools.enabled, true)))
    .all().length;
  if (toolCount === 0) {
    return { ok: false, error: "Adicione ao menos uma tool antes de publicar." };
  }

  const existing = db.select().from(mcps).where(eq(mcps.id, id)).all()[0];
  db.update(mcps)
    .set({ published: true, token: existing?.token || tokenGen() })
    .where(eq(mcps.id, id))
    .run();

  revalidatePath("/mcps");
  revalidatePath(`/mcps/${id}`);
  return { ok: true };
}

export async function unpublishMcp(id: number): Promise<ActionResult> {
  db.update(mcps).set({ published: false }).where(eq(mcps.id, id)).run();
  revalidatePath("/mcps");
  revalidatePath(`/mcps/${id}`);
  return { ok: true };
}

export async function regenerateToken(id: number): Promise<ActionResult> {
  db.update(mcps).set({ token: tokenGen() }).where(eq(mcps.id, id)).run();
  revalidatePath(`/mcps/${id}`);
  return { ok: true };
}

// ---------------- Tools do MCP ----------------

export async function toggleMcpTool(
  mcpId: number,
  endpointId: number,
  selected: boolean
): Promise<ActionResult> {
  const existing = db
    .select()
    .from(mcpTools)
    .where(and(eq(mcpTools.mcpId, mcpId), eq(mcpTools.endpointId, endpointId)))
    .all()[0];

  if (selected && !existing) {
    const ep = db.select().from(endpoints).where(eq(endpoints.id, endpointId)).all()[0];
    if (!ep) return { ok: false, error: "Endpoint não encontrado." };

    let toolName = toToolName(ep.name, ep.method, ep.path);
    const siblings = db
      .select({ toolName: mcpTools.toolName })
      .from(mcpTools)
      .where(eq(mcpTools.mcpId, mcpId))
      .all();
    if (siblings.some((s) => s.toolName === toolName)) {
      toolName = `${toolName}_${endpointId}`.slice(0, 64);
    }

    db.insert(mcpTools)
      .values({
        mcpId,
        endpointId,
        toolName,
        toolDescription: ep.description || `${ep.method} ${ep.path}`,
        enabled: true,
      })
      .run();
  } else if (!selected && existing) {
    db.delete(mcpTools).where(eq(mcpTools.id, existing.id)).run();
  }

  revalidatePath(`/mcps/${mcpId}`);
  return { ok: true };
}

export async function updateMcpTool(toolId: number, formData: FormData): Promise<ActionResult> {
  const toolName = String(formData.get("toolName") || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 64);
  if (!toolName) return { ok: false, error: "O nome da tool é obrigatório." };

  const tool = db.select().from(mcpTools).where(eq(mcpTools.id, toolId)).all()[0];
  if (!tool) return { ok: false, error: "Tool não encontrada." };

  db.update(mcpTools)
    .set({
      toolName,
      toolDescription: String(formData.get("toolDescription") || "").trim() || null,
    })
    .where(eq(mcpTools.id, toolId))
    .run();

  revalidatePath(`/mcps/${tool.mcpId}`);
  return { ok: true };
}
