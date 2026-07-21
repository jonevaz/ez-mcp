"use client";

import React from "react";
import { X } from "lucide-react";

/**
 * Modal simples no estilo do DS (overlay escuro, card claro, sem animações).
 */
type ModalProps = {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
};

export function Modal({ open, title, onClose, children, width = 560 }: ModalProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 10, 10, 0.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh var(--space-4)",
        zIndex: 50,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          background: "var(--surface-card)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-5) var(--space-6)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <h3 style={{ font: "var(--type-h3)" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              padding: 4,
            }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div style={{ padding: "var(--space-6)" }}>{children}</div>
      </div>
    </div>
  );
}
