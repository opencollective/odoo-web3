import { corsHeaders } from "../shared.ts";

export async function handlePdfProxyRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  const pdfUrl = url.searchParams.get("url");
  const sessionId = url.searchParams.get("session_id");

  if (!pdfUrl) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: url" }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: session_id" }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const parsedUrl = new URL(pdfUrl);
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
    const response = await fetch(pdfUrl, {
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch PDF: ${response.status} ${response.statusText}`,
        }),
        { status: response.status, headers: corsHeaders }
      );
    }

    const pdfData = await response.arrayBuffer();

    return new Response(pdfData, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error proxying PDF:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch PDF",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
