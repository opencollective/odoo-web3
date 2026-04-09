import { corsHeaders } from "./shared.ts";
import { readCache, writeCache } from "../../lib/cache.ts";

export interface SyncAccount {
  address: string;
  label?: string;
  enabled: boolean;
}

export interface SyncSettings {
  accounts: SyncAccount[];
  odooUrl?: string;
  updatedAt: string;
}

const CACHE_KEY = "sync-settings";

export async function loadSyncSettings(): Promise<SyncSettings | null> {
  return readCache<SyncSettings>(CACHE_KEY);
}

export async function saveSyncSettings(settings: SyncSettings): Promise<void> {
  await writeCache(CACHE_KEY, settings);
}

export async function handleSyncSettingsRequest(
  req: Request
): Promise<Response> {
  if (req.method === "GET") {
    const settings = await loadSyncSettings();
    return new Response(JSON.stringify(settings || { accounts: [] }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const settings: SyncSettings = {
        accounts: body.accounts || [],
        odooUrl: body.odooUrl || undefined,
        updatedAt: new Date().toISOString(),
      };
      await saveSyncSettings(settings);
      return new Response(JSON.stringify(settings), {
        status: 200,
        headers: corsHeaders,
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: corsHeaders }
      );
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: corsHeaders,
  });
}
