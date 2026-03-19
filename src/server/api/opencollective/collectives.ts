const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

const HOSTED_COLLECTIVES_QUERY = `
query GetHostedCollectives($hostSlug: String!, $limit: Int, $offset: Int) {
  host(slug: $hostSlug) {
    name
    slug
    description
    imageUrl
    hostedCollectives: hostedAccounts(limit: $limit, offset: $offset, accountType: [COLLECTIVE, FUND]) {
      totalCount
      nodes {
        id
        slug
        name
        description
        imageUrl
        isActive
        stats {
          balance {
            valueInCents
            currency
          }
        }
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

export async function handleCollectivesRequest(req: Request): Promise<Response> {
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
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  try {
    const variables = {
      hostSlug,
      limit,
      offset,
    };

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        query: HOSTED_COLLECTIVES_QUERY,
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
    console.error("Failed to fetch collectives:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch collectives",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
