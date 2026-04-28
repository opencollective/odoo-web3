import { getStorageKey } from "../config.js";
import {
  getSelectedMoneriumAccount,
  setSelectedMoneriumAccount,
  markExpensePaidLocal,
  isExpensePaidLocal,
} from "../utils/storage.js";
import { KeyLockedError, unlockServer } from "../services/monerium.js";
import { markExpenseAsPaid as markOCExpenseAsPaid } from "../services/opencollective.js";
import { ExternalLinkIcon, EyeIcon, XIcon } from "./icons.jsx";
import { AttachmentSidebar } from "./AttachmentSidebar.jsx";

const { useState, useEffect } = React;

const STATE_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  reported: "bg-yellow-100 text-yellow-700",
  submit: "bg-yellow-100 text-yellow-700",
  submitted: "bg-yellow-100 text-yellow-700",
  approve: "bg-blue-100 text-blue-700",
  approved: "bg-blue-100 text-blue-700",
  post: "bg-indigo-100 text-indigo-700",
  posted: "bg-indigo-100 text-indigo-700",
  done: "bg-green-100 text-green-700",
  paid: "bg-green-100 text-green-700",
  refused: "bg-red-100 text-red-700",
  cancel: "bg-red-100 text-red-700",
};

const STATE_LABELS = {
  draft: "Draft",
  reported: "Reported",
  submit: "Submitted",
  submitted: "Submitted",
  approve: "Approved",
  approved: "Approved",
  post: "Posted",
  posted: "Posted",
  done: "Done",
  paid: "Paid",
  refused: "Refused",
  cancel: "Cancelled",
};

const PAYABLE_STATES = new Set(["approve", "approved", "post", "posted"]);

function formatAmount(amount, currency = "EUR") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || ""}`;
  }
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString();
}

export function OdooExpenseCard({
  expense,
  odooUrl,
  onPay,
  availableAccounts = [],
  wallet = null,
}) {
  const stateKey = (expense.state || "").toLowerCase();
  const stateColor = STATE_COLORS[stateKey] || "bg-gray-100 text-gray-700";
  const stateLabel = STATE_LABELS[stateKey] || expense.state;

  const expenseUrl = odooUrl
    ? `${odooUrl}/odoo/expenses-employee/${expense.id}`
    : null;
  const employeeId = Array.isArray(expense.employee_id)
    ? expense.employee_id[0]
    : null;
  const employeeUrl =
    odooUrl && employeeId
      ? `${odooUrl}/web#id=${employeeId}&model=hr.employee&view_type=form`
      : null;

  const hasBankAccount = Boolean(expense.bank_account_number);
  const isPayableState = PAYABLE_STATES.has(stateKey);

  const [expanded, setExpanded] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [paySuccess, setPaySuccess] = useState(() =>
    isExpensePaidLocal("odoo", expense.id) ? "Already paid" : null
  );
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [selectedAccountAddress, setSelectedAccountAddress] = useState("");
  const [memo, setMemo] = useState(() => {
    const base = expense.title || expense.description || `Odoo expense ${expense.id}`;
    return `CHB Expense ${expense.id} - ${base}`;
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  const attachment = expense.attachment;
  const proxyAttachmentUrl = attachment
    ? `/api/odoo/attachment?id=${attachment.id}`
    : null;
  const attachmentType = (() => {
    if (!attachment) return null;
    const mime = (attachment.mimetype || "").toLowerCase();
    const name = (attachment.name || "").toLowerCase();
    if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
    if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|svg)$/.test(name))
      return "image";
    return "other";
  })();

  useEffect(() => {
    if (availableAccounts.length === 0) return;
    const saved = getSelectedMoneriumAccount();
    if (
      saved &&
      availableAccounts.some(
        (acc) => acc.address.toLowerCase() === saved.toLowerCase()
      )
    ) {
      setSelectedAccountAddress(saved);
      return;
    }
    const storedConnection = localStorage.getItem(
      getStorageKey("monerium_connection")
    );
    let accountToSelect = availableAccounts[0].address;
    if (storedConnection) {
      try {
        const connection = JSON.parse(storedConnection);
        if (connection.accountAddress) accountToSelect = connection.accountAddress;
      } catch (_err) {
        // ignore
      }
    }
    setSelectedAccountAddress(accountToSelect);
  }, [availableAccounts]);

  const canPay =
    typeof onPay === "function" &&
    isPayableState &&
    hasBankAccount &&
    !paySuccess;

  const handleOpenPayModal = (e) => {
    if (e) e.stopPropagation();
    if (!canPay) return;
    setPayError(null);
    setNeedsPassphrase(false);
    setNeedsReconnect(false);
    setShowPayModal(true);
  };

  const handleClosePayModal = () => {
    if (paying) return;
    setShowPayModal(false);
    setPayError(null);
    setNeedsPassphrase(false);
    setPassphrase("");
  };

  const handleConfirmPay = async (e) => {
    if (e) e.stopPropagation();
    if (!canPay) return;

    setPaying(true);
    setPayError(null);
    setPaySuccess(null);
    setNeedsReconnect(false);

    try {
      if (selectedAccountAddress) {
        setSelectedMoneriumAccount(selectedAccountAddress);
        const storedConnection = localStorage.getItem(
          getStorageKey("monerium_connection")
        );
        if (storedConnection) {
          try {
            const connection = JSON.parse(storedConnection);
            connection.accountAddress = selectedAccountAddress;
            localStorage.setItem(
              getStorageKey("monerium_connection"),
              JSON.stringify(connection)
            );
          } catch (_err) {
            // ignore
          }
        }
      }

      const paymentData = {
        id: `odoo-expense-${expense.id}`,
        bank_account_number: expense.bank_account_number,
        amount_total: expense.total_amount || 0,
        partner_name: expense.employee_name || "Unknown",
      };
      const recipientInfo = {
        type: "employee",
        name: expense.employee_name || "Unknown",
      };

      const result = await onPay(
        paymentData,
        memo,
        selectedAccountAddress,
        recipientInfo
      );
      markExpensePaidLocal("odoo", expense.id);
      const baseSuccessMessage =
        result && result.id
          ? `Payment order ${result.id} created`
          : "Payment order created";

      // If this Odoo expense was imported from Open Collective, mark it paid
      // on OC too. Best-effort: a failure here doesn't undo the successful
      // Monerium payment, it just shows up in the success message.
      let successMessage = baseSuccessMessage;
      if (expense.ocLegacyId) {
        try {
          await markOCExpenseAsPaid(
            expense.ocLegacyId,
            Math.round((expense.total_amount || 0) * 100)
          );
          successMessage = `${baseSuccessMessage}, marked paid on Open Collective`;
        } catch (ocErr) {
          console.error("Failed to mark OC expense as paid:", ocErr);
          successMessage = `${baseSuccessMessage} (couldn't mark paid on Open Collective: ${
            ocErr instanceof Error ? ocErr.message : ocErr
          })`;
        }
      }

      setPaySuccess(successMessage);
      setShowPayModal(false);
    } catch (err) {
      console.error("Odoo expense payment failed:", err);
      if (err instanceof KeyLockedError) {
        setNeedsPassphrase(true);
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow transition-shadow">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-4 text-left gap-4"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-end gap-2 flex-wrap">
              <h3 className="font-semibold text-base text-gray-900 truncate max-w-xs md:max-w-md">
                {expense.title || "(no description)"}
              </h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${stateColor}`}>
                {stateLabel}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 uppercase">
                Odoo
              </span>
              {isPayableState && !hasBankAccount && (
                employeeUrl ? (
                  <a
                    href={employeeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded px-2 py-0.5 hover:bg-red-100"
                  >
                    bank account missing
                  </a>
                ) : (
                  <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded px-2 py-0.5">
                    bank account missing
                  </span>
                )
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              {expense.employee_name && (
                <span className="text-purple-700">{expense.employee_name}</span>
              )}
              {expense.date && <span>{formatDate(expense.date)}</span>}
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
            {paySuccess && (
              <div className="text-xs text-green-600 bg-green-50 border border-green-100 rounded px-3 py-2">
                {paySuccess}
              </div>
            )}
          </div>
          <span className="font-semibold text-lg text-gray-900 whitespace-nowrap">
            {formatAmount(expense.total_amount || 0, expense.currency)}
          </span>
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
                State
              </span>
              <span className="font-medium text-gray-900">{stateLabel}</span>
            </div>
            {expense.date && (
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Date
                </span>
                <span className="font-medium text-gray-900">
                  {formatDate(expense.date)}
                </span>
              </div>
            )}
            {expense.employee_name && (
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Employee
                </span>
                <span className="font-medium text-gray-900">
                  {expense.employee_name}
                </span>
              </div>
            )}
            {expense.payment_mode && (
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Payment Mode
                </span>
                <span className="font-medium text-gray-900">
                  {expense.payment_mode}
                </span>
              </div>
            )}
          </div>

          {expense.description && expense.description !== expense.title && (
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide">
                Description
              </span>
              <span className="font-medium text-gray-900 whitespace-pre-wrap">
                {expense.description}
              </span>
            </div>
          )}

          <div>
            <span className="block text-gray-500 text-xs uppercase tracking-wide">
              Bank Account
            </span>
            {hasBankAccount ? (
              <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                {expense.bank_account_number}
              </span>
            ) : (
              <span className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 inline-flex items-center gap-2">
                <span>bank account missing</span>
                {employeeUrl && (
                  <a
                    href={employeeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Add in Odoo →
                  </a>
                )}
              </span>
            )}
          </div>

          {attachment && proxyAttachmentUrl && (
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide mb-2">
                Receipt
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewOpen(true);
                }}
                className="group block text-left border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:border-blue-400 transition-colors"
                title={`Preview ${attachment.name || "receipt"}`}
              >
                <div className="relative w-full max-w-sm bg-white">
                  {attachmentType === "image" && (
                    <img
                      src={proxyAttachmentUrl}
                      alt={attachment.name || "Receipt"}
                      className="w-full max-h-64 object-contain bg-gray-50"
                      loading="lazy"
                    />
                  )}
                  {attachmentType === "pdf" && (
                    <iframe
                      src={`${proxyAttachmentUrl}#toolbar=0&navpanes=0&view=FitH`}
                      title={attachment.name || "Receipt PDF"}
                      className="w-full h-64 pointer-events-none bg-white"
                    />
                  )}
                  {attachmentType === "other" && (
                    <div className="px-4 py-6 text-center text-xs text-gray-500">
                      {attachment.name || "Receipt"}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 pointer-events-none">
                    <span className="inline-flex items-center gap-1 text-xs bg-white/90 text-blue-700 rounded px-2 py-1 shadow-sm">
                      <EyeIcon />
                      <span>Preview</span>
                    </span>
                  </div>
                </div>
                <div className="px-3 py-1.5 text-xs text-gray-600 truncate border-t border-gray-200">
                  {attachment.name || "Receipt"}
                </div>
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {attachment && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewOpen(true);
                }}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <EyeIcon />
                <span>Preview</span>
              </button>
            )}
            {expenseUrl && (
              <a
                href={expenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg transition-colors border border-blue-100"
              >
                <ExternalLinkIcon />
                <span>Open in Odoo</span>
              </a>
            )}
            {expense.ocUrl && (
              <a
                href={expense.ocUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center space-x-1 text-orange-700 hover:text-orange-800 px-3 py-2 rounded-lg transition-colors border border-orange-200 bg-orange-50"
              >
                <ExternalLinkIcon />
                <span>View on Open Collective</span>
              </a>
            )}
          </div>
        </div>
      )}

      {previewOpen && attachment && proxyAttachmentUrl && (
        <AttachmentSidebar
          attachment={{
            url: proxyAttachmentUrl,
            name: attachment.name || "Receipt",
            originalUrl: attachment.url,
          }}
          onClose={() => setPreviewOpen(false)}
          title={attachment.name || "Receipt"}
          subtitle={expense.title || expense.employee_name}
          footer={
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>
                Amount:{" "}
                <strong className="text-gray-900">
                  {formatAmount(expense.total_amount || 0, expense.currency)}
                </strong>
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${stateColor}`}>
                {stateLabel}
              </span>
            </div>
          }
        />
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
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Employee
                </span>
                <span className="font-medium text-gray-900">
                  {expense.employee_name || "—"}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Bank Account
                </span>
                <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                  {expense.bank_account_number}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Amount
                </span>
                <span className="font-semibold text-lg text-gray-900">
                  {formatAmount(expense.total_amount || 0, expense.currency)}
                </span>
              </div>

              {expense.ocUrl && (
                <div className="text-xs bg-orange-50 border border-orange-100 rounded px-3 py-2">
                  <span className="text-orange-900">
                    This expense was imported from Open Collective. It will be
                    marked as paid there after the Monerium order is placed.
                  </span>{" "}
                  <a
                    href={expense.ocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-700 hover:text-orange-900 underline font-medium"
                  >
                    View →
                  </a>
                </div>
              )}

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
                      const displayAddress = `${account.address.substring(
                        0,
                        6
                      )}...${account.address.substring(
                        account.address.length - 4
                      )}`;
                      return (
                        <option key={addressKey} value={account.address}>
                          {displayAddress} ({account.chain}) - EUR{" "}
                          {account.balance || "0.00"}
                        </option>
                      );
                    })}
                  </select>
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
                  {payError}
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
                      {unlocking ? "Unlocking..." : "Unlock & Pay"}
                    </button>
                  </div>
                </div>
              )}

              {needsReconnect && (
                <button
                  onClick={() => {
                    handleClosePayModal();
                    window.location.assign("/settings");
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
                disabled={paying || !hasBankAccount}
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
