import { getStorageKey, ENV } from "../config.js";
import {
  loadMoneriumConnectionState,
  getSelectedMoneriumAccount,
  setSelectedMoneriumAccount,
  getOpenCollectiveApiKey,
  markExpensePaidLocal,
  isExpensePaidLocal,
} from "../utils/storage.js";
import {
  getExpenseIBAN,
  canPayExpense,
  formatExpenseAmount,
  getStatusColor,
  markExpenseAsPaid,
  getExpenseAccountHolder,
  getExpensePayoutAddress,
  getExpenseBIC,
  getExpensePayoutEmail,
} from "../services/opencollective.js";
import { XIcon, ExternalLinkIcon, EyeIcon } from "./icons.jsx";
import { AttachmentSidebar } from "./AttachmentSidebar.jsx";

const { useState, useEffect } = React;

export function ExpenseCard({
  expense,
  onPay,
  availableAccounts = [],
  wallet = null,
  onStatusUpdate,
  collectiveBalance = 0,
  collectiveSlug = "",
  collectiveName = null,
  parentCollective = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [paySuccess, setPaySuccess] = useState(() =>
    isExpensePaidLocal("oc", expense.id) ? "Already paid" : null
  );
  const [selectedAccountAddress, setSelectedAccountAddress] = useState("");
  const memoBase = `${collectiveSlug} expense ${expense.legacyId || expense.id}`;
  const [memo, setMemo] = useState(memoBase);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [forcePayment, setForcePayment] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Odoo integration state
  const [odooLookup, setOdooLookup] = useState(null); // { employee, expense, odooUrl }
  const [odooLoading, setOdooLoading] = useState(false);
  const [odooAction, setOdooAction] = useState(null); // "creating-employee" | "creating-expense"
  const [odooError, setOdooError] = useState(null);

  const iban = getExpenseIBAN(expense);
  const expenseAmount = expense.amount || 0; // in cents
  const hasEnoughBalance = collectiveBalance >= expenseAmount;
  const canPay = canPayExpense(expense) && Boolean(iban) && hasEnoughBalance;
  const isPaid = expense.status === "PAID" || Boolean(paySuccess);

  // Build proxy URL for Open Collective files
  const buildProxyUrl = (originalUrl) => {
    const params = new URLSearchParams({ url: originalUrl });
    return `/api/opencollective/file?${params.toString()}`;
  };

  // Combine attachments from attachedFiles and items (which contain receipt URLs)
  const allAttachments = React.useMemo(() => {
    const attachments = [];

    // Add attached files
    if (expense.attachedFiles && Array.isArray(expense.attachedFiles)) {
      expense.attachedFiles.forEach((file) => {
        if (file.url) {
          attachments.push({
            url: buildProxyUrl(file.url),
            originalUrl: file.url,
            name: file.name || "Attachment",
            source: "file",
          });
        }
      });
    }

    // Add items with URLs (receipts/invoices)
    if (expense.items && Array.isArray(expense.items)) {
      expense.items.forEach((item, idx) => {
        if (item.url) {
          attachments.push({
            url: buildProxyUrl(item.url),
            originalUrl: item.url,
            name: item.description || `Receipt ${idx + 1}`,
            source: "item",
          });
        }
      });
    }

    return attachments;
  }, [expense.attachedFiles, expense.items]);

  // Odoo lookup when expanded
  useEffect(() => {
    if (!expanded || odooLookup) return;
    const lookup = async () => {
      setOdooLoading(true);
      setOdooError(null);
      try {
        const accountHolder = getExpenseAccountHolder(expense);
        const lookupName = accountHolder?.name || expense.payee?.name || "";
        const params = new URLSearchParams({
          payeeName: lookupName,
          ocExpenseId: String(expense.legacyId || expense.id),
        });
        const res = await fetch(`/api/odoo/expense-sync?${params}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Odoo lookup failed");
        }
        setOdooLookup(await res.json());
      } catch (err) {
        setOdooError(err.message);
      } finally {
        setOdooLoading(false);
      }
    };
    lookup();
  }, [expanded]);

  // Prepend "CHB Expense <odoo-id>" to memo once the Odoo lookup resolves a linked expense,
  // unless the user has already edited the memo away from its default.
  useEffect(() => {
    const odooExpenseId = odooLookup?.expense?.id;
    if (!odooExpenseId) return;
    const withPrefix = `CHB Expense ${odooExpenseId} - ${memoBase}`;
    setMemo((prev) => (prev === memoBase ? withPrefix : prev));
  }, [odooLookup?.expense?.id, memoBase]);

  const handleCreateEmployee = async () => {
    setOdooAction("creating-employee");
    setOdooError(null);
    try {
      const accountHolder = getExpenseAccountHolder(expense);
      const address = getExpensePayoutAddress(expense);
      const employeeName = accountHolder?.name || expense.payee?.name;
      const department = collectiveName
        ? (parentCollective ? `${parentCollective.name} › ${collectiveName}` : collectiveName)
        : undefined;

      const res = await fetch("/api/odoo/expense-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-employee",
          name: employeeName,
          iban: iban || undefined,
          accountHolderName: employeeName,
          department,
          email: expense.payee?.email || undefined,
          address: address || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create employee");
      setOdooLookup((prev) => ({ ...prev, employee: data.employee }));
    } catch (err) {
      setOdooError(err.message);
    } finally {
      setOdooAction(null);
    }
  };

  const handleSyncEmployee = async () => {
    if (!odooLookup?.employee?.id) return;
    setOdooAction("syncing-employee");
    setOdooError(null);
    try {
      const accountHolder = getExpenseAccountHolder(expense);
      const address = getExpensePayoutAddress(expense);
      const bic = getExpenseBIC(expense);
      const email = getExpensePayoutEmail(expense);
      const department = collectiveName
        ? (parentCollective ? `${parentCollective.name} › ${collectiveName}` : collectiveName)
        : undefined;
      const firstAdmin = expense.account?.members?.nodes?.[0]?.account;

      const res = await fetch("/api/odoo/expense-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-employee",
          employeeId: odooLookup.employee.id,
          email: email || undefined,
          iban: iban || undefined,
          bic: bic || undefined,
          accountHolderName: accountHolder?.name || expense.payee?.name,
          address: address || undefined,
          department,
          managerName: firstAdmin?.name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync employee");
      setOdooLookup((prev) => ({ ...prev, employee: data.employee }));
    } catch (err) {
      setOdooError(err.message);
    } finally {
      setOdooAction(null);
    }
  };

  const handleCreateExpense = async () => {
    if (!odooLookup?.employee?.id) return;
    setOdooAction("creating-expense");
    setOdooError(null);
    try {
      // Build items with per-item attachments (receipt URLs)
      const items = (expense.items && expense.items.length > 0)
        ? expense.items.map((item) => ({
            description: item.description || expense.description,
            amount: item.amount || expense.amount,
            date: expense.createdAt?.split("T")[0],
            attachments: item.url ? [{ url: item.url, name: item.description || "Receipt" }] : [],
          }))
        : [{ description: expense.description, amount: expense.amount, date: expense.createdAt?.split("T")[0], attachments: [] }];

      // Expense-level attached files (not tied to a specific item)
      const attachments = (expense.attachedFiles || [])
        .filter((f) => f.url)
        .map((f) => ({ url: f.url, name: f.name || "Attachment" }));

      const res = await fetch("/api/odoo/expense-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-expense",
          employeeId: odooLookup.employee.id,
          description: expense.description,
          ocExpenseId: expense.legacyId || expense.id,
          ocExpenseUrl: collectiveSlug && expense.legacyId
            ? `https://opencollective.com/${collectiveSlug}/expenses/${expense.legacyId}`
            : undefined,
          items,
          attachments,
          currency: expense.currency,
          ocApiKey: getOpenCollectiveApiKey(),
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error || "Failed to create expense");
      // 409 means already exists — still update the lookup
      const expenseResult = data.expense || { id: data.expenseIds?.[0] };
      setOdooLookup((prev) => ({
        ...prev,
        expense: expenseResult,
        sheetId: data.sheetId,
      }));
    } catch (err) {
      setOdooError(err.message);
    } finally {
      setOdooAction(null);
    }
  };

  const odooUrl = odooLookup?.odooUrl || "";
  const odooEmployeeUrl = odooLookup?.employee ? `${odooUrl}/web#id=${odooLookup.employee.id}&model=hr.employee&view_type=form` : null;
  const odooExpenseUrl = odooLookup?.expense
    ? `${odooUrl}/web#id=${odooLookup.expense.id}&model=hr.expense&view_type=form`
    : null;

  // Set initial selected account
  useEffect(() => {
    if (availableAccounts.length === 0) return;

    const savedAccount = getSelectedMoneriumAccount();
    if (
      savedAccount &&
      availableAccounts.some(
        (acc) => acc.address.toLowerCase() === savedAccount.toLowerCase()
      )
    ) {
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
        accountToSelect =
          connection.accountAddress || availableAccounts[0].address;
      } catch (err) {
        accountToSelect = availableAccounts[0].address;
      }
    } else {
      accountToSelect = availableAccounts[0].address;
    }

    if (accountToSelect) {
      setSelectedAccountAddress(accountToSelect);
    }
  }, [availableAccounts]);

  const handleOpenPayModal = (e) => {
    if (e) e.stopPropagation();
    if (!canPay || !onPay) return;
    setPayError(null);
    setShowPayModal(true);
  };

  const handleClosePayModal = () => {
    if (paying) return;
    setShowPayModal(false);
    setPayError(null);
    setForcePayment(false);
  };

  const handleConfirmPay = async (e) => {
    if (e) e.stopPropagation();
    if (!canPay || !onPay) return;

    setPaying(true);
    setPayError(null);
    setPaySuccess(null);

    try {
      // Persist selection
      if (selectedAccountAddress) {
        setSelectedMoneriumAccount(selectedAccountAddress);
      }

      // Update connection with selected account
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

      // Create invoice-like object for the payment handler
      const paymentData = {
        id: expense.id,
        bank_account_number: iban,
        amount_total: expense.amount / 100, // Convert cents to main unit
        partner_name: expense.payee?.name || "Unknown",
      };

      // Use the account holder name from the payout method; fall back to payee name
      const accountHolder = getExpenseAccountHolder(expense);
      const recipientInfo = accountHolder
        ? { type: accountHolder.type, name: accountHolder.name }
        : { type: "individual", name: expense.payee?.name || "Unknown" };

      const result = await onPay(
        paymentData,
        memo,
        selectedAccountAddress,
        recipientInfo,
        forcePayment
      );

      console.log("Payment created:", result);

      // Record locally first so a reload/second-tab can't re-pay this expense.
      markExpensePaidLocal("oc", expense.id);

      // Mark as paid on Open Collective
      setMarkingPaid(true);
      try {
        await markExpenseAsPaid(expense.id, expense.amount);
        setPaySuccess("Payment sent and expense marked as paid");
        if (onStatusUpdate) {
          onStatusUpdate(expense.id, "PAID");
        }
      } catch (markErr) {
        console.error("Failed to mark as paid on OC:", markErr);
        setPaySuccess(
          "Payment sent, but failed to mark as paid on Open Collective"
        );
      }

      setShowPayModal(false);
    } catch (err) {
      console.error("Payment failed:", err);
      if (err.message === "This invoice has already been paid.") {
        setForcePayment(true);
      }
      setPayError(err.message || "Failed to initiate payment");
    } finally {
      setPaying(false);
      setMarkingPaid(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const ocExpenseUrl = `https://opencollective.com/${collectiveSlug}/expenses/${expense.legacyId}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow transition-shadow">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-4 text-left gap-4"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-end gap-2 flex-wrap">
              <h3 className="font-semibold text-base text-gray-900 truncate max-w-xs md:max-w-sm">
                {expense.payee?.name || "Unknown Payee"}
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                  expense.status
                )}`}
              >
                {expense.status}
              </span>
              {expense.payoutMethod?.type && expense.payoutMethod.type !== "BANK_ACCOUNT" && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {expense.payoutMethod.type.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              {collectiveName && (
                <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-xs font-medium">
                  {parentCollective ? `${parentCollective.name} › ` : ""}{collectiveName}
                  {collectiveBalance > 0 && (
                    <span className="text-purple-500 font-normal">
                      ({new Intl.NumberFormat("en-US", { style: "currency", currency: expense.currency || "EUR" }).format(collectiveBalance / 100)})
                    </span>
                  )}
                </span>
              )}
              <span>{formatDate(expense.createdAt)}</span>
              <span className="truncate max-w-[300px]">
                {expense.description}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            {canPay && !isPaid && onPay && (
              <button
                onClick={handleOpenPayModal}
                className="inline-flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <span>Pay</span>
              </button>
            )}
            {expense.status === "APPROVED" && !isPaid && !canPay && hasEnoughBalance && !iban && (
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded px-3 py-2">
                No IBAN
              </div>
            )}
            {expense.status === "APPROVED" && !hasEnoughBalance && !isPaid && iban && (
              <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded px-3 py-2">
                Insufficient balance
              </div>
            )}
            {paySuccess && (
              <div className="text-xs text-green-600 bg-green-50 border border-green-100 rounded px-3 py-2">
                {paySuccess}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="font-semibold text-lg text-gray-900">
              {formatExpenseAmount(expense)}
            </span>
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
                Expense Type
              </span>
              <span className="font-medium text-gray-900">
                {expense.type || "N/A"}
              </span>
            </div>
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide">
                Created
              </span>
              <span className="font-medium text-gray-900">
                {formatDate(expense.createdAt)}
              </span>
            </div>
            {expense.createdByAccount && (
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Submitted By
                </span>
                <span className="font-medium text-gray-900">
                  {expense.createdByAccount.name}
                </span>
              </div>
            )}
          </div>

          <div>
            <span className="block text-gray-500 text-xs uppercase tracking-wide">
              Description
            </span>
            <span className="font-medium text-gray-900">
              {expense.description || "N/A"}
            </span>
          </div>

          {expense.payoutMethod && (
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide">
                Payout Method
              </span>
              <span className="font-medium text-gray-900">
                {expense.payoutMethod.type?.replace(/_/g, " ")}
              </span>
              {iban && (
                <span className="ml-2 font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {iban}
                </span>
              )}
            </div>
          )}

          {allAttachments.length > 0 && (
            <div>
              <span className="block text-gray-500 text-xs uppercase tracking-wide mb-2">
                Attachments ({allAttachments.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {allAttachments.map((file, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1 bg-blue-50 rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewAttachment(file);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100"
                      title="Preview"
                    >
                      <EyeIcon />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                    </button>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-1.5 py-1 text-blue-600 hover:bg-blue-100"
                      title="Open in new tab"
                    >
                      <ExternalLinkIcon />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Odoo Integration */}
          <div className="border-t border-gray-100 pt-4">
            <span className="block text-gray-500 text-xs uppercase tracking-wide mb-2">
              Odoo
            </span>
            {odooLoading && (
              <span className="text-xs text-gray-400">Looking up in Odoo...</span>
            )}
            {odooError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 mb-2">
                {odooError}
              </div>
            )}
            {odooLookup && (
              <div className="flex flex-wrap gap-4">
                {/* Employee status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Employee:</span>
                  {odooLookup.employee ? (
                    <div className="inline-flex items-center gap-1">
                      <a
                        href={odooEmployeeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100"
                      >
                        <span>{odooLookup.employee.name}</span>
                        <ExternalLinkIcon />
                      </a>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSyncEmployee(); }}
                        disabled={!!odooAction}
                        className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 disabled:opacity-50"
                        title="Sync employee details (email, address, bank account, department, manager) from this expense"
                      >
                        {odooAction === "syncing-employee" ? "Syncing..." : "Sync"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCreateEmployee(); }}
                      disabled={!!odooAction}
                      className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100 disabled:opacity-50"
                    >
                      {odooAction === "creating-employee" ? "Creating..." : `Create "${getExpenseAccountHolder(expense)?.name || expense.payee?.name}"`}
                    </button>
                  )}
                </div>
                {/* Expense status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Expense:</span>
                  {odooLookup.expense ? (
                    <a
                      href={odooExpenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100"
                    >
                      <span>View in Odoo</span>
                      <ExternalLinkIcon />
                    </a>
                  ) : odooLookup.employee ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCreateExpense(); }}
                      disabled={!!odooAction}
                      className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100 disabled:opacity-50"
                    >
                      {odooAction === "creating-expense" ? "Creating..." : "Create in Odoo"}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Create employee first</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            {allAttachments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewAttachment(allAttachments[0]);
                }}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <EyeIcon />
                <span>Preview{allAttachments.length > 1 ? ` (${allAttachments.length})` : ""}</span>
              </button>
            )}
            <a
              href={ocExpenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg transition-colors border border-blue-100"
            >
              <ExternalLinkIcon />
              <span>View on Open Collective</span>
            </a>
          </div>
        </div>
      )}

      {/* Pay Modal */}
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
                  Payee
                </span>
                <span className="font-medium text-gray-900">
                  {getExpenseAccountHolder(expense)?.name || expense.payee?.name || "Unknown"}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Bank Account (IBAN)
                </span>
                <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                  {iban}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase tracking-wide">
                  Amount
                </span>
                <span className="font-semibold text-lg text-gray-900">
                  {formatExpenseAmount(expense)}
                </span>
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
                <div className={`text-xs rounded px-3 py-2 ${forcePayment ? "text-yellow-700 bg-yellow-50 border border-yellow-200" : "text-red-600 bg-red-50 border border-red-100"}`}>
                  {payError}
                </div>
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
                disabled={paying || !iban}
                className={`inline-flex items-center justify-center space-x-2 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors ${forcePayment ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
              >
                <span>
                  {paying
                    ? markingPaid
                      ? "Marking paid..."
                      : "Processing..."
                    : forcePayment
                      ? "Pay Anyway"
                      : "Pay"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview */}
      {previewAttachment && (
        <AttachmentSidebar
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          title={previewAttachment.name || "Attachment"}
          subtitle={expense.description}
          headers={{ "x-oc-api-key": getOpenCollectiveApiKey() }}
          footer={
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>
                Amount: <strong className="text-gray-900">{formatExpenseAmount(expense)}</strong>
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(expense.status)}`}>
                {expense.status}
              </span>
            </div>
          }
        />
      )}
    </div>
  );
}
