import { expect } from "jsr:@std/expect";
import { OdooClient } from "../src/lib/odoo.ts";

// Load environment variables for testing
const ODOO_URL = Deno.env.get("ODOO_URL");
const ODOO_DATABASE = Deno.env.get("ODOO_DATABASE");
const ODOO_USERNAME = Deno.env.get("ODOO_USERNAME");
const ODOO_PASSWORD = Deno.env.get("ODOO_PASSWORD");

Deno.test("getInvoiceDetails - fetch complete invoice information", async () => {
  if (!ODOO_URL || !ODOO_DATABASE || !ODOO_USERNAME || !ODOO_PASSWORD) {
    console.log("⚠️  Skipping test: Odoo credentials not configured");
    return;
  }

  const odooClient = new OdooClient({
    url: ODOO_URL,
    database: ODOO_DATABASE,
    username: ODOO_USERNAME,
    password: ODOO_PASSWORD,
  });

  const authenticated = await odooClient.authenticate();
  expect(authenticated).toBe(true);

  // First, get a list of invoices to get a valid invoice ID
  const invoices = await odooClient.getLatestInvoices(1);
  expect(invoices.length).toBeGreaterThan(0);

  const invoiceId = invoices[0].id;
  console.log(`\n📄 Testing with invoice ID: ${invoiceId}`);

  // Fetch detailed information for this invoice
  const invoiceDetails = await odooClient.getInvoiceDetails(invoiceId);

  // Verify basic invoice fields
  expect(invoiceDetails).toBeDefined();
  expect(invoiceDetails.id).toBe(invoiceId);
  expect(invoiceDetails.name).toBeDefined();
  expect(invoiceDetails.date).toBeDefined();
  expect(invoiceDetails.state).toBeDefined();
  expect(invoiceDetails.amount_total).toBeDefined();
  expect(invoiceDetails.amount_untaxed).toBeDefined();
  expect(invoiceDetails.amount_tax).toBeDefined();

  console.log(`\n📋 Invoice Details:`);
  console.log(`  ID: ${invoiceDetails.id}`);
  console.log(`  Number: ${invoiceDetails.name}`);
  console.log(`  Reference: ${invoiceDetails.ref || "N/A"}`);
  console.log(`  Date: ${invoiceDetails.date}`);
  console.log(`  Due Date: ${invoiceDetails.invoice_date_due || "N/A"}`);
  console.log(`  State: ${invoiceDetails.state}`);
  console.log(`  Payment State: ${invoiceDetails.payment_state || "N/A"}`);
  console.log(`  Type: ${invoiceDetails.move_type}`);
  console.log(`  Partner: ${invoiceDetails.partner_name || "N/A"}`);
  console.log(`  Amount Total: €${invoiceDetails.amount_total.toFixed(2)}`);
  console.log(`  Amount Untaxed: €${invoiceDetails.amount_untaxed.toFixed(2)}`);
  console.log(`  Amount Tax: €${invoiceDetails.amount_tax.toFixed(2)}`);
  console.log(`  Amount Residual: €${invoiceDetails.amount_residual.toFixed(2)}`);

  // Verify additional fields
  if (invoiceDetails.invoice_origin) {
    console.log(`  Origin: ${invoiceDetails.invoice_origin}`);
  }
  if (invoiceDetails.narration) {
    console.log(`  Notes: ${invoiceDetails.narration.substring(0, 100)}...`);
  }
  if (invoiceDetails.journal_id && Array.isArray(invoiceDetails.journal_id)) {
    console.log(`  Journal: ${invoiceDetails.journal_id[1]}`);
  }

  // Verify line items
  expect(invoiceDetails.invoice_line_ids).toBeDefined();
  expect(Array.isArray(invoiceDetails.invoice_line_ids)).toBe(true);

  console.log(`\n📦 Line Items (${invoiceDetails.invoice_line_ids.length}):`);
  invoiceDetails.invoice_line_ids.slice(0, 5).forEach((line, index) => {
    console.log(`  ${index + 1}. ${line.name}`);
    console.log(`     Qty: ${line.quantity} x €${line.price_unit.toFixed(2)} = €${line.price_total.toFixed(2)}`);
    if (line.discount) {
      console.log(`     Discount: ${line.discount}%`);
    }
  });
  if (invoiceDetails.invoice_line_ids.length > 5) {
    console.log(`  ... and ${invoiceDetails.invoice_line_ids.length - 5} more line items`);
  }

  // Verify attachments
  expect(invoiceDetails.attachments).toBeDefined();
  expect(Array.isArray(invoiceDetails.attachments)).toBe(true);

  console.log(`\n📎 Attachments (${invoiceDetails.attachments.length}):`);
  if (invoiceDetails.attachments.length > 0) {
    invoiceDetails.attachments.slice(0, 10).forEach((attachment, index) => {
      console.log(`  ${index + 1}. ${attachment.name}`);
      console.log(`     Type: ${attachment.mimetype}`);
      if (attachment.file_size) {
        console.log(`     Size: ${(attachment.file_size / 1024).toFixed(2)} KB`);
      }
      console.log(`     URL: ${attachment.url}`);
      if (attachment.create_date) {
        console.log(`     Created: ${attachment.create_date}`);
      }
    });
    if (invoiceDetails.attachments.length > 10) {
      console.log(`  ... and ${invoiceDetails.attachments.length - 10} more attachments`);
    }
  } else {
    console.log(`  No attachments found`);
  }

  // Verify activities
  expect(invoiceDetails.activities).toBeDefined();
  expect(Array.isArray(invoiceDetails.activities)).toBe(true);

  console.log(`\n📅 Activities (${invoiceDetails.activities.length}):`);
  if (invoiceDetails.activities.length > 0) {
    invoiceDetails.activities.slice(0, 5).forEach((activity, index) => {
      console.log(`  ${index + 1}. ${activity.summary || "Activity"}`);
      console.log(`     Type: ${Array.isArray(activity.activity_type_id) ? activity.activity_type_id[1] : "N/A"}`);
      console.log(`     Deadline: ${activity.date_deadline}`);
      console.log(`     State: ${activity.state}`);
      console.log(`     User: ${Array.isArray(activity.user_id) ? activity.user_id[1] : "N/A"}`);
      if (activity.note) {
        console.log(`     Note: ${activity.note.substring(0, 100)}...`);
      }
    });
    if (invoiceDetails.activities.length > 5) {
      console.log(`  ... and ${invoiceDetails.activities.length - 5} more activities`);
    }
  } else {
    console.log(`  No activities found`);
  }

  // Verify messages
  expect(invoiceDetails.messages).toBeDefined();
  expect(Array.isArray(invoiceDetails.messages)).toBe(true);

  console.log(`\n💬 Messages/Chatter (${invoiceDetails.messages.length}):`);
  if (invoiceDetails.messages.length > 0) {
    invoiceDetails.messages.slice(0, 5).forEach((message, index) => {
      console.log(`  ${index + 1}. [${message.message_type}] ${message.date}`);
      console.log(`     Author: ${Array.isArray(message.author_id) ? message.author_id[1] : "System"}`);
      // Strip HTML tags for console display
      const bodyText = message.body.replace(/<[^>]*>/g, "").substring(0, 100);
      console.log(`     ${bodyText}...`);
    });
    if (invoiceDetails.messages.length > 5) {
      console.log(`  ... and ${invoiceDetails.messages.length - 5} more messages`);
    }
  } else {
    console.log(`  No messages found`);
  }

  // Verify PDF URL is present
  expect(invoiceDetails.pdf_url).toBeDefined();
  console.log(`\n📄 PDF URL: ${invoiceDetails.pdf_url}`);
});

Deno.test("getInvoiceDetails - handle invalid invoice ID", async () => {
  if (!ODOO_URL || !ODOO_DATABASE || !ODOO_USERNAME || !ODOO_PASSWORD) {
    console.log("⚠️  Skipping test: Odoo credentials not configured");
    return;
  }

  const odooClient = new OdooClient({
    url: ODOO_URL,
    database: ODOO_DATABASE,
    username: ODOO_USERNAME,
    password: ODOO_PASSWORD,
  });

  const authenticated = await odooClient.authenticate();
  expect(authenticated).toBe(true);

  // Try to fetch a non-existent invoice
  const invalidId = 999999999;
  
  try {
    await odooClient.getInvoiceDetails(invalidId);
    // Should not reach here
    expect(false).toBe(true);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("not found");
    console.log(`\n✓ Correctly throws error for invalid invoice ID: ${(error as Error).message}`);
  }
});

Deno.test("getInvoiceDetails - verify attachment URLs format", async () => {
  if (!ODOO_URL || !ODOO_DATABASE || !ODOO_USERNAME || !ODOO_PASSWORD) {
    console.log("⚠️  Skipping test: Odoo credentials not configured");
    return;
  }

  const odooClient = new OdooClient({
    url: ODOO_URL,
    database: ODOO_DATABASE,
    username: ODOO_USERNAME,
    password: ODOO_PASSWORD,
  });

  const authenticated = await odooClient.authenticate();
  expect(authenticated).toBe(true);

  // Get an invoice with attachments
  const invoices = await odooClient.getLatestInvoices(10);
  const invoiceWithAttachments = invoices.find(
    (inv) => inv.attachment_ids && inv.attachment_ids.length > 0
  );

  if (!invoiceWithAttachments) {
    console.log("⚠️  No invoices with attachments found, skipping URL format test");
    return;
  }

  console.log(`\n🔍 Testing attachment URLs for invoice ${invoiceWithAttachments.id}`);
  
  const invoiceDetails = await odooClient.getInvoiceDetails(
    invoiceWithAttachments.id
  );

  expect(invoiceDetails.attachments.length).toBeGreaterThan(0);

  invoiceDetails.attachments.forEach((attachment) => {
    // Verify URL format
    expect(attachment.url).toContain("/web/content/");
    expect(attachment.url).toContain(String(attachment.id));
    expect(attachment.url).toMatch(/^https?:\/\//);
    
    console.log(`  ✓ ${attachment.name}: ${attachment.url}`);
  });
});

