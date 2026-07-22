import YAML from "yaml";
import type { EndpointParam } from "@/db/schema";
import { SchemaResolver, schemaType, type JsonSchema } from "@/lib/json-schema";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** Media types de corpo que sabemos serializar, em ordem de preferência. */
const BODY_CONTENT_PREFERENCE = [
  "application/json",
  "application/x-www-form-urlencoded",
  "text/plain",
];

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
  /** Problemas não fatais encontrados na importação (refs externas, media types etc.). */
  warnings: string[];
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
  const resolver = new SchemaResolver(spec);
  const warnings: string[] = [];

  const info = (spec.info ?? {}) as { title?: string; description?: string };
  const servers = (spec.servers ?? []) as Array<{ url?: string }>;
  // Swagger 2.0: host + basePath + schemes
  const swaggerHost = spec.host as string | undefined;
  const swaggerBase = (spec.basePath as string | undefined) ?? "";
  const swaggerScheme = ((spec.schemes as string[] | undefined) ?? ["https"])[0];

  const baseUrl =
    servers[0]?.url ??
    (swaggerHost ? `${swaggerScheme}://${swaggerHost}${swaggerBase}` : "");

  const globalConsumes = (spec.consumes as string[] | undefined) ?? [];
  const endpoints: ParsedEndpoint[] = [];
  const paths = spec.paths as Record<string, Record<string, unknown>>;

  for (const [pathKey, rawPathItem] of Object.entries(paths)) {
    const pathItem = resolver.derefRaw(rawPathItem);
    if (!pathItem) continue;
    const sharedRawParams = (pathItem.parameters as unknown[]) ?? [];

    for (const method of METHODS) {
      const op = resolver.derefRaw(pathItem[method]);
      if (!op) continue;

      const opRawParams = (op.parameters as unknown[]) ?? [];
      const rawParams = [...sharedRawParams, ...opRawParams];
      const params = dedupeParams(extractParams(rawParams, resolver, warnings));

      const bodyParam = extractBodyParam(op, rawParams, resolver, globalConsumes, warnings, {
        method,
        path: pathKey,
      });
      if (bodyParam) params.push(bodyParam);

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

  for (const ref of resolver.unresolved) {
    warnings.push(`Could not resolve reference \`${ref}\` — affected fields were left untyped.`);
  }

  return {
    title: info.title || "Imported API",
    description: (info.description || "").trim(),
    baseUrl,
    format,
    endpoints,
    warnings,
  };
}

/**
 * Extrai o parâmetro sintético `body` de uma operação.
 * OpenAPI 3.x usa `requestBody.content[mediaType].schema`; Swagger 2.0 usa um
 * parâmetro com `in: "body"`.
 */
function extractBodyParam(
  op: Record<string, unknown>,
  rawParams: unknown[],
  resolver: SchemaResolver,
  globalConsumes: string[],
  warnings: string[],
  ctx: { method: string; path: string }
): EndpointParam | null {
  // OpenAPI 3.x
  const requestBody = resolver.derefRaw(op.requestBody);
  if (requestBody) {
    const content = (requestBody.content ?? {}) as Record<string, { schema?: unknown }>;
    const mediaTypes = Object.keys(content);
    const chosen =
      BODY_CONTENT_PREFERENCE.find((c) => mediaTypes.includes(c)) ??
      mediaTypes.find((c) => c.endsWith("+json")) ??
      mediaTypes[0];
    if (!chosen) return null;
    if (!BODY_CONTENT_PREFERENCE.includes(chosen) && !chosen.endsWith("+json")) {
      warnings.push(
        `${ctx.method.toUpperCase()} ${ctx.path}: request body uses \`${chosen}\`, which is sent as a raw string.`
      );
    }
    const schema = resolver.deref(content[chosen]?.schema);
    return {
      name: "body",
      in: "body",
      type: schemaType(schema) === "array" ? "array" : "object",
      required: Boolean(requestBody.required),
      description: describeBody(requestBody.description, schema),
      schema: Object.keys(schema).length > 0 ? schema : undefined,
      contentType: chosen,
    };
  }

  // Swagger 2.0: parâmetro com in: "body"
  const swaggerBody = rawParams
    .map((p) => resolver.derefRaw(p))
    .find((p) => p?.in === "body");
  if (swaggerBody) {
    const schema = resolver.deref(swaggerBody.schema);
    const consumes = ((op.consumes as string[] | undefined) ?? globalConsumes)[0];
    return {
      name: "body",
      in: "body",
      type: schemaType(schema) === "array" ? "array" : "object",
      required: Boolean(swaggerBody.required),
      description: describeBody(swaggerBody.description, schema),
      schema: Object.keys(schema).length > 0 ? schema : undefined,
      contentType: consumes || "application/json",
    };
  }

  return null;
}

function describeBody(description: unknown, schema: JsonSchema): string {
  if (typeof description === "string" && description.trim()) return description.trim();
  if (typeof schema.description === "string" && schema.description.trim()) {
    return schema.description.trim();
  }
  return "Request body.";
}

/**
 * Converte a lista `parameters` da spec em parâmetros de endpoint.
 * Resolve `$ref` (do parâmetro e do schema dele) e preserva o schema completo —
 * é o que permite ao agente ver `enum`, `format`, `items` e `default`.
 */
function extractParams(
  list: unknown[],
  resolver: SchemaResolver,
  warnings: string[]
): EndpointParam[] {
  const out: EndpointParam[] = [];
  for (const item of list) {
    const p = resolver.derefRaw(item);
    if (!p) continue;
    const where = p.in as string;
    if (!["path", "query", "header", "formData"].includes(where)) continue;

    if (where === "formData" && p.type === "file") {
      warnings.push(`Parameter \`${String(p.name)}\`: file uploads are not supported.`);
      continue;
    }

    // OpenAPI 3.x carrega o schema em `schema`; Swagger 2.0 o declara inline.
    const schema = resolver.deref(p.schema ?? p);
    // `title` inline do parâmetro não é do schema; `required` é do parâmetro.
    delete schema.required;

    out.push({
      name: String(p.name ?? ""),
      in: where as EndpointParam["in"],
      type: normalizeType(schemaType(schema)),
      // Pela spec, parâmetros de path são sempre obrigatórios.
      required: Boolean(p.required) || where === "path",
      description: typeof p.description === "string" ? p.description.trim() : undefined,
      schema: Object.keys(schema).length > 0 ? schema : undefined,
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
  // Percorre de trás para frente: parâmetros da operação vencem os do path item.
  const kept: EndpointParam[] = [];
  for (let i = params.length - 1; i >= 0; i--) {
    const p = params[i];
    const key = `${p.in}:${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.unshift(p);
  }
  return kept;
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
