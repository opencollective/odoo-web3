import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";
import { EtherscanClient } from "../../../lib/etherscan.ts";
import { MoneriumClient } from "../../../lib/monerium.ts";
import type { Address } from "viem";

const ENV =
  process.env.ENV === "production" ? "production" : "sandbox";

const MONERIUM_CLIENT_ID = process.env.MONERIUM_CLIENT_ID || "";
const MONERIUM_CLIENT_SECRET = process.env.MONERIUM_CLIENT_SECRET || "";

const CHAIN_IDS: Record<string, number> = {
  gnosis: 100,
  chiado: 10200,
};

const EURE_TOKEN_ADDRESSES: Record<string, string> = {
  gnosis: "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430",
  chiado: "0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71",
};

// Default chain based on environment
function getDefaultChain(): string {
  return ENV === "production" ? "gnosis" : "chiado";
}

export async function handleSyncRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);

  const odooUrl =
    url.searchParams.get("url") || process.env.ODOO_URL || "";
  const database =
    url.searchParams.get("db") || process.env.ODOO_DATABASE || "";
  const username =
    url.searchParams.get("username") || process.env.ODOO_USERNAME || "";
  const password =
    url.searchParams.get("password") || process.env.ODOO_PASSWORD || "";

  if (!odooUrl || !database) {
    return new Response(
      JSON.stringify({ error: "Missing required parameters: url, db" }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!username || !password) {
    return new Response(
      JSON.stringify({ error: "Authentication required: provide username+password" }),
      { status: 401, headers: corsHeaders }
    );
  }

  let body: {
    address?: string;
    chain?: string;
    tokenAddress?: string;
    forceResync?: boolean;
    emptyJournal?: boolean;
    limit?: number;
    dryRun?: boolean;
    journalId?: number;
    enrichMonerium?: boolean;
    moneriumClientId?: string;
    moneriumClientSecret?: string;
    moneriumEnvironment?: "production" | "sandbox";
    forceReconcile?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const address = body.address;
  if (!address) {
    return new Response(
      JSON.stringify({ error: "Missing address in request body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const chain = body.chain || getDefaultChain();
  const chainId = CHAIN_IDS[chain];
  if (!chainId) {
    return new Response(
      JSON.stringify({ error: `Unsupported chain: ${chain}. Supported: ${Object.keys(CHAIN_IDS).join(", ")}` }),
      { status: 400, headers: corsHeaders }
    );
  }

  const tokenAddress = body.tokenAddress || EURE_TOKEN_ADDRESSES[chain];
  if (!tokenAddress) {
    return new Response(
      JSON.stringify({ error: "Missing tokenAddress and no default for this chain" }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Use Server-Sent Events for streaming progress
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send({ type: "status", message: "Authenticating with Odoo..." });

        const odooClient = await authenticateOdooClient(
          odooUrl,
          database,
          username,
          password
        );

        // Find or use custom journal
        let journal: { id: number; name: string };
        if (body.journalId) {
          send({ type: "status", message: `Using custom journal ID: ${body.journalId}...` });
          const found = await odooClient.getJournalById(body.journalId);
          if (!found) {
            send({ type: "error", error: `Journal ID ${body.journalId} not found.` });
            controller.close();
            return;
          }
          journal = found;
        } else {
          send({ type: "status", message: "Finding linked journal..." });
          const found = await odooClient.getJournalByBankAccount(address);
          if (!found) {
            send({
              type: "error",
              error:
                "No bank journal linked to this address. Create one first or specify a journal ID.",
            });
            controller.close();
            return;
          }
          journal = found;
        }

        const isDryRun = body.dryRun || false;
        const forceReconcile = body.forceReconcile !== false; // default true

        send({
          type: "status",
          message: `${isDryRun ? "[DRY RUN] " : ""}Using journal: ${journal.name} (ID: ${journal.id})`,
        });

        // Empty journal if requested (skip in dry run)
        if (body.emptyJournal && !isDryRun) {
          send({ type: "status", message: "Emptying journal..." });
          const deleted = await odooClient.emptyJournal(journal.id);
          send({
            type: "status",
            message: `Deleted ${deleted} existing entries from journal.`,
          });
        }

        console.log(`Sync: chain=${chain} chainId=${chainId} address=${address} token=${tokenAddress}`);

        // Step 1: Fetch blockchain transfers and sync to Odoo
        const etherscan = new EtherscanClient(chainId);

        // Quick check: get on-chain balance and Odoo state to detect if sync is needed
        send({ type: "status", message: "Checking on-chain balance..." });
        let balance: string | null = null;
        let rawBalance = "0";
        try {
          rawBalance = await etherscan.getTokenBalance(
            address as Address,
            tokenAddress as Address
          );
        } catch (err) {
          console.error("Failed to fetch token balance:", err);
        }

        const initialCounts = await odooClient.countJournalEntries(journal.id);

        // If not forcing a full sync, try incremental: only fetch new transfers
        const isForceSync = body.forceResync || body.emptyJournal;
        let transfers: Awaited<ReturnType<typeof etherscan.getTokenTransfers>>;
        let totalOnChain = 0;
        let result: { synced: number; skipped: number };

        if (!isForceSync && !body.limit && initialCounts.statementLines > 0) {
          // Incremental sync: get the latest block from Odoo, fetch only newer transfers
          const latestBlock = await odooClient.getLatestSyncedBlock(journal.id, chain);

          send({
            type: "status",
            message: `Fetching transfers after block ${latestBlock}...`,
          });

          // Fetch transfers starting from the latest known block (re-fetch that block to be safe)
          transfers = await etherscan.getTokenTransfers(
            address as Address,
            tokenAddress as Address,
            latestBlock > 0 ? latestBlock : undefined,
          );

          console.log(`Incremental fetch: ${transfers.length} transfers from block ${latestBlock}`);

          // Compute on-chain balance from fetched token balance
          const decimals = transfers.length > 0
            ? parseInt(transfers[0].tokenDecimal || "18", 10)
            : 18;
          balance = (parseFloat(rawBalance) / Math.pow(10, decimals)).toFixed(2);

          // Filter out transfers we already have (dedup handles this too, but saves Odoo queries)
          const newTransfers = transfers.filter(tx => {
            const block = parseInt(tx.blockNumber, 10);
            return block >= latestBlock;
          });

          if (newTransfers.length === 0) {
            send({
              type: "status",
              message: `Already up to date — no new transfers since block ${latestBlock}. Wallet balance: ${balance} EURe, Odoo: ${initialCounts.statementLines} lines.`,
            });
            totalOnChain = initialCounts.statementLines;
            result = { synced: 0, skipped: 0 };

            // Still run reconciliation — there may be unreconciled lines from previous syncs
            // Only check recent lines (last 30 days) since no new txs were synced
            send({ type: "status", message: "Reconciling recent statement lines with invoices..." });
            const reconcileResult = await odooClient.reconcileJournalLines(
              journal.id,
              (progress) => {
                send({ type: "reconcile-progress", ...progress });
              },
              isDryRun,
              forceReconcile,
              30
            );

            const counts = await odooClient.countJournalEntries(journal.id);
            send({
              type: "done",
              dryRun: isDryRun,
              synced: 0,
              skipped: 0,
              moneriumRan: false,
              moneriumEnriched: 0,
              moneriumSkipped: 0,
              moneriumNewPartners: 0,
              moneriumMatchedPartners: 0,
              moneriumReconciled: 0,
              reconciled: reconcileResult.reconciled,
              reconciledTotal: reconcileResult.total,
              totalMoves: counts.moves,
              totalStatementLines: counts.statementLines,
              journal: { id: journal.id, name: journal.name },
              balance,
              totalOnChain,
            });
            controller.close();
            return;
          } else {
            send({
              type: "status",
              message: `Found ${newTransfers.length} new transfer${newTransfers.length !== 1 ? "s" : ""} since block ${latestBlock}. Syncing...`,
              total: newTransfers.length,
            });

            result = await odooClient.syncBlockchainTransactions(
              journal.id,
              newTransfers,
              address,
              chain,
              (progress) => {
                send({ type: "progress", ...progress });
              },
              false,
              isDryRun
            );

            totalOnChain = initialCounts.statementLines + result.synced;

            // Verify balance after incremental sync
            const newOdooBalance = await odooClient.getJournalBalance(journal.id);
            send({
              type: "status",
              message: `Incremental sync done: ${result.synced} synced, ${result.skipped} skipped. Wallet balance: ${balance} EURe.`,
            });

            // No new transactions were actually synced — still run reconciliation
            // Only check recent lines (last 30 days) since no new txs were synced
            if (result.synced === 0) {
              send({ type: "status", message: "Reconciling recent statement lines with invoices..." });
              const reconcileResult = await odooClient.reconcileJournalLines(
                journal.id,
                (progress) => {
                  send({ type: "reconcile-progress", ...progress });
                },
                isDryRun,
                forceReconcile,
                30
              );

              const counts = await odooClient.countJournalEntries(journal.id);
              send({
                type: "done",
                dryRun: isDryRun,
                synced: 0,
                skipped: result.skipped,
                moneriumRan: false,
                moneriumEnriched: 0,
                moneriumSkipped: 0,
                moneriumNewPartners: 0,
                moneriumMatchedPartners: 0,
                moneriumReconciled: 0,
                reconciled: reconcileResult.reconciled,
                reconciledTotal: reconcileResult.total,
                totalMoves: counts.moves,
                totalStatementLines: counts.statementLines,
                journal: { id: journal.id, name: journal.name },
                balance,
                totalOnChain,
              });
              controller.close();
              return;
            }
          }
        } else {
          // Full sync: fetch all transfers
          send({
            type: "status",
            message: `Fetching all token transfers from ${chain}...`,
          });

          transfers = await etherscan.getTokenTransfers(
            address as Address,
            tokenAddress as Address
          );

          console.log(`Full fetch: ${transfers.length} transfers`);

          const decimals = transfers.length > 0
            ? parseInt(transfers[0].tokenDecimal || "18", 10)
            : 18;
          balance = (parseFloat(rawBalance) / Math.pow(10, decimals)).toFixed(2);

          send({
            type: "status",
            message: `Current wallet balance: ${balance} EURe`,
          });

          totalOnChain = transfers.length;

          // Apply limit if specified (take the most recent N after sorting chronologically)
          if (body.limit && body.limit > 0 && transfers.length > body.limit) {
            transfers.sort((a, b) => {
              const timeDiff = parseInt(a.timeStamp, 10) - parseInt(b.timeStamp, 10);
              if (timeDiff !== 0) return timeDiff;
              return parseInt(a.logIndex || "0", 10) - parseInt(b.logIndex || "0", 10);
            });
            transfers = transfers.slice(-body.limit);
            send({
              type: "status",
              message: `Limited to last ${body.limit} of ${totalOnChain} transfers. Starting sync...`,
              total: transfers.length,
            });
          } else {
            send({
              type: "status",
              message: `Found ${transfers.length} transfer${transfers.length !== 1 ? "s" : ""} on chain. Starting sync...`,
              total: transfers.length,
            });
          }

          result = await odooClient.syncBlockchainTransactions(
            journal.id,
            transfers,
            address,
            chain,
            (progress) => {
              send({ type: "progress", ...progress });
            },
            body.forceResync,
            isDryRun
          );

          send({
            type: "status",
            message: `Blockchain sync done: ${result.synced} synced, ${result.skipped} skipped.`,
          });
        }

        // Step 2: Optionally enrich with Monerium metadata
        let moneriumResult: { enriched: number; skipped: number; newPartners: number; matchedPartners: number; reconciled: number } | null = null;

        const mClientId = body.moneriumClientId || MONERIUM_CLIENT_ID;
        const mClientSecret = body.moneriumClientSecret || MONERIUM_CLIENT_SECRET;

        console.log(`Monerium enrichment: enrichMonerium=${body.enrichMonerium}, hasClientId=${!!mClientId}, hasClientSecret=${!!mClientSecret}`);

        if (body.enrichMonerium && mClientId && mClientSecret) {
          send({
            type: "status",
            message: "Connecting to Monerium...",
          });

          try {
            const moneriumEnv = body.moneriumEnvironment || (ENV as "production" | "sandbox");
            const monerium = new MoneriumClient(
              mClientId,
              mClientSecret,
              moneriumEnv
            );
            await monerium.authenticate();

            // Check if address is linked to this Monerium account
            const hasAddr = await monerium.hasAddress(address);
            if (!hasAddr) {
              send({
                type: "status",
                message: `Address ${address} not found in Monerium account. Skipping enrichment.`,
              });
            } else {
              send({
                type: "status",
                message: "Fetching Monerium orders...",
              });

              const ordersByTxHash = await monerium.getOrdersByTxHash(address, true);

              send({
                type: "status",
                message: `Found ${ordersByTxHash.size} Monerium order${ordersByTxHash.size !== 1 ? "s" : ""} with tx hashes. Enriching...`,
              });

              moneriumResult = await odooClient.enrichWithMoneriumData(
                journal.id,
                ordersByTxHash,
                (progress) => {
                  send({ type: "monerium-progress", ...progress });
                },
                isDryRun,
                forceReconcile
              );

              console.log(`Monerium enrichment summary: enriched=${moneriumResult.enriched}, skipped=${moneriumResult.skipped}, matchedPartners=${moneriumResult.matchedPartners}, newPartners=${moneriumResult.newPartners}, reconciled=${moneriumResult.reconciled}${isDryRun ? " [DRY RUN]" : ""}`);
              send({
                type: "status",
                message: `Monerium enrichment: ${moneriumResult.enriched} enriched, ${moneriumResult.skipped} skipped, ${moneriumResult.matchedPartners} partners matched, ${moneriumResult.newPartners} new partners, ${moneriumResult.reconciled} invoices reconciled${isDryRun ? " [DRY RUN]" : ""}.`,
              });
            }
          } catch (error) {
            console.error("Monerium enrichment error:", error);
            send({
              type: "status",
              message: `Monerium enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        // Step 3: Reconcile unreconciled outgoing lines with invoices
        // Runs regardless of Monerium — uses payment_ref, partner IBAN, and amount
        send({ type: "status", message: "Reconciling statement lines with invoices..." });

        const reconcileResult = await odooClient.reconcileJournalLines(
          journal.id,
          (progress) => {
            send({ type: "reconcile-progress", ...progress });
          },
          isDryRun,
          forceReconcile
        );

        if (reconcileResult.reconciled > 0) {
          send({
            type: "status",
            message: `Reconciliation: ${reconcileResult.reconciled}/${reconcileResult.total} outgoing lines matched to invoices${isDryRun ? " [DRY RUN]" : ""}.`,
          });
        } else if (reconcileResult.total > 0) {
          send({
            type: "status",
            message: `Reconciliation: no matches found for ${reconcileResult.total} unreconciled outgoing lines.`,
          });
        }

        // Count total entries on this journal for verification
        const counts = await odooClient.countJournalEntries(journal.id);

        console.log(`Sync complete${isDryRun ? " [DRY RUN]" : ""}: synced=${result.synced}, skipped=${result.skipped}, balance=${balance}, journal=${journal.name} (${counts.statementLines} statement lines), totalOnChain=${totalOnChain}`);

        send({
          type: "done",
          dryRun: isDryRun,
          synced: result.synced,
          skipped: result.skipped,
          moneriumRan: moneriumResult !== null,
          moneriumEnriched: moneriumResult?.enriched || 0,
          moneriumSkipped: moneriumResult?.skipped || 0,
          moneriumNewPartners: moneriumResult?.newPartners || 0,
          moneriumMatchedPartners: moneriumResult?.matchedPartners || 0,
          moneriumReconciled: moneriumResult?.reconciled || 0,
          reconciled: reconcileResult.reconciled,
          reconciledTotal: reconcileResult.total,
          totalMoves: counts.moves,
          totalStatementLines: counts.statementLines,
          journal: { id: journal.id, name: journal.name },
          balance,
          totalOnChain,
        });
      } catch (error) {
        console.error("Sync error:", error);
        send({
          type: "error",
          error: "Sync failed",
          details: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
