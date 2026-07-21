import { db, mcps, mcpTools } from "@/db";
import { McpsView } from "@/components/mcps/McpsView";

export const dynamic = "force-dynamic";

export default function McpsPage() {
  const allMcps = db.select().from(mcps).all();
  const allTools = db.select().from(mcpTools).all();

  const data = allMcps.map((m) => ({
    ...m,
    toolCount: allTools.filter((t) => t.mcpId === m.id && t.enabled).length,
  }));

  return <McpsView mcps={data} />;
}
