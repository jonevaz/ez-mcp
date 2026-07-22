"use client";

import React from "react";
import type { ClientSource } from "@/lib/source-dto";
import { Modal } from "@/components/ds/Modal";
import { Tabs } from "@/components/ds/Tabs";
import { Input } from "@/components/ds/Input";
import { Textarea } from "@/components/ds/Textarea";
import { Select } from "@/components/ds/Select";
import { Button } from "@/components/ds/Button";
import { createSource, importOpenApi, updateSource } from "@/lib/actions";

/**
 * Dica mostrada nos campos secretos. Segredos já gravados chegam aqui como
 * placeholder (`••••••••`) e são preservados se o campo não for editado.
 */
const SECRET_HINT = "Leave unchanged to keep the stored value. Use `env:VAR_NAME` to read it from the environment instead.";

/** Campos de autenticação compartilhados entre os modos manual e import. */
function AuthFields({
  authType,
  setAuthType,
  source,
}: {
  authType: string;
  setAuthType: (v: string) => void;
  source?: ClientSource | null;
}) {
  // Segredos nunca chegam ao browser em texto puro — ver lib/secrets.
  const config = (source?.authConfigMasked ?? {}) as Record<string, string>;
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
          hint={SECRET_HINT}
        />
      )}
      {authType === "api_key" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Header" name="authHeader" defaultValue={config.header || "X-API-Key"} />
          <Input
            label="Value"
            name="authValue"
            defaultValue={config.value || ""}
            hint={SECRET_HINT}
          />
        </div>
      )}
      {authType === "basic" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Username" name="authUsername" defaultValue={config.username || ""} />
          <Input
            label="Password"
            name="authPassword"
            defaultValue={config.password || ""}
            hint={SECRET_HINT}
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
              defaultValue={config.clientSecret || ""}
              hint={SECRET_HINT}
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
  source?: ClientSource | null;
}) {
  const isEdit = Boolean(source);
  const [tab, setTab] = React.useState<string>(isEdit ? "manual" : "import");
  const [authType, setAuthType] = React.useState(source?.authType || "none");
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
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

    if (!result.ok) {
      setError(result.error || "Something went wrong.");
      return;
    }
    // A fonte já foi criada. Se partes da spec não puderam ser interpretadas,
    // mostramos o que ficou de fora em vez de fechar como se estivesse perfeito.
    if (result.warnings?.length) {
      setWarnings(result.warnings);
      return;
    }
    onClose();
  }

  if (warnings.length > 0) {
    return (
      <Modal open={open} onClose={onClose} title="Imported with warnings" width={620}>
        <p style={{ font: "var(--type-body-sm)", marginBottom: "var(--space-4)" }}>
          The source was created, but parts of the spec could not be fully interpreted.
          Tools for the affected operations may be missing parameters — review them before
          publishing.
        </p>
        <ul
          style={{
            font: "var(--type-body-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            paddingLeft: "1.2em",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-6)" }}>
          <Button onClick={onClose}>Got it</Button>
        </div>
      </Modal>
    );
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
            { value: "import", label: "Import OpenAPI / Swagger" },
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
              label="OpenAPI or Swagger spec URL"
              name="specUrl"
              placeholder="https://api.example.com/openapi.json"
              hint="JSON or YAML. We auto-detect OpenAPI 3.x or Swagger 2.0, and if the URL points to a docs page instead of the raw spec, we try to locate it automatically."
            />
            <Textarea
              label="Or paste the spec"
              name="specText"
              rows={5}
              placeholder='{"openapi": "3.0.0", ...} or {"swagger": "2.0", ...}'
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
