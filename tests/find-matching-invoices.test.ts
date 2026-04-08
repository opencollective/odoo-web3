import { test, expect } from "bun:test";
import { OdooClient } from "../src/lib/odoo.ts";

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DATABASE = process.env.ODOO_DATABASE;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

function createClient() {
  return new OdooClient({
    url: ODOO_URL!,
    database: ODOO_DATABASE!,
    username: ODOO_USERNAME!,
    password: ODOO_PASSWORD!,
  });
}

test("findMatchingInvoicesByAmount - find invoices by amount", async () => {
  if (!ODOO_URL || !ODOO_DATABASE || !ODOO_USERNAME || !ODOO_PASSWORD) {
    console.log("Skipping test: Odoo credentials not configured");
    return;
  }

  const client = createClient();
  await client.authenticate();

  // Get a real invoice to test against
  const invoices = await client.getLatestInvoices(1, "outgoing");
  if (invoices.length === 0) {
    console.log("Skipping: no invoices found");
    return;
  }

  const amount = invoices[0].amount_total;
  const results = await client.findMatchingInvoicesByAmount(amount);
  console.log(`Searching for amount ${amount}, found ${results.length} invoices`);
  expect(results.length).toBeGreaterThan(0);
  expect(results.some((r) => r.amount_total >= amount - 0.01 && r.amount_total <= amount + 0.01)).toBe(true);
});

test("findMatchingInvoicesByAmount - find invoice by memo reference", async () => {
  if (!ODOO_URL || !ODOO_DATABASE || !ODOO_USERNAME || !ODOO_PASSWORD) {
    console.log("Skipping test: Odoo credentials not configured");
    return;
  }

  const client = createClient();
  await client.authenticate();

  // Get a real invoice name to use as memo
  const invoices = await client.getLatestInvoices(1, "outgoing");
  if (invoices.length === 0) {
    console.log("Skipping: no invoices found");
    return;
  }

  const invoiceName = invoices[0].name;
  console.log(`Searching for memo "${invoiceName}"`);
  const results = await client.findMatchingInvoicesByAmount(0, undefined, invoiceName);
  console.log(`Found ${results.length} invoices by memo`);
  expect(results.length).toBeGreaterThan(0);
  expect(results.some((r) => r.name === invoiceName)).toBe(true);
});

test("findMatchingInvoicesByAmount - memo regex extracts reference from longer text", async () => {
  if (!ODOO_URL || !ODOO_DATABASE || !ODOO_USERNAME || !ODOO_PASSWORD) {
    console.log("Skipping test: Odoo credentials not configured");
    return;
  }

  const client = createClient();
  await client.authenticate();

  // Get a real invoice whose name matches the reference pattern
  const invoices = await client.getLatestInvoices(5, "outgoing");
  const refPattern = /.*\/2[0-9]{3}\/[0-9]{3,5}/;
  const invoice = invoices.find((i) => refPattern.test(i.name));
  if (!invoice) {
    console.log("Skipping: no invoice with reference pattern found");
    return;
  }

  // Wrap reference in a longer memo string
  const memo = `Payment for ${invoice.name} thank you`;
  console.log(`Searching for memo "${memo}" (expect to find ${invoice.name})`);
  const results = await client.findMatchingInvoicesByAmount(0, undefined, memo);
  console.log(`Found ${results.length} invoices`);
  expect(results.length).toBeGreaterThan(0);
  expect(results.some((r) => r.name === invoice.name)).toBe(true);
});
