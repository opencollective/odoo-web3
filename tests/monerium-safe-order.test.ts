// Reproduces, against the Monerium SANDBOX, that placing an order works for a
// 1-of-N Safe but is rejected for an M-of-N (e.g. 2-of-2) Safe — even though the
// aggregated signature verifies on-chain via EIP-1271 (isValidSignature).
//
// The ONLY difference between the two cases is the Safe threshold: identical
// message, identical EIP-712 signing, identical submission. This isolates the
// behaviour so it can be shared with Monerium support.
//
// Run as a test:   bun test tests/monerium-safe-order.test.ts
// Run as a script: bun run tests/monerium-safe-order.test.ts
//
// Required env (Chiado / Monerium sandbox; test skips if missing):
//   MONERIUM_CLIENT_ID, MONERIUM_CLIENT_SECRET   sandbox client credentials
//   TEST_SAFE_1OFN                               a 1-of-N Safe on Chiado linked to the Monerium account
//   TEST_SAFE_2OFN                               a 2-of-N Safe on Chiado linked to the Monerium account
//   TEST_OWNER_KEY_1                             owner private key (signs the 1-of-N, and 1st signer of the 2-of-N)
//   TEST_OWNER_KEY_2                             2nd owner private key of the 2-of-N Safe
//   TEST_IBAN                                    destination IBAN for the redeem order
//   TEST_COMPANY_NAME (optional)                 counterpart name (default "Test Co")
//   SAFE_RPC_URL (optional)                      Chiado RPC (default https://rpc.chiadochain.net)
import { test, expect } from "bun:test";
import Safe from "@safe-global/protocol-kit";
import { SigningMethod } from "@safe-global/types-kit";
import { createPublicClient, http, hashMessage } from "viem";
import { gnosisChiado } from "viem/chains";

const SANDBOX_URL = "https://api.monerium.dev";
const CHAIN = "chiado" as const;
const EIP1271_MAGIC = "0x1626ba7e";

const env = {
  clientId: process.env.MONERIUM_CLIENT_ID,
  clientSecret: process.env.MONERIUM_CLIENT_SECRET,
  safe1ofN: process.env.TEST_SAFE_1OFN,
  safe2ofN: process.env.TEST_SAFE_2OFN,
  key1: process.env.TEST_OWNER_KEY_1,
  key2: process.env.TEST_OWNER_KEY_2,
  iban: process.env.TEST_IBAN,
  companyName: process.env.TEST_COMPANY_NAME || "Test Co",
  rpcUrl: process.env.SAFE_RPC_URL || "https://rpc.chiadochain.net",
};

function missingEnv(keys: (keyof typeof env)[]): string[] {
  return keys.filter((k) => !env[k]);
}

function withHexPrefix(key: string): `0x${string}` {
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

function normalizeIban(iban: string): string {
  return iban.toUpperCase().replace(/\s/g, "");
}

/** Order message — full RFC3339 with the seconds zeroed (minute precision). */
function buildMessage(amount: number, iban: string): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const ts = d.toISOString().replace(/\.\d{3}Z$/, "Z");
  return `Send EUR ${amount} to ${normalizeIban(iban)} at ${ts}`;
}

async function authenticate(): Promise<string> {
  const res = await fetch(`${SANDBOX_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.clientId!,
      client_secret: env.clientSecret!,
    }),
  });
  if (!res.ok) throw new Error(`Monerium auth failed: ${res.status}`);
  return (await res.json()).access_token;
}

/**
 * Sign the message with every provided owner key and return the combined,
 * threshold-meeting EIP-1271 signature bytes (sorted by owner, as the Safe
 * contract requires).
 */
async function signWithOwners(
  safeAddress: string,
  ownerKeys: string[],
  message: string
): Promise<string> {
  let safeMessage: any = null;
  for (const key of ownerKeys) {
    const kit = await (Safe as any).init({
      provider: env.rpcUrl,
      signer: withHexPrefix(key),
      safeAddress,
    });
    if (!safeMessage) safeMessage = kit.createMessage(message);
    safeMessage = await kit.signMessage(
      safeMessage,
      SigningMethod.ETH_SIGN_TYPED_DATA_V4
    );
  }
  return safeMessage.encodedSignatures();
}

/** Verify the signature against the Safe on-chain (the EIP-1271 ground truth). */
async function isValidOnChain(
  safeAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  const client = createPublicClient({
    chain: gnosisChiado,
    transport: http(env.rpcUrl),
  });
  try {
    const res = await client.readContract({
      address: safeAddress as `0x${string}`,
      abi: [
        {
          name: "isValidSignature",
          type: "function",
          stateMutability: "view",
          inputs: [{ type: "bytes32" }, { type: "bytes" }],
          outputs: [{ type: "bytes4" }],
        },
      ],
      functionName: "isValidSignature",
      args: [hashMessage(message), signature as `0x${string}`],
    });
    return res === EIP1271_MAGIC;
  } catch {
    return false;
  }
}

async function placeOrder(
  token: string,
  safeAddress: string,
  amount: number,
  message: string,
  signature: string
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${SANDBOX_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.monerium.api-v2+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amount.toString(),
      currency: "eur",
      message,
      signature,
      address: safeAddress,
      chain: CHAIN,
      counterpart: {
        identifier: { standard: "iban", iban: normalizeIban(env.iban!) },
        details: { companyName: env.companyName },
      },
      memo: "Safe threshold reproduction",
      kind: "redeem",
    }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** True when Monerium rejected specifically because the signature didn't verify. */
function isSignatureError(status: number, body: any): boolean {
  const text = JSON.stringify(body).toLowerCase();
  return (
    status === 400 &&
    (text.includes("address mismatch") ||
      text.includes("no longer valid") ||
      text.includes("isvalidsignature"))
  );
}

const REQUIRED: (keyof typeof env)[] = [
  "clientId",
  "clientSecret",
  "safe1ofN",
  "safe2ofN",
  "key1",
  "key2",
  "iban",
];

test("1-of-N Safe: Monerium accepts the order (no signature error)", async () => {
  const missing = missingEnv(REQUIRED);
  if (missing.length) {
    console.warn(`⚠️  Skipping (set ${missing.join(", ")})`);
    return;
  }

  const amount = 1;
  const message = buildMessage(amount, env.iban!);
  const signature = await signWithOwners(env.safe1ofN!, [env.key1!], message);

  expect(await isValidOnChain(env.safe1ofN!, message, signature)).toBe(true);

  const { status, body } = await placeOrder(
    await authenticate(),
    env.safe1ofN!,
    amount,
    message,
    signature
  );
  console.log("1-of-N order ->", status, JSON.stringify(body));

  // The signature must be accepted. A non-signature 400 (e.g. balance) is fine —
  // what matters is it is NOT rejected as an invalid signature.
  expect(isSignatureError(status, body)).toBe(false);
});

test("2-of-N Safe: Monerium rejects the order despite a valid on-chain signature", async () => {
  const missing = missingEnv(REQUIRED);
  if (missing.length) {
    console.warn(`⚠️  Skipping (set ${missing.join(", ")})`);
    return;
  }

  const amount = 1;
  const message = buildMessage(amount, env.iban!);
  const signature = await signWithOwners(
    env.safe2ofN!,
    [env.key1!, env.key2!],
    message
  );

  // Same ground truth as the 1-of-N case: the combined signature is valid.
  expect(await isValidOnChain(env.safe2ofN!, message, signature)).toBe(true);

  const { status, body } = await placeOrder(
    await authenticate(),
    env.safe2ofN!,
    amount,
    message,
    signature
  );
  console.log("2-of-N order ->", status, JSON.stringify(body));

  // The bug: a fully-signed, on-chain-valid M-of-N signature is rejected.
  expect(isSignatureError(status, body)).toBe(true);
});
