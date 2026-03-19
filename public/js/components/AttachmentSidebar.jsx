import { ExternalLinkIcon, DownloadIcon, XIcon, LoaderIcon } from "./icons.jsx";

const { useState, useEffect } = React;

/**
 * Generic sidebar for previewing attachments (PDFs, images)
 * Supports authenticated requests via headers prop
 * @param {Object} props
 * @param {Object} props.attachment - { url, name, originalUrl? }
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Optional title override
 * @param {string} props.subtitle - Optional subtitle
 * @param {React.ReactNode} props.footer - Optional footer content
 * @param {Object} props.headers - Optional headers for authenticated requests
 */
export function AttachmentSidebar({ attachment, onClose, title, subtitle, footer, headers }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [contentType, setContentType] = useState(null);

  if (!attachment) return null;

  const { url, name, originalUrl } = attachment;

  // Fetch the file with authentication headers
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchFile = async () => {
      setLoading(true);
      setError(null);
      setBlobUrl(null);

      try {
        const response = await fetch(url, {
          headers: headers || {},
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load: ${response.status}`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setContentType(blob.type || response.headers.get("Content-Type"));
        setLoading(false);
      } catch (err) {
        if (cancelled || err.name === "AbortError") return;
        console.error("Failed to load attachment:", err);
        setError(err.message || "Failed to load file");
        setLoading(false);
      }
    };

    fetchFile();

    return () => {
      cancelled = true;
      controller.abort();
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url, headers]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Determine file type from content type or name
  const getFileType = () => {
    if (contentType) {
      if (contentType.includes("pdf")) return "pdf";
      if (contentType.startsWith("image/")) return "image";
    }

    const nameLower = (name || "").toLowerCase();
    if (nameLower.includes(".pdf")) return "pdf";
    if (nameLower.match(/\.(jpg|jpeg|png|gif|webp|svg)/)) return "image";

    // Default to image
    return "image";
  };

  const fileType = getFileType();

  const openInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    } else if (originalUrl) {
      window.open(originalUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name || "attachment";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      ></div>
      <div className="fixed right-0 top-0 h-full w-full md:w-3/4 lg:w-2/3 xl:w-1/2 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {title || name || "Attachment"}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              type="button"
              onClick={openInNewTab}
              disabled={loading}
              className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors disabled:opacity-50"
              title="Open in new tab"
            >
              <ExternalLinkIcon />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !blobUrl}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              title="Download"
            >
              <DownloadIcon />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <LoaderIcon />
                <p className="text-gray-500 mt-4">Loading...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center p-8">
              <p className="text-red-500 mb-2">Could not load preview</p>
              <p className="text-gray-500 mb-4 text-sm">{error}</p>
              {originalUrl && (
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-block"
                >
                  Try Opening Directly
                </a>
              )}
            </div>
          )}

          {!loading && !error && blobUrl && fileType === "pdf" && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={name || "PDF Preview"}
            />
          )}

          {!loading && !error && blobUrl && fileType === "image" && (
            <img
              src={blobUrl}
              alt={name || "Attachment"}
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
