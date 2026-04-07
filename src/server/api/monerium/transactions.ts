import { corsHeaders } from "../shared.ts";
import { MONERIUM_CLIENT_ID, MONERIUM_CLIENT_SECRET, ENV } from "./utils.ts";
import { readCache, writeCache } from "../../../lib/cache.ts";

async function getAccessToken(environment: string): Promise<string> {
  const baseUrl =
    environment === "production"
      ? "https://api.monerium.app"
      : "https://api.monerium.dev";

  const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
  return tokenData.access_token;
}

interface MoneriumOrderRaw {
  id: string;
  kind: string;
  address: string;
  chain: string;
  currency: string;
  amount: string;
  counterpart: {
    identifier: {
      standard: string;
      iban?: string;
      chain?: string;
      address?: string;
    };
    details: {
      name?: string;
      companyName?: string;
      firstName?: string;
      lastName?: string;
      country?: string;
    };
  };
  memo?: string;
  state: string;
  meta: {
    placedAt: string;
    processedAt?: string;
    txHashes?: string[];
  };
}

export async function handleMoneriumTransactionsRequest(
  req: Request
): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const addressFilter = url.searchParams.get("address");
    const forceRefresh = url.searchParams.get("refresh") === "true";

    if (!MONERIUM_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "MONERIUM_CLIENT_SECRET not configured" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check cache first (unless refresh is forced)
    const cacheKey = addressFilter
      ? `monerium-transactions-${ENV}-${addressFilter.toLowerCase()}`
      : `monerium-transactions-${ENV}-all`;

    if (!forceRefresh) {
      const cached = await readCache<{
        transactions: unknown[];
        addresses: string[];
        cachedAt: string;
      }>(cacheKey);
      if (cached) {
        console.log(
          `[cache] Using cached transactions (${cached.transactions.length} entries)`
        );
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: corsHeaders,
        });
      }
    }

    const accessToken = await getAccessToken(ENV);
    const baseUrl =
      ENV === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";

    const supportedChain = ENV === "production" ? "gnosis" : "chiado";

    // Get addresses
    const addrResp = await fetch(`${baseUrl}/addresses`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.monerium.api-v2+json",
      },
    });
    const addrData = await addrResp.json();
    const allAddresses: string[] = (addrData.addresses || [])
      .filter((a: { chains: string[] }) =>
        a.chains.some((c: string) => c.toLowerCase() === supportedChain)
      )
      .map((a: { address: string }) => a.address);

    // Filter to specific address if requested
    const addresses = addressFilter
      ? allAddresses.filter(
          (a) => a.toLowerCase() === addressFilter.toLowerCase()
        )
      : allAddresses;

    if (addresses.length === 0) {
      return new Response(
        JSON.stringify({
          transactions: [],
          addresses: allAddresses,
          cachedAt: new Date().toISOString(),
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Fetch orders for each address and Odoo reconciliation data in parallel
    const orderPromises = addresses.map(async (addr) => {
      const ordersUrl = new URL(`${baseUrl}/orders`);
      ordersUrl.searchParams.set("address", addr);
      const resp = await fetch(ordersUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.monerium.api-v2+json",
        },
      });
      const data = await resp.json();
      return Array.isArray(data) ? data : data.orders || [];
    });

    // Check reconciliation status + invoice details via Odoo
    const odooUrl = process.env.ODOO_URL || "";
    const odooDb = process.env.ODOO_DATABASE || "";
    const odooUser = process.env.ODOO_USERNAME || "";
    const odooPass = process.env.ODOO_PASSWORD || "";

    const reconciledPromise = (async () => {
      if (!odooUrl || !odooDb || !odooUser || !odooPass)
        return { txHashes: new Set<string>(), invoicesByTxHash: new Map() };

      try {
        const { authenticateOdooClient } = await import("../odoo/utils.ts");
        const odooClient = await authenticateOdooClient(
          odooUrl, odooDb, odooUser, odooPass
        );
        const invoicesByTxHash = await odooClient.getReconciledInvoicesByTxHash();
        const txHashes = new Set(invoicesByTxHash.keys());
        return { txHashes, invoicesByTxHash };
      } catch (err) {
        console.error("Failed to check Odoo reconciliation:", err);
        return { txHashes: new Set<string>(), invoicesByTxHash: new Map() };
      }
    })();

    const [orderArrays, reconciledData] = await Promise.all([
      Promise.all(orderPromises),
      reconciledPromise,
    ]);
    const reconciledTxHashes = reconciledData.txHashes;
    const invoicesByTxHash = reconciledData.invoicesByTxHash;

    const allOrders = orderArrays.flat();

    // Filter to only orders on the supported chain
    const chainOrders = allOrders.filter(
      (o: MoneriumOrderRaw) => o.chain.toLowerCase() === supportedChain
    );

    // Build transaction list
    const transactions = chainOrders.map((order: MoneriumOrderRaw) => {
      const txHashes = order.meta.txHashes || [];
      const reconciledHash = txHashes.find((h) =>
        reconciledTxHashes.has(h.toLowerCase())
      );
      const isReconciled = !!reconciledHash;
      const invoice = reconciledHash
        ? invoicesByTxHash.get(reconciledHash.toLowerCase()) || null
        : null;

      // Determine counterparty name
      const details = order.counterpart.details;
      const counterpartyName =
        details.companyName ||
        details.name ||
        [details.firstName, details.lastName].filter(Boolean).join(" ") ||
        (order.counterpart.identifier.standard === "chain"
          ? `${order.counterpart.identifier.address?.slice(0, 6)}...${order.counterpart.identifier.address?.slice(-4)}`
          : "Unknown");

      const counterpartyIban =
        order.counterpart.identifier.standard === "iban"
          ? order.counterpart.identifier.iban || null
          : null;

      return {
        id: order.id,
        date: order.meta.processedAt || order.meta.placedAt,
        kind: order.kind,
        address: order.address,
        chain: order.chain,
        currency: order.currency,
        amount: order.amount,
        counterpartyName,
        counterpartyIban,
        counterpartyCountry: details.country || null,
        memo: order.memo || null,
        state: order.state,
        isReconciled,
        invoice: invoice ? {
          id: invoice.invoiceId,
          name: invoice.invoiceName,
          partnerName: invoice.partnerName,
          amountTotal: invoice.amountTotal,
          pdfUrl: invoice.pdfUrl,
          attachments: invoice.attachments,
        } : null,
        odooUrl: isReconciled && invoice ? odooUrl : null,
        txHashes,
        placedAt: order.meta.placedAt,
        processedAt: order.meta.processedAt || null,
      };
    });

    // Sort by date descending
    transactions.sort(
      (a: { date: string }, b: { date: string }) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const result = {
      transactions,
      addresses: allAddresses,
      cachedAt: new Date().toISOString(),
    };

    // Write to cache
    await writeCache(cacheKey, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
