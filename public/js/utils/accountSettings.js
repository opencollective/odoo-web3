/**
 * Shared account settings helpers.
 * Labels and hidden state are stored server-side in settings.json (accounts[]).
 * localStorage is used as a fast local cache.
 */

import { getStorageKey } from "../config.js";

const LOCAL_KEY = () => getStorageKey("account_settings");

// ── Local cache (localStorage) ──

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(settings) {
  try {
    localStorage.setItem(LOCAL_KEY(), JSON.stringify(settings));
  } catch {}
}

// ── Server API ──

async function fetchServerAccounts() {
  try {
    const resp = await fetch("/api/sync/settings");
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.accounts || [];
  } catch {
    return [];
  }
}

function accountsToMap(accounts) {
  const map = {};
  for (const a of accounts) {
    if (a.label || a.hidden) {
      map[a.address] = { label: a.label || "", hidden: a.hidden || false };
    }
  }
  return map;
}

function mapToAccounts(map, existingAccounts) {
  // Update existing accounts with new label/hidden values
  const updated = existingAccounts.map((a) => {
    const entry = map[a.address];
    if (entry) {
      return { ...a, label: entry.label || undefined, hidden: entry.hidden || undefined };
    }
    return a;
  });
  // Add entries from map that aren't in existing accounts
  for (const [address, entry] of Object.entries(map)) {
    if (!updated.find((a) => a.address.toLowerCase() === address.toLowerCase())) {
      updated.push({ address, label: entry.label, hidden: entry.hidden, enabled: false });
    }
  }
  return updated;
}

async function saveToServer(map) {
  try {
    const serverAccounts = await fetchServerAccounts();
    const updatedAccounts = mapToAccounts(map, serverAccounts);
    await fetch("/api/sync/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts: updatedAccounts }),
    });
  } catch {}
}

// ── Public API ──

export function loadAccountSettings() {
  return readLocal();
}

export async function loadAccountSettingsFromServer() {
  const accounts = await fetchServerAccounts();
  if (accounts.length > 0) {
    const serverMap = accountsToMap(accounts);
    if (Object.keys(serverMap).length > 0) {
      const local = readLocal();
      const merged = { ...local, ...serverMap };
      writeLocal(merged);
      return merged;
    }
  }
  return null;
}

export function saveAccountSettings(settings) {
  writeLocal(settings);
  saveToServer(settings);
}

export function getAccountLabel(settings, addr) {
  return settings[addr]?.label || "";
}

export function isAccountHidden(settings, addr) {
  return !!settings[addr]?.hidden;
}
