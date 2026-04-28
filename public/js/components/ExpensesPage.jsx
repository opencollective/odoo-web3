import {
  loadMoneriumConnectionState,
  isOCExpenseImported,
} from "../utils/storage.js";
import { fetchHostExpenses, getExpenseIBAN } from "../services/opencollective.js";
import { handlePay } from "../services/monerium.js";
import { validateAccounts } from "../utils/validation.js";
import { useWallet } from "../hooks/useWallet.js";
import { OdooExpenseCard } from "./OdooExpenseCard.jsx";
import { MoneriumConnectPanel } from "./MoneriumConnectPanel.jsx";
import { LoaderIcon } from "./icons.jsx";

const { useState, useEffect, useCallback, useMemo } = React;

const FILTER_OPTIONS = [
  { value: "READY", label: "Ready to Pay" },
  { value: "", label: "All" },
  { value: "APPROVED", label: "Approved" },
];

const ODOO_PAYABLE_STATES = new Set(["approve", "approved", "post", "posted"]);
const ODOO_APPROVED_STATES = new Set(["approve", "approved", "post", "posted"]);

export function ExpensesPage({ navigate }) {
  // Odoo state — main list on this page
  const [odooExpenses, setOdooExpenses] = useState([]);
  const [odooUrl, setOdooUrl] = useState("");
  const [odooLoading, setOdooLoading] = useState(true);
  const [odooError, setOdooError] = useState(null);
  const [odooConfigured, setOdooConfigured] = useState(false);
  const [filter, setFilter] = useState("READY");

  // Open Collective — fetched only to count "to import" expenses
  const [ocReadyToImportCount, setOcReadyToImportCount] = useState(0);
  const [ocLoading, setOcLoading] = useState(true);

  const [moneriumConnection, setMoneriumConnection] = useState(
    loadMoneriumConnectionState
  );
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const wallet = useWallet();

  useEffect(() => {
    const handleConnectionUpdate = () =>
      setMoneriumConnection(loadMoneriumConnectionState());
    window.addEventListener("monerium-connection-updated", handleConnectionUpdate);
    return () =>
      window.removeEventListener("monerium-connection-updated", handleConnectionUpdate);
  }, []);

  // Load Monerium accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!moneriumConnection?.accessToken) {
        setAvailableAccounts([]);
        return;
      }
      try {
        const response = await fetch("/api/monerium/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: moneriumConnection.accessToken,
            environment: moneriumConnection.environment || "sandbox",
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const accounts = Array.isArray(data) ? data : [];
          const signerAddress = wallet?.signerAddress;
          setAvailableAccounts(validateAccounts(accounts, signerAddress));
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

  // Odoo expenses
  const loadOdooExpenses = useCallback(async () => {
    setOdooLoading(true);
    setOdooError(null);
    try {
      const res = await fetch("/api/odoo/expenses?limit=100");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          setOdooConfigured(false);
          setOdooExpenses([]);
          setOdooUrl("");
          return;
        }
        throw new Error(data.error || "Failed to fetch Odoo expenses");
      }
      setOdooConfigured(true);
      setOdooExpenses(data.expenses || []);
      setOdooUrl(data.odooUrl || "");
    } catch (err) {
      console.error("Failed to fetch Odoo expenses:", err);
      setOdooError(err.message || "Failed to fetch Odoo expenses");
      setOdooExpenses([]);
    } finally {
      setOdooLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOdooExpenses();
  }, [loadOdooExpenses]);

  // Open Collective — only to count expenses still to import.
  const loadOcImportCount = useCallback(async () => {
    setOcLoading(true);
    try {
      const result = await fetchHostExpenses({
        hostSlug: "citizenspring-asbl",
        limit: 100,
        offset: 0,
        status: "APPROVED",
      });
      const nodes = result.expenses?.nodes || [];
      const pending = nodes.filter((exp) => {
        if (isOCExpenseImported(exp.id)) return false;
        const iban = getExpenseIBAN(exp);
        if (!iban) return false;
        const balance = exp.account?.stats?.balance?.valueInCents || 0;
        return balance >= (exp.amount || 0);
      });
      setOcReadyToImportCount(pending.length);
    } catch (err) {
      console.error("Failed to fetch OC expenses:", err);
      setOcReadyToImportCount(0);
    } finally {
      setOcLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOcImportCount();
  }, [loadOcImportCount]);

  // Filter Odoo expenses by the active filter
  const filteredOdooExpenses = useMemo(() => {
    if (!odooConfigured) return [];
    return odooExpenses.filter((exp) => {
      const state = (exp.state || "").toLowerCase();
      if (filter === "READY") {
        return (
          ODOO_PAYABLE_STATES.has(state) && Boolean(exp.bank_account_number)
        );
      }
      if (filter === "APPROVED") {
        return ODOO_APPROVED_STATES.has(state);
      }
      return true; // all
    });
  }, [odooExpenses, odooConfigured, filter]);

  const handlePayExpense = async (invoice, memo, accountAddress, recipientInfo, force = false) => {
    return handlePay(
      invoice,
      memo,
      accountAddress,
      wallet.walletAddress ? wallet.signMessage : null,
      recipientInfo,
      force
    );
  };

  const moneriumConfigured = Boolean(
    moneriumConnection?.accessToken && moneriumConnection?.accountAddress
  );

  const countByFilter = (value) => {
    if (!odooConfigured) return null;
    if (value === "READY") {
      return odooExpenses.filter(
        (e) =>
          ODOO_PAYABLE_STATES.has((e.state || "").toLowerCase()) &&
          Boolean(e.bank_account_number)
      ).length;
    }
    if (value === "APPROVED") {
      return odooExpenses.filter((e) =>
        ODOO_APPROVED_STATES.has((e.state || "").toLowerCase())
      ).length;
    }
    return odooExpenses.length;
  };

  const summaryText = useMemo(() => {
    if (odooLoading) return null;
    const count = filteredOdooExpenses.length;
    const totalCents = filteredOdooExpenses.reduce(
      (sum, r) => sum + (r.total_amount || 0) * 100,
      0
    );
    const currency = filteredOdooExpenses[0]?.currency || "EUR";
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(totalCents / 100);

    if (filter === "READY") {
      return `${count} expense${count !== 1 ? "s" : ""} ready to be paid (total: ${formattedTotal})`;
    }
    const label = filter ? filter.toLowerCase() : "";
    return `${count} ${label} expense${count !== 1 ? "s" : ""} (total: ${formattedTotal})`;
  }, [filteredOdooExpenses, odooLoading, filter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate("/")}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              &larr; Back to Home
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
              <p className="text-gray-600 mt-1">Odoo expenses</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  loadOdooExpenses();
                  loadOcImportCount();
                }}
                disabled={odooLoading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {odooLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Monerium Connect Panel */}
        {!moneriumConfigured && (
          <MoneriumConnectPanel
            connection={moneriumConnection}
            onConnectionChange={(next) =>
              setMoneriumConnection(next ?? loadMoneriumConnectionState())
            }
          />
        )}

        {/* Open Collective import summary */}
        {!ocLoading && ocReadyToImportCount > 0 && (
          <button
            type="button"
            onClick={() => navigate("/expenses/import/opencollective")}
            className="w-full mb-6 px-4 py-3 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors flex items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-orange-900">
              {ocReadyToImportCount} expense{ocReadyToImportCount !== 1 ? "s" : ""} on Open Collective to import
            </span>
            <span className="text-orange-700">→</span>
          </button>
        )}

        {/* Errors */}
        {odooError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">Odoo: {odooError}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              {FILTER_OPTIONS.map(({ value, label }) => {
                const count = countByFilter(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      filter === value
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {label}
                    {count != null && count > 0 && (
                      <span
                        className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                          filter === value
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {summaryText && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
              {summaryText}
            </div>
          )}
        </div>

        {/* Loading */}
        {odooLoading && filteredOdooExpenses.length === 0 && (
          <div className="flex justify-center items-center py-12">
            <LoaderIcon />
          </div>
        )}

        {/* Odoo expenses list */}
        {filteredOdooExpenses.length > 0 && (
          <div className="space-y-4">
            {filteredOdooExpenses.map((expense) => (
              <OdooExpenseCard
                key={`odoo-${expense.id}`}
                expense={expense}
                odooUrl={odooUrl}
                onPay={moneriumConfigured ? handlePayExpense : null}
                availableAccounts={availableAccounts}
                wallet={wallet}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!odooLoading && filteredOdooExpenses.length === 0 && !odooError && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {filter === "READY"
                ? "No Odoo expenses ready to be paid."
                : `No Odoo expenses found${filter ? ` with status "${filter}"` : ""}.`}
            </p>
            {filter && (
              <button
                onClick={() => setFilter("")}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Show All Expenses
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
