import type { EndpointParam } from "@/db/schema";

/**
 * Converte os parâmetros de um endpoint no `inputSchema` da tool MCP.
 *
 * Usa o JSON Schema completo extraído da spec (com `$ref` já resolvido), que é
 * o que carrega `enum`, `format`, `items` e a forma do corpo da requisição —
 * sem isso o agente precisa adivinhar os campos.
 */
export function paramsToInputSchema(params: EndpointParam[]) {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const p of params) {
    const schema: Record<string, unknown> =
      p.schema && Object.keys(p.schema).length > 0 ? { ...p.schema } : { type: p.type };

    if (!schema.type) schema.type = p.type;
    // `array` sem `items` é JSON Schema inválido para clientes mais estritos.
    if (schema.type === "array" && schema.items === undefined) schema.items = {};

    // A localização ajuda o agente a distinguir parâmetros de nomes parecidos
    // (ex.: `id` de path vs. `id` de query).
    const location = p.in === "body" ? undefined : `(${p.in})`;
    const description = [p.description || schema.description, location].filter(Boolean).join(" ");
    if (description) schema.description = description;

    properties[p.name] = schema;
    if (p.required) required.push(p.name);
  }

  return {
    type: "object" as const,
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
