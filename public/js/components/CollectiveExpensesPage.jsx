import { getStorageKey, ENV } from "../config.js";
import {
  loadMoneriumConnectionState,
  setOpenCollectiveCollective,
} from "../utils/storage.js";
import { fetchExpenses } from "../services/opencollective.js";
import { handlePay } from "../services/monerium.js";
import { validateAccounts } from "../utils/validation.js";
import { useWallet } from "../hooks/useWallet.js";
import { ExpenseCard } from "./ExpenseCard.jsx";
import { LoaderIcon, FilterIcon } from "./icons.jsx";

const { useState, useEffect, useCallback } = React;

export function CollectiveExpensesPage({ slug, navigate }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("APPROVED");
  const [moneriumConnection, setMoneriumConnection] = useState(
    loadMoneriumConnectionState
  );
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [account, setAccount] = useState(null);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    paid: 0,
    rejected: 0,
    processing: 0,
  });
  const wallet = useWallet();

  // Save the collective slug for future use
  useEffect(() => {
    setOpenCollectiveCollective(slug);
  }, [slug]);

  // Listen for Monerium connection updates
  useEffect(() => {
    const handleConnectionUpdate = () => {
      setMoneriumConnection(loadMoneriumConnectionState());
    };
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
          const signerAddress = wallet?.walletAddress || ENV.serverWalletAddress;
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

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchExpenses(slug, {
        limit: 50,
        offset: 0,
        status: statusFilter || undefined,
      });

      setExpenses(result.expenses?.nodes || []);
      setTotalCount(result.expenses?.totalCount || 0);
      setAccount(result.account);
      setStatusCounts(result.statusCounts);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
      setError(err.message || "Failed to fetch expenses");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [slug, statusFilter]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleStatusUpdate = (expenseId, newStatus) => {
    setExpenses((prev) =>
      prev.map((exp) =>
        exp.id === expenseId ? { ...exp, status: newStatus } : exp
      )
    );
  };

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

  const statusOptions = [
    { value: "", label: "All", count: statusCounts.all },
    { value: "PENDING", label: "Pending", count: statusCounts.pending },
    { value: "APPROVED", label: "Approved", count: statusCounts.approved },
    { value: "PAID", label: "Paid", count: statusCounts.paid },
    { value: "REJECTED", label: "Rejected", count: statusCounts.rejected },
    { value: "PROCESSING", label: "Processing", count: statusCounts.processing },
  ];

  // Format balance
  const formatBalance = () => {
    if (!account?.stats?.balance) return null;
    const { valueInCents, currency } = account.stats.balance;
    const amount = valueInCents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  const collectiveBalance = account?.stats?.balance?.valueInCents || 0;

  const moneriumConfigured = Boolean(
    moneriumConnection?.accessToken && moneriumConnection?.accountAddress
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate("/settings")}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              &larr; Back to Settings
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {account?.name || slug}
              </h1>
              <p className="text-gray-600 mt-1">
                {formatBalance() ? (
                  <>
                    Balance: <span className="font-semibold text-green-700">{formatBalance()}</span>
                  </>
                ) : (
                  "Loading..."
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadExpenses}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
              <a
                href={`https://opencollective.com/${slug}/expenses`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                View on OC
              </a>
            </div>
          </div>
        </div>

        {/* Monerium Connect Button */}
        {!moneriumConfigured && (
          <div className="mb-6">
            <button
              onClick={() => navigate("/settings")}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Connect Monerium
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              {statusOptions.map(({ value, label, count }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    statusFilter === value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                      statusFilter === value
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoaderIcon />
          </div>
        )}

        {/* Expenses List */}
        {!loading && expenses.length > 0 && (
          <div className="space-y-4">
            {expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                onPay={moneriumConfigured ? handlePayExpense : null}
                availableAccounts={availableAccounts}
                wallet={wallet}
                onStatusUpdate={handleStatusUpdate}
                collectiveBalance={collectiveBalance}
                collectiveSlug={slug}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && expenses.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No expenses found
              {statusFilter && ` with status "${statusFilter}"`}.
            </p>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter("")}
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
