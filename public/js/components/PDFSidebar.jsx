import { ExternalLinkIcon, DownloadIcon, XIcon, LoaderIcon } from "./icons.jsx";

export function PDFSidebar({ invoice, onClose, odooUrl, sessionId }) {
  if (!invoice) return null;

  // Build proxy URL with session_id
  const proxyUrl = React.useMemo(() => {
    if (!sessionId) return "";
    const params = new URLSearchParams({
      url: invoice.pdf_url,
      session_id: sessionId,
    });
    return `/api/pdf/view?${params.toString()}`;
  }, [invoice.pdf_url, sessionId]);

  const openInNewTab = () => {
    window.open(invoice.pdf_url, "_blank", "noopener,noreferrer");
  };

  const openInOdoo = () => {
    // Construct Odoo web interface URL for the invoice
    const odooInvoiceUrl = `${odooUrl}/web#id=${invoice.id}&model=account.move&view_type=form`;
    window.open(odooInvoiceUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      ></div>
      <div className="fixed right-0 top-0 h-full w-full md:w-3/4 lg:w-2/3 xl:w-1/2 bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{invoice.name}</h2>
            <p className="text-sm text-gray-500">
              {invoice.partner_name || "No partner"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {odooUrl && (
              <button
                type="button"
                onClick={openInOdoo}
                className="p-2 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors"
                title="Open in Odoo"
              >
                <ExternalLinkIcon />
              </button>
            )}
            <button
              type="button"
              onClick={openInNewTab}
              className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLinkIcon />
            </button>
            <a
              type="button"
              href={invoice.pdf_url}
              download
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Download PDF"
            >
              <DownloadIcon />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-100">
          {sessionId && proxyUrl ? (
            <iframe
              src={proxyUrl}
              className="w-full h-full border-0"
              title={`PDF: ${invoice.name}`}
              onError={() => {
                console.error("Failed to load PDF");
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <LoaderIcon />
                <p className="text-gray-500 mt-4">Loading PDF...</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 space-y-2">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>
              Amount:{" "}
              <strong className="text-gray-900">
                €{invoice.amount_total.toFixed(2)}
              </strong>
            </span>
            {invoice.payment_state === "paid" && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                Paid
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            If the PDF doesn't load, try opening in a new tab or downloading it.
          </p>
        </div>
      </div>
    </>
  );
}
