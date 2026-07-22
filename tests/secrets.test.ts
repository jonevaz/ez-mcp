import { describe, it, expect } from "vitest";

process.env.EZ_MCP_SECRET_KEY = "test-key-not-a-real-secret";

const {
  encryptAuthConfig,
  decryptAuthConfig,
  maskAuthConfig,
  mergeSecrets,
  safeEqual,
  SECRET_PLACEHOLDER,
} = await import("@/lib/secrets");

describe("auth config encryption", () => {
  it("round-trips a config", () => {
    const stored = encryptAuthConfig(JSON.stringify({ token: "abc123" }));
    expect(stored).not.toBeNull();
    expect(stored).not.toContain("abc123");
    expect(decryptAuthConfig(stored)).toEqual({ token: "abc123" });
  });

  it("uses a fresh IV so identical secrets do not produce identical ciphertext", () => {
    const a = encryptAuthConfig(JSON.stringify({ token: "same" }));
    const b = encryptAuthConfig(JSON.stringify({ token: "same" }));
    expect(a).not.toBe(b);
  });

  it("still reads rows written before encryption existed", () => {
    expect(decryptAuthConfig('{"token":"legacy"}')).toEqual({ token: "legacy" });
  });

  it("returns an empty config instead of throwing on tampered data", () => {
    const stored = encryptAuthConfig(JSON.stringify({ token: "abc" }))!;
    const tampered = stored.slice(0, -4) + "AAAA";
    expect(decryptAuthConfig(tampered)).toEqual({});
  });
});

describe("masking for the browser", () => {
  it("replaces every secret field with a placeholder", () => {
    const stored = encryptAuthConfig(
      JSON.stringify({
        header: "X-API-Key",
        value: "super-secret",
        password: "pw",
        clientSecret: "cs",
        token: "tok",
      })
    );
    const masked = maskAuthConfig(stored);
    expect(masked).toEqual({
      header: "X-API-Key",
      value: SECRET_PLACEHOLDER,
      password: SECRET_PLACEHOLDER,
      clientSecret: SECRET_PLACEHOLDER,
      token: SECRET_PLACEHOLDER,
    });
    expect(JSON.stringify(masked)).not.toContain("super-secret");
  });

  it("keeps `env:` references visible, since they are not secrets", () => {
    const stored = encryptAuthConfig(JSON.stringify({ token: "env:MY_TOKEN" }));
    expect(maskAuthConfig(stored).token).toBe("env:MY_TOKEN");
  });
});

describe("mergeSecrets", () => {
  it("keeps the stored secret when the form returns the placeholder untouched", () => {
    const stored = encryptAuthConfig(JSON.stringify({ token: "original" }));
    expect(mergeSecrets({ token: SECRET_PLACEHOLDER }, stored)).toEqual({ token: "original" });
  });

  it("takes the new value when the field was actually edited", () => {
    const stored = encryptAuthConfig(JSON.stringify({ token: "original" }));
    expect(mergeSecrets({ token: "rotated" }, stored)).toEqual({ token: "rotated" });
  });

  it("drops the placeholder when there is nothing stored to fall back to", () => {
    expect(mergeSecrets({ token: SECRET_PLACEHOLDER }, null)).toEqual({});
  });
});

describe("safeEqual", () => {
  it("matches identical strings and rejects everything else", () => {
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true);
    expect(safeEqual("Bearer abc", "Bearer abd")).toBe(false);
    expect(safeEqual("short", "much longer string")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
