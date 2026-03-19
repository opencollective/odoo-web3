import { XIcon, LoaderIcon, DownloadIcon } from "./icons.jsx";
import {
  parseCSV,
  validateBatchPayments,
  formatValidationErrors,
  generateSampleCSV,
  resultsToCsv,
} from "../utils/csv.js";

const { useState, useEffect } = React;

export function BatchPaymentModal({ onClose, moneriumConnection, walletSignMessage }) {
  const [activeTab, setActiveTab] = useState("paste"); // 'paste' or 'upload'
  const [csvText, setCsvText] = useState("");
  const [parsedPayments, setParsedPayments] = useState([]);
  const [validationErrors, setValidationErrors] = useState(new Map());
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState(null);

  // Load Monerium accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    if (!moneriumConnection?.accessToken) return;

    setLoadingAccounts(true);
    try {
      const response = await fetch("/api/monerium/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: moneriumConnection.accessToken,
          environment: moneriumConnection.environment,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load accounts");
      }

      const data = await response.json();
      setAccounts(data || []);

      // Auto-select the stored account if available
      if (moneriumConnection.accountAddress) {
        setSelectedAccount(moneriumConnection.accountAddress);
      } else if (data.length > 0) {
        setSelectedAccount(data[0].address);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
      alert("Failed to load Monerium accounts: " + error.message);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleParseCsv = () => {
    try {
      const rows = parseCSV(csvText);
      const validation = validateBatchPayments(rows);

      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setParsedPayments([]);
        alert(
          "CSV validation failed:\n\n" +
            formatValidationErrors(validation.errors)
        );
        return;
      }

      setParsedPayments(validation.payments);
      setValidationErrors(new Map());
    } catch (error) {
      alert("CSV parsing error: " + error.message);
      setParsedPayments([]);
      setValidationErrors(new Map());
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
      setActiveTab("paste"); // Switch to paste tab to show content
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-batch-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadResults = () => {
    if (!results) return;

    const csv = resultsToCsv(results.results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-payment-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProcess = async () => {
    if (parsedPayments.length === 0) {
      alert("Please parse and validate CSV first");
      return;
    }

    if (!selectedAccount) {
      alert("Please select a payment account");
      return;
    }

    // Generate signature if wallet is connected
    let signature = null;
    if (walletSignMessage) {
      const totalAmount = parsedPayments.reduce(
        (sum, p) => sum + p.amount,
        0
      );
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const message = `Batch payment: ${
        parsedPayments.length
      } transactions, total €${totalAmount.toFixed(2)} at ${timestamp}`;

      try {
        signature = await walletSignMessage(message);
        console.log("✍️ Batch signed with wallet:", signature);
      } catch (error) {
        console.error("Failed to sign:", error);
        alert("Failed to sign with wallet: " + error.message);
        return;
      }
    }

    setProcessing(true);
    setCurrentIndex(0);
    setResults(null);

    try {
      const response = await fetch("/api/monerium/batch-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: moneriumConnection.accessToken,
          environment: moneriumConnection.environment,
          accountAddress: selectedAccount,
          signature,
          payments: parsedPayments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Batch processing failed");
      }

      setResults(data);
    } catch (error) {
      console.error("Batch processing error:", error);
      alert("Batch processing failed: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const totalAmount = parsedPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          title="Close"
        >
          <XIcon />
        </button>

        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Batch Payment
        </h2>

        {!results ? (
          <>
            {/* CSV Input Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  1. Input CSV Data
                </h3>
                <button
                  onClick={handleDownloadSample}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <DownloadIcon />
                  Download Sample
                </button>
              </div>

              <div className="border-b border-gray-200 mb-4">
                <div className="flex gap-4">
                  <button
                    className={`py-2 px-4 text-sm font-medium border-b-2 ${
                      activeTab === "paste"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-600 hover:text-gray-800"
                    }`}
                    onClick={() => setActiveTab("paste")}
                  >
                    Paste CSV
                  </button>
                  <button
                    className={`py-2 px-4 text-sm font-medium border-b-2 ${
                      activeTab === "upload"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-600 hover:text-gray-800"
                    }`}
                    onClick={() => setActiveTab("upload")}
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {activeTab === "paste" ? (
                <div>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="name,type,iban,amount,description
&quot;Acme Corp&quot;,organisation,DE89370400440532013000,1234.56,&quot;Invoice INV-001&quot;"
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleParseCsv}
                    disabled={!csvText.trim()}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                  >
                    Parse & Validate
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Select a CSV file to upload. It will be loaded into the editor.
                  </p>
                </div>
              )}
            </div>

            {/* Preview Section */}
            {parsedPayments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  2. Review Payments ({parsedPayments.length} payments, total €
                  {totalAmount.toFixed(2)})
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">IBAN</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedPayments.map((payment, index) => (
                        <tr
                          key={index}
                          className={
                            validationErrors.has(index) ? "bg-red-50" : ""
                          }
                        >
                          <td className="px-3 py-2">{index + 1}</td>
                          <td className="px-3 py-2">{payment.name}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${
                                payment.type === "organisation"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {payment.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {payment.iban}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            €{payment.amount.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {payment.description || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Account Selection */}
            {parsedPayments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  3. Select Payment Account
                </h3>
                {loadingAccounts ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <LoaderIcon />
                    <span>Loading accounts...</span>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                    No Monerium accounts found. Please connect to Monerium first.
                  </div>
                ) : (
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {accounts.map((account) => (
                      <option key={account.address} value={account.address}>
                        {account.address} - {account.network} - €
                        {account.balances?.[0]?.amount || "0.00"}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Processing Status */}
            {processing && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Processing Payments...
                </h3>
                <div className="flex items-center gap-3">
                  <LoaderIcon />
                  <span className="text-sm text-gray-600">
                    Please wait while we process your batch payment
                  </span>
                </div>
              </div>
            )}

            {/* Action Button */}
            {!processing && parsedPayments.length > 0 && (
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcess}
                  disabled={!selectedAccount || accounts.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Process {parsedPayments.length} Payment
                  {parsedPayments.length !== 1 ? "s" : ""} (€
                  {totalAmount.toFixed(2)})
                </button>
              </div>
            )}
          </>
        ) : (
          /* Results Section */
          <div>
            <div className="mb-6">
              <div
                className={`p-4 rounded-lg ${
                  results.failed === 0
                    ? "bg-green-50 border border-green-200"
                    : results.successful === 0
                    ? "bg-red-50 border border-red-200"
                    : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <h3 className="text-lg font-semibold mb-2">
                  {results.failed === 0
                    ? "✅ All payments successful!"
                    : results.successful === 0
                    ? "❌ All payments failed"
                    : "⚠️ Partial success"}
                </h3>
                <p className="text-sm">
                  {results.successful} of {results.total} payments completed
                  successfully
                  {results.failed > 0 && `, ${results.failed} failed`}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Payment Results
                </h3>
                <button
                  onClick={handleDownloadResults}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <DownloadIcon />
                  Download Results
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Order ID / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {results.results.map((result) => (
                      <tr
                        key={result.index}
                        className={
                          result.status === "failed" ? "bg-red-50" : ""
                        }
                      >
                        <td className="px-3 py-2">{result.index + 1}</td>
                        <td className="px-3 py-2">{result.name}</td>
                        <td className="px-3 py-2 text-right">
                          €{result.amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              result.status === "success"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {result.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {result.orderId || result.error || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
