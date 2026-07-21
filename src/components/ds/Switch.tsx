"use client";

import React from "react";

/**
 * Switch (port sem animações)
 */
type SwitchProps = {
  checked?: boolean;
  label?: React.ReactNode;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  id?: string;
  style?: React.CSSProperties;
};

export function Switch({ checked = false, label, disabled = false, onChange, id, style }: SwitchProps) {
  const reactId = React.useId();
  const swId = id || reactId;
  return (
    <label
      htmlFor={swId}
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
        id={swId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          width: 42,
          height: 24,
          flex: "none",
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--brand-primary)" : "var(--ink-200)",
          padding: 3,
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "var(--shadow-sm)",
            transform: checked ? "translateX(18px)" : "translateX(0)",
          }}
        />
      </span>
      {label}
    </label>
  );
}
