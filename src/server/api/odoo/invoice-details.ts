import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

export async function handleInvoiceDetailsRequest(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);

  const pathParts = url.pathname.split("/");
  const invoiceIdStr = pathParts[pathParts.length - 1];
  const invoiceId = parseInt(invoiceIdStr);

  if (isNaN(invoiceId)) {
    return new Response(JSON.stringify({ error: "Invalid invoice ID" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

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

    const invoice = await odooClient.getInvoiceDetails(invoiceId);

    return new Response(JSON.stringify({ invoice }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error fetching invoice details:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
