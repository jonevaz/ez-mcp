import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, mcps, mcpTools, endpoints, sources } from "@/db";
import { McpDetailView } from "@/components/mcps/McpDetailView";

export const dynamic = "force-dynamic";

export default async function McpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mcpId = Number(id);
  if (!Number.isInteger(mcpId)) notFound();

  const mcp = db.select().from(mcps).where(eq(mcps.id, mcpId)).all()[0];
  if (!mcp) notFound();

  const tools = db.select().from(mcpTools).where(eq(mcpTools.mcpId, mcpId)).all();
  const allSources = db.select().from(sources).all();
  const allEndpoints = db.select().from(endpoints).where(eq(endpoints.enabled, true)).all();

  const sourcesWithEndpoints = allSources
    .map((s) => ({
      ...s,
      endpoints: allEndpoints.filter((e) => e.sourceId === s.id),
    }))
    .filter((s) => s.endpoints.length > 0);

  return <McpDetailView mcp={mcp} tools={tools} sources={sourcesWithEndpoints} />;
}
