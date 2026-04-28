import { getStorageKey } from "../config.js";
import { useWallet } from "../hooks/useWallet.js";
import { handlePay, KeyLockedError, unlockServer } from "../services/monerium.js";
import { ExternalLinkIcon } from "./icons.jsx";

const { useCallback, useEffect, useMemo, useState } = React;

function loadConnectionSettings() {
  try {
    const stored = localStorage.getItem(getStorageKey("odoo_connection"));
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error("Failed to load connection settings:", err);
  }
  return { url: "", db: "", username: "", password: "" };
}

function formatAccount(account) {
  if (!account) return "";
  return account.replace(/(.{4})/g, "$1 ").trim();
}

function ContactPayButton({ contact }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState(() => `Payment to ${contact.name}`);
  const [selectedBankId, setSelectedBankId] = useState(
    contact.bank_accounts?.[0]?.id || null
  );
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const selectedBank =
    contact.bank_accounts?.find((bank) => bank.id === selectedBankId) ||
    contact.bank_accounts?.[0];

  const canPay = Boolean(selectedBank?.acc_number);

  const close = () => {
    if (paying || unlocking) return;
    setOpen(false);
    setError(null);
    setNeedsPassphrase(false);
    setPassphrase("");
  };

  const submitPayment = async () => {
    const parsedAmount = Number(amount);
    if (!canPay) {
      setError("This contact does not have a bank account.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setPaying(true);
    setError(null);
    setNeedsPassphrase(false);

    try {
      const paymentTarget = {
        id: `contact-${contact.id}-${Date.now()}`,
        partner_name: contact.name,
        bank_account_number: selectedBank.acc_number,
        amount_total: parsedAmount,
        amount_residual: parsedAmount,
      };
      const result = await handlePay(
        paymentTarget,
        memo,
        null,
        wallet.walletAddress ? wallet.signMessage : null,
        {
          type: contact.is_company ? "company" : "individual",
          name: selectedBank.acc_holder_name || contact.name,
        },
        true
      );

      setSuccess(result.message || `Payment order created for ${contact.name}.`);
      setOpen(false);
    } catch (err) {
      if (err instanceof KeyLockedError) {
        setNeedsPassphrase(true);
        setError(null);
      } else {
        setError(err.message || "Failed to initiate payment.");
      }
    } finally {
      setPaying(false);
    }
  };

  const unlockAndRetry = async () => {
    if (!passphrase) return;
    setUnlocking(true);
    setError(null);
    try {
      await unlockServer(passphrase);
      setNeedsPassphrase(false);
      setPassphrase("");
      await submitPayment();
    } catch (err) {
      setError(err.message || "Failed to unlock signing key.");
    } finally {
      setUnlocking(false);
    }
  };

  if (!canPay) {
    return (
      <span className="text-xs text-gray-400">
        No bank account
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {success && (
          <span className="text-xs text-green-700 bg-green-50 border border-green-100 rounded px-2 py-1">
            {success}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          Pay
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Pay {contact.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {formatAccount(selectedBank?.acc_number)}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-gray-400 hover:text-gray-600"
                disabled={paying || unlocking}
              >
                X
              </button>
            </div>

            <div className="space-y-4">
              {contact.bank_accounts.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Bank account
                  </label>
                  <select
                    value={selectedBankId || ""}
                    onChange={(e) => setSelectedBankId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {contact.bank_accounts.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {formatAccount(bank.acc_number)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500 text-sm">
                    EUR
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Memo / Reference
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                  {error}
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
                        if (e.key === "Enter" && passphrase && !unlocking) {
                          unlockAndRetry();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={unlockAndRetry}
                      disabled={!passphrase || unlocking}
                      className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                    >
                      {unlocking ? "Unlocking..." : "Unlock"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={paying || unlocking}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPayment}
                disabled={paying || unlocking}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white transition-colors"
              >
                {paying ? "Processing..." : "Pay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ContactRow({ contact, odooUrl }) {
  const primaryPhone = contact.phone;
  const contactUrl = odooUrl
    ? `${odooUrl.replace(/\/$/, "")}/web#id=${contact.id}&model=res.partner&view_type=form`
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 break-words">
              {contact.display_name || contact.name}
            </h2>
            {contactUrl && (
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open contact in Odoo"
                className="inline-flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
              >
                <ExternalLinkIcon />
              </a>
            )}
            {contact.is_company && (
              <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
                Company
              </span>
            )}
            {contact.supplier_rank > 0 && (
              <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-0.5">
                Supplier
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {contact.email && <span>{contact.email}</span>}
            {primaryPhone && <span>{primaryPhone}</span>}
          </div>
        </div>

        <ContactPayButton contact={contact} />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Bank account
        </div>
        {contact.bank_accounts.length > 0 ? (
          <div className="space-y-1">
            {contact.bank_accounts.map((bank) => (
              <div
                key={bank.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm"
              >
                <span className="font-mono text-gray-900 break-all">
                  {formatAccount(bank.acc_number)}
                </span>
                {(bank.acc_holder_name || bank.bank_bic) && (
                  <span className="text-gray-500">
                    {[bank.acc_holder_name, bank.bank_bic].filter(Boolean).join(" - ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">Not set</div>
        )}
      </div>
    </div>
  );
}

export function ContactsPage({ navigate }) {
  const [connectionSettings] = useState(loadConnectionSettings);
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("bank_account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isConfigured = Boolean(
    connectionSettings.url &&
      connectionSettings.db &&
      connectionSettings.username &&
      connectionSettings.password
  );

  const fetchContacts = useCallback(async () => {
    if (!isConfigured) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(connectionSettings).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/odoo/contacts?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch contacts.");
      }
      setContacts(
        (data.contacts || []).map((contact) => ({
          ...contact,
          bank_accounts: Array.isArray(contact.bank_accounts)
            ? contact.bank_accounts
            : [],
        }))
      );
    } catch (err) {
      console.error("Error fetching contacts:", err);
      setError(err.message || "Failed to fetch contacts.");
    } finally {
      setLoading(false);
    }
  }, [connectionSettings, isConfigured]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (filter === "bank_account" && !contact.bank_accounts?.length) {
        return false;
      }
      if (!term) return true;
      const haystack = [
        contact.name,
        contact.display_name,
        contact.email,
        contact.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [contacts, filter, query]);

  const contactsWithBank = contacts.filter(
    (contact) => contact.bank_accounts?.length > 0
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="text-blue-600 hover:text-blue-700 text-sm mb-4"
          >
            &larr; Back to Home
          </button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
              <p className="text-gray-600 mt-1">
                {contacts.length} Odoo contacts, {contactsWithBank} with bank accounts
              </p>
            </div>
            <button
              type="button"
              onClick={fetchContacts}
              disabled={loading || !isConfigured}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white transition-colors"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {!isConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            Connect to Odoo from Settings before loading contacts.
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Search by name
              </label>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a contact name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Filter
              </label>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    filter === "all"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("bank_account")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    filter === "bank_account"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Bank Account
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-600">
            Loading contacts...
          </div>
        ) : filteredContacts.length > 0 ? (
          <div className="space-y-3">
            {filteredContacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                odooUrl={connectionSettings.url}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-600">
            No contacts found.
          </div>
        )}
      </div>
    </div>
  );
}
