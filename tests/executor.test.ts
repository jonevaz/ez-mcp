import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Endpoint, EndpointParam, Source } from "@/db/schema";
import { executeEndpoint } from "@/lib/executor";
import { validateArgs } from "@/lib/validate";

// Chave fixa para os testes, para não gravar `data/.secret-key` no repositório.
process.env.EZ_MCP_SECRET_KEY = "test-key-not-a-real-secret";

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    name: "Test API",
    description: null,
    baseUrl: "https://api.test.example/v1",
    authType: "none",
    authConfig: null,
    specRaw: null,
    createdAt: 0,
    ...overrides,
  };
}

function makeEndpoint(params: EndpointParam[], overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id: 1,
    sourceId: 1,
    name: "op",
    method: "GET",
    path: "/things/{id}",
    description: null,
    paramsSchema: JSON.stringify(params),
    enabled: true,
    ...overrides,
  };
}

/** Captura a requisição que o executor montaria, sem sair para a rede. */
function captureFetch(response = { status: 200, body: '{"ok":true}' }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fake = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(response.body, { status: response.status });
  });
  vi.stubGlobal("fetch", fake);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("validateArgs", () => {
  const params: EndpointParam[] = [
    { name: "id", in: "path", type: "string", required: true },
    { name: "limit", in: "query", type: "integer", required: false },
    {
      name: "status",
      in: "query",
      type: "string",
      required: false,
      schema: { type: "string", enum: ["open", "closed"] },
    },
  ];

  it("names the missing required parameter", () => {
    const result = validateArgs(params, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain("`id`");
    expect(result.errors[0]).toContain("path parameter");
  });

  it("lists the accepted values when an enum does not match", () => {
    const result = validateArgs(params, { id: "1", status: "archived" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain("open, closed");
  });

  it("flags an unknown parameter instead of dropping it silently", () => {
    const result = validateArgs(params, { id: "1", limitt: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain("`limitt`");
  });

  it("coerces a numeric string into the declared integer", () => {
    const result = validateArgs(params, { id: "1", limit: "25" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.limit).toBe(25);
  });

  it("rejects a non-integer for an integer parameter", () => {
    const result = validateArgs(params, { id: "1", limit: 2.5 });
    expect(result.ok).toBe(false);
  });

  it("checks required top-level fields of the body", () => {
    const bodyParams: EndpointParam[] = [
      {
        name: "body",
        in: "body",
        type: "object",
        required: true,
        schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
      },
    ];
    const result = validateArgs(bodyParams, { body: { color: "red" } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain("`name`");
  });
});

describe("executeEndpoint", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("does not send a request when arguments are invalid", async () => {
    const calls = captureFetch();
    const result = await executeEndpoint(
      makeSource(),
      makeEndpoint([{ name: "id", in: "path", type: "string", required: true }]),
      {}
    );
    expect(result.kind).toBe("invalid_args");
    expect(calls).toHaveLength(0);
  });

  it("substitutes path parameters and never leaves a literal placeholder", async () => {
    const calls = captureFetch();
    await executeEndpoint(
      makeSource(),
      makeEndpoint([{ name: "id", in: "path", type: "string", required: true }]),
      { id: "abc 1" }
    );
    expect(calls[0].url).toBe("https://api.test.example/v1/things/abc%201");
  });

  it("fails loudly when the path has a placeholder with no matching parameter", async () => {
    const calls = captureFetch();
    const result = await executeEndpoint(
      makeSource(),
      makeEndpoint([], { path: "/things/{id}" }),
      {}
    );
    expect(result.kind).toBe("invalid_args");
    if (result.kind !== "invalid_args") return;
    expect(result.errors[0]).toContain("{id}");
    expect(calls).toHaveLength(0);
  });

  it("repeats array query parameters instead of stringifying the array", async () => {
    const calls = captureFetch();
    await executeEndpoint(
      makeSource(),
      makeEndpoint([{ name: "tag", in: "query", type: "array", required: false }], {
        path: "/things",
      }),
      { tag: ["a", "b"] }
    );
    expect(calls[0].url).toBe("https://api.test.example/v1/things?tag=a&tag=b");
  });

  it("sends a JSON body with the matching Content-Type", async () => {
    const calls = captureFetch();
    await executeEndpoint(
      makeSource(),
      makeEndpoint(
        [
          {
            name: "body",
            in: "body",
            type: "object",
            required: true,
            contentType: "application/json",
          },
        ],
        { method: "POST", path: "/things" }
      ),
      { body: { name: "x" } }
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.body).toBe('{"name":"x"}');
  });

  it("url-encodes the body when the spec declares form-urlencoded", async () => {
    const calls = captureFetch();
    await executeEndpoint(
      makeSource(),
      makeEndpoint(
        [
          {
            name: "body",
            in: "body",
            type: "object",
            required: true,
            contentType: "application/x-www-form-urlencoded",
          },
        ],
        { method: "POST", path: "/things" }
      ),
      { body: { name: "x", n: 2 } }
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(calls[0].init.body).toBe("name=x&n=2");
  });

  it("sends Swagger 2 formData parameters as a urlencoded body", async () => {
    const calls = captureFetch();
    await executeEndpoint(
      makeSource(),
      makeEndpoint([{ name: "name", in: "formData", type: "string", required: false }], {
        method: "POST",
        path: "/things",
      }),
      { name: "x" }
    );
    expect(calls[0].init.body).toBe("name=x");
  });

  it("applies bearer auth from the encrypted config", async () => {
    const { encryptAuthConfig } = await import("@/lib/secrets");
    const calls = captureFetch();
    await executeEndpoint(
      makeSource({
        authType: "bearer",
        authConfig: encryptAuthConfig(JSON.stringify({ token: "s3cret" })),
      }),
      makeEndpoint([], { path: "/things" }),
      {}
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer s3cret");
  });

  it("resolves an `env:` reference at call time", async () => {
    process.env.TEST_API_TOKEN = "from-env";
    const { encryptAuthConfig } = await import("@/lib/secrets");
    const calls = captureFetch();
    await executeEndpoint(
      makeSource({
        authType: "bearer",
        authConfig: encryptAuthConfig(JSON.stringify({ token: "env:TEST_API_TOKEN" })),
      }),
      makeEndpoint([], { path: "/things" }),
      {}
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer from-env");
  });

  it("labels a truncated response so the agent knows it is incomplete", async () => {
    captureFetch({ status: 200, body: "x".repeat(70_000) });
    const result = await executeEndpoint(makeSource(), makeEndpoint([], { path: "/things" }), {});
    expect(result.kind).toBe("response");
    if (result.kind !== "response") return;
    expect(result.truncated).toBe(true);
    expect(result.body).toContain("Response truncated");
  });
});
