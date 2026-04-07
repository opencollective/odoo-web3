// Safe Protocol Kit v6
// Documentation: https://docs.safe.global/sdk/protocol-kit/guides/signatures/messages
import Safe from "@safe-global/protocol-kit";
import { SigningMethod } from "@safe-global/types-kit";
import { getPrivateKey } from "./keystore.ts";

// Get RPC URL based on chain
function getRpcUrl(chain: "gnosis" | "chiado"): string {
  const envRpcUrl = process.env.SAFE_RPC_URL;
  if (envRpcUrl) {
    return envRpcUrl;
  }
  // Default RPC URLs
  return chain === "gnosis"
    ? "https://rpc.gnosischain.com"
    : "https://rpc.chiadochain.net";
}

/**
 * Sign a message using a Safe account
 *
 * Based on Safe Protocol Kit documentation:
 * https://docs.safe.global/sdk/protocol-kit/guides/signatures/messages
 *
 * @param message - The message to sign (string)
 * @param safeAddressOverride - Optional Safe address (defaults to SAFE_ADDRESS env var)
 * @param chain - The chain to use ("gnosis" or "chiado")
 * @returns The encoded signatures
 */
export async function signMessage(
  message: string,
  safeAddressOverride?: string,
  chain: "gnosis" | "chiado" = "chiado"
): Promise<string> {
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error("Signing key not available. Unlock via /api/unlock first.");
  }

  const safeAddress = safeAddressOverride || process.env.SAFE_ADDRESS;
  if (!safeAddress) {
    throw new Error("SAFE_ADDRESS environment variable is required");
  }

  const rpcUrl = getRpcUrl(chain);

  // Ensure private key has 0x prefix
  const formattedPrivateKey = privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`;

  console.log(`🔐 Initializing Safe SDK for address: ${safeAddress}`);
  console.log(`🔗 Using RPC: ${rpcUrl} (chain: ${chain})`);

  // Initialize the Protocol Kit with RPC URL and private key
  // Per documentation: provider can be an RPC URL, signer can be a private key
  // Reference: https://docs.safe.global/sdk/protocol-kit/guides/signatures/messages
  let protocolKit;
  try {
    protocolKit = await (Safe as any).init({
      provider: rpcUrl,
      signer: formattedPrivateKey,
      safeAddress,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during Safe init";

    // Provide helpful error message for common issues
    if (errorMessage.includes("SafeProxy contract is not deployed")) {
      const chainLabel =
        chain === "gnosis" ? "Gnosis mainnet" : "Chiado testnet";
      const otherChain =
        chain === "gnosis" ? "Chiado testnet" : "Gnosis mainnet";
      throw new Error(
        `Safe not found at ${safeAddress} on ${chainLabel}. ` +
          `This address might be a regular wallet (not a Safe), or the Safe may exist on ${otherChain} instead. ` +
          `Check your environment setting (production uses Gnosis, sandbox uses Chiado).`
      );
    }
    throw error;
  }

  console.log(`✅ Safe SDK initialized`);

  // Create the message using createMessage
  // Reference: "The createMessage method in the Protocol Kit allows for creating new messages"
  const safeMessage = protocolKit.createMessage(message);

  console.log(`📝 Created Safe message`);

  // Sign the message using signMessage with ETH_SIGN for string messages
  // Reference: "The signMessage method takes the safeMessage together with a SigningMethod"
  // For string messages, use SigningMethod.ETH_SIGN
  const signedMessage = await protocolKit.signMessage(
    safeMessage,
    SigningMethod.ETH_SIGN
  );

  console.log(`✍️ Message signed`);

  // Get the encoded signatures
  // Reference: "safeMessage.encodedSignatures()"
  const encoded = signedMessage.encodedSignatures();
  if (!encoded) {
    throw new Error("Failed to encode Safe signature");
  }

  console.log(`🔏 Encoded signatures: ${encoded.substring(0, 20)}...`);

  return encoded;
}
