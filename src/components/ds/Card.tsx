import React from "react";

/**
 * Card (port sem animações/hover lift)
 */
type CardProps = {
  tone?: "light" | "muted" | "dark";
  gradient?: "api" | "data" | "genai" | "magenta";
  padding?: number | string;
} & React.HTMLAttributes<HTMLDivElement>;

export function Card({
  children,
  tone = "light",
  gradient,
  padding = 24,
  style,
  ...rest
}: CardProps) {
  const tones: Record<string, React.CSSProperties> = {
    light: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      color: "var(--text-body)",
      boxShadow: "var(--shadow-sm)",
    },
    muted: {
      background: "var(--surface-muted)",
      border: "1px solid var(--border-subtle)",
      color: "var(--text-body)",
      boxShadow: "none",
    },
    dark: {
      background: "var(--surface-dark)",
      border: "1px solid var(--border-on-dark)",
      color: "var(--text-on-dark)",
      boxShadow: "none",
    },
  };

  const gradients: Record<string, string> = {
    api: "var(--gradient-api)",
    data: "var(--gradient-data)",
    genai: "var(--gradient-genai)",
    magenta: "var(--gradient-magenta)",
  };

  const base = tones[tone] || tones.light;
  const gradStyle = gradient
    ? {
        background: gradients[gradient] || gradient,
        border: "1px solid transparent",
        color: "var(--white)",
      }
    : null;

  return (
    <div
      style={{
        borderRadius: "var(--radius-card)",
        padding,
        ...base,
        ...gradStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
