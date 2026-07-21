import React from "react";

/**
 * Tabela simples no estilo do DS: hairlines, header em label, sem zebra.
 */
export function Table({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", ...style }}>{children}</table>
    </div>
  );
}

export function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: "left",
        font: "var(--type-label)",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "var(--ls-wide)",
        color: "var(--text-muted)",
        padding: "10px 12px",
        borderBottom: "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        font: "var(--type-body-sm)",
        color: "var(--text-body)",
        padding: "12px",
        borderBottom: "1px solid var(--border-subtle)",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export function Mono({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, ...style }}>{children}</span>
  );
}
