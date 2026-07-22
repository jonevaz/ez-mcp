/**
 * Resolução de `$ref` e normalização de JSON Schema vindo de specs OpenAPI/Swagger.
 *
 * Specs reais (Stripe, GitHub, Petstore) descrevem quase tudo por referência a
 * `#/components/schemas/...`. Sem resolver isso, as tools chegam ao agente sem
 * parâmetros e sem o formato do corpo da requisição.
 */

export type JsonSchema = Record<string, unknown>;

/** Profundidade máxima de aninhamento preservada ao expandir referências. */
const MAX_DEPTH = 10;
/** Teto de nós expandidos por schema, para não estourar o contexto do agente. */
const MAX_NODES = 400;

/** Campos de JSON Schema que ajudam o agente a acertar a chamada de primeira. */
const KEPT_KEYS = new Set([
  "type",
  "format",
  "enum",
  "const",
  "default",
  "example",
  "description",
  "title",
  "items",
  "properties",
  "required",
  "additionalProperties",
  "nullable",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "oneOf",
  "anyOf",
]);

/** Placeholder usado quando um `$ref` recursivo ou fundo demais é cortado. */
const OPAQUE_OBJECT: JsonSchema = { type: "object" };

export class SchemaResolver {
  private root: Record<string, unknown>;
  /** Referências que não foi possível resolver, para reportar na importação. */
  readonly unresolved = new Set<string>();

  constructor(root: Record<string, unknown>) {
    this.root = root;
  }

  /** Resolve um JSON Pointer local (`#/components/schemas/Pet`). */
  private resolvePointer(ref: string): unknown {
    if (!ref.startsWith("#/")) return undefined; // refs externas não são buscadas
    const parts = ref
      .slice(2)
      .split("/")
      .map((p) => decodeURIComponent(p).replace(/~1/g, "/").replace(/~0/g, "~"));
    let cur: unknown = this.root;
    for (const part of parts) {
      if (!cur || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
  }

  /**
   * Expande `$ref` recursivamente e normaliza o schema.
   * Ciclos viram `{ type: "object" }` em vez de estourar a pilha.
   */
  deref(node: unknown): JsonSchema {
    const budget = { nodes: 0 };
    const out = this.walk(node, new Set(), 0, budget);
    return isObject(out) ? out : {};
  }

  /** Resolve um nó que pode ser `$ref` sem normalizar (usado para parameters). */
  derefRaw(node: unknown): Record<string, unknown> | undefined {
    let cur = node;
    const seen = new Set<string>();
    while (isObject(cur) && typeof cur.$ref === "string") {
      const ref = cur.$ref;
      if (seen.has(ref)) return undefined;
      seen.add(ref);
      const target = this.resolvePointer(ref);
      if (target === undefined) {
        this.unresolved.add(ref);
        return undefined;
      }
      cur = target;
    }
    return isObject(cur) ? cur : undefined;
  }

  private walk(
    node: unknown,
    seenRefs: Set<string>,
    depth: number,
    budget: { nodes: number }
  ): unknown {
    if (Array.isArray(node)) {
      return node.map((item) => this.walk(item, seenRefs, depth, budget));
    }
    if (!isObject(node)) return node;

    if (budget.nodes++ > MAX_NODES || depth > MAX_DEPTH) return { ...OPAQUE_OBJECT };

    // 1. `$ref` → resolve, marcando a referência para detectar ciclos.
    if (typeof node.$ref === "string") {
      const ref = node.$ref;
      if (seenRefs.has(ref)) {
        return { ...OPAQUE_OBJECT, description: `Recursive reference to ${shortRef(ref)}.` };
      }
      const target = this.resolvePointer(ref);
      if (target === undefined) {
        this.unresolved.add(ref);
        return { ...OPAQUE_OBJECT, description: `Unresolved reference ${shortRef(ref)}.` };
      }
      const nextSeen = new Set(seenRefs).add(ref);
      const resolved = this.walk(target, nextSeen, depth, budget);
      // Campos irmãos do $ref (ex.: description própria) têm precedência.
      const siblings = this.walk(omit(node, ["$ref"]), seenRefs, depth, budget);
      return { ...(isObject(resolved) ? resolved : {}), ...(isObject(siblings) ? siblings : {}) };
    }

    // 2. `allOf` → mescla numa única forma, que é o que o agente consegue usar.
    if (Array.isArray(node.allOf)) {
      const merged: JsonSchema = {};
      for (const part of node.allOf) {
        const resolved = this.walk(part, seenRefs, depth + 1, budget);
        if (isObject(resolved)) mergeInto(merged, resolved);
      }
      mergeInto(merged, this.walkPlain(omit(node, ["allOf"]), seenRefs, depth, budget));
      return merged;
    }

    return this.walkPlain(node, seenRefs, depth, budget);
  }

  private walkPlain(
    node: Record<string, unknown>,
    seenRefs: Set<string>,
    depth: number,
    budget: { nodes: number }
  ): JsonSchema {
    const out: JsonSchema = {};
    for (const [key, value] of Object.entries(node)) {
      if (!KEPT_KEYS.has(key)) continue;
      if (key === "properties" && isObject(value)) {
        const props: JsonSchema = {};
        for (const [propName, propSchema] of Object.entries(value)) {
          props[propName] = this.walk(propSchema, seenRefs, depth + 1, budget);
        }
        out.properties = props;
      } else if (key === "items" || key === "additionalProperties") {
        out[key] =
          typeof value === "boolean" ? value : this.walk(value, seenRefs, depth + 1, budget);
      } else if (key === "oneOf" || key === "anyOf") {
        out[key] = Array.isArray(value)
          ? value.map((v) => this.walk(v, seenRefs, depth + 1, budget))
          : value;
      } else {
        out[key] = value;
      }
    }
    return out;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function omit(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (!keys.includes(k)) out[k] = v;
  return out;
}

function shortRef(ref: string): string {
  return ref.split("/").pop() || ref;
}

/** Mescla `src` em `dst`, unindo `properties` e `required` em vez de sobrescrever. */
function mergeInto(dst: JsonSchema, src: JsonSchema) {
  for (const [key, value] of Object.entries(src)) {
    if (key === "properties" && isObject(value)) {
      dst.properties = { ...(isObject(dst.properties) ? dst.properties : {}), ...value };
    } else if (key === "required" && Array.isArray(value)) {
      const prev = Array.isArray(dst.required) ? (dst.required as unknown[]) : [];
      dst.required = Array.from(new Set([...prev, ...value]));
    } else if (value !== undefined) {
      dst[key] = value;
    }
  }
}

/** Tipo JSON Schema declarado por um schema, normalizado para os tipos suportados. */
export function schemaType(schema: JsonSchema | undefined): string {
  const t = schema?.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    const first = t.find((x) => x !== "null");
    if (typeof first === "string") return first;
  }
  if (isObject(schema?.properties)) return "object";
  if (schema?.items !== undefined) return "array";
  return "string";
}
