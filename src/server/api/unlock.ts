import { corsHeaders } from "./shared.ts";
import { unlock, lock, isUnlocked, needsUnlock, getPrivateKey } from "../../lib/keystore.ts";
import { privateKeyToAccount } from "viem/accounts";

/** GET /api/unlock — returns the current lock status. */
export async function handleUnlockStatusRequest(): Promise<Response> {
  return new Response(
    JSON.stringify({
      locked: !isUnlocked(),
      needsUnlock: needsUnlock(),
    }),
    { status: 200, headers: corsHeaders }
  );
}

/** POST /api/unlock — decrypt the private key with the submitted passphrase. */
export async function handleUnlockRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (!needsUnlock()) {
    return new Response(
      JSON.stringify({
        error: isUnlocked()
          ? "Already unlocked"
          : "No PRIVATE_KEY_ENCRYPTED configured",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  let body: { passphrase?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!body.passphrase) {
    return new Response(
      JSON.stringify({ error: "passphrase is required" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const success = await unlock(body.passphrase);

  if (!success) {
    return new Response(
      JSON.stringify({ error: "Wrong passphrase" }),
      { status: 403, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: corsHeaders }
  );
}

/** POST /api/lock — clear the decrypted key from memory. */
export async function handleLockRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  lock();
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: corsHeaders }
  );
}

/**
 * POST /api/unlock/verify — verify a passphrase and keep the server unlocked.
 * Decrypts the key to derive the wallet address and confirm validity.
 * The passphrase is stored in memory for on-demand decryption during signing.
 * Returns { ok, address } or { ok: false, error }.
 */
export async function handleVerifyPassphraseRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (!process.env.PRIVATE_KEY_ENCRYPTED) {
    return new Response(
      JSON.stringify({ ok: false, error: "No PRIVATE_KEY_ENCRYPTED configured" }),
      { status: 400, headers: corsHeaders }
    );
  }

  let body: { passphrase?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!body.passphrase) {
    return new Response(
      JSON.stringify({ ok: false, error: "passphrase is required" }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Temporarily unlock to verify
  const success = await unlock(body.passphrase);
  if (!success) {
    return new Response(
      JSON.stringify({ ok: false, error: "Wrong passphrase" }),
      { status: 200, headers: corsHeaders }
    );
  }

  // Derive address to confirm the key is valid
  let address: string | null = null;
  try {
    let key = (await getPrivateKey())!;
    if (!key.startsWith("0x")) key = `0x${key}`;
    const account = privateKeyToAccount(key as `0x${string}`);
    address = account.address;
  } catch {
    lock();
    return new Response(
      JSON.stringify({ ok: false, error: "Decrypted key is not a valid private key" }),
      { status: 200, headers: corsHeaders }
    );
  }

  // Passphrase stays in memory — getPrivateKey() will decrypt on demand for signing

  return new Response(
    JSON.stringify({ ok: true, address }),
    { status: 200, headers: corsHeaders }
  );
}
