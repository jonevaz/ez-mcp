import { db, sources, endpoints } from "@/db";
import { SourcesView } from "@/components/sources/SourcesView";

export const dynamic = "force-dynamic";

export default function SourcesPage() {
  const allSources = db.select().from(sources).all();
  const allEndpoints = db.select().from(endpoints).all();

  const data = allSources.map((s) => ({
    ...s,
    endpoints: allEndpoints.filter((e) => e.sourceId === s.id),
  }));

  return <SourcesView sources={data} />;
}
