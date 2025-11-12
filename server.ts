import { OdooClient, InvoiceDirection } from "./src/lib/odoo.ts";
import { privateKeyToAccount } from "viem/accounts";
import { signMessage } from "./src/lib/safe.ts";

const PORT = 8000;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Helper function to create and authenticate OdooClient
async function authenticateOdooClient(
  odooUrl: string,
  database: string,
  username?: string,
  password?: string
): Promise<OdooClient> {
  // If session_id is provided, we still need username/password for the OdooClient
  // but we can skip authentication since session_id implies already authenticated
  const client = new OdooClient({
    url: odooUrl,
    database: database,
    username: username || "",
    password: password || "",
  });

  const authenticated = await client.authenticate();
  if (!authenticated) {
    throw new Error("Authentication failed");
  }

  return client;
}

async function handleAuthenticateRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Get authentication parameters from query
  const odooUrl = url.searchParams.get("url");
  const database = url.searchParams.get("db");
  const username = url.searchParams.get("username");
  const password = url.searchParams.get("password");

  // Validate required parameters
  if (!odooUrl || !database || !username || !password) {
    return new Response(
      JSON.stringify({
        error: "Missing required parameters: url, db, username, password",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Security: Only allow URLs from *.odoo.com domains
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
    // Authenticate with Odoo to get session_id
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

    // Extract session_id from Set-Cookie header
    const setCookieHeader = authResponse.headers.get("set-cookie");
    let sessionId = null;

    if (setCookieHeader) {
      const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
      if (sessionMatch) {
        sessionId = sessionMatch[1];
      }
    }

    // Parse response body to check for errors
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

    // Return session_id to client
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

async function handlePdfProxyRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Get PDF URL and session_id from query parameters
  const pdfUrl = url.searchParams.get("url");
  const sessionId = url.searchParams.get("session_id");

  // Validate PDF URL is provided
  if (!pdfUrl) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: url" }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate session_id is provided
  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: session_id" }),
      { status: 401, headers: corsHeaders }
    );
  }

  // Security: Only allow URLs from *.odoo.com domains
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
    // Fetch PDF from Odoo with session cookie
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

    // Get the PDF content
    const pdfData = await response.arrayBuffer();

    // Return PDF with proper headers (including CORS)
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

async function handleInvoicesRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Get query parameters
  const type = (url.searchParams.get("type") || "all") as InvoiceDirection;
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  const odooUrl = url.searchParams.get("url") || Deno.env.get("ODOO_URL") || "";
  const database =
    url.searchParams.get("db") || Deno.env.get("ODOO_DATABASE") || "";

  // Support both session_id and username/password authentication
  const sessionId = url.searchParams.get("session_id");
  const username =
    url.searchParams.get("username") || Deno.env.get("ODOO_USERNAME") || "";
  const password =
    url.searchParams.get("password") || Deno.env.get("ODOO_PASSWORD") || "";

  // Validate required parameters
  if (!odooUrl || !database) {
    return new Response(
      JSON.stringify({
        error: "Missing required parameters: url, db",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Check authentication method
  if (!sessionId && (!username || !password)) {
    return new Response(
      JSON.stringify({
        error:
          "Authentication required: provide either session_id or username+password",
      }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // Authenticate with OdooClient
    const odooClient = await authenticateOdooClient(
      odooUrl,
      database,
      username,
      password
    );

    // Get invoices (pass since and until parameters directly to getLatestInvoices)
    const invoices = await odooClient.getLatestInvoices(
      limit,
      type,
      since || undefined,
      until || undefined
    );

    return new Response(JSON.stringify({ invoices }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleInvoiceDetailsRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Extract invoice ID from path: /api/odoo/invoices/:invoiceId
  const pathParts = url.pathname.split("/");
  const invoiceIdStr = pathParts[pathParts.length - 1];
  const invoiceId = parseInt(invoiceIdStr);

  if (isNaN(invoiceId)) {
    return new Response(JSON.stringify({ error: "Invalid invoice ID" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Get query parameters
  const odooUrl = url.searchParams.get("url") || Deno.env.get("ODOO_URL") || "";
  const database =
    url.searchParams.get("db") || Deno.env.get("ODOO_DATABASE") || "";

  // Support both session_id and username/password authentication
  const sessionId = url.searchParams.get("session_id");
  const username =
    url.searchParams.get("username") || Deno.env.get("ODOO_USERNAME") || "";
  const password =
    url.searchParams.get("password") || Deno.env.get("ODOO_PASSWORD") || "";

  // Validate required parameters
  if (!odooUrl || !database) {
    return new Response(
      JSON.stringify({
        error: "Missing required parameters: url, db",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Check authentication method
  if (!sessionId && (!username || !password)) {
    return new Response(
      JSON.stringify({
        error:
          "Authentication required: provide either session_id or username+password",
      }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // Authenticate with OdooClient
    const odooClient = await authenticateOdooClient(
      odooUrl,
      database,
      username,
      password,
      sessionId || undefined
    );

    // Get invoice details
    const invoice = await odooClient.getInvoiceDetails(invoiceId);

    return new Response(JSON.stringify({ invoice }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error fetching invoice details:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

function normalizeIban(iban: string): string {
  return iban.toUpperCase().replace(/\s/g, "");
}

async function handleMoneriumOrderPlacement(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      companyName,
      amount,
      iban,
      memo,
      environment,
      accessToken,
      accountAddress,
    } = body;

    if (!amount || !iban || !environment || !accessToken || !accountAddress) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: amount, iban, environment, accessToken, accountAddress",
        }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!companyName && !(firstName && lastName)) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: companyName or firstName and lastName",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get private key from environment
    let privateKey = Deno.env.get("PRIVATE_KEY");
    if (!privateKey) {
      console.error("❌ PRIVATE_KEY environment variable not set");
      return new Response(
        JSON.stringify({
          error: "Server configuration error: PRIVATE_KEY not set",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Ensure private key has 0x prefix
    if (!privateKey.startsWith("0x")) {
      privateKey = `0x${privateKey}`;
    }

    console.log(
      "🔑 Using private key (first 10 chars):",
      privateKey.substring(0, 10) + "..."
    );

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    console.log("🔑 Signing address:", account.address);

    // Build order payload according to Monerium API spec
    const chainName = environment === "production" ? "gnosis" : "chiado";

    const orderPayload = {
      amount: amount.toString(),
      currency: "eur",
      message: `Send EUR ${amount} to ${iban} at ${new Date()
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z")}`,
      signature: "0x", // Placeholder, will be replaced
      address: accountAddress,
      chain: chainName,
      counterpart: {
        identifier: {
          standard: "iban",
          iban: normalizeIban(iban),
        },
        details: {},
      },
      memo: memo || "",
      kind: "redeem", // for IBAN payments
    };

    if (companyName) {
      orderPayload.counterpart.details.companyName = companyName;
    } else if (firstName || lastName) {
      orderPayload.counterpart.details.firstName = firstName;
      orderPayload.counterpart.details.lastName = lastName;
    }

    // Create the signature message
    // According to Monerium docs, the message to sign should be the stringified JSON
    const messageToSign = orderPayload.message;
    console.log("📝 Message to sign:", messageToSign);

    const normalizedAccountAddress = accountAddress.toLowerCase();
    const signerAddress = account.address.toLowerCase();

    let signature: string;

    if (normalizedAccountAddress === signerAddress) {
      signature = await account.signMessage({
        message: messageToSign,
      });
      console.log("✍️ Signature using signer account:", signature);
    } else {
      console.log(
        "🔄 Using Safe SDK for signing with address:",
        accountAddress
      );

      signature = await signMessage(messageToSign, accountAddress);

      console.log("✍️ Signature via Safe SDK:", signature);
    }

    // Update payload with real signature
    const fullPayload = {
      ...orderPayload,
      signature: signature,
    };

    // Post to Monerium API
    const baseUrl =
      environment === "sandbox"
        ? "https://api.monerium.dev"
        : "https://api.monerium.app";

    console.log("🔄 Posting order to Monerium:");
    console.log("  URL:", `${baseUrl}/orders`);
    console.log(
      "  Access token:",
      accessToken[0] +
        (accessToken.length - 2) +
        accessToken[accessToken.length - 1]
    );
    console.log("  Full payload:", JSON.stringify(fullPayload, null, 2));

    const orderResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.monerium.api-v2+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fullPayload),
    });

    console.log("📥 Order Response Status:", orderResponse.status);

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("❌ Order Error Response:", orderData);
      return new Response(JSON.stringify(orderData), {
        status: orderResponse.status,
        headers: corsHeaders,
      });
    }

    console.log("✅ Order placed successfully:", orderData.id);

    return new Response(JSON.stringify(orderData), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Order placement error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

async function handleMoneriumTokenExchange(req: Request): Promise<Response> {
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

    // Exchange authorization code for access token
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

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // API endpoints
  if (url.pathname === "/api/odoo/invoices") {
    return handleInvoicesRequest(req);
  }

  // Match /api/odoo/invoices/:invoiceId (numeric ID)
  if (url.pathname.match(/^\/api\/odoo\/invoices\/\d+$/)) {
    return handleInvoiceDetailsRequest(req);
  }

  if (url.pathname === "/api/odoo/authenticate") {
    return handleAuthenticateRequest(req);
  }

  if (url.pathname === "/api/pdf/view") {
    return handlePdfProxyRequest(req);
  }

  if (url.pathname === "/api/monerium/token") {
    return handleMoneriumTokenExchange(req);
  }

  if (url.pathname === "/api/monerium/order") {
    return handleMoneriumOrderPlacement(req);
  }

  // Serve index.html for root path and client-side routes
  if (
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/monerium" ||
    url.pathname.match(/^\/invoices\/\d+$/) ||
    url.pathname.match(/^\/\d{4}\/\d{1,2}$/)
  ) {
    try {
      const html = await Deno.readTextFile("./public/index.html");
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    } catch {
      return new Response("index.html not found", { status: 404 });
    }
  }

  // Serve static files from public directory
  if (url.pathname.startsWith("/public/")) {
    try {
      const filePath = `.${url.pathname}`;
      const file = await Deno.readFile(filePath);
      const contentType = url.pathname.endsWith(".css")
        ? "text/css"
        : url.pathname.endsWith(".js")
        ? "application/javascript"
        : "text/plain";
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    } catch {
      return new Response("File not found", { status: 404 });
    }
  }

  return new Response("Not Found", { status: 404 });
}

console.log(`🚀 Server running at http://localhost:${PORT}/`);
console.log(`📋 API endpoints:`);
console.log(`   - /api/odoo/invoices - Fetch invoices from Odoo`);
console.log(`   - /api/odoo/invoices/:id - Fetch invoice details by ID`);
console.log(`   - /api/odoo/authenticate - Get Odoo session_id`);
console.log(
  `   - /api/pdf/view - PDF proxy (CORS workaround, requires session_id)`
);
console.log(
  `   - /api/monerium/token - Exchange Monerium OAuth code for token`
);
console.log(`   - /api/monerium/order - Place a Monerium payment order`);
console.log(`📄 Frontend routes:`);
console.log(`   - / - Main invoices list`);
console.log(`   - /invoices/:id - Invoice details view`);
console.log(`   - /:year/:month - Monthly invoices view`);
console.log(`   - /monerium - Monerium account view`);

Deno.serve({ port: PORT }, handleRequest);
