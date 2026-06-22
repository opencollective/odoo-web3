import { corsHeaders } from "../shared.ts";
import { MONERIUM_CLIENT_ID, MONERIUM_CLIENT_SECRET, ENV } from "./utils.ts";

export function handleMoneriumConfigRequest(): Response {
  return new Response(
    JSON.stringify({
      clientId: MONERIUM_CLIENT_ID,
      environment: ENV,
      hasClientSecret: Boolean(MONERIUM_CLIENT_SECRET),
      // Needed to collect signatures for multisig (M-of-N) Safe accounts via the
      // Safe Transaction Service. A custom tx service URL can replace the API key.
      safeApiKeyConfigured: Boolean(process.env.SAFE_API_KEY),
      safeTxServiceUrlConfigured: Boolean(process.env.SAFE_TX_SERVICE_URL),
    }),
    {
      status: 200,
      headers: corsHeaders,
    }
  );
}
