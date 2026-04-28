const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

const HOST_EXPENSES_QUERY = `
query GetHostExpenses($hostSlug: String!, $limit: Int, $offset: Int, $status: [ExpenseStatusFilter]) {
  host(slug: $hostSlug) {
    name
    slug
  }
  all: expenses(host: { slug: $hostSlug }, limit: 1) {
    totalCount
  }
  pending: expenses(host: { slug: $hostSlug }, limit: 1, status: [PENDING]) {
    totalCount
  }
  approved: expenses(host: { slug: $hostSlug }, limit: 1, status: [APPROVED]) {
    totalCount
  }
  paid: expenses(host: { slug: $hostSlug }, limit: 1, status: [PAID]) {
    totalCount
  }
  rejected: expenses(host: { slug: $hostSlug }, limit: 1, status: [REJECTED]) {
    totalCount
  }
  processing: expenses(host: { slug: $hostSlug }, limit: 1, status: [PROCESSING]) {
    totalCount
  }
  expenses(host: { slug: $hostSlug }, limit: $limit, offset: $offset, status: $status) {
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
      account {
        name
        slug
        imageUrl
        type
        ... on AccountWithParent {
          parent {
            name
            slug
          }
        }
        members(role: [ADMIN], limit: 1) {
          nodes {
            account {
              name
              slug
            }
          }
        }
        stats {
          balance {
            valueInCents
            currency
          }
        }
      }
      payee {
        name
        slug
        ... on Individual {
          email
        }
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

export async function handleHostExpensesRequest(req: Request): Promise<Response> {
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
  const hostSlug = url.searchParams.get("hostSlug") || "citizenspring-asbl";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const status = url.searchParams.get("status") || null;

  try {
    const variables: Record<string, unknown> = {
      hostSlug,
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
        query: HOST_EXPENSES_QUERY,
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
    console.error("Failed to fetch host expenses:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch host expenses",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
