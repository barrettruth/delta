import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt, getEncryptionKey } from "@/core/encryption";

const TEST_KEY = randomBytes(32).toString("hex");

describe("getEncryptionKey", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the key when valid", () => {
    expect(getEncryptionKey()).toBe(TEST_KEY);
  });

  it("throws when env var is missing", () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "");
    expect(() => getEncryptionKey()).toThrow("not set");
  });

  it("throws when key is wrong length", () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "abcd1234");
    expect(() => getEncryptionKey()).toThrow("64-character hex string");
  });
});

describe("encrypt / decrypt", () => {
  it("round-trips plaintext", () => {
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("round-trips JSON objects", () => {
    const obj = { access_token: "tok_abc", refresh_token: "ref_xyz" };
    const plaintext = JSON.stringify(obj);
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(JSON.parse(decrypted)).toEqual(obj);
  });

  it("round-trips empty string", () => {
    const encrypted = encrypt("", TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe("");
  });

  it("round-trips unicode content", () => {
    const plaintext = "日本語テスト 🔐";
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "same input";
    const a = encrypt(plaintext, TEST_KEY);
    const b = encrypt(plaintext, TEST_KEY);
    expect(a).not.toBe(b);
    expect(decrypt(a, TEST_KEY)).toBe(plaintext);
    expect(decrypt(b, TEST_KEY)).toBe(plaintext);
  });

  it("different plaintexts produce different ciphertexts", () => {
    const a = encrypt("alpha", TEST_KEY);
    const b = encrypt("bravo", TEST_KEY);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with wrong key", () => {
    const encrypted = encrypt("secret", TEST_KEY);
    const wrongKey = randomBytes(32).toString("hex");
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const encrypted = encrypt("secret", TEST_KEY);
    const parts = encrypted.split(":");
    const ctLast2 = parts[1].slice(-2);
    const tampered = `${parts[1].slice(0, -2)}${ctLast2 === "ff" ? "00" : "ff"}`;
    const tamperedStr = `${parts[0]}:${tampered}:${parts[2]}`;
    expect(() => decrypt(tamperedStr, TEST_KEY)).toThrow();
  });

  it("fails to decrypt tampered auth tag", () => {
    const encrypted = encrypt("secret", TEST_KEY);
    const parts = encrypted.split(":");
    const tagLast2 = parts[2].slice(-2);
    const tamperedTag = `${parts[2].slice(0, -2)}${tagLast2 === "ff" ? "00" : "ff"}`;
    const tamperedStr = `${parts[0]}:${parts[1]}:${tamperedTag}`;
    expect(() => decrypt(tamperedStr, TEST_KEY)).toThrow();
  });

  it("fails on invalid format", () => {
    expect(() => decrypt("not:valid", TEST_KEY)).toThrow(
      "Invalid encrypted format",
    );
  });
});
