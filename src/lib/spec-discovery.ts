import { parseOpenApiSpec, type ParsedSpec } from "@/lib/openapi";

/** Caminhos comuns onde APIs costumam publicar a spec OpenAPI/Swagger. */
const CANDIDATE_PATHS = [
  "/openapi.json",
  "/openapi.yaml",
  "/openapi.yml",
  "/swagger.json",
  "/swagger.yaml",
  "/v3/api-docs",
  "/v2/api-docs",
  "/api-docs",
  "/api-docs.json",
  "/swagger/v1/swagger.json",
];

/** Padrões usados para achar a URL da spec embutida numa página HTML (Swagger UI, Redoc etc.). */
const HTML_SPEC_URL_PATTERNS = [
  /url\s*[:=]\s*["']([^"']+\.(?:json|ya?ml))["']/i,
  /spec-url\s*=\s*["']([^"']+)["']/i,
  /<link[^>]+rel=["'](?:swagger|openapi)["'][^>]+href=["']([^"']+)["']/i,
];

export type SpecDiscoveryResult = { url: string; raw: string; spec: ParsedSpec };

async function fetchText(url: string): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, text: "" };
    return { ok: true, text: await res.text() };
  } catch {
    return { ok: false, text: "" };
  }
}

function tryParse(raw: string): ParsedSpec | null {
  try {
    return parseOpenApiSpec(raw);
  } catch {
    return null;
  }
}

function directoryOf(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/\/[^/]*$/, "")}`;
}

/**
 * Busca e identifica automaticamente uma spec OpenAPI 3.x ou Swagger 2.0 a partir de uma URL.
 * Aceita tanto a URL direta da spec quanto a URL de uma página de documentação (Swagger UI/Redoc),
 * caso em que tenta localizar a spec embutida ou em caminhos comuns (/swagger.json, /openapi.json, ...).
 */
export async function discoverSpec(inputUrl: string): Promise<SpecDiscoveryResult> {
  const direct = await fetchText(inputUrl);
  if (direct.ok) {
    const parsed = tryParse(direct.text);
    if (parsed) return { url: inputUrl, raw: direct.text, spec: parsed };

    if (/<html/i.test(direct.text)) {
      for (const pattern of HTML_SPEC_URL_PATTERNS) {
        const match = direct.text.match(pattern);
        if (!match) continue;
        const candidateUrl = new URL(match[1], inputUrl).toString();
        const candidate = await fetchText(candidateUrl);
        if (!candidate.ok) continue;
        const candidateParsed = tryParse(candidate.text);
        if (candidateParsed) return { url: candidateUrl, raw: candidate.text, spec: candidateParsed };
      }
    }
  }

  const bases = Array.from(new Set([new URL(inputUrl).origin, directoryOf(inputUrl)]));
  const tried = new Set<string>([inputUrl]);
  for (const base of bases) {
    for (const path of CANDIDATE_PATHS) {
      const candidateUrl = base + path;
      if (tried.has(candidateUrl)) continue;
      tried.add(candidateUrl);
      const candidate = await fetchText(candidateUrl);
      if (!candidate.ok) continue;
      const candidateParsed = tryParse(candidate.text);
      if (candidateParsed) return { url: candidateUrl, raw: candidate.text, spec: candidateParsed };
    }
  }

  throw new Error(
    "Could not find a valid OpenAPI/Swagger spec at that URL. Try the direct spec URL or paste the content."
  );
}
