import type { Endpoint, EndpointParam, Source } from "@/db/schema";

const MAX_BODY_CHARS = 60_000;

export type ExecutionResult = {
  ok: boolean;
  httpStatus: number;
  body: string;
  durationMs: number;
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

  let pathStr = endpoint.path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = {};
  let body: string | undefined;

  for (const p of params) {
    const value = args?.[p.name];
    if (value === undefined || value === null || value === "") continue;
    switch (p.in) {
      case "path":
        pathStr = pathStr.replaceAll(`{${p.name}}`, encodeURIComponent(String(value)));
        break;
      case "query":
        query.set(p.name, String(value));
        break;
      case "header":
        headers[p.name] = String(value);
        break;
      case "body":
        body = typeof value === "string" ? value : JSON.stringify(value);
        break;
    }
  }

  await applyAuth(source, headers);

  const url =
    source.baseUrl.replace(/\/+$/, "") +
    pathStr +
    (query.size > 0 ? `?${query.toString()}` : "");

  const method = endpoint.method.toUpperCase();
  if (body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const started = Date.now();
  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
    signal: AbortSignal.timeout(30_000),
  });
  let text = await res.text();
  if (text.length > MAX_BODY_CHARS) {
    text = text.slice(0, MAX_BODY_CHARS) + "\n… [response truncated]";
  }

  return {
    ok: res.ok,
    httpStatus: res.status,
    body: text,
    durationMs: Date.now() - started,
  };
}

async function applyAuth(source: Source, headers: Record<string, string>) {
  const auth = source.authConfig ? JSON.parse(source.authConfig) : {};
  switch (source.authType) {
    case "bearer":
      if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
      break;
    case "api_key":
      if (auth.header && auth.value) headers[auth.header] = auth.value;
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
        const token = await getOAuth2Token(source.id, auth);
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
