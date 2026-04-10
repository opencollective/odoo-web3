/**
 * Cron sync script — run with: bun run cron
 *
 * Reads sync settings from cache/sync-settings.json (configured via /settings UI),
 * then for each enabled account:
 *   1. Incremental blockchain sync (only new transfers since last synced block)
 *   2. Monerium enrichment (partner names, IBANs, memos)
 *   3. Reconciliation with invoices/bills
 *
 * Reports per-account stats: time, new/updated transactions, reconciliations.
 */

import { loadSyncSettings } from "./server/api/sync-settings.ts";
import { OdooClient } from "./lib/odoo.ts";
import { EtherscanClient } from "./lib/etherscan.ts";
import { MoneriumClient } from "./lib/monerium.ts";
import type { Address } from "viem";

const ENV = process.env.ENV === "production" ? "production" : "sandbox";

const CHAIN = ENV === "production" ? "gnosis" : "chiado";
const CHAIN_ID = CHAIN === "gnosis" ? 100 : 10200;
const EURE_TOKEN: Record<string, string> = {
  gnosis: "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430",
  chiado: "0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71",
};
const TOKEN_ADDRESS = EURE_TOKEN[CHAIN];

const MONERIUM_CLIENT_ID = process.env.MONERIUM_CLIENT_ID || "";
const MONERIUM_CLIENT_SECRET = process.env.MONERIUM_CLIENT_SECRET || "";

interface AccountResult {
  address: string;
  label: string;
  durationMs: number;
  newTransactions: number;
  skippedTransactions: number;
  moneriumEnriched: number;
  moneriumNewPartners: number;
  moneriumMatchedPartners: number;
  moneriumReconciled: number;
  error?: string;
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function syncAccount(
  address: string,
  label: string,
  odooUrl: string,
  odooDb: string,
  odooUser: string,
  odooPass: string
): Promise<AccountResult> {
  const start = Date.now();
  const tag = label || `${address.slice(0, 6)}...${address.slice(-4)}`;

  const result: AccountResult = {
    address,
    label: tag,
    durationMs: 0,
    newTransactions: 0,
    skippedTransactions: 0,
    moneriumEnriched: 0,
    moneriumNewPartners: 0,
    moneriumMatchedPartners: 0,
    moneriumReconciled: 0,
  };

  try {
    // 1. Authenticate with Odoo
    log(`[${tag}] Authenticating with Odoo...`);
    const odooClient = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPass,
    });
    const authed = await odooClient.authenticate();
    if (!authed) throw new Error("Odoo authentication failed");

    // 2. Find linked journal
    const journal = await odooClient.getJournalByBankAccount(address);
    if (!journal) {
      log(`[${tag}] No journal linked to this address, skipping.`);
      result.error = "No linked journal";
      result.durationMs = Date.now() - start;
      return result;
    }
    log(`[${tag}] Using journal: ${journal.name} (ID: ${journal.id})`);

    // 3. Incremental blockchain sync
    const latestBlock = await odooClient.getLatestSyncedBlock(journal.id, CHAIN);
    log(`[${tag}] Fetching transfers after block ${latestBlock}...`);

    const etherscan = new EtherscanClient(CHAIN_ID);
    const transfers = await etherscan.getTokenTransfers(
      address as Address,
      TOKEN_ADDRESS as Address,
      latestBlock > 0 ? latestBlock : undefined
    );

    const newTransfers = transfers.filter(
      (tx) => parseInt(tx.blockNumber, 10) >= latestBlock
    );

    if (newTransfers.length > 0) {
      log(`[${tag}] Syncing ${newTransfers.length} new transfer(s)...`);
      const syncResult = await odooClient.syncBlockchainTransactions(
        journal.id,
        newTransfers,
        address,
        CHAIN,
        undefined,
        false,
        false
      );
      result.newTransactions = syncResult.synced;
      result.skippedTransactions = syncResult.skipped;
      log(`[${tag}] Synced: ${syncResult.synced} new, ${syncResult.skipped} skipped`);
    } else {
      log(`[${tag}] Already up to date, no new transfers.`);
    }

    // 4. Monerium enrichment
    if (MONERIUM_CLIENT_ID && MONERIUM_CLIENT_SECRET) {
      try {
        log(`[${tag}] Enriching with Monerium data...`);
        const monerium = new MoneriumClient(
          MONERIUM_CLIENT_ID,
          MONERIUM_CLIENT_SECRET,
          ENV as "production" | "sandbox"
        );
        await monerium.authenticate();

        const hasAddr = await monerium.hasAddress(address);
        if (hasAddr) {
          const ordersByTxHash = await monerium.getOrdersByTxHash(address, true);
          log(`[${tag}] Found ${ordersByTxHash.size} Monerium orders with tx hashes`);

          const mResult = await odooClient.enrichWithMoneriumData(
            journal.id,
            ordersByTxHash,
            undefined,
            false,
            true
          );
          result.moneriumEnriched = mResult.enriched;
          result.moneriumNewPartners = mResult.newPartners;
          result.moneriumMatchedPartners = mResult.matchedPartners;
          result.moneriumReconciled = mResult.reconciled;

          if (mResult.enriched > 0 || mResult.reconciled > 0) {
            log(
              `[${tag}] Monerium: ${mResult.enriched} enriched, ${mResult.matchedPartners} matched partners, ${mResult.newPartners} new partners, ${mResult.reconciled} reconciled`
            );
          }
        } else {
          log(`[${tag}] Address not in Monerium account, skipping enrichment.`);
        }
      } catch (err) {
        log(`[${tag}] Monerium enrichment error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Reconciliation is already handled inside enrichWithMoneriumData
    // (it reconciles all unreconciled outgoing lines, not just Monerium-matched ones)
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    log(`[${tag}] ERROR: ${result.error}`);
  }

  result.durationMs = Date.now() - start;
  return result;
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  const totalStart = Date.now();
  log(`Starting cron sync (env: ${ENV}, chain: ${CHAIN})`);

  const settings = await loadSyncSettings();
  if (!settings) {
    log("No sync settings found. Configure accounts in /settings first.");
    process.exit(1);
  }

  const enabledAccounts = settings.accounts.filter((a) => a.enabled);
  if (enabledAccounts.length === 0) {
    log("No accounts enabled for sync. Enable accounts in /settings first.");
    process.exit(0);
  }

  // Odoo credentials come from environment variables
  const odooUrl = settings.odooUrl || process.env.ODOO_URL || "";
  const odooDb = process.env.ODOO_DATABASE || "";
  const odooUser = process.env.ODOO_USERNAME || "";
  const odooPass = process.env.ODOO_PASSWORD || "";

  if (!odooUrl || !odooDb || !odooUser || !odooPass) {
    log("Odoo credentials not configured. Set ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD env vars.");
    process.exit(1);
  }

  log(`Syncing ${enabledAccounts.length} account(s) on ${odooUrl}...`);
  console.log("");

  const results: AccountResult[] = [];

  for (const account of enabledAccounts) {
    const result = await syncAccount(
      account.address,
      account.label || "",
      odooUrl,
      odooDb,
      odooUser,
      odooPass
    );
    results.push(result);
    console.log("");
  }

  // ── Summary ──
  const totalMs = Date.now() - totalStart;
  const totalNew = results.reduce((s, r) => s + r.newTransactions, 0);
  const totalReconciled = results.reduce((s, r) => s + r.moneriumReconciled, 0);
  const errors = results.filter((r) => r.error);

  console.log("═══════════════════════════════════════════");
  console.log("  SYNC SUMMARY");
  console.log("═══════════════════════════════════════════");

  for (const r of results) {
    const status = r.error ? `ERROR: ${r.error}` : "OK";
    const time = (r.durationMs / 1000).toFixed(1);
    console.log(`  ${r.label}`);
    console.log(`    Status:       ${status}`);
    console.log(`    Time:         ${time}s`);
    if (!r.error || r.newTransactions > 0) {
      console.log(`    New txs:      ${r.newTransactions}`);
      if (r.skippedTransactions > 0)
        console.log(`    Skipped:      ${r.skippedTransactions}`);
      if (r.moneriumEnriched > 0)
        console.log(`    Enriched:     ${r.moneriumEnriched} (${r.moneriumNewPartners} new partners, ${r.moneriumMatchedPartners} matched)`);
      if (r.moneriumReconciled > 0)
        console.log(`    Reconciled:   ${r.moneriumReconciled}`);
    }
    console.log("");
  }

  console.log(`  Total time:     ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  New txs:        ${totalNew}`);
  console.log(`  Reconciled:     ${totalReconciled}`);
  if (errors.length > 0)
    console.log(`  Errors:         ${errors.length}`);
  console.log("═══════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Cron sync failed:", err);
  process.exit(1);
});
