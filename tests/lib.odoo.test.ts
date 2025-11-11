import { assertEquals } from "@std/assert";
import { expect } from "@std/expect";
import {
  OdooClient,
  OdooConfig,
  BankAccountIdentifier,
} from "../src/lib/odoo.ts";
import type { Address } from "viem";

import {
  EtherscanClient,
  EtherscanTokenTransfer,
} from "../src/lib/etherscan.ts";
import { getTokenInfo } from "../src/lib/blockchain.ts";
import { formatUnits } from "viem/utils";

// Helper to check if Odoo is configured
function isOdooConfigured(): boolean {
  return !!(
    Deno.env.get("ODOO_URL") &&
    Deno.env.get("ODOO_DATABASE") &&
    Deno.env.get("ODOO_USERNAME") &&
    Deno.env.get("ODOO_PASSWORD")
  );
}

// Helper to check if Etherscan is configured
function isEtherscanConfigured(): boolean {
  return !!Deno.env.get("ETHEREUM_ETHERSCAN_API_KEY");
}

const chainId = 100; // Gnosis Chain
const tokenAddress: Address = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430"; // EURe token
const walletAddress: Address = "0x6fDF0AaE33E313d9C98D2Aa19Bcd8EF777912CBf";

Deno.test("import txs", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  type Many2One = [number, string];

  // Initialize OdooClient instance - will be set in main()
  let odooClient: OdooClient;

  // Helper function to access private callRPC method
  function callRPC(
    model: string,
    method: string,
    args: unknown[],
    kwargs?: Record<string, unknown>
  ): Promise<unknown> {
    return (
      odooClient as unknown as {
        callRPC: (
          endpoint: string,
          method: string,
          params: unknown[]
        ) => Promise<unknown>;
      }
    ).callRPC("object", "execute_kw", [
      (odooClient as unknown as { config: OdooConfig }).config.database,
      (odooClient as unknown as { uid: number }).uid,
      (odooClient as unknown as { config: OdooConfig }).config.password,
      model,
      method,
      args,
      ...(kwargs ? [kwargs] : []),
    ]);
  }

  async function findOrCreatePartnerByName(
    name: string,
    dryRun: boolean = false,
    receivableAccountId?: number,
    payableAccountId?: number
  ): Promise<number> {
    if (!name?.trim()) return 0;

    const partnerId = await odooClient.getPartnerIdByName(name);
    if (partnerId) return partnerId;

    if (dryRun) {
      console.log(`[DRY RUN] Would create partner: ${name}`);
      return 999999; // Return fake ID for dry run
    }

    return await odooClient.createPartner(
      name,
      undefined,
      receivableAccountId,
      payableAccountId
    );
  }

  async function findOrCreatePartnerBank(
    partnerId: number,
    iban: string,
    dryRun: boolean = false,
    receivableAccountId?: number,
    payableAccountId?: number
  ): Promise<number> {
    const acc = iban.replace(/\s+/g, "").toUpperCase();
    if (!acc) return 0;

    const bankAccountIdentifier: BankAccountIdentifier = {
      standard: "iban",
      iban: acc,
    };

    const bankAccountId = await odooClient.findBankAccountByIdentifier(
      bankAccountIdentifier
    );
    if (bankAccountId) return bankAccountId;

    if (dryRun) {
      console.log(
        `[DRY RUN] Would create bank account: ${acc} for partner ${partnerId}`
      );
      return 888888; // Return fake ID for dry run
    }

    // If not found, create it
    const pid =
      partnerId ||
      (await findOrCreatePartnerByName(
        "Unknown",
        dryRun,
        receivableAccountId,
        payableAccountId
      ));
    return await odooClient.createBankAccount(acc, pid);
  }

  // type CsvRow = {
  //   txHash: string;
  //   date: string; // YYYY-MM-DD or DD/MM/YYYY etc.
  //   partnerName: string;
  //   partnerIban: string;
  //   label: string;
  //   debit: string; // "0.00"
  //   credit: string; // "0.00"
  // };

  function toISODate(s: string): string {
    const t = s.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
      const [_, d, mo, y] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const dt = new Date(t);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    }
    throw new Error(`Unrecognized date: ${s}`);
  }

  function monthKeyFromISO(iso: string): string {
    // iso = YYYY-MM-DD → YYYY-MM
    return iso.slice(0, 7);
  }

  function firstDayOfMonthISO(monthKey: string): string {
    // monthKey = YYYY-MM
    return `${monthKey}-01`;
  }

  async function getOrCreateMonthlyStatement(
    journalId: number,
    monthKey: string,
    dryRun: boolean = false
  ): Promise<number> {
    const name = `Feed ${monthKey}`;
    const domain = [
      ["journal_id", "=", journalId],
      ["name", "=", name],
    ];
    const found = (await callRPC(
      "account.bank.statement",
      "search_read",
      [domain],
      { fields: ["id"], limit: 1 } // Removed "state" field
    )) as { id: number }[];

    if (found.length) return found[0].id;

    if (dryRun) {
      console.log(
        `[DRY RUN] Would create monthly statement: ${name} for journal ${journalId}`
      );
      return 777777; // Return fake ID for dry run
    }

    // Create new monthly statement with date = first of month (for info only)
    return (await callRPC("account.bank.statement", "create", [
      {
        name,
        journal_id: journalId,
        date: firstDayOfMonthISO(monthKey),
      },
    ])) as number;
  }

  async function sumStatementLineAmounts(statementId: number): Promise<number> {
    const lines = (await callRPC(
      "account.bank.statement.line",
      "search_read",
      [[["statement_id", "=", statementId]]],
      { fields: ["amount"], limit: 100000 }
    )) as { amount: number }[];

    const total = lines.reduce(
      (acc: number, l: { amount: number }) => acc + Number(l.amount || 0),
      0
    );
    return +total.toFixed(2);
  }

  async function closeStatementIfNeeded(
    statementId: number,
    dryRun: boolean = false
  ) {
    // In modern Odoo versions, statements are automatically posted or use different logic
    // Check if statement exists and has lines before attempting to close
    const recs = (await callRPC(
      "account.bank.statement",
      "read",
      [[statementId]],
      { fields: ["id", "balance_start", "balance_end_real", "name"] } // Removed "state" field
    )) as {
      id: number;
      balance_start?: number;
      balance_end_real?: number;
      name: string;
    }[];

    if (!recs.length) return;
    const st = recs[0];

    // Compute ending real if not set
    const start = Number(st.balance_start || 0);
    let endReal =
      st.balance_end_real != null ? Number(st.balance_end_real) : NaN;
    if (isNaN(endReal)) {
      const sumLines = await sumStatementLineAmounts(statementId);
      endReal = +(start + sumLines).toFixed(2);

      if (dryRun) {
        console.log(
          `[DRY RUN] Would update statement #${statementId} (${
            st.name
          }) balance to ${endReal.toFixed(2)}`
        );
      } else {
        await callRPC("account.bank.statement", "write", [
          [statementId],
          { balance_end_real: endReal },
        ]);
      }
    }

    // Try to post (close) the statement - this may not be needed in newer versions
    if (dryRun) {
      console.log(
        `[DRY RUN] Would close statement #${statementId} (${
          st.name
        }) with end balance = ${endReal.toFixed(2)}`
      );
    } else {
      try {
        await callRPC("account.bank.statement", "button_post", [[statementId]]);
        console.log(
          `✓ Closed statement #${statementId} (${
            st.name
          }) with end balance = ${endReal.toFixed(2)}`
        );
      } catch (_error) {
        console.log(
          `ℹ️ Statement #${statementId} (${st.name}) - posting not available or already processed`
        );
      }
    }
  }

  async function closeAllPastMonthlyStatements(
    journalId: number,
    currentMonthKey: string,
    dryRun: boolean = false
  ) {
    // Find all statements for this journal named "Feed YYYY-MM" with month < currentMonthKey
    const allSts = (await callRPC(
      "account.bank.statement",
      "search_read",
      [[["journal_id", "=", journalId]]],
      { fields: ["id", "name"], limit: 10000 } // Removed "state" field
    )) as { id: number; name: string }[];

    for (const st of allSts) {
      const m = String(st.name || "").match(/^Feed (\d{4}-\d{2})$/);
      if (!m) continue;
      const stMonth = m[1];
      if (stMonth < currentMonthKey) {
        await closeStatementIfNeeded(st.id, dryRun);
      }
    }
  }

  const dryRun = Deno.env.get("DRY_RUN") === "true";

  async function main() {
    const journalId = 55;

    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No changes will be made to Odoo");
      console.log("=".repeat(50));
    }

    // Initialize OdooClient
    const config: OdooConfig = {
      url: Deno.env.get("ODOO_URL") || "",
      database: Deno.env.get("ODOO_DATABASE") || "",
      username: Deno.env.get("ODOO_USERNAME") || "",
      password: Deno.env.get("ODOO_PASSWORD") || "",
    };

    odooClient = new OdooClient(config, dryRun);

    // Authenticate
    const authenticated = await odooClient.authenticate();
    if (!authenticated) {
      console.error("Authentication failed");
      Deno.exit(1);
    }

    console.log("Authentication successful!");

    // Fetch the journal configuration to verify it's properly set up
    const journals = (await callRPC("account.journal", "read", [[journalId]], {
      fields: [
        "id",
        "name",
        "type",
        "suspense_account_id",
        "default_account_id",
      ],
    })) as {
      id: number;
      name: string;
      type: string;
      suspense_account_id: [number, string] | false;
      default_account_id: [number, string] | false;
    }[];

    if (!journals.length) {
      console.error(`Journal ${journalId} not found`);
      Deno.exit(1);
    }

    const journal = journals[0];
    console.log(`Journal: ${journal.name} (Type: ${journal.type})`);

    if (journal.suspense_account_id) {
      console.log(`Suspense Account: ${journal.suspense_account_id[1]}`);
    } else {
      console.warn(`⚠️ Warning: Journal has no suspense account configured`);
    }

    if (journal.default_account_id) {
      console.log(`Default Account: ${journal.default_account_id[1]}`);
    } else {
      console.error(`❌ Error: Journal has no default account configured`);
      console.error(
        `A bank journal must have a default liquidity account (the bank account in the chart of accounts)`
      );
      Deno.exit(1);
    }

    // Verify that default_account_id and suspense_account_id are different
    // The default account should be the bank's liquidity account
    // The suspense account is for unreconciled items
    const defaultAccountId = Array.isArray(journal.default_account_id)
      ? journal.default_account_id[0]
      : journal.default_account_id;
    const suspenseAccountId = journal.suspense_account_id
      ? Array.isArray(journal.suspense_account_id)
        ? journal.suspense_account_id[0]
        : journal.suspense_account_id
      : null;

    if (defaultAccountId === suspenseAccountId) {
      console.error(
        `❌ Error: Journal's default account and suspense account are the same!`
      );
      console.error(
        `The default_account_id should be the bank's liquidity account (e.g., a bank account in the chart of accounts)`
      );
      console.error(`The suspense_account_id is for unreconciled items`);
      console.error(
        `Please configure the journal properly in Odoo before running this import`
      );
      Deno.exit(1);
    }

    // Check the account type of the default account
    const defaultAccounts = (await callRPC(
      "account.account",
      "read",
      [[defaultAccountId]],
      { fields: ["id", "name", "code", "account_type"] }
    )) as { id: number; name: string; code: string; account_type: string }[];

    if (defaultAccounts.length) {
      const defaultAccount = defaultAccounts[0];
      console.log(`Default Account Type: ${defaultAccount.account_type}`);

      // For bank journals, the default account should be of type asset_cash or similar
      if (
        !["asset_cash", "asset_current"].includes(defaultAccount.account_type)
      ) {
        console.warn(
          `⚠️ Warning: Default account type is "${defaultAccount.account_type}"`
        );
        console.warn(
          `For bank/crypto wallets, consider using an account of type "asset_cash" or "asset_current"`
        );
      }
    }

    // Check the suspense account configuration
    if (suspenseAccountId) {
      const suspenseAccounts = (await callRPC(
        "account.account",
        "read",
        [[suspenseAccountId]],
        { fields: ["id", "name", "code", "account_type", "reconcile"] }
      )) as {
        id: number;
        name: string;
        code: string;
        account_type: string;
        reconcile: boolean;
      }[];

      if (suspenseAccounts.length) {
        const suspenseAccount = suspenseAccounts[0];
        console.log(
          `Suspense Account Type: ${suspenseAccount.account_type}, Reconcile: ${suspenseAccount.reconcile}`
        );

        if (
          suspenseAccount.account_type === "liability_current" ||
          suspenseAccount.account_type === "asset_current"
        ) {
          if (!suspenseAccount.reconcile) {
            console.error(
              `❌ Error: Suspense account must have "Allow Reconciliation" enabled!`
            );
            console.error(
              `Please go to Accounting → Configuration → Chart of Accounts`
            );
            console.error(
              `Find account ${suspenseAccount.code} - ${suspenseAccount.name}`
            );
            console.error(`Edit it and check the "Allow Reconciliation" box`);
            Deno.exit(1);
          }
        }
      }
    }

    // Fetch default receivable and payable accounts for partner configuration
    const receivableAccounts = (await callRPC(
      "account.account",
      "search_read",
      [[["account_type", "=", "asset_receivable"]]],
      { fields: ["id", "name"], limit: 1 }
    )) as { id: number; name: string }[];

    const payableAccounts = (await callRPC(
      "account.account",
      "search_read",
      [[["account_type", "=", "liability_payable"]]],
      { fields: ["id", "name"], limit: 1 }
    )) as { id: number; name: string }[];

    if (!receivableAccounts.length || !payableAccounts.length) {
      console.error("Could not find default receivable and payable accounts");
      Deno.exit(1);
    }

    const defaultReceivableAccountId = receivableAccounts[0].id;
    const defaultPayableAccountId = payableAccounts[0].id;
    console.log(
      `Default Receivable Account: ${receivableAccounts[0].name} (ID: ${defaultReceivableAccountId})`
    );
    console.log(
      `Default Payable Account: ${payableAccounts[0].name} (ID: ${defaultPayableAccountId})`
    );

    const client = new EtherscanClient(chainId);
    const txsTransfers = await client.getTokenTransfers(
      walletAddress,
      tokenAddress
    );

    // Determine current month in Europe/Brussels (simple local-now is fine for month key decisions)
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    // Group rows by month
    const byMonth = new Map<
      string,
      (EtherscanTokenTransfer & { date: string })[]
    >();
    for (const r of txsTransfers) {
      const iso = new Date(parseInt(r.timeStamp) * 1000)
        .toISOString()
        .split("T")[0];
      const mk = monthKeyFromISO(iso);
      if (!byMonth.has(mk)) byMonth.set(mk, []);
      byMonth.get(mk)!.push({ ...r, date: iso });
    }

    // Process each month
    for (const [monthKey, items] of byMonth) {
      const stId = await getOrCreateMonthlyStatement(
        journalId,
        monthKey,
        dryRun
      );

      for (const r of items) {
        const amount = formatUnits(BigInt(r.value), 18);
        let partnerId = 0;
        let partnerBankId = 0;

        const partnerAddress = r.from === walletAddress ? r.to : r.from;

        partnerBankId = await findOrCreatePartnerBank(
          partnerId,
          partnerAddress.toLowerCase(),
          dryRun,
          defaultReceivableAccountId,
          defaultPayableAccountId
        );

        console.log(
          `DEBUG: partnerId=${partnerId}, partnerBankId=${partnerBankId}, dryRun=${dryRun}`
        );

        if (!partnerId && partnerBankId && !dryRun) {
          const pb = (await callRPC(
            "res.partner.bank",
            "read",
            [[partnerBankId]],
            { fields: ["partner_id"] }
          )) as { partner_id: [number, string] | number }[];

          partnerId = Array.isArray(pb[0].partner_id)
            ? pb[0].partner_id[0]
            : pb[0].partner_id || 0;

          console.log(`DEBUG: Found partner ${partnerId} from bank account`);

          // Ensure the partner has receivable and payable accounts configured
          if (partnerId) {
            const partners = (await callRPC(
              "res.partner",
              "read",
              [[partnerId]],
              {
                fields: [
                  "property_account_receivable_id",
                  "property_account_payable_id",
                  "name",
                ],
              }
            )) as {
              name: string;
              property_account_receivable_id: [number, string] | false;
              property_account_payable_id: [number, string] | false;
            }[];

            if (partners.length) {
              const partner = partners[0];
              console.log(
                `DEBUG: Partner "${partner.name}" receivable=${partner.property_account_receivable_id}, payable=${partner.property_account_payable_id}`
              );

              const needsUpdate: Record<string, number> = {};

              if (!partner.property_account_receivable_id) {
                console.log(
                  `DEBUG: Adding receivable account ${defaultReceivableAccountId}`
                );
                needsUpdate.property_account_receivable_id =
                  defaultReceivableAccountId;
              }
              if (!partner.property_account_payable_id) {
                console.log(
                  `DEBUG: Adding payable account ${defaultPayableAccountId}`
                );
                needsUpdate.property_account_payable_id =
                  defaultPayableAccountId;
              }

              if (Object.keys(needsUpdate).length > 0) {
                console.log(
                  `Updating partner ${partnerId} "${partner.name}" with default accounts...`
                );
                await callRPC("res.partner", "write", [
                  [partnerId],
                  needsUpdate,
                ]);
                console.log(`✓ Partner ${partnerId} updated successfully`);
              } else {
                console.log(
                  `✓ Partner ${partnerId} "${partner.name}" already has required accounts`
                );
              }
            }
          }
        }

        const payload: Record<string, unknown> = {
          statement_id: stId,
          date: r.date, // exact transaction date
          payment_ref: `${r.hash}:${r.transactionIndex}:${tokenAddress}`,
          amount,
          name: `Blockchain tx ${r.hash?.slice(0, 10) || ""}`, // Description is required
        };
        // Don't set partner for now - try using suspense account
        // if (partnerId) payload.partner_id = partnerId;
        // if (partnerBankId) payload.partner_bank_id = partnerBankId;
        if (r.hash?.trim()) payload.unique_import_id = r.hash.trim();

        if (payload.unique_import_id) {
          const dup = (await callRPC(
            "account.bank.statement.line",
            "search",
            [[["unique_import_id", "=", payload.unique_import_id]]],
            { limit: 1 }
          )) as number[];

          if (dup.length) {
            console.log(`Skip duplicate tx ${r.hash}`);
            continue;
          }
        }

        if (dryRun) {
          console.log(
            `[DRY RUN] Would create statement line: ${
              r.hash || "(no-hash)"
            } amount=${amount} date=${r.date} partner=${
              partnerAddress || "N/A"
            }`
          );
        } else {
          await callRPC("account.bank.statement.line", "create", [payload]);
          console.log(
            `+ ${monthKey} line ${
              r.hash || "(no-hash)"
            } amount=${amount} date=${r.date}`
          );
        }
      }

      // Auto-close if month < current month
      if (monthKey < currentMonthKey) {
        await closeStatementIfNeeded(stId, dryRun);
      } else {
        console.log(`⏳ Keeping ${monthKey} statement open (rolling).`);
      }
    }

    // Also proactively close any other open monthly feed statements from older months (not touched in this file)
    await closeAllPastMonthlyStatements(journalId, currentMonthKey, dryRun);

    if (dryRun) {
      console.log("🔍 DRY RUN COMPLETED - No actual changes were made to Odoo");
    } else {
      console.log("Done. Reconcile via Accounting → Reconciliation.");
    }
  }
  await main();
});
