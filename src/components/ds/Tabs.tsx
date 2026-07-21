"use client";

import React from "react";

/**
 * Tabs (port sem animações)
 */
type TabItem = { value: string; label: React.ReactNode };

type TabsProps = {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  tone?: "light" | "dark";
  style?: React.CSSProperties;
};

export function Tabs({ items = [], value, defaultValue, onChange, tone = "light", style }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value);
  const active = value !== undefined ? value : internal;
  const onDark = tone === "dark";

  const select = (v: string) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 28,
        borderBottom: `1px solid ${onDark ? "var(--border-on-dark)" : "var(--border-subtle)"}`,
        ...style,
      }}
    >
      {items.map((it) => {
        const isActive = it.value === active;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => select(it.value)}
            style={{
              position: "relative",
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "0 0 14px",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 15,
              color: isActive
                ? onDark
                  ? "var(--white)"
                  : "var(--text-strong)"
                : onDark
                ? "var(--text-on-dark-muted)"
                : "var(--text-muted)",
            }}
          >
            {it.label}
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -1,
                  height: 2,
                  background: "var(--brand-primary)",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
