import { handleAuthenticateRequest } from "./api/odoo/authenticate.ts";
import { handlePdfProxyRequest } from "./api/odoo/pdf.ts";
import { handleInvoicesRequest } from "./api/odoo/invoices.ts";
import { handleInvoiceDetailsRequest } from "./api/odoo/invoice-details.ts";
import { handleTransactionsRequest } from "./api/odoo/transactions.ts";
import { handleEmployeesRequest } from "./api/odoo/employees.ts";
import { handleJournalsRequest } from "./api/odoo/journals.ts";
import { handleSyncRequest } from "./api/odoo/sync.ts";
import { handleDoctorRequest } from "./api/odoo/doctor.ts";
import { handleMatchingInvoicesRequest, handleReconcileRequest } from "./api/odoo/reconcile.ts";
import { handleSyncStatusRequest } from "./api/odoo/sync-status.ts";
import { handleMoneriumTokenExchange } from "./api/monerium/token.ts";
import { handleMoneriumConfigRequest } from "./api/monerium/config.ts";
import { handleMoneriumClientCredentialsAuth } from "./api/monerium/authenticate.ts";
import { handleMoneriumAddressesRequest } from "./api/monerium/addresses.ts";
import { handleMoneriumOrderPlacement } from "./api/monerium/order.ts";
import { handleMoneriumOrdersRequest } from "./api/monerium/orders.ts";
import { handleMoneriumSignerAddressRequest } from "./api/monerium/signer-address.ts";
import { handleMoneriumCheckAddress } from "./api/monerium/check-address.ts";
import { handleBatchOrder } from "./api/monerium/batch-order.ts";
import { handleTransfersRequest } from "./api/monerium/transfers.ts";
import { handleMoneriumTransactionsRequest } from "./api/monerium/transactions.ts";
import { handleExpensesRequest } from "./api/opencollective/expenses.ts";
import { handleMarkPaidRequest } from "./api/opencollective/markPaid.ts";
import { handleTestConnectionRequest } from "./api/opencollective/test.ts";
import { handleFileProxyRequest } from "./api/opencollective/file.ts";
import { handleCollectivesRequest } from "./api/opencollective/collectives.ts";
import { transform } from "@swc/core";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8000;
const ENV = process.env.ENV === "production" ? "production" : "sandbox";

function getSignerAddressFromPrivateKey(): string | null {
  const privateKeyRaw = process.env.PRIVATE_KEY;
  if (!privateKeyRaw) return null;

  const privateKey = privateKeyRaw.startsWith("0x")
    ? privateKeyRaw
    : `0x${privateKeyRaw}`;

  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    return account.address;
  } catch (error) {
    console.error(
      "Failed to derive signer address from PRIVATE_KEY:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

const signerAddressFromPrivateKey = getSignerAddressFromPrivateKey();
const serverWalletAddress =
  process.env.SERVER_WALLET_ADDRESS || signerAddressFromPrivateKey || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const addPublicEnvironmentVariables = (html: string) => {
  const PUBLIC_ENV_VARIABLES = ["ENV", "SERVER_WALLET_ADDRESS"];
  return PUBLIC_ENV_VARIABLES.reduce((acc, variable) => {
    const value =
      variable === "SERVER_WALLET_ADDRESS"
        ? serverWalletAddress
        : process.env[variable] || "";
    return acc.replace(`{{${variable}}}`, value);
  }, html);
};

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

  if (url.pathname === "/api/odoo/transactions") {
    return handleTransactionsRequest(req);
  }

  if (url.pathname === "/api/odoo/employees") {
    return handleEmployeesRequest(req);
  }

  if (url.pathname === "/api/odoo/journals") {
    return handleJournalsRequest(req);
  }

  if (url.pathname === "/api/odoo/sync") {
    return handleSyncRequest(req);
  }

  if (url.pathname === "/api/odoo/sync-status") {
    return handleSyncStatusRequest(req);
  }

  if (url.pathname === "/api/odoo/doctor") {
    return handleDoctorRequest(req);
  }

  if (url.pathname === "/api/odoo/matching-invoices") {
    return handleMatchingInvoicesRequest(req);
  }

  if (url.pathname === "/api/odoo/reconcile") {
    return handleReconcileRequest(req);
  }

  if (url.pathname === "/api/pdf/view") {
    return handlePdfProxyRequest(req);
  }

  if (url.pathname === "/api/monerium/token") {
    return handleMoneriumTokenExchange(req);
  }

  if (url.pathname === "/api/monerium/config") {
    return handleMoneriumConfigRequest();
  }

  if (url.pathname === "/api/monerium/authenticate") {
    return handleMoneriumClientCredentialsAuth(req);
  }

  if (url.pathname === "/api/monerium/addresses") {
    return handleMoneriumAddressesRequest(req);
  }

  if (url.pathname === "/api/monerium/order") {
    return handleMoneriumOrderPlacement(req);
  }

  if (url.pathname === "/api/monerium/orders") {
    return handleMoneriumOrdersRequest(req);
  }

  if (url.pathname === "/api/monerium/check-address") {
    return handleMoneriumCheckAddress(req);
  }

  if (url.pathname === "/api/monerium/signer-address") {
    return handleMoneriumSignerAddressRequest();
  }

  if (url.pathname === "/api/monerium/batch-order") {
    return handleBatchOrder(req);
  }

  if (url.pathname === "/api/monerium/transfers") {
    return handleTransfersRequest(req);
  }

  if (url.pathname === "/api/monerium/transactions") {
    return handleMoneriumTransactionsRequest(req);
  }

  // Open Collective API endpoints
  if (url.pathname === "/api/opencollective/expenses") {
    return handleExpensesRequest(req);
  }

  if (url.pathname === "/api/opencollective/mark-paid") {
    return handleMarkPaidRequest(req);
  }

  if (url.pathname === "/api/opencollective/test") {
    return handleTestConnectionRequest(req);
  }

  if (url.pathname === "/api/opencollective/file") {
    return handleFileProxyRequest(req);
  }

  if (url.pathname === "/api/opencollective/collectives") {
    return handleCollectivesRequest(req);
  }

  // Serve monerium.html for /monerium route
  if (url.pathname === "/monerium") {
    try {
      const html = await Bun.file("./public/monerium.html").text();
      return new Response(addPublicEnvironmentVariables(html), {
        headers: { "Content-Type": "text/html" },
      });
    } catch {
      return new Response("monerium.html not found", { status: 404 });
    }
  }

  // Serve index.html for root path and client-side routes
  if (
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/bills" ||
    url.pathname === "/collectives" ||
    url.pathname === "/settings" ||
    url.pathname === "/odoo/sync" ||
    url.pathname === "/odoo/doctor" ||
    url.pathname === "/monerium/pay" ||
    url.pathname === "/transactions" ||
    url.pathname.match(/^\/transactions\/0x[a-fA-F0-9]+$/) ||
    url.pathname.match(/^\/invoices\/\d+$/) ||
    url.pathname.match(/^\/\d{4}\/\d{1,2}$/) ||
    url.pathname.match(/^\/oc\/.+$/)
  ) {
    try {
      const html = await Bun.file("./public/index.html").text();
      return new Response(addPublicEnvironmentVariables(html), {
        headers: { "Content-Type": "text/html" },
      });
    } catch {
      return new Response("index.html not found", { status: 404 });
    }
  }

  // Serve JavaScript modules
  if (url.pathname.startsWith("/js/")) {
    console.log("Serving JavaScript module:", url.pathname);
    try {
      const filePath = `./public${url.pathname}`;

      // Inject environment variables into config.js
      if (url.pathname === "/js/config.js") {
        const file = await Bun.file(filePath).text();
        const configWithEnv = file
          .replace(
            '"{{ENV}}" || "sandbox"',
            `"${process.env.ENV || "sandbox"}"`
          )
          .replace(
            '"{{SERVER_WALLET_ADDRESS}}" || ""',
            `"${serverWalletAddress}"`
          );
        return new Response(configWithEnv, {
          headers: { "Content-Type": "application/javascript" },
        });
      }

      // Transpile JSX files using SWC
      if (url.pathname.endsWith(".jsx")) {
        const file = await Bun.file(filePath).text();

        const result = await transform(file, {
          jsc: {
            parser: {
              syntax: "ecmascript",
              jsx: true,
            },
            transform: {
              react: {
                pragma: "React.createElement",
                pragmaFrag: "React.Fragment",
                throwIfNamespace: false,
                development: false,
                useBuiltins: false,
              },
            },
            target: "es2020",
          },
          module: {
            type: "es6",
          },
        });

        return new Response(result.code, {
          headers: { "Content-Type": "application/javascript" },
        });
      }

      // Serve regular JavaScript files
      return new Response(Bun.file(filePath), {
        headers: { "Content-Type": "application/javascript" },
      });
    } catch (error) {
      console.error("Error serving JavaScript module:", error);
      return new Response("File not found", { status: 404 });
    }
  }

  // Serve static files from public directory
  if (url.pathname.startsWith("/public/")) {
    try {
      const filePath = `.${url.pathname}`;
      const bunFile = Bun.file(filePath);
      const contentType = url.pathname.endsWith(".css")
        ? "text/css"
        : url.pathname.endsWith(".js")
        ? "application/javascript"
        : "text/plain";
      return new Response(bunFile, {
        headers: { "Content-Type": contentType },
      });
    } catch {
      return new Response("File not found", { status: 404 });
    }
  }

  return new Response("Not Found", { status: 404 });
}

console.log(
  `🚀 Server running at http://localhost:${PORT}/ in ${ENV} environment`
);
if (signerAddressFromPrivateKey) {
  console.log(
    `🔑 Signer address (from PRIVATE_KEY): ${signerAddressFromPrivateKey}`
  );
} else {
  console.log("🔑 Signer address: not configured (PRIVATE_KEY not set)");
}
if (process.env.SERVER_WALLET_ADDRESS) {
  console.log(
    `🧾 SERVER_WALLET_ADDRESS (explicit): ${process.env.SERVER_WALLET_ADDRESS}`
  );
} else if (signerAddressFromPrivateKey) {
  console.log(
    `🧾 SERVER_WALLET_ADDRESS (derived from PRIVATE_KEY): ${serverWalletAddress}`
  );
}
console.log(`📋 API endpoints:`);
console.log(`   - /api/odoo/invoices - Fetch invoices from Odoo`);
console.log(`   - /api/odoo/invoices/:id - Fetch invoice details by ID`);
console.log(
  `   - /api/odoo/transactions - Fetch transactions from Odoo journal`
);
console.log(`   - /api/odoo/employees - Fetch employees with bank accounts`);
console.log(`   - /api/odoo/journals - List/create bank journals`);
console.log(`   - /api/odoo/sync - Sync blockchain transactions to Odoo`);
console.log(`   - /api/odoo/authenticate - Get Odoo session_id`);
console.log(
  `   - /api/pdf/view - PDF proxy (CORS workaround, requires session_id)`
);
console.log(
  `   - /api/monerium/token - Exchange Monerium OAuth code for token`
);
console.log(
  `   - /api/monerium/authenticate - Direct authentication using client credentials (if MONERIUM_CLIENT_SECRET is set)`
);
console.log(`   - /api/monerium/config - Monerium client configuration`);
console.log(
  `   - /api/monerium/accounts - List Monerium accounts (GET with client secret, or POST with accessToken)`
);
console.log(`   - /api/monerium/order - Place a Monerium payment order`);
console.log(`📄 Frontend routes:`);
console.log(`   - / - Homepage`);
console.log(`   - /bills - Odoo invoices list`);
console.log(`   - /collectives - Hosted collectives list`);
console.log(`   - /settings - Settings page`);
console.log(`   - /invoices/:id - Invoice details view`);
console.log(`   - /:year/:month - Monthly invoices view`);
console.log(`   - /monerium - Monerium account view`);
console.log(`   - /oc/:slug - Open Collective expenses for a collective`);
console.log(`🔌 Open Collective API endpoints:`);
console.log(`   - /api/opencollective/collectives - Fetch hosted collectives`);
console.log(`   - /api/opencollective/expenses - Fetch expenses for a collective`);
console.log(`   - /api/opencollective/mark-paid - Mark an expense as paid`);
console.log(`   - /api/opencollective/test - Test API key connection`);

Bun.serve({ port: PORT, fetch: handleRequest });
