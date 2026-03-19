import { BillsStats } from "./BillsStats.jsx";
import { InvoiceCard } from "./InvoiceCard.jsx";
import { PDFSidebar } from "./PDFSidebar.jsx";
import { getStorageKey, ENV } from "../config.js";
import {
  loadMoneriumConnectionState,
  isInvoicePaid,
} from "../utils/storage.js";
import { validateAccounts } from "../utils/validation.js";
import { useWallet } from "../hooks/useWallet.js";
import { handlePay } from "../services/monerium.js";
import {
  FileIcon,
  EyeIcon,
  XIcon,
  ExternalLinkIcon,
  LoaderIcon,
  DownloadIcon,
  FilterIcon,
  IncomingIcon,
  OutgoingIcon,
} from "./icons.jsx";

const { useState, useEffect, useCallback } = React;

export function App() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Load connection settings from localStorage
  const loadConnectionSettings = () => {
    try {
      const stored = localStorage.getItem(getStorageKey("odoo_connection"));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.error("Failed to load connection settings:", err);
    }
    return { url: "", db: "", username: "", password: "" };
  };

  const [connectionSettings, setConnectionSettings] = useState(
    loadConnectionSettings
  );
  const [moneriumConnection, setMoneriumConnection] = useState(
    loadMoneriumConnectionState
  );
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      limit: params.get("limit") || "50",
      since: params.get("since") || "",
      until: params.get("until") || "",
      incoming: params.has("incoming") ? params.get("incoming") === "true" : true,
      outgoing: params.has("outgoing") ? params.get("outgoing") === "true" : false,
      status: params.get("status") || "all",
    };
  });
  const [filtersExpanded, setFiltersExpanded] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("since") || params.has("until") || params.has("limit");
  });
  const [employees, setEmployees] = useState([]);

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.since) params.set("since", filters.since);
    if (filters.until) params.set("until", filters.until);
    if (filters.limit && filters.limit !== "50") params.set("limit", filters.limit);
    if (!filters.incoming) params.set("incoming", "false");
    if (filters.outgoing) params.set("outgoing", "true");
    if (filters.status && filters.status !== "all") params.set("status", filters.status);

    const qs = params.toString();
    const newUrl = qs ? `/bills?${qs}` : "/bills";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [filters]);

  // Filter invoices by status (client-side)
  const getFilteredInvoices = () => {
    if (filters.status === "all") return invoices;

    return invoices.filter((invoice) => {
      // Check if paid: payment_state, local storage, or amount_residual is 0
      const isPaid =
        invoice.payment_state === "paid" ||
        isInvoicePaid(invoice.id) ||
        (invoice.amount_residual != null && invoice.amount_residual === 0);
      const hasBankAccount = Boolean(invoice.bank_account_number);
      const isDraft = invoice.state === "draft";
      const isIncomingInvoice = invoice.move_type === "in_invoice" || invoice.move_type === "in_refund";

      switch (filters.status) {
        case "ready_to_pay":
          // Ready to pay: has bank account, not paid, not draft, has amount, is incoming
          const hasAmount = (invoice.amount_residual ?? invoice.amount_total) > 0;
          return hasBankAccount && !isDraft && !isPaid && hasAmount && isIncomingInvoice;
        case "missing_bank":
          // Only incoming invoices (supplier bills) can have "Add bank account" link
          return !hasBankAccount && !isDraft && isIncomingInvoice;
        case "draft":
          return isDraft;
        default:
          return true;
      }
    });
  };

  const filteredInvoices = getFilteredInvoices();
  const [sessionId, setSessionId] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const wallet = useWallet();
  // Authenticate with Odoo to get session_id
  const authenticateOdoo = async () => {
    if (!isConnectionConfigured()) return null;

    try {
      const params = new URLSearchParams({
        url: connectionSettings.url,
        db: connectionSettings.db,
        username: connectionSettings.username,
        password: connectionSettings.password,
      });

      const response = await fetch(
        `/api/odoo/authenticate?${params.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        console.error("Authentication failed:", data.error);
        return null;
      }

      setSessionId(data.session_id);
      return data.session_id;
    } catch (err) {
      console.error("Authentication error:", err);
      return null;
    }
  };

  // Authenticate when opening invoice for PDF preview
  useEffect(() => {
    if (selectedInvoice && !sessionId) {
      authenticateOdoo();
    }
  }, [selectedInvoice]);

  // Check if connection settings are configured
  const isConnectionConfigured = () => {
    return (
      connectionSettings.url &&
      connectionSettings.db &&
      connectionSettings.username &&
      connectionSettings.password
    );
  };

  useEffect(() => {
    const handleConnectionUpdate = () => {
      setMoneriumConnection(loadMoneriumConnectionState());
    };
    window.addEventListener(
      "monerium-connection-updated",
      handleConnectionUpdate
    );
    return () =>
      window.removeEventListener(
        "monerium-connection-updated",
        handleConnectionUpdate
      );
  }, []);

  // Load Monerium accounts once when connection is available
  useEffect(() => {
    const loadAccounts = async () => {
      if (!moneriumConnection?.accessToken) {
        setAvailableAccounts([]);
        return;
      }

      try {
        const response = await fetch("/api/monerium/addresses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: moneriumConnection.accessToken,
            environment: moneriumConnection.environment || "sandbox",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const accounts = Array.isArray(data) ? data : [];
          // Validate accounts with current wallet/server address
          const signerAddress =
            wallet?.walletAddress || ENV.serverWalletAddress;
          const validatedAccounts = validateAccounts(accounts, signerAddress);
          setAvailableAccounts(validatedAccounts);
        } else {
          setAvailableAccounts([]);
        }
      } catch (err) {
        console.error("Failed to load Monerium accounts:", err);
        setAvailableAccounts([]);
      }
    };

    loadAccounts();
  }, [moneriumConnection?.accessToken, moneriumConnection?.environment]);

  // Re-validate accounts when wallet address changes
  useEffect(() => {
    if (availableAccounts.length > 0) {
      const signerAddress = wallet?.walletAddress || ENV.serverWalletAddress;
      // Get raw accounts without validation props
      const rawAccounts = availableAccounts.map(
        ({ usable, validationError, ...acc }) => acc
      );
      const validatedAccounts = validateAccounts(rawAccounts, signerAddress);
      setAvailableAccounts(validatedAccounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.walletAddress]);

  useEffect(() => {
    const handleReconnectRequest = () => {
      // Clear Monerium connection and trigger reconnect
      localStorage.removeItem(getStorageKey("monerium_connection"));
      localStorage.removeItem(getStorageKey("monerium_oauth"));
      setMoneriumConnection(null);
      // Trigger the MoneriumConnectPanel to reconnect
      window.dispatchEvent(new Event("monerium-reconnect"));
    };
    window.addEventListener(
      "monerium-reconnect-requested",
      handleReconnectRequest
    );
    return () =>
      window.removeEventListener(
        "monerium-reconnect-requested",
        handleReconnectRequest
      );
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (!event.key || event.key === "monerium_connection") {
        setMoneriumConnection(loadMoneriumConnectionState());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();

    Object.entries(connectionSettings).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    const direction =
      filters.incoming && filters.outgoing
        ? "all"
        : filters.incoming
        ? "incoming"
        : filters.outgoing
        ? "outgoing"
        : "incoming";

    params.append("type", direction);
    if (filters.limit) params.append("limit", filters.limit);
    if (filters.since) params.append("since", filters.since);
    if (filters.until) params.append("until", filters.until);

    try {
      const response = await fetch(`/api/odoo/invoices?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch invoices");
      }

      setInvoices(data.invoices);
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (err.errors.amount) {
        msg = `${err.errors.amount} (balance: €${err.errors.balance})`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [connectionSettings, filters]);

  const fetchEmployees = useCallback(async () => {
    // Only fetch if we have valid connection settings
    if (!connectionSettings.url || !connectionSettings.db) {
      return;
    }

    try {
      const params = new URLSearchParams();
      Object.entries(connectionSettings).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/odoo/employees?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to fetch employees:", data.error);
        return;
      }

      const employeeData = data.employees || [];
      console.log("📋 Fetched employees:", employeeData.length, employeeData);
      setEmployees(employeeData);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  }, [connectionSettings]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const toggleIncoming = () => {
    setFilters((prev) => {
      const next = { ...prev, incoming: !prev.incoming };
      if (!next.incoming && !next.outgoing) {
        next.outgoing = true;
      }
      return next;
    });
  };

  const toggleOutgoing = () => {
    setFilters((prev) => {
      const next = { ...prev, outgoing: !prev.outgoing };
      if (!next.incoming && !next.outgoing) {
        next.incoming = true;
      }
      return next;
    });
  };

  useEffect(() => {
    if (isConnectionConfigured()) {
      fetchInvoices();
    }
  }, [connectionSettings, filters, fetchInvoices]);

  useEffect(() => {
    if (isConnectionConfigured()) {
      fetchEmployees();
    }
  }, [connectionSettings, fetchEmployees]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            onClick={() => {
              window.history.pushState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            &larr; Back to Home
          </button>
        </div>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              📋 Bills
            </h1>
            {connectionSettings.url && (
              <p className="text-sm text-gray-600 mt-1">
                Data source:{" "}
                <a
                  href={connectionSettings.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  Odoo
                </a>
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {isConnectionConfigured() && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-green-800">
                  Connected to {connectionSettings.db}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!isConnectionConfigured() && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-yellow-800">
              Odoo connection not configured.
            </p>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Set up now
            </button>
          </div>
        )}

        {isConnectionConfigured() && (
          <BillsStats
            invoices={invoices}
            moneriumConnection={moneriumConnection}
            availableAccounts={availableAccounts}
          />
        )}

        {isConnectionConfigured() && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
            {/* Main Filter Bar */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filters */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  {[
                    { key: "all", label: "All", icon: "📋" },
                    { key: "ready_to_pay", label: "Ready to Pay", icon: "✅" },
                    { key: "missing_bank", label: "Missing Bank", icon: "⚠️" },
                    { key: "draft", label: "Draft", icon: "📝" },
                  ].map(({ key, label, icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, status: key }))
                      }
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        filters.status === key
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <span className="mr-1">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Advanced Filters Toggle */}
                <button
                  type="button"
                  onClick={() => setFiltersExpanded((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filtersExpanded
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FilterIcon />
                  <span className="hidden sm:inline">
                    {filtersExpanded ? "Hide Filters" : "More Filters"}
                  </span>
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {filtersExpanded && (
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Max Results
                    </label>
                    <input
                      type="number"
                      name="limit"
                      placeholder="20"
                      value={filters.limit}
                      onChange={handleFilterChange}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      From Date
                    </label>
                    <input
                      type="date"
                      name="since"
                      value={filters.since}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      To Date
                    </label>
                    <input
                      type="date"
                      name="until"
                      value={filters.until}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Results Summary */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-700">
                  {filteredInvoices.length}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700">
                  {invoices.length}
                </span>{" "}
                invoices
                {filters.status !== "all" && (
                  <span className="ml-1">
                    •{" "}
                    {filters.status === "ready_to_pay"
                      ? "Ready to Pay"
                      : filters.status === "missing_bank"
                      ? "Missing Bank Details"
                      : "Draft"}
                  </span>
                )}
              </p>
              {(filters.since || filters.until) && (
                <p className="text-xs text-gray-500">
                  {filters.since && <span>From: {filters.since}</span>}
                  {filters.since && filters.until && <span> • </span>}
                  {filters.until && <span>To: {filters.until}</span>}
                </p>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoaderIcon />
          </div>
        )}

        {!loading && filteredInvoices.length > 0 && (
          <div className="space-y-4">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onPreview={setSelectedInvoice}
                odooUrl={connectionSettings.url}
                onPay={(invoice, memo, accountAddress, recipientInfo) =>
                  handlePay(
                    invoice,
                    memo,
                    accountAddress,
                    wallet.walletAddress ? wallet.signMessage : null,
                    recipientInfo
                  )
                }
                availableAccounts={availableAccounts}
                wallet={wallet}
                employees={employees}
              />
            ))}
          </div>
        )}

        {!loading && filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            {!isConnectionConfigured() ? (
              <p className="text-gray-500">
                Please configure your Odoo connection to get started.
              </p>
            ) : invoices.length === 0 ? (
              <p className="text-gray-500">
                No invoices found. Try adjusting your date range or direction
                filters.
              </p>
            ) : (
              <div>
                <p className="text-gray-600 font-medium mb-1">
                  No invoices match the current filter
                </p>
                <p className="text-sm text-gray-500">
                  {filters.status === "ready_to_pay"
                    ? "No invoices are ready to pay. They may be missing bank details or already paid."
                    : filters.status === "missing_bank"
                    ? "All invoices have bank details configured."
                    : filters.status === "draft"
                    ? "No draft invoices found."
                    : "Try adjusting your filters."}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, status: "all" }))
                  }
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Show All Invoices
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedInvoice && (
        <PDFSidebar
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          odooUrl={connectionSettings.url}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}
