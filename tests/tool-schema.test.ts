import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { paramsToInputSchema } from "@/lib/tool-schema";
import { parseOpenApiSpec } from "@/lib/openapi";
import type { EndpointParam } from "@/db/schema";

const petstore3 = parseOpenApiSpec(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "petstore-openapi3.json"), "utf8")
);

describe("paramsToInputSchema", () => {
  it("carries the full schema through to the tool", () => {
    const params: EndpointParam[] = [
      {
        name: "status",
        in: "query",
        type: "string",
        required: true,
        description: "Status to filter by",
        schema: { type: "string", enum: ["a", "b"], default: "a" },
      },
    ];
    const schema = paramsToInputSchema(params);
    expect(schema.properties.status).toMatchObject({
      type: "string",
      enum: ["a", "b"],
      default: "a",
    });
    expect(schema.required).toEqual(["status"]);
  });

  it("annotates the parameter location in the description", () => {
    const schema = paramsToInputSchema([
      { name: "id", in: "path", type: "string", required: true, description: "The id" },
    ]);
    expect(schema.properties.id.description).toBe("The id (path)");
  });

  it("gives arrays an `items` so the schema stays valid", () => {
    const schema = paramsToInputSchema([
      { name: "tags", in: "query", type: "array", required: false },
    ]);
    expect(schema.properties.tags).toMatchObject({ type: "array", items: {} });
  });

  it("omits `required` entirely when nothing is required", () => {
    const schema = paramsToInputSchema([
      { name: "q", in: "query", type: "string", required: false },
    ]);
    expect(schema).not.toHaveProperty("required");
  });

  it("falls back to `type` for endpoints created before schemas were stored", () => {
    const schema = paramsToInputSchema([
      { name: "n", in: "query", type: "integer", required: false },
    ]);
    expect(schema.properties.n).toMatchObject({ type: "integer" });
  });

  it("produces a schema with a declared type for every Petstore tool input", () => {
    for (const ep of petstore3.endpoints) {
      const schema = paramsToInputSchema(ep.params);
      expect(schema.type).toBe("object");
      for (const [name, prop] of Object.entries(schema.properties)) {
        expect(prop.type, `${ep.method} ${ep.path} → ${name}`).toBeDefined();
      }
    }
  });

  it("describes the body fields of POST /pet instead of an opaque object", () => {
    const addPet = petstore3.endpoints.find((e) => e.method === "POST" && e.path === "/pet")!;
    const schema = paramsToInputSchema(addPet.params);
    const body = schema.properties.body as Record<string, unknown>;
    expect(Object.keys(body.properties as object)).toContain("name");
  });
});
