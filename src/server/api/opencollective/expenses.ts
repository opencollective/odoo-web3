const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

const EXPENSES_QUERY = `
query GetExpenses($slug: String!, $limit: Int, $offset: Int, $status: [ExpenseStatusFilter]) {
  account(slug: $slug) {
    name
    slug
    stats {
      balance {
        valueInCents
        currency
      }
    }
  }
  all: expenses(account: { slug: $slug }, limit: 1) {
    totalCount
  }
  pending: expenses(account: { slug: $slug }, limit: 1, status: [PENDING]) {
    totalCount
  }
  approved: expenses(account: { slug: $slug }, limit: 1, status: [APPROVED]) {
    totalCount
  }
  paid: expenses(account: { slug: $slug }, limit: 1, status: [PAID]) {
    totalCount
  }
  rejected: expenses(account: { slug: $slug }, limit: 1, status: [REJECTED]) {
    totalCount
  }
  processing: expenses(account: { slug: $slug }, limit: 1, status: [PROCESSING]) {
    totalCount
  }
  expenses(account: { slug: $slug }, limit: $limit, offset: $offset, status: $status) {
    totalCount
    nodes {
      id
      legacyId
      description
      status
      type
      createdAt
      amount
      currency
      payee {
        name
        slug
      }
      payoutMethod {
        type
        data
      }
      createdByAccount {
        name
      }
      attachedFiles {
        id
        url
        name
      }
      items {
        id
        description
        amount
        url
      }
    }
  }
}
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-oc-api-key",
  "Content-Type": "application/json",
};

export async function handleExpensesRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
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

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const status = url.searchParams.get("status") || null;

  if (!slug) {
    return new Response(
      JSON.stringify({ error: "Missing collective slug" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const variables: Record<string, unknown> = {
      slug,
      limit,
      offset,
    };

    if (status) {
      variables.status = [status];
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        query: EXPENSES_QUERY,
        variables,
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
    console.error("Failed to fetch expenses:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch expenses",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
