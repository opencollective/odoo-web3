import { corsHeaders } from "../shared.ts";
import { authenticateOdooClient } from "./utils.ts";

/**
 * GET /api/odoo/expense-sync?action=lookup&payeeName=...&ocExpenseId=...
 *   Looks up whether the payee exists as an Odoo employee and whether the OC expense already exists.
 *
 * POST /api/odoo/expense-sync
 *   body.action = "create-employee" | "create-expense"
 */
export async function handleExpenseSyncRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const odooUrl = process.env.ODOO_URL || "";
  const database = process.env.ODOO_DATABASE || "";
  const username = process.env.ODOO_USERNAME || "";
  const password = process.env.ODOO_PASSWORD || "";

  if (!odooUrl || !database || !username || !password) {
    return new Response(
      JSON.stringify({ error: "Odoo not configured (missing ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, or ODOO_PASSWORD)" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const odooClient = await authenticateOdooClient(odooUrl, database, username, password);

    // ---------- GET: lookup ----------
    if (req.method === "GET") {
      const url = new URL(req.url);
      const payeeName = url.searchParams.get("payeeName") || "";
      const ocExpenseId = url.searchParams.get("ocExpenseId") || "";

      const result: Record<string, unknown> = { odooUrl };

      // Lookup employee by payee name
      if (payeeName) {
        const employee = await odooClient.findEmployeeByName(payeeName);
        result.employee = employee; // null if not found
      }

      // Lookup expense by OC reference
      if (ocExpenseId) {
        const ref = `OC-${ocExpenseId}`;
        const expense = await odooClient.findExpenseByRef(ref);
        result.expense = expense; // null if not found
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // ---------- POST: create ----------
    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      if (action === "create-employee") {
        const { name, iban, accountHolderName, department, email, address } = body;
        if (!name) {
          return new Response(JSON.stringify({ error: "Missing employee name" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const employee = await odooClient.createEmployee({ name, iban, accountHolderName, department, email, address });
        return new Response(JSON.stringify({ employee, odooUrl }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      if (action === "sync-employee") {
        const { employeeId, email, iban, bic, accountHolderName, address, department, managerName } = body;
        if (!employeeId) {
          return new Response(JSON.stringify({ error: "Missing employeeId" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const employee = await odooClient.syncEmployee(employeeId, {
          email, iban, bic, accountHolderName, address, department, managerName,
        });
        return new Response(JSON.stringify({ employee, odooUrl }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      if (action === "create-expense") {
        const { employeeId, description, ocExpenseId, ocExpenseUrl, items, currency, attachments, ocApiKey } = body;
        if (!employeeId || !ocExpenseId) {
          return new Response(
            JSON.stringify({ error: "Missing employeeId or ocExpenseId" }),
            { status: 400, headers: corsHeaders }
          );
        }

        const reference = `OC-${ocExpenseId}`;

        // Check if already exists
        const existing = await odooClient.findExpenseByRef(reference);
        if (existing) {
          return new Response(
            JSON.stringify({ error: "Expense already exists in Odoo", expense: existing, odooUrl }),
            { status: 409, headers: corsHeaders }
          );
        }

        const result = await odooClient.createExpenseReport({
          employeeId,
          description: description || `Open Collective Expense ${ocExpenseId}`,
          reference,
          ocExpenseUrl: typeof ocExpenseUrl === "string" && ocExpenseUrl.startsWith("http")
            ? ocExpenseUrl
            : undefined,
          items: items || [{ description: description || "Expense", amount: 0 }],
          attachments: attachments || [],
          currency,
          ocApiKey: ocApiKey || undefined,
        });

        return new Response(JSON.stringify({ ...result, odooUrl }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Expense sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}
