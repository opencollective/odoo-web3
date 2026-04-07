import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

export async function handleTransactionsRequest(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);

  const journalId = url.searchParams.get("journalId");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const page = parseInt(url.searchParams.get("page") || "1");

  const odooUrl = url.searchParams.get("url") || process.env.ODOO_URL || "";
  const database =
    url.searchParams.get("db") || process.env.ODOO_DATABASE || "";

  const sessionId = url.searchParams.get("session_id");
  const username =
    url.searchParams.get("username") || process.env.ODOO_USERNAME || "";
  const password =
    url.searchParams.get("password") || process.env.ODOO_PASSWORD || "";

  if (!journalId) {
    return new Response(
      JSON.stringify({
        error: "Missing required parameter: journalId",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!odooUrl || !database) {
    return new Response(
      JSON.stringify({
        error: "Missing required parameters: url, db",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!sessionId && (!username || !password)) {
    return new Response(
      JSON.stringify({
        error:
          "Authentication required: provide either session_id or username+password",
      }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const odooClient = await authenticateOdooClient(
      odooUrl,
      database,
      username,
      password
    );

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch more transactions to account for grouping by move_id
    const transactionsToFetch = limit * page * 2;
    const transactions = await odooClient.getLatestTransactions(
      parseInt(journalId),
      transactionsToFetch
    );

    console.log(transactions);
    // Apply pagination
    const paginatedTransactions = transactions.slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        transactions: paginatedTransactions,
        page,
        limit,
        total: transactions.length,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
