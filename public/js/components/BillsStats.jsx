import { isInvoicePaid } from "../utils/storage.js";
import { getStorageKey, ENV } from "../config.js";
import {
  setSelectedMoneriumAccount,
  getSelectedMoneriumAccount,
} from "../utils/storage.js";
import { JournalLink } from "./JournalLink.jsx";

const { useState, useEffect, useMemo, useCallback } = React;

function formatEUR(amount) {
  return new Intl.NumberFormat("en-EU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function safeUrl(addr) {
  return `https://app.safe.global/transactions/history?safe=gno:${addr}`;
}

function getOdooParams() {
  try {
    const stored = localStorage.getItem(getStorageKey("odoo_connection"));
    if (!stored) return null;
    const conn = JSON.parse(stored);
    const params = new URLSearchParams();
    if (conn.url) params.append("url", conn.url);
    if (conn.db) params.append("db", conn.db);
    if (conn.username) params.append("username", conn.username);
    if (conn.password) params.append("password", conn.password);
    return params;
  } catch {
    return null;
  }
}

export function BillsStats({
  invoices,
  moneriumConnection,
  availableAccounts,
}) {
  const [paidThisMonth, setPaidThisMonth] = useState(null);
  const [paidLastMonth, setPaidLastMonth] = useState(null);
  const [transfersLoading, setTransfersLoading] = useState(false);
  // Map of address -> journal object
  const [journalMap, setJournalMap] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState(null);

  const currentAddress = moneriumConnection?.accountAddress;

  // Check if there was a previously selected account (user had connected before)
  const hadPreviousConnection = Boolean(getSelectedMoneriumAccount());

  const selectedAccount = useMemo(() => {
    if (!currentAddress || !availableAccounts?.length) return null;
    return availableAccounts.find((a) => a.address === currentAddress);
  }, [currentAddress, availableAccounts]);

  const balance = selectedAccount
    ? parseFloat(selectedAccount.balance || "0")
    : null;

  const [notSynced, setNotSynced] = useState(null);

  const linkedJournal = currentAddress ? journalMap[currentAddress] || null : null;

  const handleJournalChange = useCallback(
    (journal) => {
      if (currentAddress) {
        setJournalMap((prev) => ({ ...prev, [currentAddress]: journal }));
      }
    },
    [currentAddress]
  );

  // Switch account
  const handleAccountSwitch = (address) => {
    if (!address || address === currentAddress) return;
    setSelectedMoneriumAccount(address);

    // Update monerium connection in localStorage
    try {
      const stored = localStorage.getItem(
        getStorageKey("monerium_connection")
      );
      if (stored) {
        const conn = JSON.parse(stored);
        conn.accountAddress = address;
        localStorage.setItem(
          getStorageKey("monerium_connection"),
          JSON.stringify(conn)
        );
      }
    } catch {}

    // Notify App.jsx to reload
    window.dispatchEvent(new Event("monerium-connection-updated"));

    // Reset transfer stats for new account
    setPaidThisMonth(null);
    setPaidLastMonth(null);
    setSyncStatus(null);
  };

  // Calculate total to pay from ready-to-pay invoices
  const totalToPay = useMemo(() => {
    return invoices.reduce((sum, invoice) => {
      const isPaid =
        invoice.payment_state === "paid" ||
        isInvoicePaid(invoice.id) ||
        (invoice.amount_residual != null && invoice.amount_residual === 0);
      const hasBankAccount = Boolean(invoice.bank_account_number);
      const isDraft = invoice.state === "draft";
      const isIncoming =
        invoice.move_type === "in_invoice" ||
        invoice.move_type === "in_refund";
      const amount = invoice.amount_residual ?? invoice.amount_total;

      if (hasBankAccount && !isDraft && !isPaid && amount > 0 && isIncoming) {
        return sum + amount;
      }
      return sum;
    }, 0);
  }, [invoices]);

  // Fetch EURe token transfers
  useEffect(() => {
    if (!currentAddress) return;

    let cancelled = false;
    const fetchTransfers = async () => {
      setTransfersLoading(true);
      try {
        const response = await fetch(
          `/api/monerium/transfers?address=${encodeURIComponent(currentAddress)}`
        );
        if (!response.ok) throw new Error("Failed to fetch transfers");
        const data = await response.json();
        const transfers = data.transfers || [];

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );

        let thisMonthTotal = 0;
        let lastMonthTotal = 0;

        for (const tx of transfers) {
          const txDate = new Date(parseInt(tx.timeStamp, 10) * 1000);
          const decimals = parseInt(tx.tokenDecimal || "18", 10);
          const amount = parseInt(tx.value, 10) / Math.pow(10, decimals);

          if (txDate >= thisMonthStart) {
            thisMonthTotal += amount;
          } else if (txDate >= lastMonthStart && txDate < thisMonthStart) {
            lastMonthTotal += amount;
          }
        }

        if (!cancelled) {
          setPaidThisMonth(thisMonthTotal);
          setPaidLastMonth(lastMonthTotal);
        }
      } catch (err) {
        console.error("Failed to fetch EURe transfers for stats:", err);
        if (!cancelled) {
          setPaidThisMonth(null);
          setPaidLastMonth(null);
        }
      } finally {
        if (!cancelled) setTransfersLoading(false);
      }
    };

    fetchTransfers();
    return () => {
      cancelled = true;
    };
  }, [currentAddress]);

  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    setReconnectError(null);
    try {
      // Fetch config to check if client credentials are available
      const configRes = await fetch("/api/monerium/config");
      const config = await configRes.json();

      if (!config.hasClientSecret) {
        // No client secret — redirect to setup flow
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }

      const response = await fetch("/api/monerium/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      const token = data.access_token;
      if (!token) throw new Error("No access token received");

      const expiresAt = data.expires_in
        ? Date.now() + data.expires_in * 1000
        : null;
      const environment =
        ENV.environment === "production" ? "production" : "sandbox";
      const savedAccount = getSelectedMoneriumAccount();

      const newConnection = {
        accessToken: token,
        environment,
        accountAddress: savedAccount,
        expiresAt,
      };

      localStorage.setItem(
        getStorageKey("monerium_connection"),
        JSON.stringify(newConnection)
      );
      window.dispatchEvent(new Event("monerium-connection-updated"));
    } catch (err) {
      console.error("Reconnect failed:", err);
      setReconnectError(err.message);
    } finally {
      setReconnecting(false);
    }
  }, []);

  // Fetch sync status when journal is linked
  useEffect(() => {
    if (!currentAddress || !linkedJournal) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const params = getOdooParams();
        if (!params) return;
        params.append("address", currentAddress);
        const resp = await fetch(`/api/odoo/sync-status?${params.toString()}`);
        const data = await resp.json();
        if (!cancelled && resp.ok) {
          setNotSynced(data.notSynced);
        }
      } catch {
        // ignore
      }
    };
    checkStatus();
    return () => { cancelled = true; };
  }, [currentAddress, linkedJournal]);

  const handleSync = useCallback(async () => {
    if (!currentAddress || !linkedJournal) return;

    const params = getOdooParams();
    if (!params) return;

    setSyncing(true);
    setSyncStatus(null);

    try {
      const response = await fetch(`/api/odoo/sync?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: currentAddress,
          enrichMonerium: true,
        }),
      });

      // Consume SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.type === "done") {
              finalResult = data;
            } else if (data.type === "error") {
              throw new Error(data.details || data.error);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      if (finalResult) {
        const parts = [];
        if (finalResult.synced > 0) {
          parts.push(`${finalResult.synced} synced`);
        }
        if (finalResult.moneriumEnriched > 0) {
          parts.push(`${finalResult.moneriumEnriched} enriched`);
        }
        if (finalResult.moneriumReconciled > 0 || finalResult.reconciled > 0) {
          const total = (finalResult.moneriumReconciled || 0) + (finalResult.reconciled || 0);
          parts.push(`${total} reconciled`);
        }
        setSyncStatus(parts.length > 0 ? parts.join(", ") : "Already up to date");
        setNotSynced(0);
      } else {
        setSyncStatus("Already up to date");
        setNotSynced(0);
      }
    } catch (err) {
      setSyncStatus(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [currentAddress, linkedJournal]);

  const hasAccount = Boolean(currentAddress);
  const multipleAccounts = availableAccounts?.length > 1;

  const monthDiff =
    paidThisMonth != null && paidLastMonth != null
      ? paidThisMonth - paidLastMonth
      : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Balance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-medium text-gray-500 mb-1">Balance</div>
        {hasAccount ? (
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {balance != null ? `€${formatEUR(balance)}` : "—"}
            </div>

            {/* Account selector or single address link */}
            {multipleAccounts ? (
              <select
                value={currentAddress}
                onChange={(e) => handleAccountSwitch(e.target.value)}
                className="mt-1 text-xs font-mono text-blue-600 bg-transparent border border-gray-200 rounded px-1 py-0.5 w-full cursor-pointer hover:border-blue-300 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {availableAccounts.map((acc) => (
                  <option key={acc.address} value={acc.address}>
                    {shortAddr(acc.address)} — €{acc.balance || "0.00"}
                  </option>
                ))}
              </select>
            ) : (
              <a
                href={safeUrl(currentAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-700 mt-1 font-mono truncate block"
              >
                {shortAddr(currentAddress)}
              </a>
            )}

            {/* Safe link when using dropdown */}
            {multipleAccounts && (
              <a
                href={safeUrl(currentAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-blue-600 mt-0.5 inline-block"
              >
                View on Safe
              </a>
            )}

            <div className="mt-2">
              <JournalLink
                accountAddress={currentAddress}
                onJournalChange={handleJournalChange}
              />
            </div>
            {linkedJournal && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1"
                >
                  <svg
                    className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {syncing ? "Syncing..." : "Sync"}
                </button>
                {notSynced > 0 && !syncing && !syncStatus && (
                  <span className="text-xs text-orange-600 font-medium">
                    {notSynced} not synced
                  </span>
                )}
                {syncStatus && (
                  <span
                    className={`text-xs ${
                      syncStatus.startsWith("Error")
                        ? "text-red-500"
                        : "text-green-600"
                    }`}
                  >
                    {syncStatus}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : availableAccounts?.length > 0 ? (
          <div>
            <div className="text-lg text-gray-400 mb-2">No account selected</div>
            <select
              value=""
              onChange={(e) => handleAccountSwitch(e.target.value)}
              className="text-xs font-mono text-gray-700 bg-white border border-gray-300 rounded px-2 py-1.5 w-full cursor-pointer hover:border-blue-300 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="" disabled>Select an account...</option>
              {availableAccounts.map((acc) => (
                <option key={acc.address} value={acc.address}>
                  {shortAddr(acc.address)} — €{acc.balance || "0.00"}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <div className="text-lg text-gray-400">Not connected</div>
            {hadPreviousConnection ? (
              <div>
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={reconnecting}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1 disabled:opacity-50"
                >
                  {reconnecting ? "Reconnecting..." : "Reconnect Monerium account"}
                </button>
                {reconnectError && (
                  <div className="text-xs text-red-500 mt-1">{reconnectError}</div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, "", "/");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
                className="text-xs text-blue-600 hover:text-blue-700 mt-1"
              >
                Set up Monerium connection
              </button>
            )}
          </div>
        )}
      </div>

      {/* Total to Pay */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-medium text-gray-500 mb-1">
          Total to Pay
        </div>
        <div className="text-2xl font-bold text-gray-900">
          €{formatEUR(totalToPay)}
        </div>
        <div className="text-xs text-gray-400 mt-1">Ready-to-pay bills</div>
      </div>

      {/* Paid This Month */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-medium text-gray-500 mb-1">
          Paid This Month
        </div>
        {!hasAccount ? (
          <div className="text-lg text-gray-400">—</div>
        ) : transfersLoading ? (
          <div className="text-lg text-gray-400 animate-pulse">Loading...</div>
        ) : paidThisMonth != null ? (
          <div>
            <div className="text-2xl font-bold text-gray-900">
              €{formatEUR(paidThisMonth)}
            </div>
            {paidLastMonth != null && (
              <div className="text-xs mt-1">
                {monthDiff > 0 ? (
                  <span className="text-red-500">
                    +€{formatEUR(monthDiff)} vs last month
                  </span>
                ) : monthDiff < 0 ? (
                  <span className="text-green-600">
                    -€{formatEUR(Math.abs(monthDiff))} vs last month
                  </span>
                ) : (
                  <span className="text-gray-400">Same as last month</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-lg text-gray-400">—</div>
        )}
      </div>
    </div>
  );
}
