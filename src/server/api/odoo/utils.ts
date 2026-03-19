import { OdooClient } from "../../../lib/odoo.ts";

export async function authenticateOdooClient(
  odooUrl: string,
  database: string,
  username?: string,
  password?: string
): Promise<OdooClient> {
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
