import { corsHeaders } from "../shared.ts";
import {
  proposeSafeMessage,
  getSafeMessageStatus,
  type SafeMessageStatus,
} from "../../../lib/safe-message.ts";
import type { SafeChain } from "../../../lib/safe.ts";
import { normalizeIban } from "./utils.ts";

// Monerium requires the order-message timestamp in RFC3339 format accurate to
// the MINUTE (no seconds), e.g. "2024-07-12T12:02Z", within 5 minutes of now.
// Monerium normalizes the timestamp to minute precision before recomputing the
// message hash it verifies, so a timestamp with seconds yields a different hash
// than what was signed -> EIP-1271 "address mismatch".
// https://docs.monerium.com/whitelabel/#signing-an-order

/** Format a Date as an RFC3339 minute-precision UTC timestamp (no seconds). */
function minuteTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 16)}Z`;
}

/**
 * Build the exact (frozen) Monerium order message. The timestamp must stay
 * identical between signature collection and final submission, so callers build
 * it once and pass it back verbatim.
 */
export function buildOrderMessage(amount: number | string, iban: string): string {
  // Use the normalized IBAN (no spaces) so the signed message matches the
  // canonical order details.
  return `Send EUR ${amount} to ${normalizeIban(iban)} at ${minuteTimestamp(
    new Date()
  )}`;
}

function chainForEnvironment(environment?: string): SafeChain {
  return environment === "production" ? "gnosis" : "chiado";
}

function errorResponse(error: unknown, status = 500): Response {
  const message =
    error instanceof Error ? error.message : "Internal server error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders,
  });
}

function statusResponse(status: SafeMessageStatus): Response {
  return new Response(JSON.stringify(status), {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * POST /api/monerium/safe-message
 * Sign a Monerium order message with the server key and, for multisig Safes,
 * propose it to the Safe Transaction Service. Returns the signature status.
 *
 * Body: { amount, iban, accountAddress, environment, message? }
 * If `message` is omitted a fresh one (with current timestamp) is built and
 * returned in the response so the client can reuse it for submission.
 */
export async function handleSafeMessagePropose(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(new Error("Method not allowed"), 405);
  }
  try {
    const body = await req.json();
    const { amount, iban, accountAddress, environment } = body;
    if (!accountAddress || (!body.message && (amount == null || !iban))) {
      return errorResponse(
        new Error(
          "Missing required fields: accountAddress and either message or (amount, iban)"
        ),
        400
      );
    }

    const message: string = body.message || buildOrderMessage(amount, iban);
    const chain = chainForEnvironment(environment);

    try {
      const status = await proposeSafeMessage(message, accountAddress, chain);
      return statusResponse(status);
    } catch (error) {
      // Surface a locked keystore as 423 so the UI can prompt for the passphrase.
      if (
        error instanceof Error &&
        error.message.includes("Signing key not available")
      ) {
        return errorResponse(error, 423);
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/monerium/safe-message/status
 * Poll the Safe Transaction Service for the current signature count of a
 * previously proposed message.
 *
 * Body: { message, accountAddress, environment }
 */
export async function handleSafeMessageStatus(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(new Error("Method not allowed"), 405);
  }
  try {
    const body = await req.json();
    const { message, accountAddress, environment } = body;
    if (!message || !accountAddress) {
      return errorResponse(
        new Error("Missing required fields: message, accountAddress"),
        400
      );
    }
    const chain = chainForEnvironment(environment);
    const status = await getSafeMessageStatus(message, accountAddress, chain);
    return statusResponse(status);
  } catch (error) {
    return errorResponse(error);
  }
}
