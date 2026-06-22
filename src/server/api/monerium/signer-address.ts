import { corsHeaders } from "../shared.ts";
import { getSignerAddress, isUnlocked } from "../../../lib/keystore.ts";

export async function handleMoneriumSignerAddressRequest(): Promise<Response> {
  try {
    // The signer's public address can be known even while the keystore is locked
    // (via cache or SIGNER_ADDRESS env). `locked` tells the client whether a
    // passphrase will still be required before signing.
    const address = await getSignerAddress();
    const locked = !isUnlocked();

    return new Response(
      JSON.stringify({
        address,
        locked,
        // Fall back to WalletConnect only when we can't identify a server signer.
        useWalletConnect: !address,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

