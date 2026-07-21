import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Fontes: APIs de origem que serão expostas como tools MCP
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull().default("none"), // none | bearer | api_key | basic | oauth2
  authConfig: text("auth_config"), // JSON: { token } | { header, value } | { username, password } | { tokenUrl, clientId, clientSecret, scope }
  specRaw: text("spec_raw"), // spec OpenAPI original (quando importada)
  createdAt: integer("created_at").notNull(),
});

export const endpoints = sqliteTable("endpoints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  method: text("method").notNull(), // GET | POST | PUT | PATCH | DELETE
  path: text("path").notNull(), // ex.: /users/{id}
  description: text("description"),
  paramsSchema: text("params_schema"), // JSON: [{ name, in, type, required, description }]
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const mcps = sqliteTable("mcps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  token: text("token"), // Bearer token gerado ao publicar
  createdAt: integer("created_at").notNull(),
});

export const mcpTools = sqliteTable("mcp_tools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mcpId: integer("mcp_id")
    .notNull()
    .references(() => mcps.id, { onDelete: "cascade" }),
  endpointId: integer("endpoint_id")
    .notNull()
    .references(() => endpoints.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  toolDescription: text("tool_description"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const usageLogs = sqliteTable("usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mcpId: integer("mcp_id").notNull(),
  toolName: text("tool_name").notNull(),
  status: text("status").notNull(), // ok | error
  httpStatus: integer("http_status"),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at").notNull(),
});

export type Source = typeof sources.$inferSelect;
export type Endpoint = typeof endpoints.$inferSelect;
export type Mcp = typeof mcps.$inferSelect;
export type McpTool = typeof mcpTools.$inferSelect;
export type UsageLog = typeof usageLogs.$inferSelect;

// Parâmetro de endpoint (armazenado como JSON em endpoints.params_schema)
export type EndpointParam = {
  name: string;
  in: "path" | "query" | "header" | "body";
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  required: boolean;
  description?: string;
};
