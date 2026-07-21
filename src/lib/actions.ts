"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
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
    case "oauth2":
      return JSON.stringify({
        tokenUrl: String(formData.get("authTokenUrl") || ""),
        clientId: String(formData.get("authClientId") || ""),
        clientSecret: String(formData.get("authClientSecret") || ""),
        scope: String(formData.get("authScope") || "") || undefined,
      });
    default:
      return null;
  }
}

// ---------------- Sources ----------------

export async function createSource(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  if (!name || !baseUrl) return { ok: false, error: "Name and base URL are required." };

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

  revalidatePath("/sources");
  return { ok: true, id: row.id };
}

export async function updateSource(id: number, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  if (!name || !baseUrl) return { ok: false, error: "Name and base URL are required." };

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

  revalidatePath("/sources");
  return { ok: true };
}

export async function deleteSource(id: number): Promise<ActionResult> {
  // MCPs que usam tools desta fonte: se algum estiver publicado, volta a rascunho
  // (as tools são removidas junto via cascade ao apagar os endpoints).
  const affectedMcpIds = db
    .selectDistinct({ mcpId: mcpTools.mcpId })
    .from(mcpTools)
    .innerJoin(endpoints, eq(mcpTools.endpointId, endpoints.id))
    .where(eq(endpoints.sourceId, id))
    .all()
    .map((r) => r.mcpId);

  db.delete(sources).where(eq(sources.id, id)).run();

  if (affectedMcpIds.length > 0) {
    db.update(mcps)
      .set({ published: false })
      .where(and(inArray(mcps.id, affectedMcpIds), eq(mcps.published, true)))
      .run();
    for (const mcpId of affectedMcpIds) revalidatePath(`/mcps/${mcpId}`);
  }

  revalidatePath("/sources");
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
        return { ok: false, error: `Could not download the spec (HTTP ${res.status}).` };
      }
      raw = await res.text();
    }
    if (!raw) return { ok: false, error: "Provide the spec URL or paste the content." };

    const parsed = parseOpenApiSpec(raw);
    const name = String(formData.get("name") || "").trim() || parsed.title;
    let baseUrl = String(formData.get("baseUrl") || "").trim() || parsed.baseUrl;
    // Relative servers[] (e.g. "/api/v3") → resolve against the spec URL
    if (baseUrl && !/^https?:\/\//i.test(baseUrl) && specUrl) {
      baseUrl = new URL(baseUrl, specUrl).toString().replace(/\/$/, "");
    }
    if (!baseUrl) {
      return {
        ok: false,
        error: "The spec doesn't define `servers`. Provide the base URL manually.",
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

    revalidatePath("/sources");
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to import the spec." };
  }
}

// ---------------- Endpoints ----------------

export async function createEndpoint(sourceId: number, formData: FormData): Promise<ActionResult> {
  const method = String(formData.get("method") || "GET").toUpperCase();
  const path = String(formData.get("path") || "").trim();
  if (!path.startsWith("/")) return { ok: false, error: "The path must start with `/`." };

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

  revalidatePath("/sources");
  return { ok: true };
}

export async function deleteEndpoint(id: number): Promise<ActionResult> {
  db.delete(endpoints).where(eq(endpoints.id, id)).run();
  revalidatePath("/sources");
  revalidatePath("/mcps");
  return { ok: true };
}

export async function toggleEndpoint(id: number, enabled: boolean): Promise<ActionResult> {
  db.update(endpoints).set({ enabled }).where(eq(endpoints.id, id)).run();
  revalidatePath("/sources");
  return { ok: true };
}

// ---------------- MCPs ----------------

export async function createMcp(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required." };

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
  if (!name) return { ok: false, error: "Name is required." };

  const slug = slugify(String(formData.get("slug") || "").trim() || name);
  const clash = db
    .select({ id: mcps.id })
    .from(mcps)
    .where(eq(mcps.slug, slug))
    .all()
    .filter((m) => m.id !== id);
  if (clash.length > 0) return { ok: false, error: "An MCP with that slug already exists." };

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
    return { ok: false, error: "Add at least one tool before publishing." };
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

// ---------------- MCP Tools ----------------

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
    if (!ep) return { ok: false, error: "Endpoint not found." };

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
  if (!toolName) return { ok: false, error: "Tool name is required." };

  const tool = db.select().from(mcpTools).where(eq(mcpTools.id, toolId)).all()[0];
  if (!tool) return { ok: false, error: "Tool not found." };

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
