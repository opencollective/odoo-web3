import { corsHeaders } from "../shared.ts";

export async function handleMoneriumTokenExchange(
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
    const { code, codeVerifier, clientId, environment } = body;

    if (!code || !codeVerifier || !clientId || !environment) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: code, codeVerifier, clientId, environment",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const baseUrl =
      environment === "sandbox"
        ? "https://api.monerium.dev"
        : "https://api.monerium.app";

    console.log("🔄 Backend Token Exchange Request:", {
      url: `${baseUrl}/auth/token`,
      clientId,
      environment,
    });

    const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        code_verifier: codeVerifier,
        client_id: clientId,
        redirect_uri: new URL(req.url).origin + "/monerium",
      }),
    });

    console.log("📥 Token Response Status:", tokenResponse.status);

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("❌ Token Error Response:", tokenData);
      return new Response(JSON.stringify(tokenData), {
        status: tokenResponse.status,
        headers: corsHeaders,
      });
    }

    console.log("✅ Token Exchange Successful");

    return new Response(JSON.stringify(tokenData), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Token exchange error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
