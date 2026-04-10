import { mkdir } from "node:fs/promises";
import { corsHeaders } from "./shared.ts";

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

const DATA_DIR = process.env.DATA_DIR || "./data";
const SETTINGS_PATH = `${DATA_DIR}/sync-settings.json`;

export async function loadSyncSettings(): Promise<SyncSettings | null> {
  try {
    const data = await Bun.file(SETTINGS_PATH).text();
    return JSON.parse(data) as SyncSettings;
  } catch {
    return null;
  }
}

export async function saveSyncSettings(settings: SyncSettings): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
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
