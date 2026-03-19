import { corsHeaders } from "../shared.ts";
import { MONERIUM_CLIENT_ID, MONERIUM_CLIENT_SECRET, ENV } from "./utils.ts";

export async function handleMoneriumClientCredentialsAuth(
  req: Request
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (!MONERIUM_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({
        error: "Client secret not configured. Use PKCE flow instead.",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const baseUrl =
      ENV === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";

    console.log("🔄 Client Credentials Auth Request:", {
      url: `${baseUrl}/auth/token`,
      clientId: MONERIUM_CLIENT_ID,
      baseUrl,
      environment: ENV,
    });

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

    console.log("📥 Client Credentials Response Status:", tokenResponse.status);

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("❌ Client Credentials Error Response:", tokenData);
      return new Response(JSON.stringify(tokenData), {
        status: tokenResponse.status,
        headers: corsHeaders,
      });
    }

    console.log("✅ Client Credentials Auth Successful");

    return new Response(JSON.stringify(tokenData), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Client credentials auth error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
