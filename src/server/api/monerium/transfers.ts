import { corsHeaders } from "../shared.ts";
import { ENV } from "./utils.ts";
import { EtherscanClient } from "../../../lib/etherscan.ts";
import type { Address } from "viem";

// Gnosis chain ID = 100, Chiado testnet = 10200
const CHAIN_IDS: Record<string, number> = {
  gnosis: 100,
  chiado: 10200,
};

const EURE_TOKEN_ADDRESSES: Record<string, string> = {
  gnosis: "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430",
  chiado: "0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71",
};

export async function handleTransfersRequest(
  req: Request
): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const address = url.searchParams.get("address");

  if (!address) {
    return new Response(
      JSON.stringify({ error: "Missing address parameter" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const chain = ENV === "production" ? "gnosis" : "chiado";
    const chainId = CHAIN_IDS[chain];
    const eureAddress = EURE_TOKEN_ADDRESSES[chain];

    const client = new EtherscanClient(chainId);

    const transfers = await client.getTokenTransfers(
      address as Address,
      eureAddress as Address,
    );

    // Return only outgoing transfers (from this address) with minimal data
    const outgoing = transfers
      .filter((t) => t.from.toLowerCase() === address.toLowerCase())
      .map((t) => ({
        hash: t.hash,
        to: t.to,
        value: t.value,
        tokenDecimal: t.tokenDecimal,
        timeStamp: t.timeStamp,
      }));

    return new Response(JSON.stringify({ transfers: outgoing }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Transfers fetch error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch EURe transfers",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
