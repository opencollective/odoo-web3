const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

const TEST_QUERY = `
query TestConnection {
  me {
    id
    name
    email
  }
}
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-oc-api-key",
  "Content-Type": "application/json",
};

export async function handleTestConnectionRequest(req: Request): Promise<Response> {
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

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        query: TEST_QUERY,
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
    console.error("Failed to test connection:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to test connection",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
