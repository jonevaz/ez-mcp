"use client";

import React from "react";

/**
 * Input (port sem animações)
 */
type InputProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  iconLeft?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Input({
  label,
  hint,
  error,
  iconLeft,
  id,
  type = "text",
  disabled = false,
  style,
  ...rest
}: InputProps) {
  const reactId = React.useId();
  const inputId = id || reactId;
  const [focus, setFocus] = React.useState(false);
  const borderColor = error
    ? "var(--error-500)"
    : focus
    ? "var(--brand-primary)"
    : "var(--border-default)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <label htmlFor={inputId} style={{ font: "var(--type-label)", color: "var(--text-strong)" }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 46,
          padding: "0 14px",
          background: disabled ? "var(--surface-muted)" : "var(--surface-card)",
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-sm)",
          boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
        }}
      >
        {iconLeft && <span style={{ color: "var(--text-faint)", display: "flex" }}>{iconLeft}</span>}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            font: "var(--type-body)",
            color: "var(--text-strong)",
            minWidth: 0,
          }}
          {...rest}
        />
      </div>
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
