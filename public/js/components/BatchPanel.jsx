import {
  getBatch,
  removeFromBatch,
  clearBatch,
  clearCompleted,
} from "../utils/batch.js";
import { processBatch } from "../services/batchPayment.js";
import { unlockServer } from "../services/monerium.js";
import { XIcon, ExternalLinkIcon, LoaderIcon } from "./icons.jsx";

const { useState, useEffect, useRef } = React;

const STATUS_LABEL = {
  queued: "Queued",
  signing: "Signing…",
  collecting: "Awaiting signatures",
  submitting: "Submitting…",
  done: "Submitted",
  error: "Failed",
};

const STATUS_COLOR = {
  queued: "bg-gray-100 text-gray-700",
  signing: "bg-blue-100 text-blue-700",
  collecting: "bg-amber-100 text-amber-800",
  submitting: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

export function BatchPanel() {
  const [items, setItems] = useState(getBatch());
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState(null);
  const stopRef = useRef(false);

  useEffect(() => {
    const refresh = () => setItems(getBatch());
    window.addEventListener("payment-batch-updated", refresh);
    return () => {
      // Stop any in-flight polling loops when the panel unmounts.
      stopRef.current = true;
      window.removeEventListener("payment-batch-updated", refresh);
    };
  }, []);

  const runAll = async () => {
    setError(null);
    setNeedsPassphrase(false);
    setRunning(true);
    stopRef.current = false;
    try {
      const results = await processBatch(getBatch(), () => stopRef.current);
      // If any item failed because the key is locked, surface the unlock prompt.
      const locked = getBatch().some((i) => i.error === "locked");
      if (locked) setNeedsPassphrase(true);
    } catch (err) {
      setError(err.message || "Batch failed");
    } finally {
      setRunning(false);
    }
  };

  const handleUnlockAndRetry = async () => {
    if (!passphrase) return;
    setUnlocking(true);
    setError(null);
    try {
      await unlockServer(passphrase);
      setNeedsPassphrase(false);
      setPassphrase("");
      await runAll();
    } catch (err) {
      setError(err.message || "Failed to unlock");
    } finally {
      setUnlocking(false);
    }
  };

  if (items.length === 0) return null;

  const pendingCount = items.filter((i) => i.status !== "done").length;
  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-full shadow-lg"
        >
          <span className="font-medium">Payment batch</span>
          <span className="bg-white text-green-700 rounded-full px-2 py-0.5 text-xs font-bold">
            {items.length}
          </span>
        </button>
      )}

      {open && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div>
              <h3 className="font-semibold text-gray-900">Payment batch</h3>
              <p className="text-xs text-gray-500">
                {items.length} payment{items.length !== 1 ? "s" : ""} · €
                {total.toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              title="Minimize"
            >
              <XIcon />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-2 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="border border-gray-100 rounded-lg px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {item.label || item.name}
                  </span>
                  <span className="text-sm text-gray-700 whitespace-nowrap">
                    €{Number(item.amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      STATUS_COLOR[item.status] || STATUS_COLOR.queued
                    }`}
                  >
                    {STATUS_LABEL[item.status] || item.status}
                    {item.status === "collecting" &&
                      item.confirmationsRequired > 0 &&
                      ` (${item.confirmations}/${item.confirmationsRequired})`}
                  </span>
                  {item.status === "collecting" && item.safeUrl && (
                    <a
                      href={item.safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Sign in Safe <ExternalLinkIcon />
                    </a>
                  )}
                  {item.status !== "done" &&
                    item.status !== "submitting" &&
                    !running && (
                      <button
                        onClick={() => removeFromBatch(item.id)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                </div>
                {item.status === "error" && item.error !== "locked" && (
                  <p className="text-xs text-red-600 mt-1">{item.error}</p>
                )}
                {item.status === "done" && item.orderId && (
                  <p className="text-xs text-green-600 mt-1">
                    Order {item.orderId}
                  </p>
                )}
              </div>
            ))}
          </div>

          {needsPassphrase && (
            <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 space-y-2">
              <p className="text-xs text-amber-800 font-medium">
                Server signing key is locked. Enter the passphrase to continue.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && passphrase && !unlocking)
                      handleUnlockAndRetry();
                  }}
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-sm border border-amber-300 rounded-lg"
                />
                <button
                  onClick={handleUnlockAndRetry}
                  disabled={!passphrase || unlocking}
                  className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-medium rounded-lg"
                >
                  {unlocking ? "Unlocking…" : "Unlock"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={clearBatch}
                disabled={running}
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Clear all
              </button>
              {items.some((i) => i.status === "done") && (
                <button
                  onClick={clearCompleted}
                  disabled={running}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Clear submitted
                </button>
              )}
            </div>
            <button
              onClick={runAll}
              disabled={running || pendingCount === 0}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {running && <LoaderIcon />}
              {running
                ? "Processing…"
                : `Sign & submit ${pendingCount} payment${
                    pendingCount !== 1 ? "s" : ""
                  }`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
