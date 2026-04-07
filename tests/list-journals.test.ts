import { test, expect } from "bun:test";
import {
  OdooClient,
  getSuspenseAccount,
  ensureJournalsSuspenseAccounts,
  listJournals,
} from "../src/lib/odoo.ts";

// Helper to check if Odoo is configured
function isOdooConfigured(): boolean {
  return !!(
    process.env.ODOO_URL &&
    process.env.ODOO_DATABASE &&
    process.env.ODOO_USERNAME &&
    process.env.ODOO_PASSWORD
  );
}

test("getSuspenseAccount - returns suspense account", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const client = new OdooClient();
  await client.authenticate();
  const suspenseAccount = await getSuspenseAccount(client);

  console.log("\n💰 Suspense Account ID:", suspenseAccount);
  expect(typeof suspenseAccount).toBe("number");
  expect(suspenseAccount).toBeGreaterThan(0);
});

test(
  "ensureJournalsSuspenseAccounts - fixes missing suspense accounts",
  async () => {
    if (!isOdooConfigured()) {
      console.log("⏭️  Skipping: Odoo environment variables not configured");
      return;
    }

    const client = new OdooClient();
    await client.authenticate();

    // This should fix any journals missing suspense accounts
    await ensureJournalsSuspenseAccounts(client);

    // Verify all journals now have suspense accounts
    const journals = await listJournals(client);

    console.log("\n🔍 Verifying all journals have suspense accounts...");
    let allHaveSuspenseAccounts = true;
    for (const journal of journals) {
      if (!journal.suspense_account_id) {
        console.log(`  ⚠️  ${journal.code} - ${journal.name} (missing!)`);
        allHaveSuspenseAccounts = false;
      }
    }

    if (allHaveSuspenseAccounts) {
      console.log(
        `  ✅ All ${journals.length} journals have suspense accounts set`
      );
    }

    expect(allHaveSuspenseAccounts).toBe(true);
  }
);

test("listJournals - returns journals with name and code", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const client = new OdooClient();
  await client.authenticate();

  const journals = await listJournals(client);

  console.log(`\n📋 Testing listJournals - Found ${journals.length} journals`);
  console.log("=".repeat(80));

  // Verify that journals array is returned
  expect(Array.isArray(journals)).toBe(true);
  expect(journals.length).toBeGreaterThan(0);

  // Verify each journal has required fields: name and code
  for (const journal of journals) {
    expect(journal.name, `Journal ${journal.id} should have a name`).toBeDefined();
    expect(journal.code, `Journal ${journal.id} should have a code`).toBeDefined();

    expect(typeof journal.name).toBe("string");
    expect(typeof journal.code).toBe("string");
  }

  // Display sample journals
  console.log("\nSample journals:");
  for (const journal of journals.slice(0, 5)) {
    console.log(`  • ${journal.code} - ${journal.name} (ID: ${journal.id})`);
  }

  if (journals.length > 5) {
    console.log(`  ... and ${journals.length - 5} more`);
  }

  console.log("\n✅ All journals have name and code");
});

test("listJournals - filters by type", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const client = new OdooClient();
  await client.authenticate();

  const bankJournals = await listJournals(client, { type: "bank" });

  console.log(
    `\n🏦 Testing listJournals with type filter - Found ${bankJournals.length} bank journals`
  );
  console.log("=".repeat(80));

  expect(Array.isArray(bankJournals)).toBe(true);

  // Verify each journal has name, code, and is of type 'bank'
  for (const journal of bankJournals) {
    expect(journal.name, `Bank journal ${journal.id} should have a name`).toBeDefined();
    expect(journal.code, `Bank journal ${journal.id} should have a code`).toBeDefined();
    expect(journal.type).toBe("bank");

    console.log(
      `  • ${journal.code} - ${journal.name} (Type: ${journal.type})`
    );
  }

  console.log("\n✅ All bank journals have name, code, and correct type");
});

test("listJournals - respects limit option", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const client = new OdooClient();
  await client.authenticate();

  const limit = 3;
  const limitedJournals = await listJournals(client, { limit });

  console.log(
    `\n📊 Testing listJournals with limit=${limit} - Found ${limitedJournals.length} journals`
  );
  console.log("=".repeat(80));

  expect(Array.isArray(limitedJournals)).toBe(true);
  expect(limitedJournals.length).toBeLessThanOrEqual(limit);

  // Verify each journal has name and code
  for (const journal of limitedJournals) {
    expect(journal.name).toBeDefined();
    expect(journal.code).toBeDefined();
    console.log(`  • ${journal.code} - ${journal.name}`);
  }

  console.log(
    `\n✅ Returned ${limitedJournals.length} journals (limit: ${limit})`
  );
});

test("listJournals - filters by specific code", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const client = new OdooClient();
  await client.authenticate();

  // First get all journals to find a code to test with
  const allJournals = await listJournals(client, { limit: 1 });

  if (allJournals.length === 0) {
    console.log("⏭️  Skipping: No journals found in Odoo");
    return;
  }

  const testCode = allJournals[0].code as string;
  const filteredJournals = await listJournals(client, { code: testCode });

  console.log(
    `\n🔍 Testing listJournals with code filter '${testCode}' - Found ${filteredJournals.length} journals`
  );
  console.log("=".repeat(80));

  expect(Array.isArray(filteredJournals)).toBe(true);
  expect(filteredJournals.length).toBeGreaterThan(0);

  // Verify each journal has the correct code, name, and code field
  for (const journal of filteredJournals) {
    expect(journal.name).toBeDefined();
    expect(journal.code).toBeDefined();
    expect(journal.code).toBe(testCode);
    console.log(`  • ${journal.code} - ${journal.name}`);
  }

  console.log(
    `\n✅ All journals have code '${testCode}' and include name field`
  );
});
