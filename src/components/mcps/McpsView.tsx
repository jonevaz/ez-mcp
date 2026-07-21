"use client";

import React from "react";
import Link from "next/link";
import { Plus, Trash2, Server, ChevronRight } from "lucide-react";
import type { Mcp } from "@/db/schema";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Badge } from "@/components/ds/Badge";
import { Table, Th, Td, Mono } from "@/components/ds/Table";
import { deleteMcp } from "@/lib/actions";
import { McpFormModal } from "./McpFormModal";

type McpRow = Mcp & { toolCount: number };

export function McpsView({ mcps }: { mcps: McpRow[] }) {
  const [creating, setCreating] = React.useState(false);
  const [, startTransition] = React.useTransition();

  return (
    <div>
      <PageHeader
        eyebrow="MCPs"
        title="Seus MCP servers"
        description="Agrupe endpoints das suas fontes em MCP servers e publique para consumir no Claude Code, Cursor e outros agentes."
        action={
          <Button iconLeft={<Plus size={16} />} onClick={() => setCreating(true)}>
            Novo MCP
          </Button>
        }
      />

      {mcps.length === 0 ? (
        <Card tone="muted" style={{ textAlign: "center", padding: "var(--space-16)" }}>
          <Server size={32} strokeWidth={1.5} style={{ margin: "0 auto 12px", color: "var(--text-faint)" }} />
          <h3 style={{ font: "var(--type-h3)", marginBottom: 8 }}>Nenhum MCP criado</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            Crie seu primeiro MCP server e selecione as tools a partir das suas fontes.
          </p>
          <Button iconLeft={<Plus size={16} />} onClick={() => setCreating(true)}>
            Novo MCP
          </Button>
        </Card>
      ) : (
        <Card padding={0}>
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Slug</Th>
                <Th style={{ width: 90 }}>Tools</Th>
                <Th style={{ width: 120 }}>Status</Th>
                <Th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {mcps.map((mcp) => (
                <tr key={mcp.id}>
                  <Td>
                    <Link
                      href={`/mcps/${mcp.id}`}
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        color: "var(--text-strong)",
                      }}
                    >
                      {mcp.name}
                    </Link>
                    {mcp.description && (
                      <p style={{ font: "var(--type-body-sm)", color: "var(--text-muted)" }}>
                        {mcp.description}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <Mono>{mcp.slug}</Mono>
                  </Td>
                  <Td>{mcp.toolCount}</Td>
                  <Td>
                    {mcp.published ? (
                      <Badge tone="success">Publicado</Badge>
                    ) : (
                      <Badge tone="neutral">Rascunho</Badge>
                    )}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        aria-label="Excluir MCP"
                        onClick={() => {
                          if (confirm(`Excluir o MCP "${mcp.name}"?`)) {
                            startTransition(async () => {
                              await deleteMcp(mcp.id);
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
                      <Link
                        href={`/mcps/${mcp.id}`}
                        aria-label="Abrir MCP"
                        style={{ display: "flex", color: "var(--text-faint)" }}
                      >
                        <ChevronRight size={17} />
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {creating && <McpFormModal open onClose={() => setCreating(false)} />}
    </div>
  );
}
