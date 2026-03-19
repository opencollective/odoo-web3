import { corsHeaders } from "../shared.ts";
import { MONERIUM_CLIENT_ID, MONERIUM_CLIENT_SECRET, ENV } from "./utils.ts";

export async function handleMoneriumOrdersRequest(
  req: Request
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    let accessToken: string | null = null;
    let environment: string = ENV;
    let profileId: string | null = null;
    let address: string | null = null;

    if (req.method === "GET" && MONERIUM_CLIENT_SECRET) {
      const baseUrl =
        ENV === "production"
          ? "https://api.monerium.app"
          : "https://api.monerium.dev";

      // Get access token using client credentials
      const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: MONERIUM_CLIENT_ID,
          client_secret: MONERIUM_CLIENT_SECRET,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(
          errorData.error || "Failed to authenticate with client credentials"
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
    } else if (req.method === "POST") {
      const body = await req.json();
      accessToken = body.accessToken;
      environment = body.environment || ENV;
      profileId = body.profileId || null;
      address = body.address || null;

      if (!accessToken || typeof accessToken !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing accessToken in request body" }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      return new Response(
        JSON.stringify({
          error:
            "Either provide accessToken via POST, or configure MONERIUM_CLIENT_SECRET for GET requests",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to obtain access token" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const env = environment === "production" ? "production" : ENV || "sandbox";
    const baseUrl =
      env === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";

    // Build orders URL with optional filters
    const ordersUrl = new URL(`${baseUrl}/orders`);
    if (profileId) {
      ordersUrl.searchParams.set("profile", profileId);
    }
    if (address) {
      ordersUrl.searchParams.set("address", address);
    }

    const ordersResponse = await fetch(ordersUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.monerium.api-v2+json",
      },
    });

    const data = await ordersResponse.json();

    if (!ordersResponse.ok) {
      return new Response(JSON.stringify(data), {
        status: ordersResponse.status,
        headers: corsHeaders,
      });
    }

    // Return orders array (Monerium API returns { orders: [...] } or just an array)
    const orders = Array.isArray(data) ? data : data.orders || [];

    return new Response(JSON.stringify({ orders }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Monerium orders",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

