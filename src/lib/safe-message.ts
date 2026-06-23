// Safe off-chain message signing via the Safe Transaction Service.
//
// Monerium authorizes an order with a *signed message* ("Send EUR X to IBAN at TS")
// that it verifies against the Safe via EIP-1271 `isValidSignature`. For a 1-of-N
// Safe a single signature is enough, so we sign locally and the order can be
// submitted immediately. For an M-of-N Safe we propose the message to the Safe
// Transaction Service so the other owners can add their signatures from the Safe
// web app; once the threshold is met the aggregated signature can be submitted.
//
// Docs:
//  - Protocol Kit messages: https://docs.safe.global/sdk/protocol-kit/guides/signatures/messages
//  - API Kit messages:      https://docs.safe.global/sdk/api-kit/guides/messages
import Safe, { hashSafeMessage } from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { SigningMethod } from "@safe-global/types-kit";
import { privateKeyToAccount } from "viem/accounts";
import { getPrivateKey, getSignerAddress } from "./keystore.ts";
import { getRpcUrl, signMessage, type SafeChain } from "./safe.ts";

const CHAIN_IDS: Record<SafeChain, bigint> = {
  gnosis: 100n,
  chiado: 10200n,
};

export interface SafeMessageStatus {
  /** The Safe-specific hash used to look the message up on the Transaction Service. */
  safeMessageHash: string;
  /** The exact (frozen) message that must also be sent to Monerium. */
  message: string;
  /** Number of owner signatures required (the Safe threshold). */
  confirmationsRequired: number;
  /** Number of owner signatures collected so far. */
  confirmations: number;
  /** True when enough signatures have been collected to submit the order. */
  isReady: boolean;
  /** The aggregated EIP-1271 signature to pass to Monerium, once ready. */
  preparedSignature: string | null;
  /** Link to the Safe web app where owners can add the missing signatures. */
  safeUrl: string;
}

function formatPrivateKey(privateKey: string): `0x${string}` {
  return (privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`) as `0x${string}`;
}

/**
 * When the Monerium account is the server's own EOA (not a Safe), sign directly —
 * there's no contract to init and a single signature fully authorizes the order.
 * Returns a ready status, or null if the account isn't the server signer.
 */
async function signAsEoaIfApplicable(
  message: string,
  accountAddress: string,
  chain: SafeChain
): Promise<SafeMessageStatus | null> {
  const signerAddress = await getSignerAddress();
  if (
    !signerAddress ||
    signerAddress.toLowerCase() !== accountAddress.toLowerCase()
  ) {
    return null;
  }
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error("Signing key not available. Unlock via /api/unlock first.");
  }
  const account = privateKeyToAccount(formatPrivateKey(privateKey));
  const preparedSignature = await account.signMessage({ message });
  return {
    safeMessageHash: "",
    message,
    confirmationsRequired: 1,
    confirmations: 1,
    isReady: true,
    preparedSignature,
    safeUrl: getSafeMessagesUrl(accountAddress, chain),
  };
}

async function initProtocolKit(safeAddress: string, chain: SafeChain) {
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error("Signing key not available. Unlock via /api/unlock first.");
  }
  return (Safe as any).init({
    provider: getRpcUrl(chain),
    signer: formatPrivateKey(privateKey),
    safeAddress,
  });
}

function getApiKit(chain: SafeChain): SafeApiKit {
  // The hosted Safe Transaction Service (safe.global / 5afe.dev) requires an API key.
  // For Chiado (or a self-hosted service) set SAFE_TX_SERVICE_URL to override.
  const txServiceUrl = process.env.SAFE_TX_SERVICE_URL;
  const apiKey = process.env.SAFE_API_KEY;
  return new (SafeApiKit as any)({
    chainId: CHAIN_IDS[chain],
    ...(txServiceUrl ? { txServiceUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
  });
}

/** Build the Safe web app URL where owners review and sign pending messages. */
export function getSafeMessagesUrl(safeAddress: string, chain: SafeChain): string {
  const prefix = chain === "gnosis" ? "gno" : "chiado";
  return `https://app.safe.global/transactions/messages?safe=${prefix}:${safeAddress}`;
}

/** Read the Safe's signature threshold (number of owners required to sign). */
export async function getSafeThreshold(
  safeAddress: string,
  chain: SafeChain
): Promise<number> {
  const protocolKit = await initProtocolKit(safeAddress, chain);
  return protocolKit.getThreshold();
}

/**
 * Sign a Monerium order message with the server key and, if the Safe needs more
 * than one signature, propose it to the Safe Transaction Service so the other
 * owners can co-sign from the Safe web app.
 *
 * Returns a status describing how many signatures are still required and, when
 * the message is already fully signed, the aggregated signature to submit.
 */
export async function proposeSafeMessage(
  message: string,
  safeAddress: string,
  chain: SafeChain
): Promise<SafeMessageStatus> {
  const eoa = await signAsEoaIfApplicable(message, safeAddress, chain);
  if (eoa) return eoa;

  const protocolKit = await initProtocolKit(safeAddress, chain);
  const threshold: number = await protocolKit.getThreshold();
  const safeUrl = getSafeMessagesUrl(safeAddress, chain);

  // 1-of-N: a single signature fully authorizes the order. Sign locally and skip
  // the Transaction Service entirely (no SAFE_API_KEY required).
  if (threshold <= 1) {
    const preparedSignature = await signMessage(message, safeAddress, chain);
    return {
      safeMessageHash: await safeMessageHashFor(protocolKit, message),
      message,
      confirmationsRequired: 1,
      confirmations: 1,
      isReady: true,
      preparedSignature,
      safeUrl,
    };
  }

  // M-of-N: sign with the server key and propose the message to the Safe
  // Transaction Service for the remaining owners to co-sign.
  //
  // Use EIP-712 typed-data signing (v=27/28), NOT eth_sign (v=31/32). Both are
  // valid on-chain, but Monerium verifies "offchain" Safe signatures by
  // recovering each owner signature itself, and an eth_sign component recovers to
  // the wrong address there ("ecRecover: address mismatch"). Matching the Safe
  // web app's EIP-712 signatures keeps every component consistent.
  const apiKit = getApiKit(chain);
  const safeMessage = protocolKit.createMessage(message);
  const signed = await protocolKit.signMessage(
    safeMessage,
    SigningMethod.ETH_SIGN_TYPED_DATA_V4
  );
  const ourSignature: string = signed.encodedSignatures();
  const safeMessageHash = await safeMessageHashFor(protocolKit, message);

  // Propose only if it doesn't already exist (e.g. a retried batch).
  const existing = await tryGetMessage(apiKit, safeMessageHash);
  if (!existing) {
    await apiKit.addMessage(safeAddress, {
      message,
      signature: ourSignature,
    });
  }

  return buildStatus(
    await apiKit.getMessage(safeMessageHash),
    message,
    threshold,
    safeMessageHash,
    safeUrl
  );
}

/**
 * Poll the Safe Transaction Service for the current signature count of a
 * previously proposed message.
 */
export async function getSafeMessageStatus(
  message: string,
  safeAddress: string,
  chain: SafeChain
): Promise<SafeMessageStatus> {
  const eoa = await signAsEoaIfApplicable(message, safeAddress, chain);
  if (eoa) return eoa;

  const protocolKit = await initProtocolKit(safeAddress, chain);
  const threshold: number = await protocolKit.getThreshold();
  const safeUrl = getSafeMessagesUrl(safeAddress, chain);
  const safeMessageHash = await safeMessageHashFor(protocolKit, message);

  if (threshold <= 1) {
    const preparedSignature = await signMessage(message, safeAddress, chain);
    return {
      safeMessageHash,
      message,
      confirmationsRequired: 1,
      confirmations: 1,
      isReady: true,
      preparedSignature,
      safeUrl,
    };
  }

  const apiKit = getApiKit(chain);
  const safeMessage = await tryGetMessage(apiKit, safeMessageHash);
  if (!safeMessage) {
    return {
      safeMessageHash,
      message,
      confirmationsRequired: threshold,
      confirmations: 0,
      isReady: false,
      preparedSignature: null,
      safeUrl,
    };
  }

  return buildStatus(safeMessage, message, threshold, safeMessageHash, safeUrl);
}

async function safeMessageHashFor(
  protocolKit: any,
  message: string
): Promise<string> {
  return protocolKit.getSafeMessageHash(hashSafeMessage(message));
}

async function tryGetMessage(apiKit: SafeApiKit, hash: string): Promise<any | null> {
  try {
    return await apiKit.getMessage(hash);
  } catch {
    // 404 = not proposed yet.
    return null;
  }
}

function buildStatus(
  safeMessage: any,
  message: string,
  threshold: number,
  safeMessageHash: string,
  safeUrl: string
): SafeMessageStatus {
  const confirmations = Array.isArray(safeMessage?.confirmations)
    ? safeMessage.confirmations.length
    : 0;
  // The Transaction Service only fills `preparedSignature` once the threshold is met.
  const preparedSignature =
    confirmations >= threshold && safeMessage?.preparedSignature
      ? safeMessage.preparedSignature
      : null;
  return {
    safeMessageHash,
    message,
    confirmationsRequired: threshold,
    confirmations,
    isReady: preparedSignature !== null,
    preparedSignature,
    safeUrl,
  };
}
