"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Globe, GlobeLock, RefreshCw, Copy, Check } from "lucide-react";
import type { Endpoint, Mcp, McpTool, Source } from "@/db/schema";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Badge } from "@/components/ds/Badge";
import { Checkbox } from "@/components/ds/Checkbox";
import { Input } from "@/components/ds/Input";
import { Mono } from "@/components/ds/Table";
import { MethodBadge } from "@/components/MethodBadge";
import {
  publishMcp,
  regenerateToken,
  toggleMcpTool,
  unpublishMcp,
  updateMcpTool,
} from "@/lib/actions";
import { McpFormModal } from "./McpFormModal";

type SourceWithEndpoints = Source & { endpoints: Endpoint[] };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        border: "none",
        background: "none",
        cursor: "pointer",
        color: copied ? "var(--success-500)" : "var(--text-on-dark-muted)",
        display: "flex",
        padding: 4,
        flex: "none",
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <span
        style={{
          font: "var(--type-label)",
          fontSize: 12,
          color: "var(--text-on-dark-muted)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          background: "var(--surface-dark-raised)",
          border: "1px solid var(--border-on-dark)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 12px",
        }}
      >
        <pre
          style={{
            margin: 0,
            flex: 1,
            overflowX: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--text-on-dark)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {code}
        </pre>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function ToolEditor({ tool }: { tool: McpTool }) {
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Mono style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{tool.toolName}</Mono>
        <button
          type="button"
          aria-label="Edit tool"
          onClick={() => setEditing(true)}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--text-faint)",
            display: "flex",
            padding: 2,
          }}
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await updateMcpTool(tool.id, new FormData(e.currentTarget));
        setPending(false);
        setEditing(false);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}
    >
      <Input name="toolName" defaultValue={tool.toolName} aria-label="Tool name" />
      <Input
        name="toolDescription"
        defaultValue={tool.toolDescription || ""}
        aria-label="Tool description"
        placeholder="Tool description"
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function McpDetailView({
  mcp,
  tools,
  sources,
}: {
  mcp: Mcp;
  tools: McpTool[];
  sources: SourceWithEndpoints[];
}) {
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const origin = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => window.location.origin,
    () => ""
  );

  const toolByEndpoint = new Map(tools.map((t) => [t.endpointId, t]));
  const mcpUrl = `${origin}/api/mcp/${mcp.slug}`;

  const claudeSnippet = `claude mcp add --transport http ${mcp.slug} ${mcpUrl} --header "Authorization: Bearer ${mcp.token}"`;
  const jsonSnippet = JSON.stringify(
    {
      mcpServers: {
        [mcp.slug]: {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${mcp.token}` },
        },
      },
    },
    null,
    2
  );

  return (
    <div>
      <Link
        href="/mcps"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "var(--type-body-sm)",
          color: "var(--text-muted)",
          marginBottom: "var(--space-4)",
        }}
      >
        <ArrowLeft size={15} /> Back to MCPs
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: "var(--space-6)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ font: "var(--type-h2)" }}>{mcp.name}</h1>
            {mcp.published ? (
              <Badge tone="success">Published</Badge>
            ) : (
              <Badge tone="neutral">Draft</Badge>
            )}
          </div>
          <Mono style={{ color: "var(--text-muted)", fontSize: 13 }}>/api/mcp/{mcp.slug}</Mono>
          {mcp.description && (
            <p style={{ color: "var(--text-muted)", marginTop: 6, maxWidth: "60ch" }}>
              {mcp.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <Button variant="outline" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          {mcp.published ? (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<GlobeLock size={14} />}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await unpublishMcp(mcp.id);
                })
              }
            >
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              iconLeft={<Globe size={14} />}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await publishMcp(mcp.id);
                  setError(result.ok ? null : result.error || "Failed to publish.");
                })
              }
            >
              Publish
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p style={{ font: "var(--type-body-sm)", color: "var(--error-500)", marginBottom: "var(--space-4)" }}>
          {error}
        </p>
      )}

      {mcp.published && mcp.token && (
        <Card tone="dark" style={{ marginBottom: "var(--space-8)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <h3 style={{ font: "var(--type-h3)", color: "var(--white)" }}>
              MCP published — ready to connect
            </h3>
            <Button
              variant="on-dark"
              size="sm"
              iconLeft={<RefreshCw size={14} />}
              disabled={isPending}
              onClick={() => {
                if (confirm("Generate a new token? The current token will stop working.")) {
                  startTransition(async () => {
                    await regenerateToken(mcp.id);
                  });
                }
              }}
            >
              New token
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Snippet label="MCP URL (Streamable HTTP)" code={mcpUrl} />
            <Snippet label="Bearer token" code={mcp.token} />
            <Snippet label="Claude Code" code={claudeSnippet} />
            <Snippet label="Cursor / other clients (mcp.json)" code={jsonSnippet} />
          </div>
        </Card>
      )}

      <h2 style={{ font: "var(--type-h3)", marginBottom: 6 }}>Tools</h2>
      <p style={{ font: "var(--type-body-sm)", color: "var(--text-muted)", marginBottom: "var(--space-5)" }}>
        Select the endpoints from your sources that this MCP exposes as tools.
      </p>

      {sources.length === 0 && (
        <Card tone="muted" style={{ textAlign: "center", padding: "var(--space-10)" }}>
          <p style={{ color: "var(--text-muted)" }}>
            No sources with active endpoints.{" "}
            <Link href="/sources">Register a source</Link> first.
          </p>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {sources.map((source) => (
          <Card key={source.id} padding={0}>
            <div
              style={{
                padding: "var(--space-4) var(--space-6)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <h4 style={{ font: "var(--type-h4)" }}>{source.name}</h4>
              <Mono style={{ color: "var(--text-faint)", fontSize: 12 }}>{source.baseUrl}</Mono>
            </div>
            <div>
              {source.endpoints.map((ep) => {
                const tool = toolByEndpoint.get(ep.id);
                return (
                  <div
                    key={ep.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      padding: "12px var(--space-6)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Checkbox
                      checked={Boolean(tool)}
                      onChange={(v) =>
                        startTransition(async () => {
                          await toggleMcpTool(mcp.id, ep.id, v);
                        })
                      }
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <MethodBadge method={ep.method} />
                        <Mono>{ep.path}</Mono>
                        {tool && <ToolEditor tool={tool} />}
                      </div>
                      {(tool?.toolDescription || ep.description) && (
                        <p
                          style={{
                            font: "var(--type-body-sm)",
                            color: "var(--text-muted)",
                            marginTop: 4,
                          }}
                        >
                          {tool?.toolDescription || ep.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {editing && <McpFormModal open onClose={() => setEditing(false)} mcp={mcp} />}
    </div>
  );
}
