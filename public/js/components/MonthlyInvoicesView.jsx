import { InvoiceCard } from "./InvoiceCard.jsx";
import { PDFSidebar } from "./PDFSidebar.jsx";
import { useWallet } from "../hooks/useWallet.js";
import { getStorageKey, ENV } from "../config.js";
import { validateAccounts } from "../utils/validation.js";

const { useState, useEffect } = React;

export function MonthlyInvoicesView({
  year,
  month,
  connectionSettings,
  sessionId,
  navigate,
}) {
  const wallet = useWallet();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);

  useEffect(() => {
    const fetchMonthlyInvoices = async () => {
      setLoading(true);
      setError(null);

      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      const firstDay = `${yearNum}-${monthNum.toString().padStart(2, "0")}-01`;

      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      const lastDayStr = `${yearNum}-${monthNum
        .toString()
        .padStart(2, "0")}-${lastDay}`;

      const params = new URLSearchParams();
      Object.entries(connectionSettings).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append("since", firstDay);
      params.append("until", lastDayStr);
      params.append("limit", "1000");

      try {
        const response = await fetch(`/api/odoo/invoices?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch invoices");
        }

        setInvoices(data.invoices);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyInvoices();
  }, [year, month, connectionSettings]);

  // Load Monerium accounts once when connection is available
  useEffect(() => {
    const loadAccounts = async () => {
      const storedConnection = localStorage.getItem(
        getStorageKey("monerium_connection")
      );
      if (!storedConnection) {
        setAvailableAccounts([]);
        return;
      }

      try {
        const connection = JSON.parse(storedConnection);
        if (!connection?.accessToken) {
          setAvailableAccounts([]);
          return;
        }

        // Check if token is expired
        if (connection.expiresAt && Date.now() >= connection.expiresAt) {
          console.log("⏰ Token expired, clearing connection");
          localStorage.removeItem(getStorageKey("monerium_connection"));
          localStorage.removeItem(getStorageKey("monerium_oauth"));
          window.dispatchEvent(new Event("monerium-connection-updated"));
          setAvailableAccounts([]);
          return;
        }

        const response = await fetch("/api/monerium/addresses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: connection.accessToken,
            environment: connection.environment || "sandbox",
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
  }, []);

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

  const monthName = new Date(
    parseInt(year),
    parseInt(month) - 1,
    1
  ).toLocaleString("default", { month: "long" });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoaderIcon />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate("/")}
          className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
        >
          ← Back to Invoices
        </button>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          📅 {monthName} {year}
        </h1>
        <p className="text-gray-600 mb-8">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} found
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {invoices.length > 0 && (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onPreview={setSelectedInvoice}
                odooUrl={connectionSettings.url}
                onPay={(invoice, memo, accountAddress) =>
                  handlePay(
                    invoice,
                    memo,
                    accountAddress,
                    wallet.walletAddress ? wallet.signMessage : null
                  )
                }
                availableAccounts={availableAccounts}
                wallet={wallet}
              />
            ))}
          </div>
        )}

        {invoices.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">
            No invoices found for {monthName} {year}.
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
