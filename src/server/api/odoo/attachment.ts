import { corsHeaders } from "../shared.ts";

let cachedSession: { sessionId: string; expiresAt: number } | null = null;

async function getOdooSession(
  odooUrl: string,
  database: string,
  username: string,
  password: string
): Promise<string> {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.sessionId;
  }

  const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { db: database, login: username, password },
    }),
  });

  if (!authResponse.ok) {
    throw new Error(
      `Odoo auth failed: ${authResponse.status} ${authResponse.statusText}`
    );
  }

  const setCookie = authResponse.headers.get("set-cookie") || "";
  const match = setCookie.match(/session_id=([^;]+)/);
  if (!match) {
    throw new Error("No session_id in Odoo auth response");
  }

  const sessionId = match[1];
  cachedSession = { sessionId, expiresAt: now + 55 * 60 * 1000 };
  return sessionId;
}

export async function handleOdooAttachmentRequest(
  req: Request
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid id parameter" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const odooUrl = process.env.ODOO_URL || "";
  const database = process.env.ODOO_DATABASE || "";
  const username = process.env.ODOO_USERNAME || "";
  const password = process.env.ODOO_PASSWORD || "";

  if (!odooUrl || !database || !username || !password) {
    return new Response(
      JSON.stringify({ error: "Odoo not configured" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    let sessionId = await getOdooSession(odooUrl, database, username, password);
    const attachmentUrl = `${odooUrl}/web/content/${id}`;

    let response = await fetch(attachmentUrl, {
      headers: { Cookie: `session_id=${sessionId}` },
      redirect: "follow",
    });

    // If session was invalid, refresh once
    if (response.status === 401 || response.status === 403) {
      cachedSession = null;
      sessionId = await getOdooSession(odooUrl, database, username, password);
      response = await fetch(attachmentUrl, {
        headers: { Cookie: `session_id=${sessionId}` },
        redirect: "follow",
      });
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch attachment: ${response.status} ${response.statusText}`,
        }),
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.arrayBuffer();
    const contentType =
      response.headers.get("Content-Type") || "application/octet-stream";

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error proxying Odoo attachment:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Proxy error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
