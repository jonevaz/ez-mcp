"use client";

import React from "react";
import { Plus, Trash2, Pencil, Database } from "lucide-react";
import type { Endpoint, Source } from "@/db/schema";
import { PageHeader } from "@/components/PageHeader";
import { MethodBadge } from "@/components/MethodBadge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Badge } from "@/components/ds/Badge";
import { Switch } from "@/components/ds/Switch";
import { Table, Th, Td, Mono } from "@/components/ds/Table";
import {
  deleteEndpoint,
  deleteSource,
  toggleEndpoint,
} from "@/lib/actions";
import { SourceFormModal } from "./SourceFormModal";
import { EndpointFormModal } from "./EndpointFormModal";

export type SourceWithEndpoints = Source & { endpoints: Endpoint[] };

const AUTH_LABELS: Record<string, string> = {
  none: "No auth",
  bearer: "Bearer",
  api_key: "API Key",
  basic: "Basic",
  oauth2: "OAuth 2.0",
};

export function SourcesView({ sources }: { sources: SourceWithEndpoints[] }) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<SourceWithEndpoints | null>(null);
  const [addingEndpointTo, setAddingEndpointTo] = React.useState<SourceWithEndpoints | null>(null);
  const [, startTransition] = React.useTransition();

  return (
    <div>
      <PageHeader
        eyebrow="Sources"
        title="Your source APIs"
        description="Register the APIs that will be turned into MCP tools. Import an OpenAPI spec or define the endpoints manually."
        action={
          <Button iconLeft={<Plus size={16} />} onClick={() => setCreating(true)}>
            New source
          </Button>
        }
      />

      {sources.length === 0 && (
        <Card tone="muted" style={{ textAlign: "center", padding: "var(--space-16)" }}>
          <Database size={32} strokeWidth={1.5} style={{ margin: "0 auto 12px", color: "var(--text-faint)" }} />
          <h3 style={{ font: "var(--type-h3)", marginBottom: 8 }}>No sources yet</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            Start by importing an OpenAPI spec or registering your first API.
          </p>
          <Button iconLeft={<Plus size={16} />} onClick={() => setCreating(true)}>
            New source
          </Button>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {sources.map((source) => (
          <Card key={source.id} padding={0}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "var(--space-5) var(--space-6)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{ font: "var(--type-h3)" }}>{source.name}</h3>
                  <Badge tone="neutral">{AUTH_LABELS[source.authType] || source.authType}</Badge>
                  <Badge tone="brand">
                    {source.endpoints.length} endpoint{source.endpoints.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <Mono style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{source.baseUrl}</Mono>
                {source.description && (
                  <p style={{ font: "var(--type-body-sm)", color: "var(--text-muted)", marginTop: 4 }}>
                    {source.description}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Plus size={14} />}
                  onClick={() => setAddingEndpointTo(source)}
                >
                  Endpoint
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Pencil size={14} />}
                  onClick={() => setEditing(source)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Trash2 size={14} />}
                  style={{ color: "var(--error-500)" }}
                  onClick={() => {
                    if (confirm(`Delete source "${source.name}" and all its endpoints?`)) {
                      startTransition(async () => {
                        await deleteSource(source.id);
                      });
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>

            {source.endpoints.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th style={{ width: 90 }}>Method</Th>
                    <Th>Path</Th>
                    <Th>Name</Th>
                    <Th style={{ width: 90 }}>Params</Th>
                    <Th style={{ width: 80 }}>Active</Th>
                    <Th style={{ width: 50 }} />
                  </tr>
                </thead>
                <tbody>
                  {source.endpoints.map((ep) => {
                    const paramCount = ep.paramsSchema ? JSON.parse(ep.paramsSchema).length : 0;
                    return (
                      <tr key={ep.id}>
                        <Td>
                          <MethodBadge method={ep.method} />
                        </Td>
                        <Td>
                          <Mono>{ep.path}</Mono>
                        </Td>
                        <Td style={{ maxWidth: 280 }}>
                          <span
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={ep.description || ep.name}
                          >
                            {ep.name}
                          </span>
                        </Td>
                        <Td>{paramCount}</Td>
                        <Td>
                          <Switch
                            checked={ep.enabled}
                            onChange={(v) =>
                              startTransition(async () => {
                                await toggleEndpoint(ep.id, v);
                              })
                            }
                          />
                        </Td>
                        <Td>
                          <button
                            type="button"
                            aria-label="Delete endpoint"
                            onClick={() => {
                              if (confirm(`Delete endpoint ${ep.method} ${ep.path}?`)) {
                                startTransition(async () => {
                                  await deleteEndpoint(ep.id);
                                });
                              }
                            }}
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              color: "var(--text-faint)",
                              display: "flex",
                              padding: 4,
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <p style={{ padding: "var(--space-5) var(--space-6)", color: "var(--text-muted)", font: "var(--type-body-sm)" }}>
                No endpoints yet. Add one manually.
              </p>
            )}
          </Card>
        ))}
      </div>

      {creating && <SourceFormModal open onClose={() => setCreating(false)} />}
      {editing && (
        <SourceFormModal open onClose={() => setEditing(null)} source={editing} />
      )}
      {addingEndpointTo && (
        <EndpointFormModal
          open
          onClose={() => setAddingEndpointTo(null)}
          source={addingEndpointTo}
        />
      )}
    </div>
  );
}
