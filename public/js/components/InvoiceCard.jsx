import { isInvoicePaid } from "../utils/storage.js";
import {
  IncomingIcon,
  OutgoingIcon,
  EyeIcon,
  ExternalLinkIcon,
} from "./icons.jsx";
import { PayModal } from "./PayModal.jsx";

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
  const firstLineItem =
    invoice.invoice_line_ids &&
    invoice.invoice_line_ids.length > 0 &&
    invoice.invoice_line_ids[0];

  const getDefaultMemo = () => {
    const parts = [];
    if (invoice.name) parts.push(invoice.name);
    if (invoice.ref) parts.push(invoice.ref);
    if (parts.length === 0 && firstLineItem?.name)
      parts.push(firstLineItem.name);
    return parts.join(" - ") || "";
  };

  const [expanded, setExpanded] = useState(false);
  const [paySuccess, setPaySuccess] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [isPaidLocally, setIsPaidLocally] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setPaySuccess(null);
    setIsPaidLocally(isInvoicePaid(invoice.id));
  }, [invoice.id, invoice.ref, invoice.name, firstLineItem?.name]);

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
    setShowPayModal(true);
  };

  const handlePaid = (result, { markedAsPaid }) => {
    if (markedAsPaid) {
      setPaySuccess("Invoice marked as paid");
    } else {
      const successMessage =
        result && result.id
          ? `Payment order ${result.id} created`
          : "Payment order created";
      setPaySuccess(successMessage);
    }
    setIsPaidLocally(true);
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
        <PayModal
          invoice={invoice}
          initialMemo={getDefaultMemo()}
          employees={employees}
          availableAccounts={availableAccounts}
          wallet={wallet}
          odooInvoiceUrl={odooInvoiceUrl}
          onPay={onPay}
          onClose={() => setShowPayModal(false)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
