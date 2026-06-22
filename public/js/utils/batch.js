import { getStorageKey } from "../config.js";

// A client-side "outbox" of payments queued for signing + submission.
// Stored in localStorage so the list survives reloads while the user reviews it.
// Each item carries everything needed to sign the Monerium order message and,
// once enough Safe signatures are collected, submit the order.

const KEY = () => getStorageKey("payment_batch");

const notify = () => {
  window.dispatchEvent(new Event("payment-batch-updated"));
};

export const getBatch = () => {
  try {
    const stored = localStorage.getItem(KEY());
    if (!stored) return [];
    const items = JSON.parse(stored);
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.error("Failed to read payment batch:", err);
    return [];
  }
};

const saveBatch = (items) => {
  try {
    localStorage.setItem(KEY(), JSON.stringify(items));
    notify();
  } catch (err) {
    console.error("Failed to save payment batch:", err);
  }
};

export const isInBatch = (invoiceId) =>
  getBatch().some((item) => item.invoiceId === invoiceId);

/**
 * Add a payment to the batch. `item` must include:
 *   invoiceId, label, amount, iban, memo, recipientType ('company'|'individual'),
 *   name, accountAddress, environment
 * Returns false if the invoice is already queued.
 */
export const addToBatch = (item) => {
  const items = getBatch();
  if (items.some((i) => i.invoiceId === item.invoiceId)) return false;
  items.push({
    id: `${item.invoiceId}-${item.accountAddress}`,
    status: "queued", // queued | signing | collecting | submitting | done | error
    message: null,
    safeUrl: null,
    confirmations: 0,
    confirmationsRequired: 0,
    orderId: null,
    error: null,
    ...item,
  });
  saveBatch(items);
  return true;
};

export const removeFromBatch = (id) => {
  saveBatch(getBatch().filter((item) => item.id !== id));
};

export const updateBatchItem = (id, patch) => {
  saveBatch(
    getBatch().map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
};

export const clearBatch = () => saveBatch([]);

/** Remove every item that has been successfully submitted. */
export const clearCompleted = () => {
  saveBatch(getBatch().filter((item) => item.status !== "done"));
};
