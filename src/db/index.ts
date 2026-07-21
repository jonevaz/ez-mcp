import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DDL = `
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_config TEXT,
  spec_raw TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT,
  params_schema TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS mcps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  token TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mcp_id INTEGER NOT NULL REFERENCES mcps(id) ON DELETE CASCADE,
  endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mcp_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_logs_mcp ON usage_logs(mcp_id, created_at);
`;

function createDb(): BetterSQLite3Database<typeof schema> {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "app.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

// Cache global para sobreviver ao HMR do dev server
const globalForDb = globalThis as unknown as {
  __ezMcpDb?: BetterSQLite3Database<typeof schema>;
};

export const db = globalForDb.__ezMcpDb ?? (globalForDb.__ezMcpDb = createDb());
export * from "./schema";
