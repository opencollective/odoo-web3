import { privateKeyToAccount } from "viem/accounts";
import { corsHeaders } from "../shared.ts";

export function handleMoneriumSignerAddressRequest(): Response {
  try {
    let privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      // No PRIVATE_KEY means we're using WalletConnect
      return new Response(
        JSON.stringify({
          address: null,
          useWalletConnect: true,
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    if (!privateKey.startsWith("0x")) {
      privateKey = `0x${privateKey}`;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    return new Response(
      JSON.stringify({
        address: account.address,
        useWalletConnect: false,
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

