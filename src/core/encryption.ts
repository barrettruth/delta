import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function getEncryptionKey(): string {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY environment variable is not set",
    );
  }
  if (key.length !== 64) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }
  return key;
}

export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = Buffer.from(key, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

export function decrypt(encrypted: string, key: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }

  const [ivHex, ciphertextHex, authTagHex] = parts;
  const keyBuffer = Buffer.from(key, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
