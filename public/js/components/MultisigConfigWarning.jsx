import { getStorageKey } from "../config.js";

const { useState, useEffect } = React;

// Always-on health check: if the active Monerium account is a multisig (M-of-N)
// Safe but the server has no SAFE_API_KEY (nor a custom SAFE_TX_SERVICE_URL),
// the batch can't collect the extra signatures via the Safe Transaction Service.
// Surfaced on the homepage and /bills so it's visible after setup is complete,
// not only during onboarding.
export function MultisigConfigWarning() {
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const stored = localStorage.getItem(
          getStorageKey("monerium_connection")
        );
        if (!stored) return;
        const conn = JSON.parse(stored);
        if (!conn?.accessToken || !conn?.accountAddress) return;

        // Fetch accounts (each carries on-chain threshold + signatories).
        const res = await fetch("/api/monerium/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: conn.accessToken,
            environment: conn.environment || "sandbox",
          }),
        });
        if (!res.ok) return;
        const accounts = await res.json();
        const account = (Array.isArray(accounts) ? accounts : []).find(
          (a) =>
            a.address?.toLowerCase() === conn.accountAddress.toLowerCase()
        );
        const multisig =
          account?.signatories?.length &&
          typeof account.threshold === "number" &&
          account.threshold > 1;
        if (!multisig) return;

        const cfg = await (await fetch("/api/monerium/config")).json();
        if (cfg.safeApiKeyConfigured || cfg.safeTxServiceUrlConfigured) return;

        if (!cancelled) {
          setWarning({
            threshold: account.threshold,
            owners: account.signatories.length,
          });
        }
      } catch {
        // Network/parse failure — don't show a misleading warning.
      }
    };

    check();
    window.addEventListener("monerium-connection-updated", check);
    return () => {
      cancelled = true;
      window.removeEventListener("monerium-connection-updated", check);
    };
  }, []);

  if (!warning) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
      <p className="font-medium mb-1">
        Multisig Safe ({warning.threshold}-of-{warning.owners}) needs{" "}
        <code className="bg-red-100 px-1 py-0.5 rounded">SAFE_API_KEY</code>
      </p>
      <p>
        This account requires {warning.threshold} signatures. Collecting them
        needs the Safe Transaction Service, so set{" "}
        <code>SAFE_API_KEY</code> (from the Safe developer portal) — or a
        self-hosted <code>SAFE_TX_SERVICE_URL</code> — in the server environment.
        Until then, multisig payments can't be submitted.
      </p>
    </div>
  );
}
