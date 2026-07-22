import { db, sources, endpoints } from "@/db";
import { SourcesView } from "@/components/sources/SourcesView";
import { toClientSource } from "@/lib/source-dto";

export const dynamic = "force-dynamic";

export default function SourcesPage() {
  const allSources = db.select().from(sources).all();
  const allEndpoints = db.select().from(endpoints).all();

  // Credenciais e a spec crua não atravessam para o cliente — ver source-dto.
  const data = allSources.map((s) => ({
    ...toClientSource(s),
    endpoints: allEndpoints.filter((e) => e.sourceId === s.id),
  }));

  return <SourcesView sources={data} />;
}
