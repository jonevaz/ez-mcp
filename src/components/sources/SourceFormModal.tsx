"use client";

import React from "react";
import type { Source } from "@/db/schema";
import { Modal } from "@/components/ds/Modal";
import { Tabs } from "@/components/ds/Tabs";
import { Input } from "@/components/ds/Input";
import { Textarea } from "@/components/ds/Textarea";
import { Select } from "@/components/ds/Select";
import { Button } from "@/components/ds/Button";
import { createSource, importOpenApi, updateSource } from "@/lib/actions";

/** Campos de autenticação compartilhados entre os modos manual e import. */
function AuthFields({
  authType,
  setAuthType,
  source,
}: {
  authType: string;
  setAuthType: (v: string) => void;
  source?: Source | null;
}) {
  const config = source?.authConfig ? JSON.parse(source.authConfig) : {};
  return (
    <>
      <Select
        label="Autenticação da API"
        name="authType"
        value={authType}
        onChange={(e) => setAuthType(e.target.value)}
      >
        <option value="none">Sem autenticação</option>
        <option value="bearer">Bearer token</option>
        <option value="api_key">API Key (header)</option>
        <option value="basic">Basic (usuário e senha)</option>
      </Select>
      {authType === "bearer" && (
        <Input
          label="Token"
          name="authToken"
          defaultValue={config.token || ""}
          placeholder="token de acesso à API de origem"
        />
      )}
      {authType === "api_key" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Header" name="authHeader" defaultValue={config.header || "X-API-Key"} />
          <Input label="Valor" name="authValue" defaultValue={config.value || ""} />
        </div>
      )}
      {authType === "basic" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Usuário" name="authUsername" defaultValue={config.username || ""} />
          <Input
            label="Senha"
            name="authPassword"
            type="password"
            defaultValue={config.password || ""}
          />
        </div>
      )}
    </>
  );
}

export function SourceFormModal({
  open,
  onClose,
  source,
}: {
  open: boolean;
  onClose: () => void;
  source?: Source | null;
}) {
  const isEdit = Boolean(source);
  const [tab, setTab] = React.useState<string>(isEdit ? "manual" : "import");
  const [authType, setAuthType] = React.useState(source?.authType || "none");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = source
      ? await updateSource(source.id, formData)
      : tab === "import"
      ? await importOpenApi(formData)
      : await createSource(formData);
    setPending(false);
    if (result.ok) onClose();
    else setError(result.error || "Algo deu errado.");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar fonte" : "Nova fonte"}
      width={620}
    >
      {!isEdit && (
        <Tabs
          items={[
            { value: "import", label: "Importar OpenAPI" },
            { value: "manual", label: "Cadastro manual" },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: "var(--space-6)" }}
        />
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!isEdit && tab === "import" && (
          <>
            <Input
              label="URL da spec OpenAPI"
              name="specUrl"
              placeholder="https://api.exemplo.com/openapi.json"
              hint="JSON ou YAML. Alternativamente, cole o conteúdo abaixo."
            />
            <Textarea
              label="Ou cole a spec"
              name="specText"
              rows={5}
              placeholder='{"openapi": "3.0.0", ...}'
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Nome (opcional)" name="name" placeholder="usa o título da spec" />
              <Input
                label="URL base (opcional)"
                name="baseUrl"
                placeholder="usa o servers[] da spec"
              />
            </div>
          </>
        )}

        {(isEdit || tab === "manual") && (
          <>
            <Input
              label="Nome"
              name="name"
              required
              defaultValue={source?.name || ""}
              placeholder="Ex.: API de clientes"
            />
            <Input
              label="URL base"
              name="baseUrl"
              required
              defaultValue={source?.baseUrl || ""}
              placeholder="https://api.exemplo.com/v1"
            />
            <Textarea
              label="Descrição (opcional)"
              name="description"
              rows={2}
              defaultValue={source?.description || ""}
            />
          </>
        )}

        <AuthFields authType={authType} setAuthType={setAuthType} source={source} />

        {error && (
          <p style={{ font: "var(--type-body-sm)", color: "var(--error-500)" }}>{error}</p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : isEdit ? "Salvar" : tab === "import" ? "Importar" : "Criar fonte"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
