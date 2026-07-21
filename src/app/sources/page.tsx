import { db, sources, endpoints } from "@/db";
import { FontesView } from "@/components/fontes/FontesView";

export const dynamic = "force-dynamic";

export default function FontesPage() {
  const allSources = db.select().from(sources).all();
  const allEndpoints = db.select().from(endpoints).all();

  const data = allSources.map((s) => ({
    ...s,
    endpoints: allEndpoints.filter((e) => e.sourceId === s.id),
  }));

  return <FontesView sources={data} />;
}
