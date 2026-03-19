import { corsHeaders } from "../shared.ts";
import { MONERIUM_CLIENT_ID, MONERIUM_CLIENT_SECRET, ENV } from "./utils.ts";

export function handleMoneriumConfigRequest(): Response {
  return new Response(
    JSON.stringify({
      clientId: MONERIUM_CLIENT_ID,
      environment: ENV,
      hasClientSecret: Boolean(MONERIUM_CLIENT_SECRET),
    }),
    {
      status: 200,
      headers: corsHeaders,
    }
  );
}
