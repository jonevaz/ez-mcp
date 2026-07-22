import type { Source } from "@/db/schema";
import { maskAuthConfig } from "@/lib/secrets";

/**
 * Fonte no formato que vai para o browser.
 *
 * `authConfig` (credenciais) e `specRaw` (a spec inteira, que pode ter megabytes)
 * ficam no servidor. O formulário recebe só os campos não-secretos mais um
 * placeholder no lugar de cada segredo.
 */
export type ClientSource = Omit<Source, "authConfig" | "specRaw"> & {
  authConfigMasked: Record<string, unknown>;
  hasSpec: boolean;
};

export function toClientSource(source: Source): ClientSource {
  const { authConfig, specRaw, ...rest } = source;
  return {
    ...rest,
    authConfigMasked: maskAuthConfig(authConfig),
    hasSpec: Boolean(specRaw),
  };
}
