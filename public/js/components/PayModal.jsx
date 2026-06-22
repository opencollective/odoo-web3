import { getStorageKey } from "../config.js";
import {
  markInvoiceAsPaid,
  getSelectedMoneriumAccount,
  setSelectedMoneriumAccount,
} from "../utils/storage.js";
import { addToBatch } from "../utils/batch.js";
import { KeyLockedError, unlockServer } from "../services/monerium.js";
import { XIcon } from "./icons.jsx";

const { useState, useEffect } = React;

function getChainPrefix(chain) {
  return chain === "gnosis" ? "gno" : chain === "chiado" ? "chiado" : "gno";
}

function getValidationError(account, signerAddress) {
  if (!account || account.usable !== false) return null;
  // Signer unknown (server key locked / not yet unlocked and no wallet connected).
  // Don't fabricate a "(null) is not a signatory" error and don't block Pay —
  // the pay flow will prompt for the passphrase and validate once unlocked.
  if (!signerAddress) return null;
  if (
    account.validationError &&
    typeof account.validationError === "object" &&
    account.validationError.message
  ) {
    return account.validationError;
  }
  return {
    message: `The address (${signerAddress}) is not the owner or a signatory of this account.`,
    safeUrl: `https://app.safe.global/settings/setup?safe=${getChainPrefix(account.chain)}:${account.address}`,
  };
}

export function PayModal({
  invoice,
  initialMemo = "",
  employees = [],
  availableAccounts = [],
  wallet = null,
  odooInvoiceUrl = null,
  initialAccountAddress = null,
  onPay,
  onClose,
  onPaid,
  title = "Confirm Monerium Payment",
  payLabel = "Pay",
  allowMarkAsPaid = true,
  allowBatch = true,
}) {
  const [memo, setMemo] = useState(initialMemo);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [selectedAccountAddress, setSelectedAccountAddress] = useState("");
  const [addressValidationError, setAddressValidationError] = useState(null);
  const [recipientType, setRecipientType] = useState("partner");
  const [selectedEmployee, setSelectedEmployee] = useState(
    employees.length > 0 ? employees[0] : null
  );

  // Pick initial Monerium account when availableAccounts changes
  useEffect(() => {
    if (availableAccounts.length === 0) return;
    const matches = (addr) =>
      addr &&
      availableAccounts.some(
        (acc) => acc.address.toLowerCase() === addr.toLowerCase()
      );
    if (initialAccountAddress && matches(initialAccountAddress)) {
      setSelectedAccountAddress(initialAccountAddress);
      return;
    }
    const savedAccount = getSelectedMoneriumAccount();
    if (matches(savedAccount)) {
      setSelectedAccountAddress(savedAccount);
      return;
    }
    let accountToSelect = null;
    try {
      const storedConnection = localStorage.getItem(
        getStorageKey("monerium_connection")
      );
      if (storedConnection) {
        const connection = JSON.parse(storedConnection);
        if (matches(connection.accountAddress)) {
          accountToSelect = connection.accountAddress;
        }
      }
    } catch {
      // ignore
    }
    if (!accountToSelect) accountToSelect = availableAccounts[0].address;
    setSelectedAccountAddress(accountToSelect);
  }, [availableAccounts, initialAccountAddress, wallet?.walletAddress]);

  // Validate selected account
  useEffect(() => {
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
    setAddressValidationError(
      getValidationError(selectedAccount, wallet?.signerAddress)
    );
  }, [selectedAccountAddress, availableAccounts, wallet?.walletAddress]);

  const handleClose = () => {
    if (paying) return;
    onClose();
  };

  const handleConfirmPay = async () => {
    if (!onPay) return;
    setPaying(true);
    setPayError(null);
    setNeedsReconnect(false);
    try {
      if (selectedAccountAddress) {
        setSelectedMoneriumAccount(selectedAccountAddress);
        try {
          const storedConnection = localStorage.getItem(
            getStorageKey("monerium_connection")
          );
          if (storedConnection) {
            const connection = JSON.parse(storedConnection);
            connection.accountAddress = selectedAccountAddress;
            localStorage.setItem(
              getStorageKey("monerium_connection"),
              JSON.stringify(connection)
            );
          }
        } catch {
          // ignore
        }
      }

      const invoiceToPay = {
        ...invoice,
        bank_account_number:
          recipientType === "employee"
            ? selectedEmployee?.bank_account_number
            : invoice.bank_account_number,
      };
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
      if (onPaid) onPaid(result, { markedAsPaid: false });
      onClose();
    } catch (err) {
      console.error("Payment failed:", err.message || err);
      if (err instanceof KeyLockedError) {
        setNeedsPassphrase(true);
        setPayError(null);
      } else {
        setPayError(err.message || "Failed to initiate payment");
        if (err && typeof err === "object" && err.status === 401) {
          setNeedsReconnect(true);
        }
      }
    } finally {
      setPaying(false);
    }
  };

  const handleAddToBatch = () => {
    const amount = invoice.amount_residual ?? invoice.amount_total;
    const iban =
      recipientType === "employee"
        ? selectedEmployee?.bank_account_number
        : invoice.bank_account_number;
    const name =
      recipientType === "employee"
        ? selectedEmployee?.name
        : invoice.partner_name;
    if (!iban) {
      setPayError("Missing bank account number for the selected recipient.");
      return;
    }
    if (selectedAccountAddress) setSelectedMoneriumAccount(selectedAccountAddress);

    // Environment is derived from the stored Monerium connection.
    let environment = "sandbox";
    try {
      const stored = localStorage.getItem(getStorageKey("monerium_connection"));
      if (stored) environment = JSON.parse(stored).environment || environment;
    } catch {
      // fall back to sandbox
    }

    addToBatch({
      invoiceId: invoice.id,
      label: name,
      amount,
      iban,
      memo,
      recipientType: recipientType === "employee" ? "individual" : "company",
      name,
      accountAddress: selectedAccountAddress,
      environment,
    });
    if (onPaid) onPaid(null, { addedToBatch: true });
    onClose();
  };

  const handleUnlockAndRetry = async () => {
    if (!passphrase) return;
    setUnlocking(true);
    setPayError(null);
    try {
      await unlockServer(passphrase);
      setNeedsPassphrase(false);
      setPassphrase("");
      await handleConfirmPay();
    } catch (err) {
      setPayError(err.message || "Failed to unlock");
    } finally {
      setUnlocking(false);
    }
  };

  const handleMarkAsPaid = () => {
    markInvoiceAsPaid(invoice.id);
    if (onPaid) onPaid(null, { markedAsPaid: true });
    onClose();
  };

  const goToMonerium = () => {
    const storedConnection = localStorage.getItem(
      getStorageKey("monerium_connection")
    );
    if (!storedConnection) {
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

  const amountToShow = invoice.amount_residual ?? invoice.amount_total;
  const payButtonDisabled =
    paying ||
    addressValidationError ||
    (recipientType === "partner" && !invoice.bank_account_number) ||
    (recipientType === "employee" && !selectedEmployee?.bank_account_number);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          title="Close"
        >
          <XIcon />
        </button>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

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
            ) : recipientType === "employee" &&
              !selectedEmployee?.bank_account_number ? (
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
              €{amountToShow.toFixed(2)}
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
                    } catch {
                      // ignore parse errors
                    }
                  }
                  const displayAddress =
                    label ||
                    `${account.address.substring(0, 6)}...${account.address.substring(
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
                      <p className="mb-2">{addressValidationError.message}</p>
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
              {allowMarkAsPaid && (
                <button
                  type="button"
                  onClick={handleMarkAsPaid}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Mark as paid
                </button>
              )}
            </div>
          )}
          {needsPassphrase && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2">
              <p className="text-xs text-amber-800 font-medium">
                Server signing key is locked. Enter the passphrase to unlock.
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
                  className="flex-1 px-3 py-1.5 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleUnlockAndRetry}
                  disabled={!passphrase || unlocking}
                  className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  {unlocking ? "Unlocking..." : `Unlock & ${payLabel}`}
                </button>
              </div>
            </div>
          )}
          {needsReconnect && (
            <button
              onClick={() => {
                handleClose();
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
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            disabled={paying}
          >
            Cancel
          </button>
          {allowBatch && (
            <button
              onClick={handleAddToBatch}
              disabled={
                paying ||
                (recipientType === "partner" && !invoice.bank_account_number) ||
                (recipientType === "employee" &&
                  !selectedEmployee?.bank_account_number)
              }
              className="inline-flex items-center justify-center space-x-2 border border-green-600 text-green-700 hover:bg-green-50 disabled:border-gray-300 disabled:text-gray-400 px-4 py-2 rounded-lg transition-colors"
              title="Queue for batch signing instead of paying now"
            >
              <span>Add to batch</span>
            </button>
          )}
          <button
            onClick={handleConfirmPay}
            disabled={payButtonDisabled}
            className="inline-flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <span>{paying ? "Processing..." : payLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
