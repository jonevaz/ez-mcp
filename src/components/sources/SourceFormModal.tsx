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
        label="API authentication"
        name="authType"
        value={authType}
        onChange={(e) => setAuthType(e.target.value)}
      >
        <option value="none">No authentication</option>
        <option value="bearer">Bearer token</option>
        <option value="api_key">API Key (header)</option>
        <option value="basic">Basic (username and password)</option>
        <option value="oauth2">OAuth 2.0 (client credentials)</option>
      </Select>
      {authType === "bearer" && (
        <Input
          label="Token"
          name="authToken"
          defaultValue={config.token || ""}
          placeholder="access token for the source API"
        />
      )}
      {authType === "api_key" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Header" name="authHeader" defaultValue={config.header || "X-API-Key"} />
          <Input label="Value" name="authValue" defaultValue={config.value || ""} />
        </div>
      )}
      {authType === "basic" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Username" name="authUsername" defaultValue={config.username || ""} />
          <Input
            label="Password"
            name="authPassword"
            type="password"
            defaultValue={config.password || ""}
          />
        </div>
      )}
      {authType === "oauth2" && (
        <>
          <Input
            label="Token URL"
            name="authTokenUrl"
            defaultValue={config.tokenUrl || ""}
            placeholder="https://auth.example.com/oauth/token"
            hint="Client Credentials flow — the token is fetched server-side and cached until it expires."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Client ID" name="authClientId" defaultValue={config.clientId || ""} />
            <Input
              label="Client Secret"
              name="authClientSecret"
              type="password"
              defaultValue={config.clientSecret || ""}
            />
          </div>
          <Input
            label="Scope (optional)"
            name="authScope"
            defaultValue={config.scope || ""}
            placeholder="read write"
          />
        </>
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
    else setError(result.error || "Something went wrong.");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit source" : "New source"}
      width={620}
    >
      {!isEdit && (
        <Tabs
          items={[
            { value: "import", label: "Import OpenAPI" },
            { value: "manual", label: "Manual setup" },
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
              label="OpenAPI spec URL"
              name="specUrl"
              placeholder="https://api.example.com/openapi.json"
              hint="JSON or YAML. Alternatively, paste the content below."
            />
            <Textarea
              label="Or paste the spec"
              name="specText"
              rows={5}
              placeholder='{"openapi": "3.0.0", ...}'
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Name (optional)" name="name" placeholder="uses the spec title" />
              <Input
                label="Base URL (optional)"
                name="baseUrl"
                placeholder="uses the spec's servers[]"
              />
            </div>
          </>
        )}

        {(isEdit || tab === "manual") && (
          <>
            <Input
              label="Name"
              name="name"
              required
              defaultValue={source?.name || ""}
              placeholder="E.g.: Customers API"
            />
            <Input
              label="Base URL"
              name="baseUrl"
              required
              defaultValue={source?.baseUrl || ""}
              placeholder="https://api.example.com/v1"
            />
            <Textarea
              label="Description (optional)"
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
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save" : tab === "import" ? "Import" : "Create source"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
