import { assertEquals } from "@std/assert";
import { expect } from "@std/expect";
import {
  OdooClient,
  OdooConfig,
  Invoice,
  InvoiceDirection,
} from "../src/lib/odoo.ts";

// Helper to check if Odoo is configured
function isOdooConfigured(): boolean {
  return !!(
    Deno.env.get("ODOO_URL") &&
    Deno.env.get("ODOO_DATABASE") &&
    Deno.env.get("ODOO_USERNAME") &&
    Deno.env.get("ODOO_PASSWORD")
  );
}

Deno.test("getLatestInvoices - basic functionality", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  // Initialize OdooClient
  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);

  // Authenticate
  const authenticated = await odooClient.authenticate();
  expect(authenticated).toBe(true);

  if (!authenticated) {
    console.error("Authentication failed");
    return;
  }

  console.log("✓ Authentication successful!");

  // Test fetching latest invoices with default limit (10)
  const invoices = await odooClient.getLatestInvoices();

  console.log(`\n📋 Retrieved ${invoices.length} invoices`);

  // Basic assertions
  expect(Array.isArray(invoices)).toBe(true);
  expect(invoices.length).toBeLessThanOrEqual(10);

  // If there are invoices, validate the structure
  if (invoices.length > 0) {
    console.log("\n🔍 Validating invoice structure...");

    const invoice = invoices[0];

    // Check required fields
    expect(invoice).toHaveProperty("id");
    expect(invoice).toHaveProperty("name");
    expect(invoice).toHaveProperty("ref");
    expect(invoice).toHaveProperty("date");
    expect(invoice).toHaveProperty("state");
    expect(invoice).toHaveProperty("move_type");
    expect(invoice).toHaveProperty("amount_total");
    expect(invoice).toHaveProperty("amount_residual");

    // Validate types
    expect(typeof invoice.id).toBe("number");
    expect(typeof invoice.name).toBe("string");
    expect(typeof invoice.ref).toBe("string");
    expect(typeof invoice.date).toBe("string");
    expect(typeof invoice.amount_total).toBe("number");
    expect(typeof invoice.amount_residual).toBe("number");

    // Validate state is one of the valid values
    expect(["draft", "posted", "cancel"]).toContain(invoice.state);

    // Validate move_type is one of the valid values
    expect([
      "out_invoice",
      "in_invoice",
      "out_refund",
      "in_refund",
      "entry",
    ]).toContain(invoice.move_type);

    console.log("✓ Invoice structure validated");

    // Display sample invoice
    console.log("\n📄 Sample invoice:");
    console.log(`  ID: ${invoice.id}`);
    console.log(`  Name: ${invoice.name}`);
    console.log(`  Reference: ${invoice.ref || "(empty)"}`);
    console.log(`  Date: ${invoice.date}`);
    console.log(`  Due Date: ${invoice.invoice_date_due || "N/A"}`);
    console.log(`  Status: ${invoice.state}`);
    console.log(`  Payment Status: ${invoice.payment_state || "N/A"}`);
    console.log(`  Type: ${invoice.move_type}`);
    console.log(`  Amount Total: ${invoice.amount_total}`);
    console.log(`  Amount Residual: ${invoice.amount_residual}`);

    if (invoice.partner_name) {
      console.log(`  Partner: ${invoice.partner_name}`);
    }

    if (invoice.bank_account_number) {
      console.log(`  Bank Account: ${invoice.bank_account_number}`);
    } else {
      console.log(`  Bank Account: (not specified)`);
    }

    // Test with currency_id if present
    if (invoice.currency_id && Array.isArray(invoice.currency_id)) {
      console.log(`  Currency: ${invoice.currency_id[1]}`);
    }

    console.log(`  PDF URL: ${invoice.pdf_url}`);

    // Display line items if available
    if (invoice.invoice_line_ids && invoice.invoice_line_ids.length > 0) {
      console.log(`  Line Items: ${invoice.invoice_line_ids.length}`);
      invoice.invoice_line_ids.slice(0, 3).forEach((line, idx) => {
        console.log(`    ${idx + 1}. ${line.name}`);
        console.log(`       Qty: ${line.quantity}, Unit Price: ${line.price_unit}, Total: ${line.price_total}`);
      });
      if (invoice.invoice_line_ids.length > 3) {
        console.log(`    ... and ${invoice.invoice_line_ids.length - 3} more`);
      }
    } else {
      console.log(`  Line Items: 0`);
    }
  } else {
    console.log("\n⚠️  No invoices found in the system");
  }
});

Deno.test("getLatestInvoices - custom limit", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test with custom limit
  const limit = 5;
  const invoices = await odooClient.getLatestInvoices(limit);

  console.log(`\n📋 Retrieved ${invoices.length} invoices (limit: ${limit})`);

  expect(Array.isArray(invoices)).toBe(true);
  expect(invoices.length).toBeLessThanOrEqual(limit);

  console.log(`✓ Custom limit (${limit}) respected`);
});

Deno.test("getLatestInvoices - verify ordering by date", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  const invoices = await odooClient.getLatestInvoices();

  if (invoices.length > 1) {
    console.log("\n🔍 Verifying date ordering (descending)...");

    // Check if invoices are ordered by date descending
    for (let i = 0; i < invoices.length - 1; i++) {
      const currentDate = new Date(invoices[i].date);
      const nextDate = new Date(invoices[i + 1].date);

      // Current date should be >= next date (descending order)
      expect(currentDate >= nextDate).toBe(true);
    }

    console.log("✓ Invoices are properly ordered by date (newest first)");
    console.log(`  Newest: ${invoices[0].date} (${invoices[0].name})`);
    console.log(
      `  Oldest: ${invoices[invoices.length - 1].date} (${
        invoices[invoices.length - 1].name
      })`
    );
  } else {
    console.log("\n⚠️  Not enough invoices to verify ordering");
  }
});

Deno.test("getLatestInvoices - display all invoices with bank accounts", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  const invoices = await odooClient.getLatestInvoices(20);

  console.log(`\n📋 Latest ${invoices.length} Invoices\n`);
  console.log("=".repeat(80));

  const invoicesWithBank = invoices.filter((inv) => inv.bank_account_number);
  const invoicesWithoutBank = invoices.filter((inv) => !inv.bank_account_number);

  console.log(`\n✅ Invoices with bank accounts: ${invoicesWithBank.length}`);
  console.log(`⚠️  Invoices without bank accounts: ${invoicesWithoutBank.length}`);

  if (invoicesWithBank.length > 0) {
    console.log("\n🏦 Invoices with Bank Accounts:");
    console.log("-".repeat(80));

    invoicesWithBank.forEach((invoice, index) => {
      console.log(`\n${index + 1}. ${invoice.name}`);
      console.log(`   Reference: ${invoice.ref || "(none)"}`);
      console.log(`   Date: ${invoice.date}`);
      console.log(`   Status: ${invoice.state}`);
      console.log(`   Partner: ${invoice.partner_name || "(none)"}`);
      console.log(`   Bank Account: ${invoice.bank_account_number}`);
      console.log(`   Amount: ${invoice.amount_total}`);
      console.log(`   PDF: ${invoice.pdf_url}`);
    });
  }

  if (invoicesWithoutBank.length > 0) {
    console.log("\n\n📝 Invoices without Bank Accounts:");
    console.log("-".repeat(80));

    invoicesWithoutBank.forEach((invoice, index) => {
      console.log(`\n${index + 1}. ${invoice.name}`);
      console.log(`   Reference: ${invoice.ref || "(none)"}`);
      console.log(`   Date: ${invoice.date}`);
      console.log(`   Status: ${invoice.state}`);
      console.log(`   Partner: ${invoice.partner_name || "(none)"}`);
      console.log(`   Amount: ${invoice.amount_total}`);
      console.log(`   PDF: ${invoice.pdf_url}`);
    });
  }

  console.log("\n" + "=".repeat(80));

  // Assert that we can retrieve invoices
  expect(Array.isArray(invoices)).toBe(true);
});

Deno.test("getLatestInvoices - filter by direction (incoming only)", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test incoming invoices only (supplier invoices)
  const invoices = await odooClient.getLatestInvoices(10, "incoming");

  console.log(`\n📥 Retrieved ${invoices.length} incoming invoices (supplier bills)`);

  expect(Array.isArray(invoices)).toBe(true);

  // All invoices should be incoming (in_invoice or in_refund)
  if (invoices.length > 0) {
    const allIncoming = invoices.every(
      (inv) => inv.move_type === "in_invoice" || inv.move_type === "in_refund"
    );
    expect(allIncoming).toBe(true);
    console.log("✓ All invoices are incoming (supplier invoices)");

    // Show sample
    console.log("\n📄 Sample incoming invoice:");
    const invoice = invoices[0];
    console.log(`  Name: ${invoice.name}`);
    console.log(`  Type: ${invoice.move_type}`);
    console.log(`  Partner: ${invoice.partner_name || "(none)"}`);
    console.log(`  Bank Account: ${invoice.bank_account_number || "(not set)"}`);
    console.log(`  Amount: ${invoice.amount_total}`);
    console.log(`  PDF: ${invoice.pdf_url}`);
    
    // Check if it's an attachment URL (incoming) or report URL
    if (invoice.pdf_url.includes("/web/content/")) {
      console.log(`  ✓ Using attached PDF (correct for supplier invoice)`);
    } else if (invoice.pdf_url.includes("/report/pdf/")) {
      console.log(`  ⚠️  Using generated report (attachment may be missing)`);
    }
  } else {
    console.log("⚠️  No incoming invoices found");
  }
});

Deno.test("getLatestInvoices - filter by direction (outgoing only)", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test outgoing invoices only (customer invoices)
  const invoices = await odooClient.getLatestInvoices(10, "outgoing");

  console.log(`\n📤 Retrieved ${invoices.length} outgoing invoices (customer invoices)`);

  expect(Array.isArray(invoices)).toBe(true);

  // All invoices should be outgoing (out_invoice or out_refund)
  if (invoices.length > 0) {
    const allOutgoing = invoices.every(
      (inv) => inv.move_type === "out_invoice" || inv.move_type === "out_refund"
    );
    expect(allOutgoing).toBe(true);
    console.log("✓ All invoices are outgoing (customer invoices)");

    // Show sample
    console.log("\n📄 Sample outgoing invoice:");
    const invoice = invoices[0];
    console.log(`  Name: ${invoice.name}`);
    console.log(`  Type: ${invoice.move_type}`);
    console.log(`  Partner: ${invoice.partner_name || "(none)"}`);
    console.log(`  Bank Account: ${invoice.bank_account_number || "(not set)"}`);
    console.log(`  Amount: ${invoice.amount_total}`);
    console.log(`  PDF: ${invoice.pdf_url}`);
  } else {
    console.log("⚠️  No outgoing invoices found");
  }
});

Deno.test("getLatestInvoices - compare all directions", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Fetch all three types
  const allInvoices = await odooClient.getLatestInvoices(50, "all");
  const incomingInvoices = await odooClient.getLatestInvoices(50, "incoming");
  const outgoingInvoices = await odooClient.getLatestInvoices(50, "outgoing");

  console.log("\n📊 Invoice Direction Summary:");
  console.log("=".repeat(60));
  console.log(`  All invoices:      ${allInvoices.length}`);
  console.log(`  Incoming (supplier): ${incomingInvoices.length}`);
  console.log(`  Outgoing (customer): ${outgoingInvoices.length}`);
  console.log("=".repeat(60));

  // Verify counts match
  const incomingCount = allInvoices.filter(
    (inv) => inv.move_type === "in_invoice" || inv.move_type === "in_refund"
  ).length;
  const outgoingCount = allInvoices.filter(
    (inv) => inv.move_type === "out_invoice" || inv.move_type === "out_refund"
  ).length;

  console.log(`\n✓ Verification:`);
  console.log(`  Incoming from 'all': ${incomingCount}`);
  console.log(`  Outgoing from 'all': ${outgoingCount}`);
  console.log(
    `  Sum: ${incomingCount + outgoingCount} (should equal ${allInvoices.length})`
  );

  expect(incomingCount + outgoingCount).toBe(allInvoices.length);

  // Count invoices with bank accounts by direction
  const incomingWithBank = incomingInvoices.filter(
    (inv) => inv.bank_account_number
  ).length;
  const outgoingWithBank = outgoingInvoices.filter(
    (inv) => inv.bank_account_number
  ).length;

  console.log(`\n🏦 Bank Account Coverage:`);
  console.log(
    `  Incoming with bank account: ${incomingWithBank}/${incomingInvoices.length}`
  );
  console.log(
    `  Outgoing with bank account: ${outgoingWithBank}/${outgoingInvoices.length} (should be 0)`
  );

  // Outgoing invoices should never have bank_account_number set
  expect(outgoingWithBank).toBe(0);
  console.log(
    `\n✓ Confirmed: Outgoing invoices correctly exclude company bank accounts`
  );

  // Check PDF URL types
  const incomingWithAttachment = incomingInvoices.filter((inv) =>
    inv.pdf_url.includes("/web/content/")
  ).length;
  const incomingWithReport = incomingInvoices.filter((inv) =>
    inv.pdf_url.includes("/report/pdf/")
  ).length;
  const outgoingWithReport = outgoingInvoices.filter((inv) =>
    inv.pdf_url.includes("/report/pdf/")
  ).length;

  console.log(`\n📎 PDF URL Types:`);
  console.log(
    `  Incoming with attachments: ${incomingWithAttachment}/${incomingInvoices.length}`
  );
  console.log(
    `  Incoming with reports: ${incomingWithReport}/${incomingInvoices.length}`
  );
  console.log(
    `  Outgoing with reports: ${outgoingWithReport}/${outgoingInvoices.length}`
  );

  // All outgoing invoices should use report URLs
  expect(outgoingWithReport).toBe(outgoingInvoices.length);
  console.log(`\n✓ Confirmed: All outgoing invoices use generated report URLs`);

  if (incomingWithAttachment > 0) {
    console.log(
      `✓ Confirmed: ${incomingWithAttachment} incoming invoice(s) use attached PDFs`
    );
  }
});

Deno.test("getLatestInvoices - verify PDF attachment URLs", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  const invoices = await odooClient.getLatestInvoices(20, "all");

  console.log("\n📎 PDF URL Analysis:");
  console.log("=".repeat(60));

  const incoming = invoices.filter(
    (inv) => inv.move_type === "in_invoice" || inv.move_type === "in_refund"
  );
  const outgoing = invoices.filter(
    (inv) => inv.move_type === "out_invoice" || inv.move_type === "out_refund"
  );

  console.log(`\n📥 Incoming Invoices (${incoming.length} total):`);
  incoming.forEach((inv) => {
    const urlType = inv.pdf_url.includes("/web/content/")
      ? "📎 Attachment"
      : "📄 Report";
    console.log(`  ${urlType}: ${inv.name} - ${inv.pdf_url}`);
  });

  console.log(`\n📤 Outgoing Invoices (${outgoing.length} total):`);
  outgoing.slice(0, 5).forEach((inv) => {
    // Show only first 5
    console.log(`  📄 Report: ${inv.name} - ${inv.pdf_url}`);
  });
  if (outgoing.length > 5) {
    console.log(`  ... and ${outgoing.length - 5} more`);
  }

  console.log("\n" + "=".repeat(60));

  // Verify all outgoing invoices use report URLs
  const allOutgoingUseReports = outgoing.every((inv) =>
    inv.pdf_url.includes("/report/pdf/")
  );
  expect(allOutgoingUseReports).toBe(true);
  console.log("✓ All outgoing invoices correctly use report URLs");

  // Check if any incoming invoices have attachments
  const incomingWithAttachments = incoming.filter((inv) =>
    inv.pdf_url.includes("/web/content/")
  );
  if (incomingWithAttachments.length > 0) {
    console.log(
      `✓ ${incomingWithAttachments.length} incoming invoice(s) have attached PDFs`
    );
  } else {
    console.log(
      "ℹ️  No incoming invoices with PDF attachments found (will fall back to report URLs)"
    );
  }
});

Deno.test("getLatestInvoices - verify line items are included", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  const invoices = await odooClient.getLatestInvoices(10, "all");

  console.log("\n📦 Line Items Analysis:");
  console.log("=".repeat(60));

  const invoicesWithLines = invoices.filter(
    (inv) => inv.invoice_line_ids && inv.invoice_line_ids.length > 0
  );
  const invoicesWithoutLines = invoices.filter(
    (inv) => !inv.invoice_line_ids || inv.invoice_line_ids.length === 0
  );

  console.log(`\nTotal invoices: ${invoices.length}`);
  console.log(`With line items: ${invoicesWithLines.length}`);
  console.log(`Without line items: ${invoicesWithoutLines.length}`);

  if (invoicesWithLines.length > 0) {
    console.log("\n✅ Invoices with Line Items:");
    console.log("-".repeat(60));

    invoicesWithLines.slice(0, 3).forEach((invoice) => {
      console.log(`\n${invoice.name} (${invoice.move_type})`);
      console.log(`  Total Lines: ${invoice.invoice_line_ids.length}`);
      console.log(`  Amount: ${invoice.amount_total}`);

      if (invoice.invoice_line_ids.length > 0) {
        console.log(`  Line Items:`);
        invoice.invoice_line_ids.slice(0, 3).forEach((line, idx) => {
          const productName = line.product_id
            ? Array.isArray(line.product_id)
              ? line.product_id[1]
              : "N/A"
            : "No product";
          console.log(`    ${idx + 1}. ${line.name}`);
          console.log(`       Product: ${productName}`);
          console.log(
            `       Qty: ${line.quantity} × ${line.price_unit} = ${line.price_total}`
          );
          if (line.discount) {
            console.log(`       Discount: ${line.discount}%`);
          }
        });
        if (invoice.invoice_line_ids.length > 3) {
          console.log(
            `    ... and ${invoice.invoice_line_ids.length - 3} more line(s)`
          );
        }
      }
    });

    // Verify structure of first line item
    const firstInvoiceWithLines = invoicesWithLines[0];
    const firstLine = firstInvoiceWithLines.invoice_line_ids[0];

    console.log("\n📋 Line Item Structure Validation:");
    expect(firstLine).toHaveProperty("id");
    expect(firstLine).toHaveProperty("name");
    expect(firstLine).toHaveProperty("quantity");
    expect(firstLine).toHaveProperty("price_unit");
    expect(firstLine).toHaveProperty("price_subtotal");
    expect(firstLine).toHaveProperty("price_total");
    expect(typeof firstLine.id).toBe("number");
    expect(typeof firstLine.name).toBe("string");
    expect(typeof firstLine.quantity).toBe("number");
    expect(typeof firstLine.price_unit).toBe("number");
    console.log("✓ Line item structure is valid");
  } else {
    console.log("\n⚠️  No invoices with line items found");
  }

  console.log("\n" + "=".repeat(60));
});

Deno.test("getLatestInvoices - filter by date (YYYYMMDD format)", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test with YYYYMMDD format
  const since = "20250101"; // January 1, 2025
  const invoices = await odooClient.getLatestInvoices(50, "all", since);

  console.log(`\n📅 Invoices since ${since} (YYYYMMDD format):`);
  console.log("=".repeat(60));
  console.log(`Found ${invoices.length} invoice(s)`);

  expect(Array.isArray(invoices)).toBe(true);

  // Verify all invoices are after the specified date
  const sinceDate = new Date("2025-01-01");
  if (invoices.length > 0) {
    const allAfterDate = invoices.every(
      (inv) => new Date(inv.date) >= sinceDate
    );
    expect(allAfterDate).toBe(true);
    
    console.log(`\n✓ All invoices are on or after 2025-01-01`);
    console.log(`  Oldest: ${invoices[invoices.length - 1].date}`);
    console.log(`  Newest: ${invoices[0].date}`);
  } else {
    console.log(`\nℹ️  No invoices found after 2025-01-01`);
  }
});

Deno.test("getLatestInvoices - filter by date (YYYY-MM-DD format)", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test with YYYY-MM-DD format
  const since = "2024-10-01"; // October 1, 2024
  const invoices = await odooClient.getLatestInvoices(50, "all", since);

  console.log(`\n📅 Invoices since ${since} (YYYY-MM-DD format):`);
  console.log("=".repeat(60));
  console.log(`Found ${invoices.length} invoice(s)`);

  expect(Array.isArray(invoices)).toBe(true);

  // Verify all invoices are after the specified date
  const sinceDate = new Date("2024-10-01");
  if (invoices.length > 0) {
    const allAfterDate = invoices.every(
      (inv) => new Date(inv.date) >= sinceDate
    );
    expect(allAfterDate).toBe(true);
    
    console.log(`\n✓ All invoices are on or after 2024-10-01`);
    console.log(`  Oldest: ${invoices[invoices.length - 1].date}`);
    console.log(`  Newest: ${invoices[0].date}`);
    
    // Show sample dates
    console.log(`\n📋 Sample dates:`);
    invoices.slice(0, 5).forEach((inv) => {
      console.log(`  ${inv.name}: ${inv.date}`);
    });
  } else {
    console.log(`\nℹ️  No invoices found after 2024-10-01`);
  }
});

Deno.test("getLatestInvoices - compare with and without date filter", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Get all invoices
  const allInvoices = await odooClient.getLatestInvoices(100, "all");
  
  // Get invoices since specific date
  const sinceDate = "20241001";
  const filteredInvoices = await odooClient.getLatestInvoices(100, "all", sinceDate);

  console.log(`\n📊 Date Filter Comparison:`);
  console.log("=".repeat(60));
  console.log(`  All invoices: ${allInvoices.length}`);
  console.log(`  Since 2024-10-01: ${filteredInvoices.length}`);
  console.log(`  Filtered out: ${allInvoices.length - filteredInvoices.length}`);

  expect(filteredInvoices.length).toBeLessThanOrEqual(allInvoices.length);
  
  if (filteredInvoices.length < allInvoices.length) {
    console.log(`\n✓ Date filter is working correctly`);
  } else {
    console.log(`\nℹ️  All invoices are after the filter date`);
  }
});

Deno.test("getLatestInvoices - filter by until date (YYYYMMDD format)", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test with YYYYMMDD format
  const until = "20241231"; // December 31, 2024
  const invoices = await odooClient.getLatestInvoices(50, "all", undefined, until);

  console.log(`\n📅 Invoices until ${until} (YYYYMMDD format):`);
  console.log("=".repeat(60));
  console.log(`Found ${invoices.length} invoice(s)`);

  expect(Array.isArray(invoices)).toBe(true);

  // Verify all invoices are before or on the specified date
  const untilDate = new Date("2024-12-31");
  if (invoices.length > 0) {
    const allBeforeDate = invoices.every(
      (inv) => new Date(inv.date) <= untilDate
    );
    expect(allBeforeDate).toBe(true);
    
    console.log(`\n✓ All invoices are on or before 2024-12-31`);
    console.log(`  Oldest: ${invoices[invoices.length - 1].date}`);
    console.log(`  Newest: ${invoices[0].date}`);
  } else {
    console.log(`\nℹ️  No invoices found before 2024-12-31`);
  }
});

Deno.test("getLatestInvoices - filter by until date (YYYY-MM-DD format)", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test with YYYY-MM-DD format
  const until = "2024-12-31"; // December 31, 2024
  const invoices = await odooClient.getLatestInvoices(50, "all", undefined, until);

  console.log(`\n📅 Invoices until ${until} (YYYY-MM-DD format):`);
  console.log("=".repeat(60));
  console.log(`Found ${invoices.length} invoice(s)`);

  expect(Array.isArray(invoices)).toBe(true);

  // Verify all invoices are before or on the specified date
  const untilDate = new Date("2024-12-31");
  if (invoices.length > 0) {
    const allBeforeDate = invoices.every(
      (inv) => new Date(inv.date) <= untilDate
    );
    expect(allBeforeDate).toBe(true);
    
    console.log(`\n✓ All invoices are on or before 2024-12-31`);
    console.log(`  Oldest: ${invoices[invoices.length - 1].date}`);
    console.log(`  Newest: ${invoices[0].date}`);
  } else {
    console.log(`\nℹ️  No invoices found before 2024-12-31`);
  }
});

Deno.test("getLatestInvoices - filter by date range (since + until)", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  // Test date range with both since and until
  const since = "20241001"; // October 1, 2024
  const until = "20241231"; // December 31, 2024
  const invoices = await odooClient.getLatestInvoices(100, "all", since, until);

  console.log(`\n📅 Invoices from ${since} to ${until}:`);
  console.log("=".repeat(60));
  console.log(`Found ${invoices.length} invoice(s)`);

  expect(Array.isArray(invoices)).toBe(true);

  // Verify all invoices are within the date range (inclusive on both ends)
  const sinceDate = new Date("2024-10-01");
  const untilDate = new Date("2024-12-31");
  
  if (invoices.length > 0) {
    const allInRange = invoices.every((inv) => {
      const invDate = new Date(inv.date);
      return invDate >= sinceDate && invDate <= untilDate;
    });
    expect(allInRange).toBe(true);
    
    console.log(`\n✓ All invoices are between 2024-10-01 and 2024-12-31 (inclusive)`);
    console.log(`  Oldest: ${invoices[invoices.length - 1].date}`);
    console.log(`  Newest: ${invoices[0].date}`);
    
    // Verify boundary dates are included if they exist
    const hasBoundarySince = invoices.some((inv) => inv.date === "2024-10-01");
    const hasBoundaryUntil = invoices.some((inv) => inv.date === "2024-12-31");
    if (hasBoundarySince) {
      console.log(`  ✓ Since boundary date (2024-10-01) is INCLUDED`);
    }
    if (hasBoundaryUntil) {
      console.log(`  ✓ Until boundary date (2024-12-31) is INCLUDED`);
    }
    
    // Show sample dates
    console.log(`\n📋 Sample invoices in range:`);
    invoices.slice(0, 5).forEach((inv) => {
      console.log(`  ${inv.name}: ${inv.date}`);
    });
  } else {
    console.log(`\nℹ️  No invoices found in the specified date range`);
  }
});

Deno.test("getLatestInvoices - verify payment information", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: Deno.env.get("ODOO_URL") || "",
    database: Deno.env.get("ODOO_DATABASE") || "",
    username: Deno.env.get("ODOO_USERNAME") || "",
    password: Deno.env.get("ODOO_PASSWORD") || "",
  };

  const odooClient = new OdooClient(config);
  await odooClient.authenticate();

  const invoices = await odooClient.getLatestInvoices(50, "all");

  console.log(`\n💰 Payment Information for ${invoices.length} invoices:`);
  console.log("=".repeat(80));

  expect(Array.isArray(invoices)).toBe(true);

  if (invoices.length > 0) {
    // Verify payment fields exist
    expect(invoices[0]).toHaveProperty("payment_state");
    expect(invoices[0]).toHaveProperty("invoice_date_due");

    // Group invoices by payment state
    const paymentGroups: Record<string, Invoice[]> = {};
    invoices.forEach((inv) => {
      const state = inv.payment_state || "unknown";
      if (!paymentGroups[state]) {
        paymentGroups[state] = [];
      }
      paymentGroups[state].push(inv);
    });

    console.log(`\n📊 Payment Status Distribution:`);
    Object.entries(paymentGroups).forEach(([state, invs]) => {
      console.log(`  ${state}: ${invs.length} invoice(s)`);
    });

    // Display sample invoices with different payment states
    console.log(`\n📋 Sample Invoices by Payment Status:`);
    console.log("-".repeat(80));

    Object.entries(paymentGroups).forEach(([state, invs]) => {
      if (invs.length > 0) {
        const sample = invs[0];
        console.log(`\n${state.toUpperCase()}:`);
        console.log(`  Invoice: ${sample.name}`);
        console.log(`  Date: ${sample.date}`);
        console.log(`  Due: ${sample.invoice_date_due || "N/A"}`);
        console.log(`  Amount: ${sample.amount_total}`);
        console.log(`  Residual: ${sample.amount_residual}`);
        console.log(`  Partner: ${sample.partner_name || "N/A"}`);
        
        // Check if paid invoices have zero residual
        if (state === "paid" && sample.amount_residual !== 0) {
          console.log(`  ⚠️  Warning: Paid invoice has non-zero residual: ${sample.amount_residual}`);
        }
      }
    });

    console.log("\n✓ Payment information verified");
  } else {
    console.log(`\nℹ️  No invoices found`);
  }
});

