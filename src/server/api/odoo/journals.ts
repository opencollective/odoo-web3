import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

export async function handleJournalsRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  const odooUrl =
    url.searchParams.get("url") || Deno.env.get("ODOO_URL") || "";
  const database =
    url.searchParams.get("db") || Deno.env.get("ODOO_DATABASE") || "";
  const username =
    url.searchParams.get("username") || Deno.env.get("ODOO_USERNAME") || "";
  const password =
    url.searchParams.get("password") || Deno.env.get("ODOO_PASSWORD") || "";

  if (!odooUrl || !database) {
    return new Response(
      JSON.stringify({ error: "Missing required parameters: url, db" }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!username || !password) {
    return new Response(
      JSON.stringify({
        error: "Authentication required: provide username+password",
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

    if (req.method === "GET") {
      const address = url.searchParams.get("address");
      const journalIdParam = url.searchParams.get("journalId");

      // If journalId specified, return entry counts for that journal
      if (journalIdParam) {
        const jid = parseInt(journalIdParam, 10);
        const counts = await odooClient.countJournalEntries(jid);
        return new Response(
          JSON.stringify(counts),
          { status: 200, headers: corsHeaders }
        );
      }

      // Return bank journals, optionally with linked journal for an address
      const journals = (await odooClient.getJournals()).filter(
        (j) => j.type === "bank"
      );
      const linked = address
        ? (await odooClient.getJournalByBankAccount(address)) || null
        : null;

      return new Response(
        JSON.stringify({ linked, journals }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (req.method === "POST") {
      let body: { name?: string; code?: string; address?: string };
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { name, code, address } = body;
      if (!name || !code || !address) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: name, code, address",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      const journal = await odooClient.createBankJournal(name, code, address);

      return new Response(JSON.stringify({ journal }), {
        status: 201,
        headers: corsHeaders,
      });
    }

    if (req.method === "DELETE") {
      const journalId = url.searchParams.get("journalId");
      if (!journalId) {
        return new Response(
          JSON.stringify({ error: "Missing required parameter: journalId" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const deleted = await odooClient.emptyJournal(parseInt(journalId, 10));
      return new Response(
        JSON.stringify({ deleted }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Journals error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
