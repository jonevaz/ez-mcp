import React from "react";

/**
 * Badge
 */
type BadgeProps = {
  children: React.ReactNode;
  tone?: "brand" | "neutral" | "success" | "warning" | "error" | "info";
  variant?: "solid" | "soft";
  style?: React.CSSProperties;
};

export function Badge({ children, tone = "brand", variant = "soft", style }: BadgeProps) {
  const palette: Record<string, { solid: [string, string]; soft: [string, string] }> = {
    brand:   { solid: ["var(--brand-primary)", "#fff"], soft: ["var(--magenta-50)", "var(--magenta-700)"] },
    neutral: { solid: ["var(--ink-800)", "#fff"],       soft: ["var(--ink-100)", "var(--ink-700)"] },
    success: { solid: ["var(--success-500)", "#fff"],   soft: ["var(--success-50)", "var(--success-500)"] },
    warning: { solid: ["var(--warning-500)", "#fff"],   soft: ["var(--warning-50)", "#a65c05"] },
    error:   { solid: ["var(--error-500)", "#fff"],     soft: ["var(--error-50)", "var(--error-500)"] },
    info:    { solid: ["var(--info-500)", "#fff"],      soft: ["var(--info-50)", "var(--info-500)"] },
  };
  const [bg, fg] = (palette[tone] || palette.brand)[variant] || palette.brand.soft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        background: bg,
        color: fg,
        font: "var(--type-label)",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
