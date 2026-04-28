import { getStorageKey } from "../config.js";

// Helper functions to manage paid invoices in localStorage
export const getPaidInvoices = () => {
  try {
    const stored = localStorage.getItem(getStorageKey("paid_invoices"));
    if (!stored) return new Set();
    const ids = JSON.parse(stored);
    return new Set(Array.isArray(ids) ? ids : []);
  } catch (err) {
    console.error("Failed to load paid invoices:", err);
    return new Set();
  }
};

export const markInvoiceAsPaid = (invoiceId) => {
  try {
    const paidInvoices = getPaidInvoices();
    paidInvoices.add(invoiceId);
    localStorage.setItem(
      getStorageKey("paid_invoices"),
      JSON.stringify(Array.from(paidInvoices))
    );
  } catch (err) {
    console.error("Failed to save paid invoice:", err);
  }
};

export const isInvoicePaid = (invoiceId) => {
  const paidInvoices = getPaidInvoices();
  return paidInvoices.has(invoiceId);
};

export const getSelectedMoneriumAccount = () => {
  try {
    return localStorage.getItem(getStorageKey("monerium_selected_account")) || "";
  } catch (err) {
    return "";
  }
};

export const setSelectedMoneriumAccount = (address) => {
  try {
    if (address) {
      localStorage.setItem(getStorageKey("monerium_selected_account"), address);
    }
  } catch (err) {
    console.error("Failed to save selected Monerium account:", err);
  }
};

export const loadMoneriumConnectionState = () => {
  try {
    const stored = localStorage.getItem(
      getStorageKey("monerium_connection")
    );
    if (stored) {
      const connection = JSON.parse(stored);

      // Check if token is expired
      if (connection.expiresAt && Date.now() >= connection.expiresAt) {
        console.log("⏰ Token expired, clearing connection");
        localStorage.removeItem(getStorageKey("monerium_connection"));
        localStorage.removeItem(getStorageKey("monerium_oauth"));
        window.dispatchEvent(new Event("monerium-connection-updated"));
        return null;
      }

      return connection;
    }
  } catch (err) {
    console.error("Failed to load Monerium connection:", err);
  }
  return null;
};

// Open Collective API key helpers
export const getOpenCollectiveApiKey = () => {
  try {
    return localStorage.getItem(getStorageKey("opencollective_api_key")) || "";
  } catch (err) {
    return "";
  }
};

export const setOpenCollectiveApiKey = (key) => {
  try {
    if (key) {
      localStorage.setItem(getStorageKey("opencollective_api_key"), key);
    } else {
      localStorage.removeItem(getStorageKey("opencollective_api_key"));
    }
  } catch (err) {
    console.error("Failed to save Open Collective API key:", err);
  }
};

export const getOpenCollectiveCollective = () => {
  try {
    return localStorage.getItem(getStorageKey("opencollective_collective")) || "";
  } catch (err) {
    return "";
  }
};

// Paid expenses (by source): avoids double-paying after reload.
// Scoped to current environment via getStorageKey.
const paidExpensesKey = () => getStorageKey("paid_expenses");

const readPaidExpenses = () => {
  try {
    const stored = localStorage.getItem(paidExpensesKey());
    if (!stored) return { oc: [], odoo: [] };
    const parsed = JSON.parse(stored);
    return {
      oc: Array.isArray(parsed.oc) ? parsed.oc : [],
      odoo: Array.isArray(parsed.odoo) ? parsed.odoo : [],
    };
  } catch {
    return { oc: [], odoo: [] };
  }
};

export const markExpensePaidLocal = (source, id) => {
  if (source !== "oc" && source !== "odoo") return;
  if (id == null) return;
  try {
    const state = readPaidExpenses();
    const list = state[source];
    const key = String(id);
    if (!list.includes(key)) {
      list.push(key);
      localStorage.setItem(paidExpensesKey(), JSON.stringify(state));
    }
  } catch (err) {
    console.error("Failed to mark expense as paid locally:", err);
  }
};

export const isExpensePaidLocal = (source, id) => {
  if (source !== "oc" && source !== "odoo") return false;
  if (id == null) return false;
  const state = readPaidExpenses();
  return state[source].includes(String(id));
};

// Imported OC expenses (→ Odoo): `{ [ocExpenseId]: odooExpenseId }`.
// Scoped to current environment via getStorageKey.
const importedOCKey = () => getStorageKey("imported_oc_expenses");

const readImportedOC = () => {
  try {
    const stored = localStorage.getItem(importedOCKey());
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const markOCExpenseImported = (ocExpenseId, odooExpenseId) => {
  if (ocExpenseId == null || odooExpenseId == null) return;
  try {
    const map = readImportedOC();
    map[String(ocExpenseId)] = odooExpenseId;
    localStorage.setItem(importedOCKey(), JSON.stringify(map));
  } catch (err) {
    console.error("Failed to mark OC expense as imported:", err);
  }
};

export const getOCExpenseImportedId = (ocExpenseId) => {
  if (ocExpenseId == null) return null;
  const map = readImportedOC();
  const val = map[String(ocExpenseId)];
  return typeof val === "number" ? val : null;
};

export const isOCExpenseImported = (ocExpenseId) =>
  getOCExpenseImportedId(ocExpenseId) != null;

export const setOpenCollectiveCollective = (slug) => {
  try {
    if (slug) {
      localStorage.setItem(getStorageKey("opencollective_collective"), slug);
    } else {
      localStorage.removeItem(getStorageKey("opencollective_collective"));
    }
  } catch (err) {
    console.error("Failed to save Open Collective collective:", err);
  }
};

