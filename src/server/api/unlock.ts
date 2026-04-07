import { corsHeaders } from "./shared.ts";
import { unlock, lock, isUnlocked, needsUnlock } from "../../lib/keystore.ts";

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
