/**
 * Integration test: empty journal 44, sync blockchain transfers, verify balance.
 *
 * Run with:  deno test -A --env-file=.env.test tests/sync-balance.test.ts
 */
import { test, expect } from "bun:test";
import { OdooClient, type OdooConfig } from "../src/lib/odoo.ts";
import { EtherscanClient } from "../src/lib/etherscan.ts";

const JOURNAL_ID = 44;
const ADDRESS = "0xD578e7cd845e1ecD979b04784e77068D5eBd8716";
const TOKEN_ADDRESS = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430"; // EURe on Gnosis
const CHAIN_ID = 100; // Gnosis mainnet

test("sync blockchain transfers and verify balance matches on-chain", async () => {
  // 1. Setup clients
  const odoo = new OdooClient({
    url: process.env.ODOO_URL!,
    database: process.env.ODOO_DATABASE!,
    username: process.env.ODOO_USERNAME!,
    password: process.env.ODOO_PASSWORD!,
  });
  await odoo.authenticate();

  // Helper to access private members (same pattern as lib.odoo.test.ts)
  function callRPC(
    model: string,
    method: string,
    args: unknown[],
    kwargs?: Record<string, unknown>
  ): Promise<unknown> {
    return (
      odoo as unknown as {
        callRPC: (
          endpoint: string,
          method: string,
          params: unknown[]
        ) => Promise<unknown>;
      }
    ).callRPC("object", "execute_kw", [
      (odoo as unknown as { config: OdooConfig }).config.database,
      (odoo as unknown as { uid: number }).uid,
      (odoo as unknown as { config: OdooConfig }).config.password,
      model,
      method,
      args,
      ...(kwargs ? [kwargs] : []),
    ]);
  }

  const etherscan = new EtherscanClient(CHAIN_ID);

  // 2. Fetch all EURe transfers and on-chain balance
  const transfers = await etherscan.getTokenTransfers(ADDRESS, TOKEN_ADDRESS);
  console.log(`Fetched ${transfers.length} EURe transfers from blockchain`);

  const rawBalance = await etherscan.getTokenBalance(ADDRESS, TOKEN_ADDRESS);
  const decimals = parseInt(transfers[0]?.tokenDecimal || "18", 10);
  const onChainBalance = parseFloat(rawBalance) / Math.pow(10, decimals);
  console.log(`On-chain balance: ${onChainBalance.toFixed(2)} EURe`);

  // 3. Compute expected balance from transfers
  transfers.sort((a, b) => {
    const timeDiff = parseInt(a.timeStamp, 10) - parseInt(b.timeStamp, 10);
    if (timeDiff !== 0) return timeDiff;
    return parseInt(a.logIndex || "0", 10) - parseInt(b.logIndex || "0", 10);
  });

  let computedBalance = 0;
  for (const tx of transfers) {
    const rawAmount = parseFloat(tx.value) / Math.pow(10, decimals);
    const amount = Math.round(rawAmount * 100) / 100;
    const isOutgoing = tx.from.toLowerCase() === ADDRESS.toLowerCase();
    computedBalance += isOutgoing ? -amount : amount;
  }
  computedBalance = Math.round(computedBalance * 100) / 100;
  console.log(`Computed balance from ${transfers.length} transfers: ${computedBalance.toFixed(2)} EURe`);

  const preExisting = Math.round((onChainBalance - computedBalance) * 100) / 100;
  console.log(`Pre-existing balance (before first tracked transfer): ${preExisting.toFixed(2)} EURe`);

  // 4. Empty journal
  console.log(`\nEmptying journal ${JOURNAL_ID}...`);
  const deleted = await odoo.emptyJournal(JOURNAL_ID);
  console.log(`Deleted ${deleted} entries`);

  // Verify empty
  const remainingLines = await callRPC(
    "account.bank.statement.line", "search_count",
    [[["journal_id", "=", JOURNAL_ID]]]
  ) as number;
  expect(remainingLines).toBe(0);

  const remainingStmts = await callRPC(
    "account.bank.statement", "search_count",
    [[["journal_id", "=", JOURNAL_ID]]]
  ) as number;
  expect(remainingStmts).toBe(0);

  // 5. Sync transfers
  console.log(`\nSyncing ${transfers.length} transfers to journal ${JOURNAL_ID}...`);
  const result = await odoo.syncBlockchainTransactions(
    JOURNAL_ID,
    transfers,
    ADDRESS,
    "gnosis",
    undefined, // no progress callback
    false, // not force resync
    false, // not dry run
  );
  console.log(`Synced: ${result.synced}, Skipped: ${result.skipped}`);
  expect(result.synced).toBe(transfers.length);
  expect(result.skipped).toBe(0);

  // 6. Verify statement lines count
  const syncedLines = await callRPC(
    "account.bank.statement.line", "search_count",
    [[["journal_id", "=", JOURNAL_ID]]]
  ) as number;
  expect(syncedLines).toBe(transfers.length);

  // 7. Verify Odoo balance matches computed balance
  const allLines = await callRPC(
    "account.bank.statement.line", "search_read",
    [[["journal_id", "=", JOURNAL_ID]]],
    { fields: ["amount"] }
  ) as Array<{ amount: number }>;

  const odooBalance = Math.round(allLines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
  console.log(`\nOdoo sum of statement line amounts: ${odooBalance.toFixed(2)} EURe`);
  expect(odooBalance).toBe(computedBalance);

  // 8. Verify bank statements chain correctly (no "Invalid Statements")
  const statements = await callRPC(
    "account.bank.statement", "search_read",
    [[["journal_id", "=", JOURNAL_ID]]],
    { fields: ["id", "name", "date", "balance_start", "balance_end_real"], order: "date asc" }
  ) as Array<{ id: number; name: string; date: string; balance_start: number; balance_end_real: number }>;

  console.log(`\nBank statements (${statements.length}):`);
  let prevEnd: number | null = null;
  for (const stmt of statements) {
    const start = Math.round(stmt.balance_start * 100) / 100;
    const end = Math.round(stmt.balance_end_real * 100) / 100;
    console.log(`  ${stmt.name} (${stmt.date}): start=${start.toFixed(2)} -> end=${end.toFixed(2)}`);

    // Each statement's balance_start must equal the previous statement's balance_end_real
    if (prevEnd !== null) {
      const prevEndRounded = Math.round(prevEnd * 100) / 100;
      expect(start).toBe(prevEndRounded);
    } else {
      expect(start).toBe(0);
    }

    // balance_end_real must equal balance_start + sum of lines in this statement
    const stmtLines = await callRPC(
      "account.bank.statement.line", "search_read",
      [[["statement_id", "=", stmt.id]]],
      { fields: ["amount"] }
    ) as Array<{ amount: number }>;
    const stmtTotal = Math.round(stmtLines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
    const expectedEnd = Math.round((start + stmtTotal) * 100) / 100;
    expect(end).toBe(expectedEnd);

    prevEnd = stmt.balance_end_real;
  }

  // Last statement's balance_end_real should equal computed balance
  if (statements.length > 0) {
    const lastEnd = Math.round(statements[statements.length - 1].balance_end_real * 100) / 100;
    console.log(`\nLast statement balance_end_real: ${lastEnd.toFixed(2)}`);
    console.log(`Expected (computed from transfers): ${computedBalance.toFixed(2)}`);
    expect(lastEnd).toBe(computedBalance);
  }

  console.log("\n✅ All checks passed!");
});
