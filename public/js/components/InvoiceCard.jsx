import { isInvoicePaid, markInvoiceAsPaid, getSelectedMoneriumAccount, setSelectedMoneriumAccount } from "../utils/storage.js";
import { getStorageKey } from "../config.js";
import {
  IncomingIcon,
  OutgoingIcon,
  XIcon,
  EyeIcon,
  ExternalLinkIcon,
} from "./icons.jsx";

const { useState, useEffect } = React;

export function InvoiceCard({
  invoice,
  onPreview,
  odooUrl,
  onPay,
  availableAccounts = [],
  wallet = null,
  employees = [],
}) {
  // Helper function to get chain prefix for Safe URL
  const getChainPrefix = (chain) => {
    return chain === "gnosis" ? "gno" : chain === "chiado" ? "chiado" : "gno";
  };

  // Helper function to get Safe URL
  const getSafeUrl = (address, chain) => {
    const chainPrefix = getChainPrefix(chain);
    return `https://app.safe.global/settings/setup?safe=${chainPrefix}:${address}`;
  };

  // Helper function to get validation error for an account
  const getValidationError = (account, signerAddress) => {
    if (!account || account.usable !== false) {
      return null;
    }

    // Use validationError if available and properly formatted
    if (
      account.validationError &&
      typeof account.validationError === "object" &&
      account.validationError.message
    ) {
      return account.validationError;
    }

    // Fallback: create error object
    return {
      message: `The address (${signerAddress}) is not the owner or a signatory of this account.`,
      safeUrl: getSafeUrl(account.address, account.chain),
    };
  };

  // Helper function to validate and set error for selected account
  const validateSelectedAccount = () => {
    if (!selectedAccountAddress || availableAccounts.length === 0) {
      setAddressValidationError(null);
      return;
    }

    const selectedAccount = availableAccounts.find(
      (acc) =>
        acc.address.toLowerCase() === selectedAccountAddress.toLowerCase()
    );

    if (!selectedAccount) {
      setAddressValidationError(null);
      return;
    }

    const signerAddress = wallet?.signerAddress;
    console.log(">>> selectedAccount", selectedAccount, signerAddress);
    const error = getValidationError(selectedAccount, signerAddress);
    setAddressValidationError(error);
  };
  const firstLineItem =
    invoice.invoice_line_ids &&
    invoice.invoice_line_ids.length > 0 &&
    invoice.invoice_line_ids[0];

  // Helper function to build default memo from invoice references
  const getDefaultMemo = () => {
    const parts = [];
    if (invoice.name) parts.push(invoice.name);
    if (invoice.ref) parts.push(invoice.ref);
    if (parts.length === 0 && firstLineItem?.name)
      parts.push(firstLineItem.name);
    return parts.join(" - ") || "";
  };

  const [expanded, setExpanded] = useState(false);
  const [memo, setMemo] = useState(getDefaultMemo());
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [paySuccess, setPaySuccess] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [selectedAccountAddress, setSelectedAccountAddress] = useState("");
  const [isPaidLocally, setIsPaidLocally] = useState(false);
  const [addressValidationError, setAddressValidationError] = useState(null);
  const [recipientType, setRecipientType] = useState("partner"); // "partner" or "employee"
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    setExpanded(false);
    setMemo(getDefaultMemo());
    setPayError(null);
    setPaySuccess(null);
    setNeedsReconnect(false);
    setAddressValidationError(null);
    // Check if invoice is already paid in localStorage
    setIsPaidLocally(isInvoicePaid(invoice.id));
  }, [invoice.id, invoice.ref, invoice.name, firstLineItem?.name]);

  useEffect(() => {
    // Set initial selected account from saved selection, connection, or first available
    if (availableAccounts.length === 0) return;

    // Priority: saved selection > connection.accountAddress > first available
    const savedAccount = getSelectedMoneriumAccount();
    if (savedAccount && availableAccounts.some(acc => acc.address.toLowerCase() === savedAccount.toLowerCase())) {
      setSelectedAccountAddress(savedAccount);
      return;
    }

    const storedConnection = localStorage.getItem(
      getStorageKey("monerium_connection")
    );
    let accountToSelect = null;

    if (storedConnection) {
      try {
        const connection = JSON.parse(storedConnection);
        if (connection.accountAddress) {
          accountToSelect = connection.accountAddress;
        } else {
          accountToSelect = availableAccounts[0].address;
        }
      } catch (err) {
        console.error("Failed to parse connection:", err);
        accountToSelect = availableAccounts[0].address;
      }
    } else {
      accountToSelect = availableAccounts[0].address;
    }

    if (accountToSelect) {
      setSelectedAccountAddress(accountToSelect);
    }
  }, [availableAccounts, wallet?.walletAddress]);

  // Validate selected account whenever it changes
  useEffect(() => {
    validateSelectedAccount();
  }, [selectedAccountAddress, availableAccounts, wallet?.walletAddress]);

  const isIncoming =
    invoice.move_type === "in_invoice" || invoice.move_type === "in_refund";
  const statusColor = {
    draft: "bg-gray-100 text-gray-800",
    posted: "bg-green-100 text-green-800",
    cancel: "bg-red-100 text-red-800",
  }[invoice.state];
  const isPaid =
    invoice.payment_state === "paid" || Boolean(paySuccess) || isPaidLocally;
  const paymentStateColor = isPaid ? "bg-green-100 text-green-800" : null;

  const openInOdoo = (e) => {
    e.stopPropagation();
    const odooInvoiceUrl = `${odooUrl}/web#id=${invoice.id}&model=account.move&view_type=form`;
    window.open(odooInvoiceUrl, "_blank", "noopener,noreferrer");
  };

  const canPay =
    typeof onPay === "function" &&
    invoice.payment_state !== "paid" &&
    !isPaidLocally &&
    invoice.state !== "draft" &&
    !paySuccess &&
    (invoice.amount_residual ?? invoice.amount_total) > 0;

  const handleOpenPayModal = (e) => {
    if (e) e.stopPropagation();
    if (!canPay || !onPay) return;
    console.log("💳 Opening payment modal. Employees available:", employees.length, employees);
    setPayError(null);
    setNeedsReconnect(false);
    setAddressValidationError(null);
    // Initialize selected employee if needed
    if (recipientType === "employee" && employees.length > 0 && !selectedEmployee) {
      setSelectedEmployee(employees[0]);
    }
    setShowPayModal(true);
    // Validation will be handled by the useEffect hook
  };

  const handleClosePayModal = () => {
    if (paying) return;
    setShowPayModal(false);
    setPayError(null);
    setNeedsReconnect(false);
  };

  const handleMarkAsPaid = () => {
    markInvoiceAsPaid(invoice.id);
    setIsPaidLocally(true);
    setPaySuccess("Invoice marked as paid");
    setShowPayModal(false);
    setPayError(null);
  };

  const goToMonerium = () => {
    const storedConnection = localStorage.getItem(
      getStorageKey("monerium_connection")
    );
    if (!storedConnection) {
      // Not authenticated - trigger reconnect event
      window.dispatchEvent(new Event("monerium-reconnect-requested"));
      return;
    }
    try {
      localStorage.removeItem(getStorageKey("monerium_connection"));
      localStorage.removeItem(getStorageKey("monerium_oauth"));
    } catch (err) {
      console.warn("Failed to clear Monerium connection:", err);
    }
    window.location.assign("/monerium");
  };

  const handleConfirmPay = async (e) => {
    if (e) e.stopPropagation();
    if (!canPay || !onPay) return;

    setPaying(true);
    setPayError(null);
    setPaySuccess(null);
    setNeedsReconnect(false);

    try {
      // Update connection with selected account address and persist selection
      if (selectedAccountAddress) {
        setSelectedMoneriumAccount(selectedAccountAddress);
      }
      const storedConnection = localStorage.getItem(
        getStorageKey("monerium_connection")
      );
      if (storedConnection && selectedAccountAddress) {
        const connection = JSON.parse(storedConnection);
        connection.accountAddress = selectedAccountAddress;
        localStorage.setItem(
          getStorageKey("monerium_connection"),
          JSON.stringify(connection)
        );
      }

      // Create a modified invoice object with the selected recipient's bank account
      const invoiceToPay = {
        ...invoice,
        bank_account_number:
          recipientType === "employee"
            ? selectedEmployee?.bank_account_number
            : invoice.bank_account_number,
      };

      // Create recipient info for Monerium order
      const recipientInfo =
        recipientType === "employee" && selectedEmployee
          ? { type: "employee", name: selectedEmployee.name }
          : { type: "partner", name: invoice.partner_name };

      const result = await onPay(
        invoiceToPay,
        memo,
        selectedAccountAddress,
        recipientInfo
      );
      console.log("✅ Monerium payment created:", result);
      const successMessage =
        result && result.id
          ? `Payment order ${result.id} created`
          : "Payment order created";
      setPaySuccess(successMessage);
      setIsPaidLocally(true);
      setShowPayModal(false);
      setNeedsReconnect(false);
    } catch (err) {
      console.error("❌ Payment failed:", err.message || err);
      setPayError(err.message || "Failed to initiate payment");
      if (err && typeof err === "object" && err.status === 401) {
        setNeedsReconnect(true);
      }
    } finally {
      setPaying(false);
    }
  };

  const odooInvoiceUrl = odooUrl
    ? `${odooUrl}/web#id=${invoice.id}&model=account.move&view_type=form`
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow transition-shadow">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-4 text-left gap-4"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div
            className={`p-2 rounded-lg ${
              isIncoming
                ? "bg-blue-100 text-blue-600"
                : "bg-purple-100 text-purple-600"
            }`}
          >
            {isIncoming ? <IncomingIcon /> : <OutgoingIcon />}
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-end gap-2 flex-wrap">
              <h3 className="font-semibold text-base text-gray-900 truncate max-w-xs md:max-w-sm">
                {invoice.partner_name}
              </h3>
              {!invoice.bank_account_number &&
                odooInvoiceUrl &&
                invoice.move_type === "in_invoice" && (
                  <a
                    href={odooInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline mb-0.5"
                  >
                    bank account details missing
                  </a>
                )}
              {invoice.state !== "posted" && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}
                >
                  {invoice.state}
                </span>
              )}
              {paymentStateColor && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${paymentStateColor}`}
                >
                  Paid
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span>{invoice.date || "—"}</span>
              {invoice.name && (
                <span className="truncate max-w-[180px]">{invoice.name}</span>
              )}
              {invoice.ref && (
                <span className="truncate max-w-[160px]">{invoice.ref}</span>
              )}
              {firstLineItem && (
                <span className="truncate max-w-[220px] text-gray-500">
                  {firstLineItem.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            {canPay && (
              <button
                onClick={handleOpenPayModal}
                className="inline-flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <span>Pay</span>
              </button>
            )}
            {!canPay && paySuccess && (
              <div className="text-xs text-green-600 bg-green-50 border border-green-100 rounded px-3 py-2">
                {paySuccess}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="font-semibold text-lg text-gray-900">
              €{(invoice.amount_residual ?? invoice.amount_total).toFixed(2)}
            </span>
            {invoice.amount_residual != null &&
              invoice.amount_residual < invoice.amount_total && (
                <span className="text-xs text-gray-500">
                  of €{invoice.amount_total.toFixed(2)}
                </span>
              )}
          </div>
          <div className="flex items-center space-x-1 text-blue-600">
            <span className="text-sm">
              {expanded ? "Hide details" : "View details"}
            </span>
            <svg
              className={`w-4 h-4 transform transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-4 text-sm text-gray-700">
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide">
                Invoice Type
              </span>
              <span className="font-medium text-gray-900">
                {isIncoming ? "Incoming (Vendor)" : "Outgoing (Customer)"}
              </span>
            </div>
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide">
                Date
              </span>
              <span className="font-medium text-gray-900">
                {invoice.date || "—"}
              </span>
            </div>
            {invoice.invoice_date_due && (
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Due Date
                </span>
                <span className="font-medium text-gray-900">
                  {invoice.invoice_date_due}
                </span>
              </div>
            )}
          </div>

          {invoice.invoice_line_ids && invoice.invoice_line_ids.length > 0 && (
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide mb-2">
                Line Items
              </span>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                {invoice.invoice_line_ids.map((line) => (
                  <div
                    key={line.id}
                    className="flex justify-between text-xs bg-gray-50 rounded px-2 py-1"
                  >
                    <span className="text-gray-700 truncate flex-1 mr-2">
                      {line.name}
                    </span>
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                      €{line.price_total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoice.messages && invoice.messages.length > 0 && (
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide mb-2">
                Messages ({invoice.messages.length})
              </span>
              <div className="space-y-3">
                {invoice.messages.slice(0, 3).map((message) => (
                  <div
                    key={message.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {Array.isArray(message.author_id)
                          ? message.author_id[1]
                          : "System"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(message.date).toLocaleString()}
                      </p>
                    </div>
                    <div
                      className="text-gray-700 text-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: message.body }}
                    />
                  </div>
                ))}
                {invoice.messages.length > 3 && (
                  <p className="text-xs text-gray-500">
                    Showing first 3 messages. View more in Odoo.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.history.pushState({}, "", `/invoices/${invoice.id}`);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="inline-flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-colors"
            >
              <span>View invoice</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(invoice);
              }}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <EyeIcon />
              <span>Preview PDF</span>
            </button>
            {odooUrl && (
              <button
                type="button"
                onClick={(e) => {
                  openInOdoo(e);
                }}
                className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg transition-colors border border-blue-100"
                title="Open in Odoo"
              >
                <ExternalLinkIcon />
                <span>Open in Odoo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {showPayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4"
          onClick={handleClosePayModal}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClosePayModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              title="Close"
            >
              <XIcon />
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Monerium Payment
            </h3>

            <div className="space-y-4 text-sm text-gray-700">
              {employees.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Pay to
                  </label>
                  <select
                    value={recipientType}
                    onChange={(e) => {
                      setRecipientType(e.target.value);
                      if (e.target.value === "employee" && employees.length > 0) {
                        setSelectedEmployee(employees[0]);
                      } else {
                        setSelectedEmployee(null);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="partner">Partner (Default)</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
              )}
              {recipientType === "employee" && employees.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Select Employee
                  </label>
                  <select
                    value={selectedEmployee?.id || ""}
                    onChange={(e) => {
                      const employee = employees.find(
                        (emp) => emp.id === parseInt(e.target.value)
                      );
                      setSelectedEmployee(employee);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                        {!employee.bank_account_number && " (No bank account)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  {recipientType === "partner" ? "Partner" : "Employee"}
                </span>
                <span className="font-medium text-gray-900">
                  {recipientType === "partner"
                    ? invoice.partner_name || "—"
                    : selectedEmployee?.name || "—"}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Bank Account
                </span>
                {recipientType === "partner" && !invoice.bank_account_number ? (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                    <span>bank account details missing</span>
                    {odooInvoiceUrl && (
                      <>
                        {" - "}
                        <a
                          href={odooInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-medium"
                        >
                          Add in Odoo →
                        </a>
                      </>
                    )}
                  </div>
                ) : recipientType === "employee" && !selectedEmployee?.bank_account_number ? (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                    No bank account found for this employee
                  </div>
                ) : (
                  <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                    {recipientType === "partner"
                      ? invoice.bank_account_number
                      : selectedEmployee?.bank_account_number || "—"}
                  </span>
                )}
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  {invoice.amount_residual != null &&
                  invoice.amount_residual < invoice.amount_total
                    ? "Amount Due"
                    : "Amount"}
                </span>
                <span className="font-semibold text-lg text-gray-900">
                  €
                  {(invoice.amount_residual ?? invoice.amount_total).toFixed(2)}
                </span>
                {invoice.amount_residual != null &&
                  invoice.amount_residual < invoice.amount_total && (
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Total: €{invoice.amount_total.toFixed(2)}
                    </span>
                  )}
              </div>
              {availableAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Pay with
                  </label>
                  <select
                    value={selectedAccountAddress}
                    onChange={(e) => {
                      const newAddress = e.target.value;
                      setSelectedAccountAddress(newAddress);
                      setSelectedMoneriumAccount(newAddress);
                      // Validation error will be set by useEffect based on pre-validated accounts
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {availableAccounts.map((account) => {
                      const addressKey = `${account.address}-${account.chain}`;
                      const storedLabels = localStorage.getItem(
                        "monerium_address_labels"
                      );
                      let label = null;
                      if (storedLabels) {
                        try {
                          const labels = JSON.parse(storedLabels);
                          label = labels[addressKey];
                        } catch (err) {
                          // Ignore parse errors
                        }
                      }
                      const displayAddress =
                        label ||
                        `${account.address.substring(
                          0,
                          6
                        )}...${account.address.substring(
                          account.address.length - 4
                        )}`;
                      return (
                        <option key={addressKey} value={account.address}>
                          {displayAddress} ({account.chain}) - €
                          {account.balance || "0.00"}
                        </option>
                      );
                    })}
                  </select>
                  {addressValidationError && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                      {typeof addressValidationError === "string" ? (
                        addressValidationError
                      ) : (
                        <div>
                          <p className="mb-2">
                            {addressValidationError.message}
                          </p>
                          {addressValidationError.safeUrl && (
                            <a
                              href={addressValidationError.safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline font-medium"
                            >
                              Open Safe Settings →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Memo / Reference
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              {payError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                  <div className="mb-2">{payError}</div>
                  <button
                    type="button"
                    onClick={handleMarkAsPaid}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Mark as paid
                  </button>
                </div>
              )}
              {needsReconnect && (
                <button
                  onClick={() => {
                    handleClosePayModal();
                    goToMonerium();
                  }}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  <span>Reconnect Monerium</span>
                </button>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={handleClosePayModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                disabled={paying}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPay}
                disabled={
                  paying ||
                  addressValidationError ||
                  (recipientType === "partner" && !invoice.bank_account_number) ||
                  (recipientType === "employee" && !selectedEmployee?.bank_account_number)
                }
                className="inline-flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <span>{paying ? "Processing..." : "Pay"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
