import YAML from "yaml";
import type { EndpointParam } from "@/db/schema";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export type ParsedEndpoint = {
  name: string;
  method: string;
  path: string;
  description: string;
  params: EndpointParam[];
};

export type SpecFormat = "openapi" | "swagger";

export type ParsedSpec = {
  title: string;
  description: string;
  baseUrl: string;
  format: SpecFormat;
  endpoints: ParsedEndpoint[];
};

/** Identifica se a spec é OpenAPI 3.x ou Swagger 2.0. */
export function detectSpecFormat(spec: Record<string, unknown>): SpecFormat {
  const openapiVersion = spec.openapi as string | undefined;
  const swaggerVersion = spec.swagger as string | undefined;
  if (typeof swaggerVersion === "string" && swaggerVersion.startsWith("2")) return "swagger";
  if (typeof openapiVersion === "string") return "openapi";
  // Sem campo de versão explícito: infere pela presença de host/basePath (Swagger 2.0).
  return spec.host || spec.basePath ? "swagger" : "openapi";
}

/** Faz parse de uma spec OpenAPI 3.x ou Swagger 2.0 (JSON ou YAML) em endpoints simples. */
export function parseOpenApiSpec(raw: string): ParsedSpec {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(raw);
  } catch {
    spec = YAML.parse(raw);
  }
  if (!spec || typeof spec !== "object" || !spec.paths) {
    throw new Error("Invalid spec: could not find the OpenAPI/Swagger `paths` object.");
  }

  const format = detectSpecFormat(spec);
  const info = (spec.info ?? {}) as { title?: string; description?: string };
  const servers = (spec.servers ?? []) as Array<{ url?: string }>;
  // Swagger 2.0: host + basePath + schemes
  const swaggerHost = spec.host as string | undefined;
  const swaggerBase = (spec.basePath as string | undefined) ?? "";
  const swaggerScheme = ((spec.schemes as string[] | undefined) ?? ["https"])[0];

  const baseUrl =
    servers[0]?.url ??
    (swaggerHost ? `${swaggerScheme}://${swaggerHost}${swaggerBase}` : "");

  const endpoints: ParsedEndpoint[] = [];
  const paths = spec.paths as Record<string, Record<string, unknown>>;

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const sharedRawParams = (pathItem.parameters as unknown[]) ?? [];

    for (const method of METHODS) {
      const op = pathItem[method] as Record<string, unknown> | undefined;
      if (!op || typeof op !== "object") continue;

      const opRawParams = (op.parameters as unknown[]) ?? [];
      const rawParams = [...sharedRawParams, ...opRawParams];
      const params = dedupeParams(extractParams(rawParams));

      // requestBody (OpenAPI 3) → parâmetro único "body"
      if (op.requestBody) {
        const rb = op.requestBody as {
          required?: boolean;
          description?: string;
        };
        params.push({
          name: "body",
          in: "body",
          type: "object",
          required: rb.required ?? false,
          description: rb.description || "JSON request body.",
        });
      } else {
        // Swagger 2.0: parâmetro com in: "body" → mesmo parâmetro sintético "body"
        const bodyParam = rawParams.find(
          (p) => p && typeof p === "object" && (p as Record<string, unknown>).in === "body"
        ) as Record<string, unknown> | undefined;
        if (bodyParam) {
          params.push({
            name: "body",
            in: "body",
            type: "object",
            required: Boolean(bodyParam.required),
            description:
              typeof bodyParam.description === "string"
                ? bodyParam.description.trim()
                : "JSON request body.",
          });
        }
      }

      const summary = (op.summary as string) || (op.description as string) || "";
      endpoints.push({
        name: (op.operationId as string) || `${method.toUpperCase()} ${pathKey}`,
        method: method.toUpperCase(),
        path: pathKey,
        description: summary.trim(),
        params,
      });
    }
  }

  if (endpoints.length === 0) {
    throw new Error("The spec doesn't contain recognizable operations in `paths`.");
  }

  return {
    title: info.title || "Imported API",
    description: (info.description || "").trim(),
    baseUrl,
    format,
    endpoints,
  };
}

function extractParams(list: unknown[]): EndpointParam[] {
  const out: EndpointParam[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (p.$ref) continue; // $refs não são resolvidos nesta versão
    const where = p.in as string;
    if (!["path", "query", "header"].includes(where)) continue;
    const schema = (p.schema ?? {}) as { type?: string };
    const type = normalizeType(schema.type ?? (p.type as string));
    out.push({
      name: String(p.name ?? ""),
      in: where as EndpointParam["in"],
      type,
      required: Boolean(p.required),
      description: typeof p.description === "string" ? p.description.trim() : undefined,
    });
  }
  return out.filter((p) => p.name);
}

function normalizeType(t?: string): EndpointParam["type"] {
  switch (t) {
    case "integer":
    case "number":
    case "boolean":
    case "object":
    case "array":
      return t;
    default:
      return "string";
  }
}

function dedupeParams(params: EndpointParam[]): EndpointParam[] {
  const seen = new Set<string>();
  return params.filter((p) => {
    const key = `${p.in}:${p.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Gera um nome de tool MCP válido (snake_case) a partir do endpoint. */
export function toToolName(name: string, method: string, path: string): string {
  const base = /^[A-Za-z]/.test(name) && !name.includes(" ") && !name.includes("/")
    ? name
    : `${method.toLowerCase()}_${path}`;
  return base
    .replace(/\{(\w+)\}/g, "by_$1")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 64) || "tool";
}
