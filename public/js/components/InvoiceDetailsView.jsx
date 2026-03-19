const { useState, useEffect } = React;

export function InvoiceDetailsView({
  invoiceId,
  connectionSettings,
  sessionId,
  navigate,
}) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      Object.entries(connectionSettings).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      try {
        const response = await fetch(
          `/api/odoo/invoices/${invoiceId}?${params.toString()}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch invoice details");
        }

        setInvoice(data.invoice);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoiceId, connectionSettings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoaderIcon />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate("/")}
            className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
          >
            ← Back to Invoices
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const isIncoming =
    invoice.move_type === "in_invoice" || invoice.move_type === "in_refund";
  const statusColor = {
    draft: "bg-gray-100 text-gray-800",
    posted: "bg-green-100 text-green-800",
    cancel: "bg-red-100 text-red-800",
  }[invoice.state];

  const paymentStateColor =
    invoice.payment_state === "paid" ? "bg-green-100 text-green-800" : null;
  const odooInvoiceUrl =
    connectionSettings.url &&
    `${connectionSettings.url}/web#id=${invoice.id}&model=account.move&view_type=form`;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
        >
          ← Back to Invoices
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-end gap-3 mb-0">
                <h1 className="text-3xl font-bold text-gray-900">
                  {invoice.partner_name}
                </h1>
                {!invoice.bank_account_number && odooInvoiceUrl && (
                  <a
                    href={odooInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline mb-0.5"
                  >
                    bank account details missing
                  </a>
                )}
              </div>
              <p className="text-gray-600">
                {isIncoming ? "📥 Incoming" : "📤 Outgoing"} Invoice
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}
              >
                {invoice.state}
              </span>
              {paymentStateColor && (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${paymentStateColor}`}
                >
                  Paid
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-1">
                Partner
              </h3>
              <p className="text-lg text-gray-900">
                {invoice.partner_name || "N/A"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-1">Date</h3>
              <p className="text-lg text-gray-900">
                {invoice.invoice_date || invoice.date}
              </p>
            </div>
            {invoice.invoice_date_due && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">
                  Due Date
                </h3>
                <p className="text-lg text-gray-900">
                  {invoice.invoice_date_due}
                </p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-1">
                Total Amount
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                €{invoice.amount_total.toFixed(2)}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-1">
                Amount Due
              </h3>
              <p className="text-xl font-semibold text-gray-900">
                €{invoice.amount_residual.toFixed(2)}
              </p>
            </div>
            {invoice.ref && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">
                  Reference
                </h3>
                <p className="text-lg text-gray-900">{invoice.ref}</p>
              </div>
            )}
          </div>

          {invoice.bank_account_number && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Bank Account
              </h3>
              <p className="text-lg font-mono text-blue-900">
                {invoice.bank_account_number}
              </p>
            </div>
          )}

          {invoice.narration && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Notes
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {invoice.narration}
              </p>
            </div>
          )}
        </div>

        {invoice.invoice_line_ids && invoice.invoice_line_ids.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📦 Line Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Description
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Quantity
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Unit Price
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Subtotal
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.invoice_line_ids.map((line) => (
                    <tr key={line.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-900">{line.name}</td>
                      <td className="text-right py-3 px-4 text-gray-900">
                        {line.quantity}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900">
                        €{line.price_unit.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900">
                        €{line.price_subtotal.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-gray-900">
                        €{line.price_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan="3" className="py-3 px-4"></td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-700">
                      Subtotal:
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900">
                      €{invoice.amount_untaxed.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="3" className="py-3 px-4"></td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-700">
                      Tax:
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900">
                      €{invoice.amount_tax.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td colSpan="3" className="py-3 px-4"></td>
                    <td className="text-right py-3 px-4 text-lg font-bold text-gray-900">
                      Total:
                    </td>
                    <td className="text-right py-3 px-4 text-lg font-bold text-gray-900">
                      €{invoice.amount_total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {invoice.attachments && invoice.attachments.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📎 Attachments ({invoice.attachments.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invoice.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileIcon />
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {attachment.mimetype}
                    </p>
                    {attachment.file_size && (
                      <p className="text-xs text-gray-500">
                        {(attachment.file_size / 1024).toFixed(2)} KB
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {invoice.activities && invoice.activities.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📅 Activities ({invoice.activities.length})
            </h2>
            <div className="space-y-4">
              {invoice.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="border-l-4 border-blue-500 pl-4 py-2"
                >
                  <h3 className="font-semibold text-gray-900">
                    {activity.summary || "Activity"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Due: {activity.date_deadline} • State: {activity.state}
                  </p>
                  {activity.note && (
                    <p className="text-sm text-gray-700 mt-1">
                      {activity.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {invoice.messages && invoice.messages.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              💬 Messages ({invoice.messages.length})
            </h2>
            <div className="space-y-4">
              {invoice.messages.map((message) => (
                <div
                  key={message.id}
                  className="border-b border-gray-200 pb-4 last:border-0"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-gray-900">
                      {Array.isArray(message.author_id)
                        ? message.author_id[1]
                        : "System"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(message.date).toLocaleString()}
                    </p>
                  </div>
                  <div
                    className="text-gray-700 text-sm"
                    dangerouslySetInnerHTML={{ __html: message.body }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Monthly Invoices View Component
