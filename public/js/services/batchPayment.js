import { getStorageKey } from "../config.js";
import { updateBatchItem } from "../utils/batch.js";
import { markInvoiceAsPaid } from "../utils/storage.js";
import { KeyLockedError } from "./monerium.js";

// Engine that drives a queued payment through: sign → (collect signatures) → submit.
//
//  1. Ask the server to sign the order message with its key (POST /safe-message).
//     - 1-of-N Safe  → comes back `isReady` with the full signature.
//     - M-of-N Safe  → proposed to the Safe Tx Service; needs more signatures.
//  2. While not ready, poll every POLL_INTERVAL_MS and surface the Safe link so
//     the user can collect the remaining signatures in the Safe web app.
//  3. Once ready, submit the order to Monerium reusing the exact signed message.

const POLL_INTERVAL_MS = 10_000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getConnection = () => {
  const stored = localStorage.getItem(getStorageKey("monerium_connection"));
  if (!stored) throw new Error("Connect to Monerium first.");
  const connection = JSON.parse(stored);
  if (connection.expiresAt && Date.now() >= connection.expiresAt) {
    throw new Error("Your Monerium session has expired. Please reconnect.");
  }
  if (!connection.accessToken) throw new Error("Missing Monerium access token.");
  return connection;
};

const recipientFields = (item) => {
  if (item.recipientType === "individual" || item.recipientType === "employee") {
    const parts = (item.name || "").trim().split(/\s+/);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      companyName: "",
    };
  }
  return { companyName: item.name || "Unknown", firstName: "", lastName: "" };
};

const proposeSignature = async (item) => {
  const resp = await fetch("/api/monerium/safe-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: item.amount,
      iban: item.iban,
      accountAddress: item.accountAddress,
      environment: item.environment,
      message: item.message || undefined, // reuse frozen message on retry
    }),
  });
  if (resp.status === 423) throw new KeyLockedError();
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Failed to sign order message");
  return data;
};

const pollStatus = async (item, message) => {
  const resp = await fetch("/api/monerium/safe-message/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      accountAddress: item.accountAddress,
      environment: item.environment,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Failed to check signatures");
  return data;
};

const submitOrder = async (item, connection, preparedSignature, message) => {
  const { companyName, firstName, lastName } = recipientFields(item);
  const resp = await fetch("/api/monerium/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: item.amount,
      iban: item.iban,
      memo: item.memo,
      environment: item.environment,
      accessToken: connection.accessToken,
      accountAddress: item.accountAddress,
      companyName,
      firstName,
      lastName,
      signature: preparedSignature,
      message, // must match the signed message exactly
    }),
  });
  if (resp.status === 423) throw new KeyLockedError();
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Failed to place order");
  return data;
};

/**
 * Process a single queued payment to completion. `shouldStop()` lets the caller
 * abort the polling loop (e.g. when the panel unmounts).
 */
export const processBatchItem = async (item, shouldStop = () => false) => {
  try {
    const connection = getConnection();

    updateBatchItem(item.id, { status: "signing", error: null });
    let status = await proposeSignature(item);
    const message = status.message;
    updateBatchItem(item.id, {
      message,
      safeUrl: status.safeUrl,
      confirmations: status.confirmations,
      confirmationsRequired: status.confirmationsRequired,
    });

    // Collect the remaining signatures (M-of-N Safe).
    while (!status.isReady) {
      if (shouldStop()) return;
      updateBatchItem(item.id, {
        status: "collecting",
        confirmations: status.confirmations,
        confirmationsRequired: status.confirmationsRequired,
        safeUrl: status.safeUrl,
      });
      await delay(POLL_INTERVAL_MS);
      if (shouldStop()) return;
      status = await pollStatus(item, message);
    }

    updateBatchItem(item.id, {
      status: "submitting",
      confirmations: status.confirmations,
      confirmationsRequired: status.confirmationsRequired,
    });
    const order = await submitOrder(
      item,
      connection,
      status.preparedSignature,
      message
    );

    if (item.invoiceId) markInvoiceAsPaid(item.invoiceId);
    updateBatchItem(item.id, {
      status: "done",
      orderId: order.id || null,
      error: null,
    });
    return order;
  } catch (err) {
    updateBatchItem(item.id, {
      status: "error",
      error: err instanceof KeyLockedError ? "locked" : err.message || "Failed",
    });
    throw err;
  }
};

/** Process every not-yet-done item concurrently so fast (1-of-N) ones don't wait. */
export const processBatch = async (items, shouldStop = () => false) => {
  const pending = items.filter((i) => i.status !== "done");
  return Promise.allSettled(
    pending.map((item) => processBatchItem(item, shouldStop))
  );
};
