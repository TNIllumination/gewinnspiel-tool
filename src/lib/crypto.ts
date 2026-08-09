import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM fuer Plattform-Tokens und Versanddaten der Gewinner.
// Format: v1.<iv-base64>.<authTag-base64>.<ciphertext-base64>
// Das Praefix erlaubt spaeteren Schluesselwechsel ohne Datenverlust.

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY fehlt. Erzeugen mit: openssl rand -base64 32",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY muss 32 Byte (base64) sein, ist aber ${buf.length}. Erzeugen mit: openssl rand -base64 32`,
    );
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    enc.toString("base64"),
  ].join(".");
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Verschluesselter Wert hat ein unbekanntes Format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/// Verschluesselt nur, wenn ein Wert vorhanden ist.
export function encryptOptional(value: string | null | undefined) {
  return value ? encrypt(value) : null;
}

export function decryptOptional(value: string | null | undefined) {
  return value ? decrypt(value) : null;
}
