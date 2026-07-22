import type { EndpointParam } from "@/db/schema";

/**
 * Validação dos argumentos que o agente envia em `tools/call`, antes de montar
 * a requisição HTTP.
 *
 * O objetivo é devolver ao agente um erro que ele consiga corrigir sozinho
 * ("faltou `petId`", "`status` aceita available|pending|sold") em vez de deixar
 * a API de origem responder 400/404 com uma mensagem opaca — ou, pior, montar
 * uma URL com `{petId}` literal.
 *
 * A validação é **rasa de propósito**: cobre os parâmetros de topo (presença,
 * tipo, enum) e as propriedades obrigatórias de topo do body. Regras profundas
 * (objetos aninhados, formatos, ranges) ficam com a API de origem, que é a
 * fonte de verdade.
 */

export type ValidationResult =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: string[] };

export function validateArgs(
  params: EndpointParam[],
  args: Record<string, unknown> | undefined
): ValidationResult {
  const input = args ?? {};
  const errors: string[] = [];
  const values: Record<string, unknown> = {};
  const known = new Set(params.map((p) => p.name));

  for (const p of params) {
    const raw = input[p.name];
    const missing = raw === undefined || raw === null;

    if (missing) {
      if (p.required) {
        errors.push(`Missing required parameter \`${p.name}\`${locationHint(p)}.`);
      }
      continue;
    }

    const coerced = coerce(raw, p.type);
    if (coerced === INVALID) {
      errors.push(
        `Parameter \`${p.name}\` must be of type ${p.type}, got ${describe(raw)}.`
      );
      continue;
    }

    const enumError = checkEnum(p, coerced);
    if (enumError) {
      errors.push(enumError);
      continue;
    }

    if (p.in === "body") {
      errors.push(...checkBodyRequired(p, coerced));
    }

    values[p.name] = coerced;
  }

  // Argumento desconhecido normalmente é o agente confundindo o nome — avisar é
  // mais útil do que descartar em silêncio.
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      errors.push(`Unknown parameter \`${key}\`. Accepted: ${[...known].join(", ") || "(none)"}.`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, values };
}

/** Sentinela para "não foi possível converter para o tipo esperado". */
const INVALID = Symbol("invalid");

function coerce(value: unknown, type: EndpointParam["type"]): unknown | typeof INVALID {
  switch (type) {
    case "string":
      // Números e booleanos viram string sem reclamar; objetos não.
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return INVALID;

    case "integer":
    case "number": {
      if (typeof value === "number") {
        if (type === "integer" && !Number.isInteger(value)) return INVALID;
        return value;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        if (!Number.isFinite(n)) return INVALID;
        if (type === "integer" && !Number.isInteger(n)) return INVALID;
        return n;
      }
      return INVALID;
    }

    case "boolean":
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return INVALID;

    case "array":
      return Array.isArray(value) ? value : INVALID;

    case "object":
      // O body pode ser um array (ex.: POST de uma coleção).
      if (Array.isArray(value)) return value;
      if (typeof value === "object" && value !== null) return value;
      // Alguns clientes serializam o body como string JSON.
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return INVALID;
        }
      }
      return INVALID;
  }
}

function checkEnum(p: EndpointParam, value: unknown): string | null {
  const allowed = p.schema?.enum;
  if (!Array.isArray(allowed) || allowed.length === 0) return null;
  // Compara por string para tolerar a coerção feita acima.
  if (allowed.some((a) => String(a) === String(value))) return null;
  return `Parameter \`${p.name}\` must be one of: ${allowed.map(String).join(", ")}.`;
}

/** Confere as propriedades obrigatórias de topo declaradas no schema do body. */
function checkBodyRequired(p: EndpointParam, value: unknown): string[] {
  const required = p.schema?.required;
  if (!Array.isArray(required) || required.length === 0) return [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const obj = value as Record<string, unknown>;
  return required
    .filter((key) => typeof key === "string" && obj[key] === undefined)
    .map((key) => `Body is missing required field \`${String(key)}\`.`);
}

function locationHint(p: EndpointParam): string {
  return p.in === "body" ? "" : ` (${p.in} parameter)`;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
