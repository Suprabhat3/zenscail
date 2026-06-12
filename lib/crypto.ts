import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// AES-256-GCM for BYOK API keys at rest. Key derived from APP_SECRET.
// Stored format: base64(iv).base64(tag).base64(ciphertext)

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("Missing required environment variable: APP_SECRET");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, ciphertext] = stored.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
