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

