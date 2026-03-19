import { type Address } from "viem";
import { corsHeaders } from "../shared.ts";
import {
  MONERIUM_CLIENT_ID,
  MONERIUM_CLIENT_SECRET,
  ENV,
  getBalance,
  getSafeSignatories,
} from "./utils.ts";

export async function handleMoneriumAddressesRequest(
  req: Request
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    let accessToken: string | null = null;
    let environment: string = ENV;

    if (MONERIUM_CLIENT_SECRET) {
      const baseUrl =
        ENV === "production"
          ? "https://api.monerium.app"
          : "https://api.monerium.dev";

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

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(
          errorData.error || "Failed to authenticate with client credentials"
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
    } else if (req.method === "POST") {
      const body = await req.json();
      accessToken = body.accessToken;
      environment = body.environment || ENV;

      if (!accessToken || typeof accessToken !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing accessToken in request body" }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      return new Response(
        JSON.stringify({
          error:
            "Either provide accessToken via POST, or configure MONERIUM_CLIENT_SECRET for GET requests",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to obtain access token" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const env = environment === "production" ? "production" : ENV || "sandbox";
    const baseUrl =
      env === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";

    const accountsResponse = await fetch(`${baseUrl}/addresses`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.monerium.api-v2+json",
      },
    });

    const data = await accountsResponse.json();

    if (!accountsResponse.ok) {
      return new Response(JSON.stringify(data), {
        status: accountsResponse.status,
        headers: corsHeaders,
      });
    }

    // Determine which chain to use based on environment
    // Production uses gnosis, sandbox/dev uses chiado
    const supportedChain = env === "production" ? "gnosis" : "chiado";

    const addresses = [];
    for (const address of data.addresses) {
      for (const chain of address.chains) {
        const addressAddr = address.address as Address;
        const chainName = chain as string;

        // Only process the supported chain for this environment
        // Skip ethereum and other unsupported chains
        if (chainName.toLowerCase() !== supportedChain) {
          console.log(
            `Skipping chain ${chainName} (not supported in ${env} environment, using ${supportedChain})`
          );
          continue;
        }

        const [balance, signatories] = await Promise.all([
          getBalance(addressAddr, chainName),
          getSafeSignatories(addressAddr, chainName),
        ]);

        console.log(`Balance of ${addressAddr} on ${chainName}: ${balance}`);
        if (signatories) {
          console.log(
            `Signatories of ${addressAddr} on ${chainName}:`,
            signatories.length
          );
        }

        addresses.push({
          address: addressAddr,
          chain: chainName,
          balance,
          signatories: signatories || undefined,
        });
      }
    }

    return new Response(JSON.stringify(addresses), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
