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

  applyAuth(source, headers);

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
    text = text.slice(0, MAX_BODY_CHARS) + "\n… [resposta truncada]";
  }

  return {
    ok: res.ok,
    httpStatus: res.status,
    body: text,
    durationMs: Date.now() - started,
  };
}

function applyAuth(source: Source, headers: Record<string, string>) {
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
  }
}
