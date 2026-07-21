import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";

export const metadata: Metadata = {
  title: "ez-mcp",
  description:
    "Turn your APIs into MCP servers ready for Claude Code, Cursor, and other agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <AppSidebar />
          <main
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--surface-muted)",
              padding: "var(--space-10) var(--space-12)",
            }}
          >
            <div style={{ maxWidth: "var(--container-lg)", margin: "0 auto" }}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
