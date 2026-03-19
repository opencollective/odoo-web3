const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

const PROCESS_EXPENSE_MUTATION = `
mutation ProcessExpense($expenseId: String!, $action: ExpenseProcessAction!, $totalAmountPaidInHostCurrency: Int!) {
  processExpense(expense: { id: $expenseId }, action: $action, paymentParams: { forceManual: true, totalAmountPaidInHostCurrency: $totalAmountPaidInHostCurrency }) {
    id
    status
  }
}
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-oc-api-key",
  "Content-Type": "application/json",
};

export async function handleMarkPaidRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const apiKey = req.headers.get("x-oc-api-key");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing Open Collective API key" }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const { expenseId, amount } = body;

    if (!expenseId) {
      return new Response(
        JSON.stringify({ error: "Missing expenseId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid amount (must be a positive number in cents)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        query: PROCESS_EXPENSE_MUTATION,
        variables: {
          expenseId,
          action: "PAY",
          totalAmountPaidInHostCurrency: amount,
        },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return new Response(
        JSON.stringify({
          error: data.errors[0]?.message || "GraphQL error",
          errors: data.errors,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify(data.data), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Failed to mark expense as paid:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to mark expense as paid",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
