import { corsHeaders } from "../shared.ts";

export async function handleAuthenticateRequest(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);

  const odooUrl = url.searchParams.get("url");
  const database = url.searchParams.get("db");
  const username = url.searchParams.get("username");
  const password = url.searchParams.get("password");

  if (!odooUrl || !database || !username || !password) {
    return new Response(
      JSON.stringify({
        error: "Missing required parameters: url, db, username, password",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const parsedUrl = new URL(odooUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (!hostname.endsWith(".odoo.com") && hostname !== "odoo.com") {
      return new Response(
        JSON.stringify({
          error: "Invalid URL: Only *.odoo.com domains are allowed",
          provided: hostname,
        }),
        { status: 403, headers: corsHeaders }
      );
    }
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid URL format" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          db: database,
          login: username,
          password: password,
        },
      }),
    });

    if (!authResponse.ok) {
      return new Response(
        JSON.stringify({
          error: `Authentication failed: ${authResponse.status} ${authResponse.statusText}`,
        }),
        { status: authResponse.status, headers: corsHeaders }
      );
    }

    const setCookieHeader = authResponse.headers.get("set-cookie");
    let sessionId = null;

    if (setCookieHeader) {
      const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
      if (sessionMatch) {
        sessionId = sessionMatch[1];
      }
    }

    const authData = await authResponse.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: "Failed to obtain session_id from Odoo",
          details: authData,
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        user_context: authData.result?.user_context,
        uid: authData.result?.uid,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Error authenticating with Odoo:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Authentication failed",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
