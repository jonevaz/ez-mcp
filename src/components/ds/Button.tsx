"use client";

import React from "react";

/**
 * Button (port sem animações)
 */
type ButtonProps = {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "on-dark";
  size?: "sm" | "md" | "lg";
  shape?: "sharp" | "pill";
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  size = "md",
  shape = "sharp",
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  const sizes = {
    sm: { padding: "0 14px", height: 36, fontSize: 13 },
    md: { padding: "0 20px", height: 44, fontSize: 15 },
    lg: { padding: "0 28px", height: 54, fontSize: 16 },
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--brand-primary)",
      color: "var(--text-on-primary)",
      border: "1px solid transparent",
    },
    secondary: {
      background: "var(--ink-950)",
      color: "var(--white)",
      border: "1px solid transparent",
    },
    outline: {
      background: "transparent",
      color: "var(--text-strong)",
      border: "1px solid var(--border-strong)",
    },
    ghost: {
      background: "transparent",
      color: "var(--brand-primary)",
      border: "1px solid transparent",
    },
    "on-dark": {
      background: "var(--white)",
      color: "var(--ink-950)",
      border: "1px solid transparent",
    },
  };

  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;

  const [hover, setHover] = React.useState(false);
  const hoverBg = {
    primary: "var(--brand-primary-hover)",
    secondary: "var(--ink-800)",
    outline: "var(--surface-muted)",
    ghost: "var(--brand-primary-soft)",
    "on-dark": "var(--ink-100)",
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : "auto",
        height: s.height,
        padding: s.padding,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: s.fontSize,
        lineHeight: 1,
        letterSpacing: "0.005em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        borderRadius: shape === "pill" ? "var(--radius-pill)" : "var(--radius-sm)",
        ...v,
        ...(hover && !disabled ? { background: hoverBg } : null),
        ...style,
      }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
