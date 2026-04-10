import { mkdir } from "node:fs/promises";
import { corsHeaders } from "./shared.ts";

export interface SyncAccount {
  address: string;
  label?: string;
  hidden?: boolean;
  enabled: boolean;
}

export interface AppSettings {
  accounts: SyncAccount[];
  updatedAt: string;
}

const DATA_DIR = process.env.DATA_DIR || "./data";
const SETTINGS_PATH = `${DATA_DIR}/settings.json`;

export async function loadSettings(): Promise<AppSettings | null> {
  try {
    const data = await Bun.file(SETTINGS_PATH).text();
    return JSON.parse(data) as AppSettings;
  } catch {
    return null;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Alias for cron.ts
export const loadSyncSettings = loadSettings;

export async function handleSyncSettingsRequest(
  req: Request
): Promise<Response> {
  if (req.method === "GET") {
    const settings = await loadSettings();
    return new Response(JSON.stringify(settings || { accounts: [] }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      // Merge with existing settings to preserve fields not sent
      const existing = await loadSettings();
      const settings: AppSettings = {
        ...existing,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      await saveSettings(settings);
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
