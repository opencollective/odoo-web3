import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

export async function handleDoctorRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);

  const odooUrl =
    url.searchParams.get("url") || Deno.env.get("ODOO_URL") || "";
  const database =
    url.searchParams.get("db") || Deno.env.get("ODOO_DATABASE") || "";
  const username =
    url.searchParams.get("username") || Deno.env.get("ODOO_USERNAME") || "";
  const password =
    url.searchParams.get("password") || Deno.env.get("ODOO_PASSWORD") || "";

  if (!odooUrl || !database || !username || !password) {
    return new Response(
      JSON.stringify({ error: "Missing credentials" }),
      { status: 401, headers: corsHeaders }
    );
  }

  let body: { journalId: number; limit?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!body.journalId) {
    return new Response(
      JSON.stringify({ error: "Missing journalId" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const odooClient = await authenticateOdooClient(
      odooUrl,
      database,
      username,
      password
    );

    // Get journal info
    const journal = await odooClient.getJournalById(body.journalId);
    if (!journal) {
      return new Response(
        JSON.stringify({ error: `Journal ${body.journalId} not found` }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch statement lines with full metadata
    const limit = body.limit && body.limit > 0 ? body.limit : 0;
    const lines = await odooClient.getStatementLines(body.journalId, limit);

    // Detect duplicates by unique_import_id
    const importIdCounts = new Map<string, number[]>();
    const paymentRefCounts = new Map<string, number[]>();

    for (const line of lines) {
      const uid = typeof line.unique_import_id === "string" ? line.unique_import_id : null;
      if (uid) {
        if (!importIdCounts.has(uid)) importIdCounts.set(uid, []);
        importIdCounts.get(uid)!.push(line.id as number);
      }

      const ref = typeof line.payment_ref === "string" ? line.payment_ref : null;
      if (ref) {
        if (!paymentRefCounts.has(ref)) paymentRefCounts.set(ref, []);
        paymentRefCounts.get(ref)!.push(line.id as number);
      }
    }

    const duplicatesByImportId: Record<string, number[]> = {};
    for (const [key, ids] of importIdCounts) {
      if (ids.length > 1) duplicatesByImportId[key] = ids;
    }

    const duplicatesByPaymentRef: Record<string, number[]> = {};
    for (const [key, ids] of paymentRefCounts) {
      if (ids.length > 1) duplicatesByPaymentRef[key] = ids;
    }

    // Count totals
    const counts = await odooClient.countJournalEntries(body.journalId);

    return new Response(
      JSON.stringify({
        journal: { id: journal.id, name: journal.name },
        totalStatementLines: counts.statementLines,
        totalMoves: counts.moves,
        fetchedLines: lines.length,
        limited: limit > 0,
        duplicates: {
          byImportId: duplicatesByImportId,
          byPaymentRef: duplicatesByPaymentRef,
          countByImportId: Object.keys(duplicatesByImportId).length,
          countByPaymentRef: Object.keys(duplicatesByPaymentRef).length,
        },
        lines: lines.map((line) => ({
          id: line.id,
          date: line.date,
          payment_ref: line.payment_ref,
          amount: line.amount,
          unique_import_id: line.unique_import_id || null,
          partner_id: line.partner_id || null,
          move_id: line.move_id || null,
          narration: line.narration || null,
          transaction_details: line.transaction_details || null,
          create_date: line.create_date,
          statement_id: line.statement_id || null,
        })),
        odooUrl,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Doctor error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
