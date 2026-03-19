import { corsHeaders } from "../shared.ts";
import { MONERIUM_CLIENT_ID, MONERIUM_CLIENT_SECRET, ENV } from "./utils.ts";

export async function handleMoneriumCheckAddress(
  req: Request
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const address = body.address;

    if (!address) {
      return new Response(
        JSON.stringify({ error: "Missing address", found: false }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Use custom credentials if provided, otherwise fall back to env vars
    const clientId = body.client_id || MONERIUM_CLIENT_ID;
    const clientSecret = body.client_secret || MONERIUM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          found: false,
          configured: false,
          error: "Monerium credentials not configured",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const env = body.environment || ENV;
    const baseUrl =
      env === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";

    // Authenticate
    const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Monerium auth failed:", tokenResponse.status, errorData);
      return new Response(
        JSON.stringify({
          found: false,
          configured: true,
          addresses: [],
          error: "Failed to authenticate with Monerium. Check your credentials.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const tokenData = await tokenResponse.json();

    // Fetch addresses
    const addrResponse = await fetch(`${baseUrl}/addresses`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.monerium.api-v2+json",
      },
    });

    if (!addrResponse.ok) {
      return new Response(
        JSON.stringify({
          found: false,
          configured: true,
          addresses: [],
          error: "Failed to fetch Monerium addresses",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const addrData = await addrResponse.json();
    const rawAddresses = addrData.addresses || [];

    const addressList = rawAddresses.map((a: { address: string; chains: string[] }) => ({
      address: a.address,
      chains: a.chains,
    }));

    console.log(
      `Monerium addresses linked to this account:`,
      addressList.map((a: { address: string; chains: string[] }) => `${a.address} (${a.chains.join(", ")})`)
    );

    const found = rawAddresses.some(
      (a: { address: string }) =>
        a.address.toLowerCase() === address.toLowerCase()
    );

    return new Response(
      JSON.stringify({ found, configured: true, addresses: addressList }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Monerium check-address error:", error);
    return new Response(
      JSON.stringify({
        found: false,
        configured: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 200, headers: corsHeaders }
    );
  }
}
