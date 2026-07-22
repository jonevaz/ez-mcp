import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Source } from "@/db/schema";

/**
 * Credenciais das APIs de origem.
 *
 * **Modelo de ameaça.** A criptografia aqui protege contra o vazamento do
 * *arquivo* do banco — backup, cópia para outra máquina, `data/` commitado por
 * engano, volume compartilhado. Ela **não** protege contra quem tem acesso ao
 * host, porque a chave fica ao lado do banco (`data/.secret-key`). Para isso,
 * defina `EZ_MCP_SECRET_KEY` no ambiente e mantenha a chave fora do disco da
 * aplicação, ou use referências `env:` (ver `resolveEnvRefs`).
 */

/** Campos de `auth_config` que nunca devem sair do servidor em texto puro. */
const SECRET_FIELDS = new Set(["token", "value", "password", "clientSecret"]);

/**
 * Valor enviado ao browser no lugar de um segredo já gravado. Se voltar
 * inalterado no submit, o valor original é preservado.
 */
export const SECRET_PLACEHOLDER = "••••••••";

const KEY_FILE = ".secret-key";
const ENC_PREFIX = "v1.";

let cachedKey: Buffer | null = null;

/**
 * Chave AES-256. Vem de `EZ_MCP_SECRET_KEY` (base64 ou hex de 32 bytes) ou,
 * na ausência dela, de um arquivo gerado automaticamente em `data/`.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.EZ_MCP_SECRET_KEY;
  if (fromEnv) {
    // Aceita base64, hex ou passphrase livre (derivada por scrypt).
    const decoded = tryDecodeKey(fromEnv);
    cachedKey = decoded ?? crypto.scryptSync(fromEnv, "ez-mcp-auth-config", 32);
    return cachedKey;
  }

  const dataDir = path.join(process.cwd(), "data");
  const keyPath = path.join(dataDir, KEY_FILE);
  if (fs.existsSync(keyPath)) {
    cachedKey = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "base64");
    if (cachedKey.length === 32) return cachedKey;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString("base64"), { mode: 0o600 });
  cachedKey = key;
  return key;
}

function tryDecodeKey(raw: string): Buffer | null {
  for (const encoding of ["base64", "hex"] as const) {
    try {
      const buf = Buffer.from(raw, encoding);
      if (buf.length === 32) return buf;
    } catch {
      // tenta o próximo formato
    }
  }
  return null;
}

/** Criptografa o JSON de `auth_config` para gravação (AES-256-GCM). */
export function encryptAuthConfig(json: string | null): string | null {
  if (json === null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    ENC_PREFIX +
    [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".")
  );
}

/**
 * Descriptografa `auth_config`. Registros gravados antes da criptografia (JSON
 * puro) continuam legíveis, para não quebrar bancos existentes.
 */
export function decryptAuthConfig(stored: string | null): Record<string, unknown> {
  if (!stored) return {};

  if (!stored.startsWith(ENC_PREFIX)) {
    // Formato legado: JSON em texto puro.
    return parseJsonObject(stored);
  }

  const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(".");
  if (!ivB64 || !tagB64 || !dataB64) return {};
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return parseJsonObject(plaintext);
  } catch {
    // Chave trocada ou dado corrompido: melhor falhar a chamada com credencial
    // vazia do que derrubar a listagem inteira de fontes.
    return {};
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Credenciais prontas para uso: descriptografadas e com referências `env:`
 * resolvidas. Só deve ser chamada no caminho de execução da tool.
 */
export function readAuthConfig(source: Source): Record<string, unknown> {
  return resolveEnvRefs(decryptAuthConfig(source.authConfig));
}

/**
 * Troca valores no formato `env:NOME_DA_VAR` pelo conteúdo da variável de
 * ambiente. Permite manter o segredo fora do banco inteiramente.
 */
function resolveEnvRefs(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.startsWith("env:")) {
      out[key] = process.env[value.slice(4)] ?? "";
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Versão de `auth_config` segura para renderizar no browser: segredos viram
 * placeholder. Referências `env:` são preservadas, porque não são segredo.
 */
export function maskAuthConfig(stored: string | null): Record<string, unknown> {
  const config = decryptAuthConfig(stored);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_FIELDS.has(key) && typeof value === "string" && value.length > 0) {
      out[key] = value.startsWith("env:") ? value : SECRET_PLACEHOLDER;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Mescla o que veio do formulário com o que já estava gravado: campos secretos
 * devolvidos como placeholder mantêm o valor anterior.
 */
export function mergeSecrets(
  submitted: Record<string, unknown>,
  storedRaw: string | null
): Record<string, unknown> {
  const stored = decryptAuthConfig(storedRaw);
  const out: Record<string, unknown> = { ...submitted };
  for (const key of SECRET_FIELDS) {
    if (out[key] === SECRET_PLACEHOLDER) {
      if (stored[key] !== undefined) out[key] = stored[key];
      else delete out[key];
    }
  }
  return out;
}

/** Comparação de strings em tempo constante, para tokens de acesso. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
