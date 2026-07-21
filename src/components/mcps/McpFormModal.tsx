"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { Mcp } from "@/db/schema";
import { Modal } from "@/components/ds/Modal";
import { Input } from "@/components/ds/Input";
import { Textarea } from "@/components/ds/Textarea";
import { Button } from "@/components/ds/Button";
import { createMcp, updateMcp } from "@/lib/actions";

export function McpFormModal({
  open,
  onClose,
  mcp,
}: {
  open: boolean;
  onClose: () => void;
  mcp?: Mcp | null;
}) {
  const isEdit = Boolean(mcp);
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = mcp ? await updateMcp(mcp.id, formData) : await createMcp(formData);
    setPending(false);
    if (result.ok) {
      onClose();
      if (!mcp && result.id) router.push(`/mcps/${result.id}`);
    } else {
      setError(result.error || "Something went wrong.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit MCP" : "New MCP"}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input
          label="Name"
          name="name"
          required
          defaultValue={mcp?.name || ""}
          placeholder="E.g.: Customers MCP"
        />
        <Input
          label="Slug (optional)"
          name="slug"
          defaultValue={mcp?.slug || ""}
          placeholder="generated from the name"
          hint="Defines the public URL: /api/mcp/<slug>"
        />
        <Textarea
          label="Description (optional)"
          name="description"
          rows={3}
          defaultValue={mcp?.description || ""}
          placeholder="What this MCP offers to agents"
        />
        {error && (
          <p style={{ font: "var(--type-body-sm)", color: "var(--error-500)" }}>{error}</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save" : "Create MCP"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
