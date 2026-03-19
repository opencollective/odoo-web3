const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-oc-api-key",
};

export async function handleFileProxyRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = req.headers.get("x-oc-api-key");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing Open Collective API key" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const fileUrl = url.searchParams.get("url");

  if (!fileUrl) {
    return new Response(
      JSON.stringify({ error: "Missing file URL" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate URL is from Open Collective
  try {
    const parsedUrl = new URL(fileUrl);
    if (!parsedUrl.hostname.includes("opencollective.com") &&
        !parsedUrl.hostname.includes("opencollective-production.s3")) {
      return new Response(
        JSON.stringify({ error: "Invalid file URL - must be from Open Collective" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid URL format" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch the file with the API key
    const response = await fetch(fileUrl, {
      headers: {
        "Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Failed to fetch file:", response.status, text);
      return new Response(
        JSON.stringify({ error: `Failed to fetch file: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get content type from response
    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const contentDisposition = response.headers.get("Content-Disposition");

    // Stream the file back
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
    };

    if (contentDisposition) {
      responseHeaders["Content-Disposition"] = contentDisposition;
    }

    return new Response(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Failed to proxy file:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch file",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
