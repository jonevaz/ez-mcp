import Link from "next/link";
import { desc, gte, sql } from "drizzle-orm";
import { db, mcps, usageLogs } from "@/db";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ds/Card";
import { StatCard } from "@/components/ds/StatCard";
import { Badge } from "@/components/ds/Badge";
import { Table, Th, Td, Mono } from "@/components/ds/Table";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadDashboardData() {
  const now = Date.now();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const last30d = now - 30 * DAY_MS;

  const totals = db
    .select({
      total: sql<number>`count(*)`,
      errors: sql<number>`sum(case when ${usageLogs.status} = 'error' then 1 else 0 end)`,
    })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, last30d))
    .all()[0];

  const today = db
    .select({ total: sql<number>`count(*)` })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, startOfToday))
    .all()[0];

  const allMcps = db.select().from(mcps).all();
  const publishedCount = allMcps.filter((m) => m.published).length;

  const perMcp = db
    .select({
      mcpId: usageLogs.mcpId,
      total: sql<number>`count(*)`,
      errors: sql<number>`sum(case when ${usageLogs.status} = 'error' then 1 else 0 end)`,
      lastCall: sql<number>`max(${usageLogs.createdAt})`,
      avgMs: sql<number>`round(avg(${usageLogs.durationMs}))`,
    })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, last30d))
    .groupBy(usageLogs.mcpId)
    .orderBy(desc(sql`count(*)`))
    .all();

  const recent = db
    .select()
    .from(usageLogs)
    .orderBy(desc(usageLogs.createdAt))
    .limit(20)
    .all();

  return { totals, today, allMcps, publishedCount, perMcp, recent };
}

export default function HomePage() {
  const { totals, today, allMcps, publishedCount, perMcp, recent } = loadDashboardData();

  const mcpName = (mcpId: number) =>
    allMcps.find((m) => m.id === mcpId)?.name ?? `MCP #${mcpId}`;

  const totalCalls = totals?.total ?? 0;
  const totalErrors = totals?.errors ?? 0;
  const errorRate = totalCalls > 0 ? Math.round((totalErrors / totalCalls) * 100) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Home"
        title="Consumo dos seus MCPs"
        description="Acompanhe as chamadas que os agentes fazem aos MCP servers publicados."
      />

      <Card style={{ marginBottom: "var(--space-6)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--space-8)",
          }}
        >
          <StatCard value={totalCalls} label="Chamadas nos últimos 30 dias" />
          <StatCard value={today?.total ?? 0} label="Chamadas hoje" accent={false} />
          <StatCard value={publishedCount} label="MCPs publicados" accent={false} />
          <StatCard
            value={`${errorRate}%`}
            label="Taxa de erro (30 dias)"
            accent={errorRate > 0}
          />
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        <Card padding={0}>
          <div style={{ padding: "var(--space-5) var(--space-6) var(--space-3)" }}>
            <h3 style={{ font: "var(--type-h3)" }}>Chamadas por MCP</h3>
          </div>
          {perMcp.length === 0 ? (
            <p style={{ padding: "0 var(--space-6) var(--space-6)", color: "var(--text-muted)", font: "var(--type-body-sm)" }}>
              Sem chamadas ainda. <Link href="/mcps">Publique um MCP</Link> e conecte um agente.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>MCP</Th>
                  <Th>Chamadas</Th>
                  <Th>Erros</Th>
                  <Th>Média</Th>
                  <Th>Última</Th>
                </tr>
              </thead>
              <tbody>
                {perMcp.map((row) => (
                  <tr key={row.mcpId}>
                    <Td>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-strong)" }}>
                        {mcpName(row.mcpId)}
                      </span>
                    </Td>
                    <Td>{row.total}</Td>
                    <Td>
                      {row.errors > 0 ? (
                        <Badge tone="error">{row.errors}</Badge>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>0</span>
                      )}
                    </Td>
                    <Td>
                      <Mono>{row.avgMs ?? 0} ms</Mono>
                    </Td>
                    <Td>{formatTime(row.lastCall)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card padding={0}>
          <div style={{ padding: "var(--space-5) var(--space-6) var(--space-3)" }}>
            <h3 style={{ font: "var(--type-h3)" }}>Atividade recente</h3>
          </div>
          {recent.length === 0 ? (
            <p style={{ padding: "0 var(--space-6) var(--space-6)", color: "var(--text-muted)", font: "var(--type-body-sm)" }}>
              As chamadas de tools aparecem aqui em tempo real.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tool</Th>
                  <Th>MCP</Th>
                  <Th>Status</Th>
                  <Th>Duração</Th>
                  <Th>Quando</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((log) => (
                  <tr key={log.id}>
                    <Td>
                      <Mono>{log.toolName}</Mono>
                    </Td>
                    <Td>{mcpName(log.mcpId)}</Td>
                    <Td>
                      {log.status === "ok" ? (
                        <Badge tone="success">{log.httpStatus ?? "ok"}</Badge>
                      ) : (
                        <Badge tone="error">{log.httpStatus ?? "erro"}</Badge>
                      )}
                    </Td>
                    <Td>
                      <Mono>{log.durationMs ?? 0} ms</Mono>
                    </Td>
                    <Td>{formatTime(log.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
