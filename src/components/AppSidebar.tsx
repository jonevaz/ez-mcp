"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, Server } from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/mcps", label: "MCPs", icon: Server },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 232,
        flex: "none",
        background: "var(--surface-dark)",
        borderRight: "1px solid var(--border-on-dark)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-6) var(--space-4)",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      {/* Wordmark — stand-in tipográfico do logo (Poppins bold) */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          padding: "0 var(--space-2) var(--space-6)",
          textDecoration: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 28,
            lineHeight: 1,
            color: "var(--white)",
            letterSpacing: "var(--ls-tight)",
          }}
        >
          ez-mcp
        </span>
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 14,
                color: active ? "var(--white)" : "var(--text-on-dark-muted)",
                background: active ? "var(--brand-primary)" : "transparent",
              }}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          padding: "var(--space-4) var(--space-2) 0",
          borderTop: "1px solid var(--border-on-dark)",
          font: "var(--type-body-sm)",
          fontSize: 12,
          color: "var(--text-on-dark-faint)",
        }}
      >
        We turn your APIs into MCP servers.
      </div>
    </aside>
  );
}
