import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

function getOdooEnv() {
  return {
    url: process.env.ODOO_URL || "",
    db: process.env.ODOO_DATABASE || "",
    user: process.env.ODOO_USERNAME || "",
    pass: process.env.ODOO_PASSWORD || "",
  };
}

/**
 * GET /api/odoo/matching-invoices?txHash=0x...&amount=-100.50&iban=BE123...
 * Find invoices matching the amount of a transaction.
 */
export async function handleMatchingInvoicesRequest(
  req: Request
): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const amount = parseFloat(url.searchParams.get("amount") || "0");
    const iban = url.searchParams.get("iban") || undefined;

    if (!amount) {
      return new Response(
        JSON.stringify({ error: "amount parameter is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const env = getOdooEnv();
    if (!env.url || !env.db || !env.user || !env.pass) {
      return new Response(
        JSON.stringify({ error: "Odoo credentials not configured" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const client = await authenticateOdooClient(env.url, env.db, env.user, env.pass);
    const invoices = await client.findMatchingInvoicesByAmount(amount, iban);

    // Enrich paid invoices with payment info
    const paidIds = invoices
      .filter((inv) => inv.payment_state === "paid")
      .map((inv) => inv.id);

    const paymentInfo = paidIds.length > 0
      ? await client.getInvoicePaymentInfo(paidIds)
      : new Map();

    const enriched = invoices.map((inv) => {
      const payment = paymentInfo.get(inv.id);
      return {
        ...inv,
        payment: payment
          ? {
              journalName: payment.journalName,
              date: payment.date,
              moveName: payment.moveName,
            }
          : null,
      };
    });

    return new Response(JSON.stringify({ invoices: enriched }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Matching invoices error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to find matching invoices",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/odoo/reconcile
 * Body: { txHash: "0x...", invoiceId: 12345 }
 * Reconcile a bank statement line (found by tx hash) with an invoice.
 */
export async function handleReconcileRequest(
  req: Request
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { txHash, invoiceId } = body;

    if (!txHash || !invoiceId) {
      return new Response(
        JSON.stringify({ error: "txHash and invoiceId are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const env = getOdooEnv();
    if (!env.url || !env.db || !env.user || !env.pass) {
      return new Response(
        JSON.stringify({ error: "Odoo credentials not configured" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const client = await authenticateOdooClient(env.url, env.db, env.user, env.pass);

    // Find the statement line by tx hash
    const stmtLine = await client.findStatementLineByTxHash(txHash);
    if (!stmtLine) {
      return new Response(
        JSON.stringify({
          error:
            "This transaction has not been synced to Odoo yet. Run /odoo/sync to import blockchain transactions first.",
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (stmtLine.is_reconciled) {
      return new Response(
        JSON.stringify({ error: "This statement line is already reconciled" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Perform reconciliation
    const success = await client.reconcileStatementLineWithInvoice(
      stmtLine.id,
      invoiceId
    );

    if (!success) {
      return new Response(
        JSON.stringify({ error: "Reconciliation failed" }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, statementLineId: stmtLine.id, invoiceId }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Reconciliation error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to reconcile",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
