import Safe from "@safe-global/protocol-kit";
import { SigningMethod } from "@safe-global/types-kit";

const DEFAULT_RPC_URL =
  Deno.env.get("SAFE_RPC_URL") || "https://rpc.chiadochain.net";

export async function signMessage(
  message: string,
  safeAddressOverride?: string
) {
  const privateKey = Deno.env.get("PRIVATE_KEY");
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  const safeAddress = safeAddressOverride || Deno.env.get("SAFE_ADDRESS");
  if (!safeAddress) {
    throw new Error("SAFE_ADDRESS environment variable is required");
  }

  const protocolKit = await Safe.init({
    provider: DEFAULT_RPC_URL,
    signer: privateKey,
    safeAddress,
  });

  const safeMessage = protocolKit.createMessage(message);
  const signedMessage = await protocolKit.signMessage(
    safeMessage,
    SigningMethod.ETH_SIGN
  );

  const encoded = signedMessage.encodedSignatures();
  if (!encoded) {
    throw new Error("Failed to encode Safe signature");
  }

  return encoded;
}
