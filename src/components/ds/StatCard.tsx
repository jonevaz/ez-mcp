import React from "react";

/**
 * StatCard
 * Big metric + label (proof-point style).
 */
type StatCardProps = {
  value: React.ReactNode;
  label: React.ReactNode;
  tone?: "light" | "dark";
  accent?: boolean;
  style?: React.CSSProperties;
};

export function StatCard({ value, label, tone = "light", accent = true, style }: StatCardProps) {
  const onDark = tone === "dark";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "var(--text-4xl)",
          lineHeight: 1,
          letterSpacing: "var(--ls-tight)",
          color: accent
            ? "var(--brand-primary)"
            : onDark
            ? "var(--white)"
            : "var(--text-strong)",
        }}
      >
        {value}
      </span>
      <span
        style={{
          font: "var(--type-body-sm)",
          color: onDark ? "var(--text-on-dark-muted)" : "var(--text-muted)",
          maxWidth: "22ch",
        }}
      >
        {label}
      </span>
    </div>
  );
}
