/**
 * Deprecate journal #16 by migrating all reconciliations to journal #44 or #47.
 *
 * For each reconciled J16 statement line:
 * 1. Find what it's reconciled with (invoice, account assignment, or journal entry)
 * 2. Find the matching statement line in J44 or J47 (by payment_ref)
 * 3. Unreconcile from J16 (remove_move_reconcile + restore suspense account)
 * 4. Re-reconcile or copy account assignment to the J44/J47 line
 *
 * Usage:
 *   deno run -A --env-file=.env.test scripts/migrate-journal.ts           # dry run
 *   deno run -A --env-file=.env.test scripts/migrate-journal.ts --execute # execute
 */

import { OdooClient, type OdooConfig } from "../src/lib/odoo.ts";

const OLD_JOURNAL_ID = 16;
const TARGET_JOURNALS = [44, 47];
const EXECUTE = Deno.args.includes("--execute");

async function callRPC(
  config: OdooConfig, uid: number, model: string, method: string,
  args: unknown[], kwargs?: Record<string, unknown>,
): Promise<unknown> {
  const url = `${config.url}/jsonrpc`;
  const params: unknown[] = [config.database, uid, config.password, model, method, args];
  if (kwargs) params.push(kwargs);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service: "object", method: "execute_kw", args: params }, id: 1 }),
  });
  const result = await response.json();
  if (result.error) throw new Error(`Odoo error: ${JSON.stringify(result.error)}`);
  return result.result;
}

interface StatementLine {
  id: number;
  date: string;
  payment_ref: string;
  amount: number;
  partner_id: [number, string] | false;
  move_id: [number, string] | false;
  is_reconciled: boolean;
}

interface MoveLine {
  id: number;
  account_id: [number, string];
  account_type: string;
  reconciled: boolean;
  balance: number;
  full_reconcile_id: [number, string] | false;
}

// ─── Analyze what a J16 line is reconciled with ───

type ReconciliationType =
  | { kind: "invoice"; invoiceId: number; invoiceName: string; moveType: string }
  | { kind: "account_assigned"; accountId: number; accountName: string }
  | { kind: "none" };

async function analyzeReconciliation(
  config: OdooConfig, uid: number, moveId: number, suspenseAccountId: number,
): Promise<ReconciliationType> {
  const allLines = await callRPC(config, uid, "account.move.line", "search_read", [
    [["move_id", "=", moveId]],
  ], { fields: ["id", "account_id", "account_type", "reconciled", "balance", "full_reconcile_id"] }) as MoveLine[];

  // Check for full reconciliation (linked to an invoice/bill)
  const reconciledWithFullId = allLines.filter((l) => l.reconciled && l.full_reconcile_id);
  if (reconciledWithFullId.length > 0) {
    const reconcileIds = [...new Set(reconciledWithFullId.map((l) => (l.full_reconcile_id as [number, string])[0]))];

    const linkedLines = await callRPC(config, uid, "account.move.line", "search_read", [
      [["full_reconcile_id", "in", reconcileIds]],
    ], { fields: ["id", "move_id", "full_reconcile_id"] }) as Array<{
      id: number; move_id: [number, string] | false; full_reconcile_id: [number, string] | false;
    }>;

    const candidateIds = new Set<number>();
    for (const line of linkedLines) {
      if (line.move_id && (line.move_id as [number, string])[0] !== moveId) {
        candidateIds.add((line.move_id as [number, string])[0]);
      }
    }

    if (candidateIds.size > 0) {
      const invoiceTypes = ["in_invoice", "out_invoice", "in_refund", "out_refund"];
      const moves = await callRPC(config, uid, "account.move", "search_read", [
        [["id", "in", [...candidateIds]]],
      ], { fields: ["id", "name", "move_type"] }) as Array<{ id: number; name: string; move_type: string }>;

      // Prefer invoices over journal entries
      const invoice = moves.find((m) => invoiceTypes.includes(m.move_type)) || moves[0];
      if (invoice) {
        return { kind: "invoice", invoiceId: invoice.id, invoiceName: invoice.name, moveType: invoice.move_type };
      }
    }
  }

  // Check for account assignment (non-cash line changed from suspense to a real account)
  const nonCashLines = allLines.filter(
    (l) => l.account_type !== "asset_cash" && l.account_type !== "liability_credit_card",
  );
  const assignedLine = nonCashLines.find((l) => l.account_id[0] !== suspenseAccountId);
  if (assignedLine) {
    return { kind: "account_assigned", accountId: assignedLine.account_id[0], accountName: assignedLine.account_id[1] };
  }

  return { kind: "none" };
}

// ─── Check if a target line needs account assignment ───

async function getTargetAccountState(
  config: OdooConfig, uid: number, moveId: number, suspenseAccountId: number,
): Promise<{ isSuspense: boolean; accountId: number; accountName: string }> {
  const lines = await callRPC(config, uid, "account.move.line", "search_read", [
    [["move_id", "=", moveId]],
  ], { fields: ["id", "account_id", "account_type"] }) as Array<{
    id: number; account_id: [number, string]; account_type: string;
  }>;

  const nonCash = lines.filter(
    (l) => l.account_type !== "asset_cash" && l.account_type !== "liability_credit_card",
  );
  if (nonCash.length === 0) return { isSuspense: true, accountId: suspenseAccountId, accountName: "Suspense" };

  const line = nonCash[0];
  return {
    isSuspense: line.account_id[0] === suspenseAccountId,
    accountId: line.account_id[0],
    accountName: line.account_id[1],
  };
}

// ─── Unreconcile a J16 statement line (restore suspense account) ───

async function unreconcileStatementLine(
  config: OdooConfig, uid: number, moveId: number, suspenseAccountId: number,
): Promise<boolean> {
  const allLines = await callRPC(config, uid, "account.move.line", "search_read", [
    [["move_id", "=", moveId]],
  ], { fields: ["id", "account_id", "account_type", "reconciled", "balance"] }) as MoveLine[];

  // Remove reconciliation
  const reconciledLineIds = allLines.filter((l) => l.reconciled).map((l) => l.id);
  if (reconciledLineIds.length > 0) {
    await callRPC(config, uid, "account.move.line", "remove_move_reconcile", [reconciledLineIds]);
  }

  // Restore suspense account on non-cash lines
  const nonCashLines = allLines.filter(
    (l) => l.account_type !== "asset_cash" && l.account_type !== "liability_credit_card",
  );

  if (nonCashLines.length === 1) {
    await callRPC(config, uid, "account.move.line", "write", [
      [nonCashLines[0].id], { account_id: suspenseAccountId },
    ]);
  } else if (nonCashLines.length > 1) {
    const keepLine = nonCashLines[0];
    const extraLines = nonCashLines.slice(1);
    const totalBalance = nonCashLines.reduce((s, l) => s + l.balance, 0);

    await callRPC(config, uid, "account.move", "button_draft", [[moveId]]);
    await callRPC(config, uid, "account.move", "write", [
      [moveId],
      {
        line_ids: [
          [1, keepLine.id, { account_id: suspenseAccountId, debit: totalBalance > 0 ? totalBalance : 0, credit: totalBalance < 0 ? -totalBalance : 0 }],
          ...extraLines.map((l) => [2, l.id, 0] as [number, number, number]),
        ],
      },
    ]);
    await callRPC(config, uid, "account.move", "action_post", [[moveId]]);
  }

  return true;
}

// ─── Reconcile a target statement line with an invoice ───

async function reconcileWithInvoice(
  config: OdooConfig, uid: number, statementLineId: number, invoiceId: number,
): Promise<boolean> {
  const invoiceLines = await callRPC(config, uid, "account.move.line", "search_read", [
    [["move_id", "=", invoiceId], ["account_type", "in", ["asset_receivable", "liability_payable"]], ["reconciled", "=", false]],
  ], { fields: ["id", "account_id", "balance"] }) as Array<{ id: number; account_id: [number, string]; balance: number }>;

  if (invoiceLines.length === 0) return false;

  const stmtLineData = await callRPC(config, uid, "account.bank.statement.line", "read", [
    [statementLineId],
  ], { fields: ["move_id"] }) as Array<{ move_id: [number, string] | false }>;
  if (!stmtLineData[0]?.move_id) return false;

  const stmtMoveId = stmtLineData[0].move_id[0];

  const suspenseLines = await callRPC(config, uid, "account.move.line", "search_read", [
    [["move_id", "=", stmtMoveId], ["account_type", "not in", ["asset_cash", "liability_credit_card"]], ["reconciled", "=", false]],
  ], { fields: ["id", "account_id", "balance", "account_type"] }) as Array<{
    id: number; account_id: [number, string]; balance: number; account_type: string;
  }>;

  if (suspenseLines.length === 0) return false;

  const targetAccountId = invoiceLines[0].account_id[0];
  const suspenseIds = suspenseLines.map((l) => l.id);

  await callRPC(config, uid, "account.move.line", "write", [suspenseIds, { account_id: targetAccountId }]);
  await callRPC(config, uid, "account.move.line", "reconcile", [[...invoiceLines.map((l) => l.id), ...suspenseIds]]);

  return true;
}

// ─── Copy account assignment to a target statement line ───

async function copyAccountAssignment(
  config: OdooConfig, uid: number, targetMoveId: number, accountId: number,
): Promise<boolean> {
  const lines = await callRPC(config, uid, "account.move.line", "search_read", [
    [["move_id", "=", targetMoveId], ["account_type", "not in", ["asset_cash", "liability_credit_card"]]],
  ], { fields: ["id"] }) as Array<{ id: number }>;

  if (lines.length === 0) return false;

  await callRPC(config, uid, "account.move.line", "write", [
    lines.map((l) => l.id), { account_id: accountId },
  ]);
  return true;
}

// ─── Main ───

async function main() {
  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const client = new OdooClient(config);
  if (!await client.authenticate()) { console.error("Auth failed"); Deno.exit(1); }
  const uid = (client as unknown as { uid: number }).uid;

  console.log(`Database: ${config.database}`);
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}\n`);

  // Get suspense account
  const journal = (await callRPC(config, uid, "account.journal", "read", [[OLD_JOURNAL_ID]], {
    fields: ["suspense_account_id"],
  }) as Array<{ suspense_account_id: [number, string] | false }>)[0];
  const suspenseAccountId = journal.suspense_account_id ? journal.suspense_account_id[0] : null;
  if (!suspenseAccountId) { console.error("No suspense account!"); Deno.exit(1); }

  // Fetch J16 reconciled lines
  console.log(`Fetching J${OLD_JOURNAL_ID} reconciled lines...`);
  const oldLines = await callRPC(config, uid, "account.bank.statement.line", "search_read", [
    [["journal_id", "=", OLD_JOURNAL_ID], ["is_reconciled", "=", true]],
  ], {
    fields: ["id", "date", "payment_ref", "amount", "partner_id", "move_id", "is_reconciled"],
    order: "date asc, id asc",
  }) as StatementLine[];
  console.log(`  Found ${oldLines.length} reconciled lines\n`);

  // Fetch target journal lines
  const targetByRef = new Map<string, { journalId: number; line: StatementLine }>();
  const allTargetLines: Array<{ journalId: number; line: StatementLine }> = [];
  for (const jId of TARGET_JOURNALS) {
    const lines = await callRPC(config, uid, "account.bank.statement.line", "search_read", [
      [["journal_id", "=", jId]],
    ], {
      fields: ["id", "date", "payment_ref", "amount", "partner_id", "move_id", "is_reconciled"],
      order: "date asc",
    }) as StatementLine[];
    console.log(`J${jId}: ${lines.length} lines`);
    for (const l of lines) {
      allTargetLines.push({ journalId: jId, line: l });
      if (l.payment_ref && !targetByRef.has(l.payment_ref)) {
        targetByRef.set(l.payment_ref, { journalId: jId, line: l });
      }
    }
  }
  console.log();

  // Process
  const counts = { migrated: 0, accountCopied: 0, unlinkedTargetReconciled: 0, unlinkedNoAction: 0, failed: 0, unmatched: 0 };
  const unmatchedLines: StatementLine[] = [];
  const failedLines: Array<{ line: StatementLine; error: string }> = [];

  console.log("=".repeat(100));

  for (const oldLine of oldLines) {
    const partner = oldLine.partner_id ? (oldLine.partner_id as [number, string])[1] : "N/A";
    const ref = oldLine.payment_ref || "";
    const moveId = oldLine.move_id ? (oldLine.move_id as [number, string])[0] : null;

    // Match by payment_ref first, then fallback to amount+date+partner
    let target = ref ? targetByRef.get(ref) : undefined;
    let matchMethod = "payment_ref";

    if (!target) {
      // Fallback: find by same amount + same date + same partner name
      const partnerId = oldLine.partner_id ? (oldLine.partner_id as [number, string])[0] : null;
      const candidates = allTargetLines.filter((t) => {
        if (Math.abs(t.line.amount - oldLine.amount) > 0.01) return false;
        if (t.line.date !== oldLine.date) return false;
        // Match by partner if available
        if (partnerId && t.line.partner_id) {
          return (t.line.partner_id as [number, string])[0] === partnerId;
        }
        return false;
      });

      if (candidates.length === 1) {
        target = candidates[0];
        matchMethod = "amount+date+partner";
      } else if (candidates.length === 0) {
        // Try amount+date without partner (±3 days)
        const d = new Date(oldLine.date);
        const dMinus = new Date(d); dMinus.setDate(d.getDate() - 3);
        const dPlus = new Date(d); dPlus.setDate(d.getDate() + 3);
        const fmt = (dt: Date) => dt.toISOString().split("T")[0];

        const fuzzyCandidates = allTargetLines.filter((t) => {
          if (Math.abs(t.line.amount - oldLine.amount) > 0.01) return false;
          return t.line.date >= fmt(dMinus) && t.line.date <= fmt(dPlus);
        });

        if (fuzzyCandidates.length === 1) {
          target = fuzzyCandidates[0];
          matchMethod = "amount+date±3d";
        }
      }
    }

    if (!target) {
      counts.unmatched++;
      unmatchedLines.push(oldLine);
      continue;
    }

    // Analyze what this J16 line is reconciled with
    const reconciliation = moveId ? await analyzeReconciliation(config, uid, moveId, suspenseAccountId) : { kind: "none" as const };

    if (EXECUTE) {
      try {
        // Step 1: Unreconcile from J16
        if (moveId) {
          await unreconcileStatementLine(config, uid, moveId, suspenseAccountId);
        }

        // Step 2: Migrate to target
        if (target.line.is_reconciled) {
          // Target already reconciled — nothing more to do
          counts.unlinkedTargetReconciled++;
          console.log(`  UNLINKED #${oldLine.id} | target J${target.journalId}#${target.line.id} already reconciled | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
        } else if (reconciliation.kind === "invoice") {
          // Re-reconcile invoice with target
          const ok = await reconcileWithInvoice(config, uid, target.line.id, reconciliation.invoiceId);
          if (ok) {
            counts.migrated++;
            console.log(`  MIGRATED #${oldLine.id} → J${target.journalId}#${target.line.id} | ${reconciliation.invoiceName} | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
          } else {
            counts.unlinkedNoAction++;
            console.log(`  UNLINKED #${oldLine.id} | re-reconcile failed for ${reconciliation.invoiceName} | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
          }
        } else if (reconciliation.kind === "account_assigned") {
          // Check if target needs the account assignment
          const targetState = await getTargetAccountState(config, uid, (target.line.move_id as [number, string])[0], suspenseAccountId);
          if (targetState.isSuspense) {
            const ok = await copyAccountAssignment(config, uid, (target.line.move_id as [number, string])[0], reconciliation.accountId);
            if (ok) {
              counts.accountCopied++;
              console.log(`  COPIED   #${oldLine.id} → J${target.journalId}#${target.line.id} | ${reconciliation.accountName} | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
            } else {
              counts.unlinkedNoAction++;
              console.log(`  UNLINKED #${oldLine.id} | copy account failed | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
            }
          } else {
            counts.unlinkedTargetReconciled++;
            console.log(`  UNLINKED #${oldLine.id} | target already has account ${targetState.accountName} | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
          }
        } else {
          counts.unlinkedNoAction++;
          console.log(`  UNLINKED #${oldLine.id} | no reconciliation to migrate | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
        }
      } catch (e) {
        counts.failed++;
        const errMsg = e instanceof Error ? e.message.substring(0, 120) : String(e);
        failedLines.push({ line: oldLine, error: errMsg });
        console.log(`  FAIL     #${oldLine.id} | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner} | ${errMsg}`);
      }
    } else {
      // Dry run
      if (target.line.is_reconciled) {
        console.log(`  WOULD UNLINK    #${oldLine.id} | target J${target.journalId}#${target.line.id} already reconciled | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
        counts.unlinkedTargetReconciled++;
      } else if (reconciliation.kind === "invoice") {
        console.log(`  WOULD MIGRATE   #${oldLine.id} → J${target.journalId}#${target.line.id} | ${reconciliation.invoiceName} (${reconciliation.moveType}) | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
        counts.migrated++;
      } else if (reconciliation.kind === "account_assigned") {
        const targetState = await getTargetAccountState(config, uid, (target.line.move_id as [number, string])[0], suspenseAccountId);
        if (targetState.isSuspense) {
          console.log(`  WOULD COPY ACCT #${oldLine.id} → J${target.journalId}#${target.line.id} | ${reconciliation.accountName} | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
          counts.accountCopied++;
        } else {
          console.log(`  WOULD UNLINK    #${oldLine.id} | target already has ${targetState.accountName} | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
          counts.unlinkedTargetReconciled++;
        }
      } else {
        console.log(`  WOULD UNLINK    #${oldLine.id} | no reconciliation to migrate | ${oldLine.date} | ${oldLine.amount.toFixed(2)} EUR | ${partner}`);
        counts.unlinkedNoAction++;
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(100));
  console.log(`\n📊 SUMMARY\n`);
  console.log(`  J${OLD_JOURNAL_ID} reconciled lines: ${oldLines.length}`);
  console.log(`  Matched in J44/J47: ${oldLines.length - counts.unmatched}`);
  console.log(`  Unmatched: ${counts.unmatched}\n`);
  console.log(`  Migrated (invoice re-reconciled on target): ${counts.migrated}`);
  console.log(`  Account copied to target: ${counts.accountCopied}`);
  console.log(`  Unlinked (target already reconciled/assigned): ${counts.unlinkedTargetReconciled}`);
  console.log(`  Unlinked (nothing to migrate): ${counts.unlinkedNoAction}`);
  console.log(`  Failed: ${counts.failed}`);

  if (!EXECUTE) {
    console.log(`\n  DRY RUN — no changes made. Run with --execute to migrate.`);
  }

  if (unmatchedLines.length > 0) {
    console.log(`\n⚠️  UNMATCHED (${unmatchedLines.length}):\n`);
    for (const ol of unmatchedLines) {
      const partner = ol.partner_id ? (ol.partner_id as [number, string])[1] : "N/A";
      console.log(`  #${ol.id} | ${ol.date} | ${ol.amount.toFixed(2)} EUR | ${partner} | ref: ${ol.payment_ref || "(none)"}`);
    }
  }

  if (EXECUTE) {
    console.log(`\nVerifying...`);
    const afterCount = await callRPC(config, uid, "account.bank.statement.line", "search_count", [
      [["journal_id", "=", OLD_JOURNAL_ID], ["is_reconciled", "=", true]],
    ]) as number;
    console.log(`  J${OLD_JOURNAL_ID} reconciled BEFORE: ${oldLines.length}`);
    console.log(`  J${OLD_JOURNAL_ID} reconciled AFTER:  ${afterCount}`);
  }
}

main();
