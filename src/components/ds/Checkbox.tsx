"use client";

import React from "react";

/**
 * Checkbox (port sem animações)
 */
type CheckboxProps = {
  checked?: boolean;
  label?: React.ReactNode;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  id?: string;
  style?: React.CSSProperties;
};

export function Checkbox({ checked = false, label, disabled = false, onChange, id, style }: CheckboxProps) {
  const reactId = React.useId();
  const cbId = id || reactId;
  return (
    <label
      htmlFor={cbId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        font: "var(--type-body)",
        color: "var(--text-body)",
        ...style,
      }}
    >
      <input
        id={cbId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          width: 20,
          height: 20,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-sm)",
          border: `1.5px solid ${checked ? "var(--brand-primary)" : "var(--border-strong)"}`,
          background: checked ? "var(--brand-primary)" : "var(--surface-card)",
        }}
      >
        {checked && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {label}
    </label>
  );
}
