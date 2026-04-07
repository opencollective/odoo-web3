/**
 * In-memory keystore for the server's signing private key.
 *
 * The private key is stored encrypted at rest (in the PRIVATE_KEY_ENCRYPTED env var).
 * The admin submits the passphrase once (via /api/unlock or onboarding).
 * The passphrase is kept in memory — the private key is decrypted on demand
 * for each signing operation and immediately discarded.
 * On process restart or explicit lock, the passphrase is wiped.
 *
 * Encryption: AES-256-GCM with a key derived from a passphrase via PBKDF2 (100k iterations).
 * Format: base64(salt):base64(iv):base64(ciphertext):base64(authTag)
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// Only the passphrase lives in memory — the private key is decrypted on demand
let storedPassphrase: string | null = null;

/**
 * Decrypt and return the private key on demand.
 * The key exists only for the duration of the caller's use — it is not cached.
 * Returns null if locked (no passphrase stored).
 */
export async function getPrivateKey(): Promise<string | null> {
  if (!storedPassphrase) return null;
  const encrypted = process.env.PRIVATE_KEY_ENCRYPTED;
  if (!encrypted) return null;
  try {
    return await decrypt(encrypted, storedPassphrase);
  } catch {
    return null;
  }
}

/** Whether the keystore has a passphrase and can decrypt on demand. */
export function isUnlocked(): boolean {
  return storedPassphrase !== null;
}

/** Whether an encrypted key is configured (and thus unlock is required). */
export function needsUnlock(): boolean {
  return !!process.env.PRIVATE_KEY_ENCRYPTED && storedPassphrase === null;
}

/** Lock the keystore (wipe the passphrase from memory). */
export function lock(): void {
  storedPassphrase = null;
}

/**
 * Verify the passphrase can decrypt PRIVATE_KEY_ENCRYPTED, then store it in memory.
 * Returns true on success.
 */
export async function unlock(passphrase: string): Promise<boolean> {
  const encrypted = process.env.PRIVATE_KEY_ENCRYPTED;
  if (!encrypted) {
    throw new Error("No PRIVATE_KEY_ENCRYPTED env var configured");
  }

  try {
    const decrypted = await decrypt(encrypted, passphrase);
    // Validate: should look like a hex private key (with or without 0x)
    const cleaned = decrypted.startsWith("0x") ? decrypted.slice(2) : decrypted;
    if (!/^[a-fA-F0-9]{64}$/.test(cleaned)) {
      throw new Error("Decrypted value is not a valid private key");
    }
    storedPassphrase = passphrase;
    return true;
  } catch {
    return false;
  }
}

// --- Crypto helpers (AES-256-GCM + PBKDF2) ---

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

/** Encrypt a plaintext string. Returns the packed format: salt:iv:ciphertext:tag */
export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // AES-GCM appends the 16-byte auth tag to the ciphertext
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, -16);
  const authTag = encryptedBytes.slice(-16);

  return [toBase64(salt), toBase64(iv), toBase64(ciphertext), toBase64(authTag)].join(":");
}

/** Decrypt a packed string (salt:iv:ciphertext:tag) with the passphrase. */
async function decrypt(packed: string, passphrase: string): Promise<string> {
  const parts = packed.split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted format");

  const [saltB64, ivB64, ciphertextB64, tagB64] = parts;
  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);
  const authTag = fromBase64(tagB64);

  const key = await deriveKey(passphrase, salt);

  // AES-GCM expects ciphertext + tag concatenated
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    combined
  );

  return new TextDecoder().decode(decrypted);
}
