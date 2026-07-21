"use client";

import React from "react";

/**
 * Select nativo no estilo do Input do DS (sem animações).
 */
type SelectProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ label, hint, id, disabled, style, children, ...rest }: SelectProps) {
  const reactId = React.useId();
  const selId = id || reactId;
  const [focus, setFocus] = React.useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <label htmlFor={selId} style={{ font: "var(--type-label)", color: "var(--text-strong)" }}>
          {label}
        </label>
      )}
      <select
        id={selId}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          height: 46,
          padding: "0 14px",
          background: disabled ? "var(--surface-muted)" : "var(--surface-card)",
          border: `1px solid ${focus ? "var(--brand-primary)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-sm)",
          boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
          outline: "none",
          font: "var(--type-body)",
          color: "var(--text-strong)",
        }}
        {...rest}
      >
        {children}
      </select>
      {hint && (
        <span style={{ font: "var(--type-body-sm)", fontSize: 12.5, color: "var(--text-muted)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
