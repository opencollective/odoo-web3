import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

export async function handleExpensesRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);

  const odooUrl = process.env.ODOO_URL || "";
  const database = process.env.ODOO_DATABASE || "";
  const username = process.env.ODOO_USERNAME || "";
  const password = process.env.ODOO_PASSWORD || "";

  if (!odooUrl || !database || !username || !password) {
    return new Response(
      JSON.stringify({
        error:
          "Odoo not configured (missing ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, or ODOO_PASSWORD)",
      }),
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

    const expenses = await odooClient.getExpenses(limit);

    return new Response(JSON.stringify({ expenses, odooUrl }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error fetching Odoo expenses:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
