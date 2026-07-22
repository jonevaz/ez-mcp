import type { Endpoint, EndpointParam, Source } from "@/db/schema";
import { validateArgs } from "@/lib/validate";
import { readAuthConfig } from "@/lib/secrets";

const MAX_BODY_CHARS = 60_000;

export type ExecutionResult =
  /** Os argumentos do agente não batem com o schema da tool — nada foi chamado. */
  | { kind: "invalid_args"; errors: string[] }
  /** A requisição foi feita; `ok` reflete o status HTTP da API de origem. */
  | {
      kind: "response";
      ok: boolean;
      httpStatus: number;
      body: string;
      durationMs: number;
      truncated: boolean;
    };

/** Executa a chamada HTTP real à API de origem para uma tool MCP. */
export async function executeEndpoint(
  source: Source,
  endpoint: Endpoint,
  args: Record<string, unknown> | undefined
): Promise<ExecutionResult> {
  const params: EndpointParam[] = endpoint.paramsSchema
    ? JSON.parse(endpoint.paramsSchema)
    : [];

  const validation = validateArgs(params, args);
  if (!validation.ok) return { kind: "invalid_args", errors: validation.errors };
  const values = validation.values;

  let pathStr = endpoint.path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = {};
  const formFields = new URLSearchParams();
  let bodyParam: EndpointParam | undefined;
  let bodyValue: unknown;

  for (const p of params) {
    const value = values[p.name];
    if (value === undefined) continue;
    switch (p.in) {
      case "path":
        pathStr = pathStr.replaceAll(`{${p.name}}`, encodeURIComponent(String(value)));
        break;
      case "query":
        // Arrays viram valores repetidos (`?tag=a&tag=b`), o estilo `form`
        // com `explode: true` — o default do OpenAPI para query.
        if (Array.isArray(value)) {
          for (const item of value) query.append(p.name, String(item));
        } else {
          query.set(p.name, String(value));
        }
        break;
      case "header":
        headers[p.name] = String(value);
        break;
      case "formData":
        formFields.set(p.name, String(value));
        break;
      case "body":
        bodyParam = p;
        bodyValue = value;
        break;
    }
  }

  // Um `{placeholder}` que sobrou significa spec e path fora de sincronia —
  // melhor falhar aqui do que chamar a API com a URL errada.
  const leftover = pathStr.match(/\{(\w+)\}/g);
  if (leftover) {
    return {
      kind: "invalid_args",
      errors: [
        `The path \`${endpoint.path}\` has unfilled placeholders: ${leftover.join(", ")}. ` +
          `They are not declared as path parameters for this tool.`,
      ],
    };
  }

  const { body, contentType } = encodeBody(bodyParam, bodyValue, formFields);
  if (contentType && !headers["Content-Type"]) headers["Content-Type"] = contentType;
  if (!headers["Accept"]) headers["Accept"] = "application/json, */*";

  await applyAuth(source, headers);

  const url =
    source.baseUrl.replace(/\/+$/, "") +
    pathStr +
    (query.size > 0 ? `?${query.toString()}` : "");

  const method = endpoint.method.toUpperCase();
  const sendsBody = method !== "GET" && method !== "HEAD";

  const started = Date.now();
  const res = await fetch(url, {
    method,
    headers,
    body: sendsBody ? body : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  let text = await res.text();
  const truncated = text.length > MAX_BODY_CHARS;
  if (truncated) {
    text =
      text.slice(0, MAX_BODY_CHARS) +
      `\n\n[Response truncated at ${MAX_BODY_CHARS} characters — the text above is incomplete ` +
      `and may not be parseable. Narrow the request (filters, pagination, fewer fields) to get a complete response.]`;
  }

  return {
    kind: "response",
    ok: res.ok,
    httpStatus: res.status,
    body: text,
    durationMs: Date.now() - started,
    truncated,
  };
}

/** Serializa o corpo da requisição conforme o media type declarado na spec. */
function encodeBody(
  bodyParam: EndpointParam | undefined,
  bodyValue: unknown,
  formFields: URLSearchParams
): { body: string | undefined; contentType: string | undefined } {
  // Swagger 2.0 `in: formData` — os campos vão urlencoded.
  if (formFields.size > 0) {
    return { body: formFields.toString(), contentType: "application/x-www-form-urlencoded" };
  }
  if (bodyParam === undefined || bodyValue === undefined) {
    return { body: undefined, contentType: undefined };
  }

  const contentType = bodyParam.contentType || "application/json";

  if (contentType === "application/x-www-form-urlencoded") {
    const encoded = new URLSearchParams();
    if (typeof bodyValue === "object" && bodyValue !== null && !Array.isArray(bodyValue)) {
      for (const [k, v] of Object.entries(bodyValue as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        encoded.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }
    return { body: encoded.toString(), contentType };
  }

  if (contentType === "text/plain") {
    return { body: typeof bodyValue === "string" ? bodyValue : String(bodyValue), contentType };
  }

  return { body: JSON.stringify(bodyValue), contentType };
}

async function applyAuth(source: Source, headers: Record<string, string>) {
  const auth = readAuthConfig(source);
  switch (source.authType) {
    case "bearer":
      if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
      break;
    case "api_key":
      if (auth.header && auth.value) headers[auth.header as string] = auth.value as string;
      break;
    case "basic":
      if (auth.username !== undefined) {
        headers["Authorization"] =
          "Basic " +
          Buffer.from(`${auth.username}:${auth.password ?? ""}`).toString("base64");
      }
      break;
    case "oauth2":
      if (auth.tokenUrl && auth.clientId && auth.clientSecret) {
        const token = await getOAuth2Token(source.id, auth as unknown as OAuth2Config);
        headers["Authorization"] = `Bearer ${token}`;
      }
      break;
  }
}

type OAuth2Config = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
};

const oauthTokenCache = new Map<number, { token: string; expiresAt: number }>();

/** Busca (com cache em memória) um access token via OAuth2 client_credentials. */
async function getOAuth2Token(sourceId: number, auth: OAuth2Config): Promise<string> {
  const cached = oauthTokenCache.get(sourceId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
  });
  if (auth.scope) body.set("scope", auth.scope);

  const res = await fetch(auth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Failed to obtain OAuth token (HTTP ${res.status}).`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("OAuth token response did not include an access_token.");
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  oauthTokenCache.set(sourceId, {
    token: data.access_token,
    // renova 30s antes de expirar, para evitar usar um token borderline
    expiresAt: Date.now() + Math.max(expiresIn - 30, 0) * 1000,
  });
  return data.access_token;
}
