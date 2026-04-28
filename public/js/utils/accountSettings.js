/**
 * Account settings (labels, hidden flag) stored in localStorage.
 * Server-side sync removed — the shared syncer no longer exposes this endpoint.
 */

import { getStorageKey } from "../config.js";

const LOCAL_KEY = () => getStorageKey("account_settings");

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

export function loadAccountSettings() {
  return readLocal();
}

export async function loadAccountSettingsFromServer() {
  // No-op: kept for API compatibility with existing callers.
  return null;
}

export function saveAccountSettings(settings) {
  writeLocal(settings);
}

export function getAccountLabel(settings, addr) {
  return settings[addr]?.label || "";
}

export function isAccountHidden(settings, addr) {
  return !!settings[addr]?.hidden;
}
