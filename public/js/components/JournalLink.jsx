import { getStorageKey } from "../config.js";

const { useState, useEffect, useCallback } = React;

function getOdooParams() {
  try {
    const stored = localStorage.getItem(getStorageKey("odoo_connection"));
    if (!stored) return null;
    const conn = JSON.parse(stored);
    const params = new URLSearchParams();
    if (conn.url) params.append("url", conn.url);
    if (conn.db) params.append("db", conn.db);
    if (conn.username) params.append("username", conn.username);
    if (conn.password) params.append("password", conn.password);
    return params;
  } catch {
    return null;
  }
}

export function JournalLink({ accountAddress, onJournalChange }) {
  const [linked, setLinked] = useState(null);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState(null);

  const fetchJournals = useCallback(async () => {
    const params = getOdooParams();
    if (!params || !accountAddress) {
      setLoading(false);
      return;
    }

    params.append("address", accountAddress);

    try {
      const response = await fetch(`/api/odoo/journals?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch journals");
      }

      setLinked(data.linked || null);
      setJournals(data.journals || []);
      if (onJournalChange) onJournalChange(data.linked || null);
    } catch (err) {
      console.error("Failed to fetch journals:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accountAddress]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  const handleCreate = async () => {
    if (!newName || !newCode) return;

    const params = getOdooParams();
    if (!params) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/odoo/journals?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          code: newCode,
          address: accountAddress,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create journal");
      }

      setLinked(data.journal);
      setShowCreate(false);
      setNewName("");
      setNewCode("");
      if (onJournalChange) onJournalChange(data.journal);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <span className="text-xs text-gray-400 animate-pulse">
        Checking journal...
      </span>
    );
  }

  if (linked) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {linked.name}
        </span>
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded-lg">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Journal name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-xs border rounded px-2 py-1 flex-1"
          />
          <input
            type="text"
            placeholder="Code"
            value={newCode}
            maxLength={5}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            className="text-xs border rounded px-2 py-1 w-16"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={creating || !newName || !newCode}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            onClick={() => setShowCreate(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {journals.length > 0 ? (
        <span className="text-xs text-amber-600">
          No journal linked to this account
        </span>
      ) : null}
      <button
        onClick={() => {
          const short = accountAddress
            ? `${accountAddress.slice(0, 6)}.${accountAddress.slice(-4)}`
            : "";
          setShowCreate(true);
          setNewName(`EURe ${short}`);
          // Use last 4 hex chars of address to make code unique per account
          const suffix = accountAddress ? accountAddress.slice(-4).toUpperCase() : "";
          setNewCode(`EU${suffix}`);
        }}
        className="text-xs text-blue-600 hover:text-blue-700 underline"
      >
        + Link bank journal
      </button>
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
}
