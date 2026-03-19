import { InvoiceDirection } from "../../../lib/odoo.ts";
import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

export async function handleInvoicesRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  const type = (url.searchParams.get("type") || "all") as InvoiceDirection;
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  const odooUrl = url.searchParams.get("url") || Deno.env.get("ODOO_URL") || "";
  const database =
    url.searchParams.get("db") || Deno.env.get("ODOO_DATABASE") || "";

  const sessionId = url.searchParams.get("session_id");
  const username =
    url.searchParams.get("username") || Deno.env.get("ODOO_USERNAME") || "";
  const password =
    url.searchParams.get("password") || Deno.env.get("ODOO_PASSWORD") || "";

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

    const invoices = await odooClient.getLatestInvoices(
      limit,
      type,
      since || undefined,
      until || undefined
    );

    return new Response(JSON.stringify({ invoices }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
