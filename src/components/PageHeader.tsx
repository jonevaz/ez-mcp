import React from "react";

/**
 * Cabeçalho de página: eyebrow magenta + título Poppins + ação à direita.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "var(--space-6)",
        marginBottom: "var(--space-8)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="eyebrow">{eyebrow}</span>
        <h1 style={{ font: "var(--type-h2)" }}>{title}</h1>
        {description && (
          <p style={{ font: "var(--type-body)", color: "var(--text-muted)", maxWidth: "60ch" }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flex: "none" }}>{action}</div>}
    </div>
  );
}
