import { getStorageKey, ENV } from "../config.js";

const { useState, useCallback, useEffect } = React;

const CHAINS = [
  { id: "gnosis", label: "Gnosis", chainId: 100 },
  { id: "chiado", label: "Gnosis Chiado (testnet)", chainId: 10200 },
];

const DEFAULT_TOKENS = {
  gnosis: "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430",
  chiado: "0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71",
};

function loadOdooConnection() {
  try {
    const stored = localStorage.getItem(getStorageKey("odoo_connection"));
    if (!stored) return { url: "", db: "", username: "", password: "" };
    return JSON.parse(stored);
  } catch {
    return { url: "", db: "", username: "", password: "" };
  }
}

function buildOdooParams(conn) {
  if (!conn || !conn.url || !conn.db || !conn.username || !conn.password) return null;
  const params = new URLSearchParams();
  params.append("url", conn.url);
  params.append("db", conn.db);
  params.append("username", conn.username);
  params.append("password", conn.password);
  return params;
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

export function OdooSyncPage({ navigate }) {
  const defaultChain = ENV.environment === "production" ? "gnosis" : "chiado";

  // Source state
  const [chain, setChain] = useState(defaultChain);
  const [address, setAddress] = useState("0xD578e7cd845e1ecD979b04784e77068D5eBd8716");
  const [tokenAddress, setTokenAddress] = useState(DEFAULT_TOKENS[defaultChain]);
  const [enrichMonerium, setEnrichMonerium] = useState(true);
  const [moneriumStatus, setMoneriumStatus] = useState(null);
  const [showCustomCreds, setShowCustomCreds] = useState(false);
  const [customMoneriumEnv, setCustomMoneriumEnv] = useState(ENV.environment === "production" ? "production" : "sandbox");
  const [customClientId, setCustomClientId] = useState("");
  const [customClientSecret, setCustomClientSecret] = useState("");
  const [moneriumAddresses, setMoneriumAddresses] = useState([]);
  const [moneriumError, setMoneriumError] = useState(null);

  // Destination state — Odoo connection (editable)
  const [odooConn, setOdooConn] = useState(loadOdooConnection);
  const [editingOdoo, setEditingOdoo] = useState(false);
  const [journals, setJournals] = useState([]);
  const [linkedJournalId, setLinkedJournalId] = useState(null);
  const [selectedJournalId, setSelectedJournalId] = useState("");
  const [journalEntryCount, setJournalEntryCount] = useState(null);
  const [loadingJournals, setLoadingJournals] = useState(false);
  const [loadingCount, setLoadingCount] = useState(false);

  // Sync state
  const [txLimit, setTxLimit] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const odooParams = buildOdooParams(odooConn);
  const odooConfigured = Boolean(odooParams);
  const validAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
  const activeJournalId = selectedJournalId ? parseInt(selectedJournalId, 10) : null;
  const odooBaseUrl = odooConn?.url || "";

  const handleOdooConnChange = (field, value) => {
    setOdooConn((prev) => ({ ...prev, [field]: value }));
  };

  const saveOdooConn = () => {
    localStorage.setItem(getStorageKey("odoo_connection"), JSON.stringify(odooConn));
    setEditingOdoo(false);
    // Reset journals since connection may have changed
    setJournals([]);
    setSelectedJournalId("");
    setJournalEntryCount(null);
  };

  // Fetch bank journals list
  const fetchJournals = useCallback(async () => {
    if (!odooParams || !validAddress) return;
    setLoadingJournals(true);
    try {
      const params = new URLSearchParams(odooParams);
      params.append("address", address);
      const res = await fetch(`/api/odoo/journals?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setJournals(data.journals || []);
        if (data.linked) {
          setLinkedJournalId(data.linked.id);
          if (!selectedJournalId) {
            setSelectedJournalId(String(data.linked.id));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch journals:", err);
    } finally {
      setLoadingJournals(false);
    }
  }, [odooParams?.toString(), address, validAddress]);

  useEffect(() => {
    if (odooConfigured && validAddress) {
      fetchJournals();
    }
  }, [fetchJournals]);

  // Fetch entry count when journal changes
  const fetchEntryCount = useCallback(async () => {
    if (!odooParams || !activeJournalId) {
      setJournalEntryCount(null);
      return;
    }
    setLoadingCount(true);
    try {
      const params = new URLSearchParams(odooParams);
      params.append("journalId", String(activeJournalId));
      const res = await fetch(`/api/odoo/journals?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setJournalEntryCount(data);
      }
    } catch (err) {
      console.error("Failed to fetch entry count:", err);
    } finally {
      setLoadingCount(false);
    }
  }, [odooParams?.toString(), activeJournalId]);

  useEffect(() => {
    fetchEntryCount();
  }, [fetchEntryCount]);

  // Monerium check
  const checkMonerium = useCallback(async (customId, customSecret, customEnv) => {
    if (!validAddress) return;
    setMoneriumStatus("checking");
    setMoneriumError(null);
    setMoneriumAddresses([]);
    try {
      const reqBody = { address };
      if (customId && customSecret) {
        reqBody.client_id = customId;
        reqBody.client_secret = customSecret;
        if (customEnv) reqBody.environment = customEnv;
      }
      const res = await fetch("/api/monerium/check-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (data.addresses) setMoneriumAddresses(data.addresses);
      if (data.error) setMoneriumError(data.error);
      if (!data.configured) {
        setMoneriumStatus("no_creds");
        setEnrichMonerium(false);
      } else if (data.found) {
        setMoneriumStatus("found");
        setEnrichMonerium(true);
      } else {
        setMoneriumStatus("not_found");
        setEnrichMonerium(false);
      }
    } catch (err) {
      setMoneriumStatus("no_creds");
      setMoneriumError(err.message || "Failed to check Monerium");
      setEnrichMonerium(false);
    }
  }, [address, validAddress]);

  useEffect(() => {
    if (!validAddress) {
      setMoneriumStatus(null);
      setEnrichMonerium(false);
      return;
    }
    const timeout = setTimeout(() => {
      if (!showCustomCreds) checkMonerium(null, null);
    }, 500);
    return () => clearTimeout(timeout);
  }, [address, validAddress, showCustomCreds, checkMonerium]);

  const handleChainChange = (e) => {
    const newChain = e.target.value;
    setChain(newChain);
    setTokenAddress(DEFAULT_TOKENS[newChain] || "");
    setSyncResult(null);
    setSyncError(null);
  };

  const handleAddressChange = (e) => {
    setAddress(e.target.value.trim());
    setLinkedJournalId(null);
    setSelectedJournalId("");
    setJournals([]);
    setJournalEntryCount(null);
    setSyncResult(null);
    setSyncError(null);
  };

  // Sync
  const handleSync = useCallback(async (forceResync = false) => {
    if (!odooParams || !validAddress || !activeJournalId) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    setSyncStatus(null);
    setSyncProgress(null);
    try {
      const response = await fetch(
        `/api/odoo/sync?${odooParams.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            chain,
            tokenAddress: tokenAddress || undefined,
            forceResync,
            limit: txLimit ? parseInt(txLimit, 10) : undefined,
            dryRun,
            journalId: activeJournalId,
            enrichMonerium,
            moneriumClientId: showCustomCreds && customClientId ? customClientId : undefined,
            moneriumClientSecret: showCustomCreds && customClientSecret ? customClientSecret : undefined,
            moneriumEnvironment: showCustomCreds ? customMoneriumEnv : undefined,
          }),
        }
      );
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.type === "status") {
              setSyncStatus(data.message);
              if (data.total !== undefined) {
                setSyncProgress({ current: 0, total: data.total, synced: 0, skipped: 0 });
              }
            } else if (data.type === "progress") {
              setSyncProgress(data);
              setSyncStatus(data.status);
            } else if (data.type === "monerium-progress") {
              setSyncProgress(data);
              setSyncStatus(data.status);
            } else if (data.type === "done") {
              setSyncResult(data);
            } else if (data.type === "error") {
              setSyncError(data.details || data.error);
            }
          } catch {}
        }
      }
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      setSyncStatus(null);
      fetchEntryCount();
    }
  }, [address, chain, tokenAddress, activeJournalId, odooParams, validAddress, enrichMonerium, showCustomCreds, customClientId, customClientSecret, customMoneriumEnv, txLimit, dryRun, fetchEntryCount]);

  // Empty journal
  const handleEmptyJournal = useCallback(async () => {
    if (!odooParams || !activeJournalId) return;
    if (!confirm(`Delete ALL entries from journal ${activeJournalId}? This cannot be undone.`)) return;
    setEmptying(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch(
        `/api/odoo/journals?${odooParams.toString()}&journalId=${activeJournalId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to empty journal");
      setSyncStatus(`Deleted ${data.deleted} entries from journal.`);
      fetchEntryCount();
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setEmptying(false);
    }
  }, [odooParams, activeJournalId, fetchEntryCount]);

  const canSync = odooConfigured && validAddress && activeJournalId && !syncing;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            &larr; Back to Home
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Blockchain &rarr; Odoo Sync
          </h1>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            ENV.environment === "production"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {ENV.environment}
          </span>
        </div>

        {!odooConfigured && !editingOdoo && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Odoo connection not configured for <strong>{ENV.environment}</strong>.{" "}
              Configure it in the Destination box below or{" "}
              <button
                onClick={() => navigate("/settings")}
                className="underline font-medium"
              >
                go to Settings
              </button>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* ─── SOURCE ─── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Source</h2>

            {/* Chain */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chain</label>
              <select
                value={chain}
                onChange={handleChainChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Wallet Address */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Wallet Address</label>
              <input
                type="text"
                value={address}
                onChange={handleAddressChange}
                placeholder="0x..."
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  address && !validAddress ? "border-red-300" : "border-gray-300"
                }`}
              />
              {address && !validAddress && (
                <p className="text-xs text-red-500 mt-1">Invalid address</p>
              )}
            </div>

            {/* Token */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Token <span className="text-gray-400 font-normal">(defaults to EURe)</span>
              </label>
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value.trim())}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Monerium */}
            {validAddress && (
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enrichMonerium"
                    checked={enrichMonerium}
                    onChange={(e) => setEnrichMonerium(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="enrichMonerium" className="text-sm text-gray-700 flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      moneriumStatus === "found" ? "bg-green-500"
                        : moneriumStatus === "checking" ? "bg-gray-300 animate-pulse"
                        : "bg-amber-400"
                    }`} />
                    Enrich with Monerium
                  </label>
                </div>
                <p className="text-xs text-gray-400 ml-6">
                  Adds counterparty names, IBANs, and invoice reconciliation
                </p>

                {moneriumStatus === "found" && showCustomCreds && (
                  <p className="text-xs text-green-600 ml-6">
                    Using custom credentials ({customMoneriumEnv})
                  </p>
                )}

                {(moneriumStatus === "not_found" || moneriumStatus === "no_creds") && (
                  <div className="ml-6 space-y-2">
                    <p className="text-xs text-amber-600">
                      {moneriumStatus === "no_creds"
                        ? "Server credentials not configured"
                        : "Address not found in Monerium"}
                    </p>
                    {!showCustomCreds ? (
                      <button
                        onClick={() => setShowCustomCreds(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Use custom credentials
                      </button>
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                        <select
                          value={customMoneriumEnv}
                          onChange={(e) => setCustomMoneriumEnv(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="sandbox">Sandbox</option>
                          <option value="production">Production</option>
                        </select>
                        <input
                          type="text"
                          value={customClientId}
                          onChange={(e) => setCustomClientId(e.target.value.trim())}
                          placeholder="Client ID"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                        <input
                          type="password"
                          value={customClientSecret}
                          onChange={(e) => setCustomClientSecret(e.target.value.trim())}
                          placeholder="Client Secret"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => checkMonerium(customClientId, customClientSecret, customMoneriumEnv)}
                            disabled={!customClientId || !customClientSecret || moneriumStatus === "checking"}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {moneriumStatus === "checking" ? "Checking..." : "Check"}
                          </button>
                          <button
                            onClick={() => {
                              setShowCustomCreds(false);
                              setCustomClientId("");
                              setCustomClientSecret("");
                              setMoneriumAddresses([]);
                              setMoneriumError(null);
                              checkMonerium(null, null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                        {moneriumError && (
                          <p className="text-xs text-red-600">{moneriumError}</p>
                        )}
                        {moneriumAddresses.length > 0 && (
                          <div className="text-xs text-gray-600">
                            {moneriumAddresses.length} linked address{moneriumAddresses.length !== 1 ? "es" : ""}
                            {moneriumAddresses.some(a => a.address.toLowerCase() === address.toLowerCase()) && (
                              <span className="text-green-600 ml-1">(match found)</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── DESTINATION ─── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Destination</h2>

            {/* Odoo connection display / edit */}
            <div>
              {!editingOdoo ? (
                odooConfigured ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a
                          href={odooConn.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 truncate block"
                        >
                          {odooConn.url.replace(/^https?:\/\//, "")}
                        </a>
                        <span className="text-xs text-gray-400">
                          db: {odooConn.db} &middot; user: {odooConn.username}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingOdoo(true)}
                        className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-300 px-1">
                      localStorage: {getStorageKey("odoo_connection")}
                    </p>
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    Odoo not configured —{" "}
                    <button onClick={() => setEditingOdoo(true)} className="underline font-medium">
                      configure here
                    </button>
                    {" or "}
                    <button onClick={() => navigate("/settings")} className="underline font-medium">
                      in Settings
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1">
                      localStorage key: {getStorageKey("odoo_connection")}
                    </p>
                  </div>
                )
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">URL</label>
                      <input
                        type="text"
                        value={odooConn.url}
                        onChange={(e) => handleOdooConnChange("url", e.target.value.trim())}
                        placeholder="https://yourco.odoo.com"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Database</label>
                      <input
                        type="text"
                        value={odooConn.db}
                        onChange={(e) => handleOdooConnChange("db", e.target.value.trim())}
                        placeholder="database-name"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Username</label>
                      <input
                        type="text"
                        value={odooConn.username}
                        onChange={(e) => handleOdooConnChange("username", e.target.value.trim())}
                        placeholder="user@example.com"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Password</label>
                      <input
                        type="password"
                        value={odooConn.password}
                        onChange={(e) => handleOdooConnChange("password", e.target.value.trim())}
                        placeholder="password"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={saveOdooConn}
                      disabled={!odooConn.url || !odooConn.db || !odooConn.username || !odooConn.password}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setOdooConn(loadOdooConnection());
                        setEditingOdoo(false);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-gray-300 ml-auto">
                      {getStorageKey("odoo_connection")}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Journal dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bank Journal</label>
              {loadingJournals ? (
                <div className="px-3 py-2 text-sm text-gray-400 animate-pulse">Loading journals...</div>
              ) : journals.length > 0 ? (
                <select
                  value={selectedJournalId}
                  onChange={(e) => {
                    setSelectedJournalId(e.target.value);
                    setJournalEntryCount(null);
                    setSyncResult(null);
                    setSyncError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a journal...</option>
                  {journals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} (#{j.id}){j.id === linkedJournalId ? " — linked" : ""}
                    </option>
                  ))}
                </select>
              ) : odooConfigured && validAddress ? (
                <div className="px-3 py-2 text-sm text-gray-400">
                  No bank journals found
                </div>
              ) : (
                <div className="px-3 py-2 text-sm text-gray-400">
                  Enter a valid wallet address to load journals
                </div>
              )}
            </div>

            {/* Journal info */}
            {activeJournalId && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    {loadingCount ? (
                      <span className="text-gray-400 animate-pulse">Counting entries...</span>
                    ) : journalEntryCount ? (
                      <span>
                        <span className="font-medium">{journalEntryCount.statementLines}</span>{" "}
                        statement line{journalEntryCount.statementLines !== 1 ? "s" : ""}
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="font-medium">{journalEntryCount.moves}</span>{" "}
                        journal entr{journalEntryCount.moves !== 1 ? "ies" : "y"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-gray-200">
                  {odooBaseUrl && (
                    <a
                      href={`${odooBaseUrl}/odoo/accounting/bank-statements`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Bank Statements
                    </a>
                  )}
                  {odooBaseUrl && (
                    <a
                      href={`${odooBaseUrl}/web#action=account.action_account_moves_all&search_default_journal_id=${activeJournalId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Journal Items
                    </a>
                  )}
                  <button
                    onClick={handleEmptyJournal}
                    disabled={emptying || syncing || !journalEntryCount || journalEntryCount.statementLines === 0}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                  >
                    {emptying ? "Emptying..." : "Empty journal"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── SYNC OPTIONS & BUTTON ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Limit:</label>
              <input
                type="number"
                value={txLimit}
                onChange={(e) => setTxLimit(e.target.value)}
                placeholder="all"
                min="1"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <span className="text-xs text-gray-400">txns</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                id="dryRun"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="dryRun" className="text-sm text-purple-600">Dry run</label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSync(false)}
              disabled={!canSync}
              className={`flex-1 px-4 py-3 ${dryRun ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"} disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2`}
            >
              {syncing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Syncing...
                </>
              ) : (
                dryRun ? "Dry Run" : "Sync to Odoo"
              )}
            </button>
            <button
              onClick={() => handleSync(true)}
              disabled={!canSync}
              title="Delete existing entries and re-sync from scratch"
              className="px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              Force Re-sync
            </button>
          </div>

          {!activeJournalId && validAddress && odooConfigured && (
            <p className="text-xs text-gray-400 text-center">
              Select a journal to start syncing
            </p>
          )}
        </div>

        {/* ─── PROGRESS ─── */}
        {syncing && (syncStatus || syncProgress) && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            {syncStatus && <p className="text-sm text-blue-800">{syncStatus}</p>}
            {syncProgress && syncProgress.total > 0 && (
              <>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-blue-600">
                  <span>{syncProgress.current} / {syncProgress.total}</span>
                  <span>{syncProgress.synced} synced, {syncProgress.skipped} skipped</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── STATUS MESSAGE ─── */}
        {!syncing && syncStatus && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">{syncStatus}</p>
          </div>
        )}

        {/* ─── RESULT ─── */}
        {syncResult && (
          <div className={`mt-4 p-4 ${syncResult.dryRun ? "bg-purple-50 border-purple-200" : "bg-green-50 border-green-200"} border rounded-lg`}>
            {syncResult.dryRun && (
              <p className="text-xs font-bold text-purple-600 uppercase mb-1">Dry Run — no changes made</p>
            )}
            <p className={`text-sm font-medium ${syncResult.dryRun ? "text-purple-800" : "text-green-800"}`}>
              {syncResult.synced > 0
                ? `${syncResult.dryRun ? "Would sync" : "Synced"} ${syncResult.synced} transaction${syncResult.synced !== 1 ? "s" : ""}`
                : "Already up to date"}
              {syncResult.skipped > 0 && ` (${syncResult.skipped} duplicates skipped)`}
            </p>
            {syncResult.moneriumRan && (
              <p className={`text-sm mt-1 ${syncResult.dryRun ? "text-purple-700" : "text-green-700"}`}>
                Monerium: {syncResult.moneriumEnriched > 0
                  ? `${syncResult.dryRun ? "would enrich" : "enriched"} ${syncResult.moneriumEnriched}`
                  : `${syncResult.moneriumSkipped || 0} already enriched`}
                {(syncResult.moneriumMatchedPartners || 0) > 0 &&
                  `, ${syncResult.moneriumMatchedPartners} partner${syncResult.moneriumMatchedPartners !== 1 ? "s" : ""} matched`}
                {(syncResult.moneriumNewPartners || 0) > 0 &&
                  `, ${syncResult.dryRun ? "would create" : "created"} ${syncResult.moneriumNewPartners} new`}
                {(syncResult.moneriumReconciled || 0) > 0 &&
                  `, ${syncResult.dryRun ? "would reconcile" : "reconciled"} ${syncResult.moneriumReconciled} invoice${syncResult.moneriumReconciled !== 1 ? "s" : ""}`}
              </p>
            )}
            {syncResult.balance && (
              <p className={`text-sm mt-1 ${syncResult.dryRun ? "text-purple-700" : "text-green-700"}`}>
                Wallet balance: {syncResult.balance} EURe
              </p>
            )}
            <p className={`text-xs mt-1 ${syncResult.dryRun ? "text-purple-600" : "text-green-600"}`}>
              Journal: {syncResult.journal.name} (#{syncResult.journal.id})
              {syncResult.totalStatementLines !== undefined && syncResult.totalStatementLines >= 0 &&
                ` — ${syncResult.totalStatementLines} statement line${syncResult.totalStatementLines !== 1 ? "s" : ""}`}
              {syncResult.totalOnChain !== undefined &&
                ` (${syncResult.totalOnChain} total on chain)`}
            </p>
          </div>
        )}

        {/* ─── ERROR ─── */}
        {syncError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{syncError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
