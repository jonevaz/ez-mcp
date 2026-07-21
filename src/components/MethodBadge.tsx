import { Badge } from "@/components/ds/Badge";

const TONES: Record<string, "info" | "success" | "warning" | "error" | "neutral" | "brand"> = {
  GET: "info",
  POST: "success",
  PUT: "warning",
  PATCH: "brand",
  DELETE: "error",
};

export function MethodBadge({ method }: { method: string }) {
  const m = method.toUpperCase();
  return (
    <Badge tone={TONES[m] || "neutral"} variant="soft" style={{ fontFamily: "var(--font-mono)" }}>
      {m}
    </Badge>
  );
}
