"use client";

import React from "react";

/**
 * Textarea no estilo do Input do DS (sem animações).
 */
type TextareaProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ label, hint, error, id, disabled, style, rows = 6, ...rest }: TextareaProps) {
  const reactId = React.useId();
  const taId = id || reactId;
  const [focus, setFocus] = React.useState(false);
  const borderColor = error
    ? "var(--error-500)"
    : focus
    ? "var(--brand-primary)"
    : "var(--border-default)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <label htmlFor={taId} style={{ font: "var(--type-label)", color: "var(--text-strong)" }}>
          {label}
        </label>
      )}
      <textarea
        id={taId}
        rows={rows}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          padding: "12px 14px",
          background: disabled ? "var(--surface-muted)" : "var(--surface-card)",
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-sm)",
          boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
          outline: "none",
          font: "var(--type-body)",
          color: "var(--text-strong)",
          resize: "vertical",
          fontFamily: "var(--font-body)",
        }}
        {...rest}
      />
      {(hint || error) && (
        <span
          style={{
            font: "var(--type-body-sm)",
            fontSize: 12.5,
            color: error ? "var(--error-500)" : "var(--text-muted)",
          }}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
}
