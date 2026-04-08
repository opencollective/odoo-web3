const { useState, useEffect, useCallback, useMemo, useRef } = React;
import { getStorageKey } from "../config.js";
import { PDFSidebar } from "./PDFSidebar.jsx";

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatAmount(amount, kind) {
  const num = parseFloat(amount);
  const sign = kind === "redeem" ? "-" : "+";
  return `${sign}€${num.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Account settings (localStorage) ───────────────────────

function loadAccountSettings() {
  try {
    const raw = localStorage.getItem(getStorageKey("account_settings"));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAccountSettings(settings) {
  try {
    localStorage.setItem(getStorageKey("account_settings"), JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function getAccountLabel(settings, addr) {
  return settings[addr]?.label || "";
}

function isAccountHidden(settings, addr) {
  return !!settings[addr]?.hidden;
}

// ─── Account Edit Modal ────────────────────────────────────

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

function AccountEditModal({ address, settings, onSave, onClose }) {
  const current = settings[address] || {};
  const [label, setLabel] = useState(current.label || "");
  const [hidden, setHidden] = useState(!!current.hidden);
  const [journal, setJournal] = useState(null);
  const [journalLoading, setJournalLoading] = useState(true);

  // Fetch linked journal from Odoo on mount
  useEffect(() => {
    const fetchJournal = async () => {
      const params = getOdooParams();
      if (!params) { setJournalLoading(false); return; }
      params.append("address", address);
      try {
        const resp = await fetch(`/api/odoo/journals?${params.toString()}`);
        const data = await resp.json();
        if (resp.ok && data.linked) {
          setJournal(data.linked);
        }
      } catch {
        // ignore
      } finally {
        setJournalLoading(false);
      }
    };
    fetchJournal();
  }, [address]);

  const handleSave = () => {
    onSave(address, {
      label: label.trim() || undefined,
      hidden,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-1">Edit account</h3>
        <p className="text-sm text-gray-400 font-mono mb-5">{address}</p>

        <div className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main treasury"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Odoo journal (read-only, from Odoo) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Odoo journal
            </label>
            {journalLoading ? (
              <div className="text-sm text-gray-400 animate-pulse">Loading...</div>
            ) : journal ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {journal.name}
                  <span className="text-green-500 font-normal ml-1">(ID: {journal.id})</span>
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                No journal linked.{" "}
                <span className="text-gray-500">Link one from the <a href="/bills" className="text-blue-600 hover:underline">Bills</a> page.</span>
              </div>
            )}
          </div>

          {/* Hidden */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Hide this account from the list</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reconcile dropdown ────────────────────────────────────

function ReconcileDropdown({ tx, onReconciled }) {
  const [state, setState] = useState("loading");
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);

  const loadMatches = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const amount = tx.kind === "redeem" ? -parseFloat(tx.amount) : parseFloat(tx.amount);
      const params = new URLSearchParams({ amount: String(amount) });
      if (tx.counterpartyIban) params.set("iban", tx.counterpartyIban);
      const odooParams = getOdooParams();
      if (odooParams) { for (const [k, v] of odooParams) params.set(k, v); }
      const resp = await fetch(`/api/odoo/matching-invoices?${params}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to find matches");
      setInvoices(data.invoices || []);
      setState("loaded");
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }, [tx.kind, tx.amount, tx.counterpartyIban]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const reconcile = async (invoiceId) => {
    if (!tx.txHashes.length) { setError("No transaction hash"); return; }
    setState("reconciling");
    setError(null);
    try {
      const odooConn = (() => {
        try {
          return JSON.parse(localStorage.getItem(getStorageKey("odoo_connection")) || "{}");
        } catch { return {}; }
      })();
      const resp = await fetch("/api/odoo/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: tx.txHashes[0],
          invoiceId,
          url: odooConn.url,
          db: odooConn.db,
          username: odooConn.username,
          password: odooConn.password,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Reconciliation failed");
      setState("done");
      if (onReconciled) onReconciled();
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Reconciled successfully
      </div>
    );
  }
  if (state === "loading") return <div className="mt-3 text-sm text-gray-400">Finding matching {tx.kind === "redeem" ? "vendor bills" : "invoices"}...</div>;
  if (state === "reconciling") return <div className="mt-3 text-sm text-gray-500">Reconciling...</div>;

  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {error}
          <button onClick={loadMatches} className="ml-2 text-blue-600 hover:underline">Retry</button>
        </div>
      )}
      {state === "loaded" && invoices.length === 0 && (
        <div className="text-sm text-gray-500">No matching {tx.kind === "redeem" ? "vendor bills" : "invoices"} found for this amount.</div>
      )}
      {invoices.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Matching {tx.kind === "redeem" ? "vendor bills" : "invoices"} ({invoices.length}):
          </div>
          <div className="space-y-1">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {inv.name}
                    {inv.ref && <span className="text-gray-400 font-normal ml-2">{inv.ref}</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {inv.partner_id ? inv.partner_id[1] : "Unknown partner"} · {formatDate(inv.invoice_date || inv.date)} · €{inv.amount_total.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </div>
                  {inv.payment_state === "paid" && inv.payment && (
                    <div className="text-xs text-yellow-700 mt-0.5">Already paid on {formatDate(inv.payment.date)} in {inv.payment.journalName}</div>
                  )}
                  {inv.payment_state === "paid" && !inv.payment && (
                    <div className="text-xs text-yellow-700 mt-0.5">Already paid</div>
                  )}
                </div>
                {inv.payment_state !== "paid" ? (
                  <button onClick={() => reconcile(inv.id)} className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 flex-shrink-0">Reconcile</button>
                ) : (
                  <span className="px-3 py-1 text-xs font-medium text-yellow-600 flex-shrink-0">Paid</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Transaction row ───────────────────────────────────────

function TransactionRow({ tx, onReconciled, accountSettings, onPreviewInvoice }) {
  const [expanded, setExpanded] = useState(false);
  const [reconciled, setReconciled] = useState(tx.isReconciled);

  const isOutgoing = tx.kind === "redeem";
  const amountColor = isOutgoing ? "text-red-600" : "text-green-600";
  const stateColors = {
    processed: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
  };
  const stateColor = stateColors[tx.state] || "bg-gray-100 text-gray-700";
  const accountLabel = getAccountLabel(accountSettings, tx.address);

  const handleReconciled = () => {
    setReconciled(true);
    if (onReconciled) onReconciled();
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-24 flex-shrink-0">
          <div className="text-sm font-medium text-gray-900">{formatDate(tx.date)}</div>
          <div className="text-xs text-gray-400">{formatTime(tx.date)}</div>
        </div>
        <div className="flex-shrink-0">
          {isOutgoing ? (
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{tx.counterpartyName}</div>
          {tx.counterpartyIban && <div className="text-xs text-gray-400 font-mono">{tx.counterpartyIban}</div>}
        </div>
        <div className="flex-shrink-0">
          {reconciled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Reconciled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Not reconciled</span>
          )}
        </div>
        <div className={`w-28 text-right flex-shrink-0 text-sm font-semibold ${amountColor}`}>{formatAmount(tx.amount, tx.kind)}</div>
        <div className="flex-shrink-0">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-12 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-gray-500">Type:</span> <span className="text-gray-900">{tx.kind === "redeem" ? "Outgoing (SEPA)" : "Incoming (mint)"}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${stateColor}`}>{tx.state}</span></div>
            {tx.memo && <div className="col-span-2"><span className="text-gray-500">Memo:</span> <span className="text-gray-900">{tx.memo}</span></div>}
            {tx.counterpartyCountry && <div><span className="text-gray-500">Country:</span> <span className="text-gray-900">{tx.counterpartyCountry}</span></div>}
            <div>
              <span className="text-gray-500">Account:</span>{" "}
              <span className="text-gray-900 font-mono text-xs">{accountLabel ? `${accountLabel} (${shortenAddress(tx.address)})` : shortenAddress(tx.address)}</span>
            </div>
            <div><span className="text-gray-500">Placed:</span> <span className="text-gray-900">{formatDate(tx.placedAt)} {formatTime(tx.placedAt)}</span></div>
            {tx.processedAt && <div><span className="text-gray-500">Processed:</span> <span className="text-gray-900">{formatDate(tx.processedAt)} {formatTime(tx.processedAt)}</span></div>}
            {tx.txHashes.length > 0 && (
              <div className="col-span-2">
                <span className="text-gray-500">Tx hashes:</span>{" "}
                {tx.txHashes.map((h, i) => (
                  <a key={i} href={`https://gnosisscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono text-xs mr-2" onClick={(e) => e.stopPropagation()}>
                    {h.slice(0, 10)}...{h.slice(-6)}
                  </a>
                ))}
              </div>
            )}
            <div><span className="text-gray-500">Order ID:</span> <span className="text-gray-900 font-mono text-xs">{tx.id}</span></div>
          </div>
          {reconciled && tx.invoice && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-green-800">
                    {tx.invoice.name}
                    {tx.invoice.partnerName && <span className="text-green-600 font-normal ml-2">{tx.invoice.partnerName}</span>}
                  </div>
                  <div className="text-xs text-green-600 mt-0.5">
                    €{tx.invoice.amountTotal.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {tx.invoice.pdfUrl && (
                    <button
                      onClick={() => onPreviewInvoice(tx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Preview
                    </button>
                  )}
                  {tx.odooUrl && (
                    <a
                      href={`${tx.odooUrl}/web#id=${tx.invoice.id}&model=account.move&view_type=form`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Open in Odoo
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          {!reconciled && tx.state === "processed" && tx.txHashes.length > 0 && (
            <ReconcileDropdown tx={tx} onReconciled={handleReconciled} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter bar ────────────────────────────────────────────

function FilterBar({ filters, setFilters, counterparties, years }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* Direction */}
      <select
        value={filters.direction}
        onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All directions</option>
        <option value="outgoing">Outgoing</option>
        <option value="incoming">Incoming</option>
      </select>

      {/* Reconciliation status */}
      <select
        value={filters.reconciled}
        onChange={(e) => setFilters((f) => ({ ...f, reconciled: e.target.value }))}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All statuses</option>
        <option value="reconciled">Reconciled</option>
        <option value="not_reconciled">Not reconciled</option>
      </select>

      {/* Order status */}
      <select
        value={filters.state}
        onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All order states</option>
        <option value="processed">Processed</option>
        <option value="pending">Pending</option>
        <option value="rejected">Rejected</option>
      </select>

      {/* Year */}
      <select
        value={filters.year}
        onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value, month: "all" }))}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All years</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Month (only when year selected) */}
      {filters.year !== "all" && (
        <select
          value={filters.month}
          onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
            </option>
          ))}
        </select>
      )}

      {/* Counterparty */}
      <select
        value={filters.counterparty}
        onChange={(e) => setFilters((f) => ({ ...f, counterparty: e.target.value }))}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
      >
        <option value="all">All counterparties</option>
        {counterparties.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Clear filters */}
      {(filters.direction !== "all" || filters.reconciled !== "all" || filters.state !== "all" || filters.year !== "all" || filters.counterparty !== "all") && (
        <button
          onClick={() =>
            setFilters({ direction: "all", reconciled: "all", state: "all", year: "all", month: "all", counterparty: "all" })
          }
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────

export function TransactionsPage({ navigate, account }) {
  const [allTransactions, setAllTransactions] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cachedAt, setCachedAt] = useState(null);
  const [accountSettings, setAccountSettings] = useState(loadAccountSettings);
  const [showHidden, setShowHidden] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const odooConnectionUrl = useMemo(() => {
    try {
      const c = JSON.parse(localStorage.getItem(getStorageKey("odoo_connection")) || "{}");
      return c.url || null;
    } catch { return null; }
  }, []);
  const [filters, setFilters] = useState({
    direction: "all",
    reconciled: "all",
    state: "all",
    year: "all",
    month: "all",
    counterparty: "all",
  });

  const fetchTransactions = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) { setRefreshing(true); } else { setLoading(true); }
      setError(null);
      try {
        const params = new URLSearchParams();
        if (account) params.set("address", account);
        if (refresh) params.set("refresh", "true");
        const odooParams = getOdooParams();
        if (odooParams) {
          for (const [k, v] of odooParams) params.set(`odoo_${k}`, v);
        }
        const response = await fetch(`/api/monerium/transactions${params.toString() ? `?${params}` : ""}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to fetch");
        setAllTransactions(data.transactions);
        setAddresses(data.addresses || []);
        setCachedAt(data.cachedAt || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [account]
  );

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Authenticate with Odoo to get session_id for PDF proxy
  const authenticateOdoo = useCallback(async () => {
    if (sessionId) return;
    const params = getOdooParams();
    if (!params) return;
    try {
      const resp = await fetch(`/api/odoo/invoices?${params.toString()}`);
      const data = await resp.json();
      if (data.session_id) setSessionId(data.session_id);
    } catch {
      // ignore
    }
  }, [sessionId]);

  const handlePreviewInvoice = useCallback((tx) => {
    if (!tx.invoice) return;
    setPreviewInvoice({
      id: tx.invoice.id,
      name: tx.invoice.name,
      partner_name: tx.invoice.partnerName,
      amount_total: tx.invoice.amountTotal,
      pdf_url: tx.invoice.pdfUrl,
      payment_state: "paid",
    });
    if (!sessionId) authenticateOdoo();
  }, [sessionId, authenticateOdoo]);

  const handleSaveAccount = (addr, newSettings) => {
    setAccountSettings((prev) => {
      const next = { ...prev };
      // Only store label and hidden — journal comes from Odoo
      const clean = { label: newSettings.label, hidden: newSettings.hidden };
      if (!clean.label && !clean.hidden) {
        delete next[addr];
      } else {
        next[addr] = clean;
      }
      saveAccountSettings(next);
      return next;
    });
  };

  // Derived: visible vs hidden addresses
  const visibleAddresses = addresses.filter((a) => !isAccountHidden(accountSettings, a));
  const hiddenAddresses = addresses.filter((a) => isAccountHidden(accountSettings, a));

  // Filter transactions by visible accounts (when viewing all)
  const accountFilteredTxs = useMemo(() => {
    if (account) return allTransactions; // viewing a specific account — show all
    if (showHidden) return allTransactions;
    return allTransactions.filter((tx) => !isAccountHidden(accountSettings, tx.address));
  }, [allTransactions, accountSettings, showHidden, account]);

  // Derive unique counterparties and years from account-filtered set
  const counterparties = useMemo(() => {
    const set = new Set(accountFilteredTxs.map((t) => t.counterpartyName));
    return Array.from(set).sort();
  }, [accountFilteredTxs]);

  const years = useMemo(() => {
    const set = new Set(accountFilteredTxs.map((t) => new Date(t.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [accountFilteredTxs]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    return accountFilteredTxs.filter((tx) => {
      if (filters.direction === "outgoing" && tx.kind !== "redeem") return false;
      if (filters.direction === "incoming" && tx.kind !== "issue") return false;
      if (filters.reconciled === "reconciled" && !tx.isReconciled) return false;
      if (filters.reconciled === "not_reconciled" && tx.isReconciled) return false;
      if (filters.state !== "all" && tx.state !== filters.state) return false;
      if (filters.counterparty !== "all" && tx.counterpartyName !== filters.counterparty) return false;
      if (filters.year !== "all") {
        const d = new Date(tx.date);
        if (d.getFullYear() !== parseInt(filters.year)) return false;
        if (filters.month !== "all" && d.getMonth() + 1 !== parseInt(filters.month)) return false;
      }
      return true;
    });
  }, [accountFilteredTxs, filters]);

  // Stats from filtered set
  const totalIn = filteredTransactions
    .filter((t) => t.kind === "issue")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalOut = filteredTransactions
    .filter((t) => t.kind === "redeem")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const reconciledCount = filteredTransactions.filter((t) => t.isReconciled).length;

  const displayLabel = (addr) => {
    const lbl = getAccountLabel(accountSettings, addr);
    return lbl ? `${lbl} (${shortenAddress(addr)})` : shortenAddress(addr);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
              <p className="text-sm text-gray-500">
                {account ? displayLabel(account) : `${visibleAddresses.length} account${visibleAddresses.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {cachedAt && !loading && (
            <div className="text-sm text-gray-400">
              {refreshing ? "Refreshing..." : (
                <>
                  Last updated {timeAgo(cachedAt)}{" · "}
                  <button onClick={() => fetchTransactions({ refresh: true })} className="text-blue-500 hover:text-blue-700 hover:underline">refresh</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Account selector */}
        {!account && addresses.length > 1 && (
          <div className="mb-4">
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={() => navigate("/transactions")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  !account ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                All
              </button>
              {visibleAddresses.map((addr) => (
                <div key={addr} className="flex items-center gap-0.5">
                  <button
                    onClick={() => navigate(`/transactions/${addr}`)}
                    className="px-3 py-1.5 text-xs font-medium rounded-l-lg border border-r-0 bg-white border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {displayLabel(addr)}
                  </button>
                  <button
                    onClick={() => setEditingAccount(addr)}
                    className="px-1.5 py-1.5 text-xs rounded-r-lg border bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Edit account"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              ))}
              {hiddenAddresses.length > 0 && (
                <button
                  onClick={() => setShowHidden(!showHidden)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showHidden ? "Hide" : `${hiddenAddresses.length} hidden`}
                </button>
              )}
            </div>
            {showHidden && hiddenAddresses.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2 pl-4 border-l-2 border-gray-200">
                {hiddenAddresses.map((addr) => (
                  <div key={addr} className="flex items-center gap-0.5 opacity-60">
                    <button
                      onClick={() => navigate(`/transactions/${addr}`)}
                      className="px-3 py-1.5 text-xs font-medium rounded-l-lg border border-r-0 bg-white border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {displayLabel(addr)}
                    </button>
                    <button
                      onClick={() => setEditingAccount(addr)}
                      className="px-1.5 py-1.5 text-xs rounded-r-lg border bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                      title="Edit account"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Single account edit button */}
        {account && (
          <div className="mb-4">
            <button
              onClick={() => setEditingAccount(account)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Edit account settings
            </button>
          </div>
        )}

        {/* Filters */}
        {!loading && allTransactions.length > 0 && (
          <FilterBar filters={filters} setFilters={setFilters} counterparties={counterparties} years={years} />
        )}

        {/* Stats */}
        {!loading && filteredTransactions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Transactions</div>
              <div className="text-xl font-bold text-gray-900">{filteredTransactions.length}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Total incoming</div>
              <div className="text-xl font-bold text-green-600">+€{totalIn.toLocaleString("en", { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Total outgoing</div>
              <div className="text-xl font-bold text-red-600">-€{totalOut.toLocaleString("en", { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Reconciled</div>
              <div className="text-xl font-bold text-gray-900">
                {reconciledCount}<span className="text-sm font-normal text-gray-400">/{filteredTransactions.length}</span>
              </div>
            </div>
          </div>
        )}

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {loading && <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">Loading transactions...</div>}
        {!loading && !error && filteredTransactions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            {allTransactions.length > 0 ? "No transactions match the current filters." : "No transactions found."}
          </div>
        )}

        {/* Transaction list */}
        {!loading && filteredTransactions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="w-24 flex-shrink-0">Date</div>
              <div className="w-8 flex-shrink-0"></div>
              <div className="flex-1">Counterparty</div>
              <div className="flex-shrink-0">Status</div>
              <div className="w-28 text-right flex-shrink-0">Amount</div>
              <div className="w-4 flex-shrink-0"></div>
            </div>
            {filteredTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                accountSettings={accountSettings}
                onPreviewInvoice={handlePreviewInvoice}
                onReconciled={() => {
                  setAllTransactions((prev) =>
                    prev.map((t) => t.id === tx.id ? { ...t, isReconciled: true } : t)
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Account edit modal */}
      {editingAccount && (
        <AccountEditModal
          address={editingAccount}
          settings={accountSettings}
          onSave={handleSaveAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {/* Invoice PDF preview sidebar */}
      {previewInvoice && (
        <PDFSidebar
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          odooUrl={odooConnectionUrl}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}
