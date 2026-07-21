"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { EndpointParam, Source } from "@/db/schema";
import { Modal } from "@/components/ds/Modal";
import { Input } from "@/components/ds/Input";
import { Select } from "@/components/ds/Select";
import { Checkbox } from "@/components/ds/Checkbox";
import { Button } from "@/components/ds/Button";
import { createEndpoint } from "@/lib/actions";

const EMPTY_PARAM: EndpointParam = {
  name: "",
  in: "query",
  type: "string",
  required: false,
  description: "",
};

export function EndpointFormModal({
  open,
  onClose,
  source,
}: {
  open: boolean;
  onClose: () => void;
  source: Source | null;
}) {
  const [params, setParams] = React.useState<EndpointParam[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function setParam(index: number, patch: Partial<EndpointParam>) {
    setParams((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!source) return;
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("paramsJson", JSON.stringify(params.filter((p) => p.name.trim())));
    const result = await createEndpoint(source.id, formData);
    setPending(false);
    if (result.ok) onClose();
    else setError(result.error || "Algo deu errado.");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Novo endpoint — ${source?.name ?? ""}`}
      width={680}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
          <Select label="Método" name="method" defaultValue="GET">
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </Select>
          <Input
            label="Path"
            name="path"
            required
            placeholder="/users/{id}"
            hint="Parâmetros de path entre chaves: /users/{id}"
          />
        </div>
        <Input label="Nome (opcional)" name="name" placeholder="Ex.: Buscar usuário por id" />
        <Input
          label="Descrição (opcional)"
          name="description"
          placeholder="O que este endpoint faz — vira a descrição da tool"
        />

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ font: "var(--type-label)", color: "var(--text-strong)" }}>
              Parâmetros
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Plus size={14} />}
              onClick={() => setParams((prev) => [...prev, { ...EMPTY_PARAM }])}
            >
              Adicionar
            </Button>
          </div>

          {params.length === 0 && (
            <p style={{ font: "var(--type-body-sm)", color: "var(--text-muted)" }}>
              Nenhum parâmetro. Adicione parâmetros de path, query, header ou body.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {params.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 110px 110px auto auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Input
                  aria-label="Nome do parâmetro"
                  placeholder="nome"
                  value={p.name}
                  onChange={(e) => setParam(i, { name: e.target.value })}
                />
                <Select
                  aria-label="Local"
                  value={p.in}
                  onChange={(e) => setParam(i, { in: e.target.value as EndpointParam["in"] })}
                >
                  <option value="path">path</option>
                  <option value="query">query</option>
                  <option value="header">header</option>
                  <option value="body">body</option>
                </Select>
                <Select
                  aria-label="Tipo"
                  value={p.type}
                  onChange={(e) => setParam(i, { type: e.target.value as EndpointParam["type"] })}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="integer">integer</option>
                  <option value="boolean">boolean</option>
                  <option value="object">object</option>
                  <option value="array">array</option>
                </Select>
                <Checkbox
                  checked={p.required}
                  onChange={(v) => setParam(i, { required: v })}
                  label={<span style={{ fontSize: 13 }}>obrig.</span>}
                />
                <button
                  type="button"
                  aria-label="Remover parâmetro"
                  onClick={() => setParams((prev) => prev.filter((_, j) => j !== i))}
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
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ font: "var(--type-body-sm)", color: "var(--error-500)" }}>{error}</p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Criar endpoint"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
