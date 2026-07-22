import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseOpenApiSpec, toToolName, detectSpecFormat } from "@/lib/openapi";
import type { EndpointParam } from "@/db/schema";

const fixture = (name: string) =>
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");

const petstore3 = parseOpenApiSpec(fixture("petstore-openapi3.json"));
const petstore2 = parseOpenApiSpec(fixture("petstore-swagger2.json"));
const edge = parseOpenApiSpec(fixture("edge-cases.yaml"));

function endpoint(spec: typeof petstore3, method: string, p: string) {
  const found = spec.endpoints.find((e) => e.method === method && e.path === p);
  if (!found) throw new Error(`Endpoint not found: ${method} ${p}`);
  return found;
}

function param(params: EndpointParam[], name: string): EndpointParam {
  const found = params.find((p) => p.name === name);
  if (!found) throw new Error(`Param not found: ${name} (have: ${params.map((p) => p.name)})`);
  return found;
}

describe("detectSpecFormat", () => {
  it("distinguishes OpenAPI 3 from Swagger 2", () => {
    expect(petstore3.format).toBe("openapi");
    expect(petstore2.format).toBe("swagger");
  });

  it("falls back to host/basePath when there is no version field", () => {
    expect(detectSpecFormat({ host: "api.example.com", paths: {} })).toBe("swagger");
    expect(detectSpecFormat({ paths: {} })).toBe("openapi");
  });
});

describe("base URL", () => {
  it("reads servers[] on OpenAPI 3", () => {
    expect(petstore3.baseUrl).toBe("/api/v3");
  });

  it("assembles scheme + host + basePath on Swagger 2", () => {
    expect(petstore2.baseUrl).toMatch(/^https?:\/\/petstore\.swagger\.io\/v2$/);
  });
});

describe("$ref resolution", () => {
  it("resolves a parameter declared via $ref at the path-item level", () => {
    const op = endpoint(edge, "GET", "/nodes/{nodeId}");
    const nodeId = param(op.params, "nodeId");
    expect(nodeId.in).toBe("path");
    expect(nodeId.required).toBe(true);
    expect(nodeId.description).toBe("Identifier of the node.");
    expect(nodeId.schema).toMatchObject({ type: "string", format: "uuid" });
  });

  it("terminates on a recursive schema instead of hanging", () => {
    const op = endpoint(edge, "PUT", "/nodes/{nodeId}");
    const body = param(op.params, "body");
    const props = body.schema?.properties as Record<string, Record<string, unknown>>;
    expect(Object.keys(props).sort()).toEqual(["children", "id", "label"]);
    // O nível recursivo é cortado, mas o array e seu `items` continuam descritos.
    expect(props.children.type).toBe("array");
    expect(props.children.items).toBeTypeOf("object");
  });

  it("merges allOf into a single shape", () => {
    const op = endpoint(edge, "POST", "/reports");
    const body = param(op.params, "body");
    const props = body.schema?.properties as Record<string, unknown>;
    // createdAt vem do Timestamps; title e severity do bloco inline.
    expect(Object.keys(props).sort()).toEqual(["createdAt", "severity", "title"]);
    expect(body.schema?.required).toEqual(["title"]);
  });

  it("reports unresolvable external refs as warnings instead of dropping silently", () => {
    expect(edge.warnings.some((w) => w.includes("other.example"))).toBe(true);
  });
});

describe("request body", () => {
  it("extracts the JSON schema of an OpenAPI 3 requestBody", () => {
    const op = endpoint(petstore3, "POST", "/pet");
    const body = param(op.params, "body");
    expect(body.required).toBe(true);
    expect(body.contentType).toBe("application/json");
    const props = body.schema?.properties as Record<string, unknown>;
    // Sem resolver $ref, este objeto vinha vazio e o agente ficava às cegas.
    expect(Object.keys(props)).toContain("name");
    expect(Object.keys(props)).toContain("photoUrls");
    expect(body.schema?.required).toEqual(expect.arrayContaining(["name", "photoUrls"]));
  });

  it("extracts the schema of a Swagger 2 `in: body` parameter", () => {
    const op = endpoint(petstore2, "POST", "/pet");
    const body = param(op.params, "body");
    const props = body.schema?.properties as Record<string, unknown>;
    expect(Object.keys(props)).toContain("name");
  });

  it("keeps Swagger 2 formData parameters as regular fields", () => {
    const op = endpoint(petstore2, "POST", "/pet/{petId}");
    const names = op.params.filter((p) => p.in === "formData").map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["name", "status"]));
  });
});

describe("parameter details the agent needs", () => {
  it("preserves enum values", () => {
    const op = endpoint(petstore3, "GET", "/pet/findByStatus");
    const status = param(op.params, "status");
    expect(status.schema?.enum).toEqual(["available", "pending", "sold"]);
  });

  it("preserves array items", () => {
    const op = endpoint(edge, "POST", "/reports");
    const tags = param(op.params, "tags");
    expect(tags.type).toBe("array");
    expect(tags.schema?.items).toMatchObject({ type: "string" });
  });

  it("preserves defaults and numeric constraints", () => {
    const op = endpoint(edge, "GET", "/nodes/{nodeId}");
    const depth = param(op.params, "depth");
    expect(depth.type).toBe("integer");
    expect(depth.schema).toMatchObject({ default: 1, maximum: 5 });
  });

  it("marks path parameters as required even when the spec omits it", () => {
    for (const ep of [...petstore3.endpoints, ...petstore2.endpoints]) {
      for (const p of ep.params) {
        if (p.in === "path") expect(p.required).toBe(true);
      }
    }
  });

  it("never leaks the parameter's own `name`/`required` into its schema", () => {
    for (const ep of [...petstore3.endpoints, ...petstore2.endpoints, ...edge.endpoints]) {
      for (const p of ep.params) {
        if (p.in === "body") continue;
        expect(p.schema).not.toHaveProperty("name");
        expect(p.schema).not.toHaveProperty("in");
      }
    }
  });
});

describe("full-spec smoke tests", () => {
  it("parses every operation of the real Petstore specs", () => {
    expect(petstore3.endpoints.length).toBeGreaterThan(15);
    expect(petstore2.endpoints.length).toBeGreaterThan(15);
  });

  it("produces a valid tool name for every operation", () => {
    for (const ep of [...petstore3.endpoints, ...petstore2.endpoints, ...edge.endpoints]) {
      const name = toToolName(ep.name, ep.method, ep.path);
      expect(name).toMatch(/^[a-z0-9_]{1,64}$/);
    }
  });

  it("rejects a document without `paths`", () => {
    expect(() => parseOpenApiSpec('{"openapi":"3.0.0"}')).toThrow(/paths/);
  });
});
