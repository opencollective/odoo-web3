import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";
import { EtherscanClient } from "../../../lib/etherscan.ts";
import type { Address } from "viem";

const ENV =
  process.env.ENV === "production" ? "production" : "sandbox";

const CHAIN_IDS: Record<string, number> = {
  gnosis: 100,
  chiado: 10200,
};

const EURE_TOKEN_ADDRESSES: Record<string, string> = {
  gnosis: "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430",
  chiado: "0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71",
};

/**
 * GET /api/odoo/sync-status?address=0x...
 * Lightweight check: how many on-chain transactions vs Odoo statement lines.
 */
export async function handleSyncStatusRequest(
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
      JSON.stringify({ error: "address parameter is required" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const odooUrl = url.searchParams.get("url") || process.env.ODOO_URL || "";
  const database = url.searchParams.get("db") || process.env.ODOO_DATABASE || "";
  const username = url.searchParams.get("username") || process.env.ODOO_USERNAME || "";
  const password = url.searchParams.get("password") || process.env.ODOO_PASSWORD || "";

  const chain = ENV === "production" ? "gnosis" : "chiado";
  const chainId = CHAIN_IDS[chain];
  const tokenAddress = EURE_TOKEN_ADDRESSES[chain];

  try {
    // Fetch on-chain transfer count and Odoo count in parallel
    const etherscan = new EtherscanClient(chainId);

    const [transfers, odooClient] = await Promise.all([
      etherscan.getTokenTransfers(
        address as Address,
        tokenAddress as Address
      ),
      (odooUrl && database && username && password)
        ? authenticateOdooClient(odooUrl, database, username, password)
        : null,
    ]);

    const onChainCount = transfers.length;
    let odooCount = 0;
    let journalId: number | null = null;
    let journalName: string | null = null;

    if (odooClient) {
      const journal = await odooClient.getJournalByBankAccount(address);
      if (journal) {
        journalId = journal.id;
        journalName = journal.name;
        const counts = await odooClient.countJournalEntries(journal.id);
        odooCount = counts.statementLines;
      }
    }

    const notSynced = onChainCount - odooCount;

    return new Response(
      JSON.stringify({
        onChainCount,
        odooCount,
        notSynced: Math.max(0, notSynced),
        journalId,
        journalName,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Sync status error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check sync status",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
