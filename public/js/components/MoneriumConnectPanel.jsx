import { generatePKCE } from "../utils/crypto.js";
import { getStorageKey } from "../config.js";
import { getSelectedMoneriumAccount, setSelectedMoneriumAccount } from "../utils/storage.js";
import { formatAddress } from "../utils/format.js";
import { LoaderIcon } from "./icons.jsx";

const { useState, useEffect, useCallback } = React;

function CopyableAddress({ address, chain }) {
  const [copied, setCopied] = useState(false);
  const short = formatAddress(address);
  const explorerUrl = `https://txinfo.xyz/${chain}/address/${address}`;

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm" title={address}>
        {short}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        title="Copy full address"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-blue-500 transition-colors"
        title="View on explorer"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </span>
  );
}

export function MoneriumConnectPanel({ connection, onConnectionChange, embedded }) {
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);

  const environment =
    connection?.environment ||
    (config?.environment === "production" ? "production" : "sandbox") ||
    "sandbox";
  const clientId = config?.clientId || "";

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        setConfigLoading(true);
        const response = await fetch("/api/monerium/config");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load configuration");
        }
        if (!cancelled) {
          setConfig(data);
        }
      } catch (err) {
        if (!cancelled) {
          setConfigError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setConfigLoading(false);
        }
      }
    };

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAddresses = useCallback(async () => {
    if (!connection?.accessToken) return;
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const response = await fetch("/api/monerium/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: connection.accessToken,
          environment,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to load Monerium accounts"
        );
      }
      setAccounts(data);
    } catch (err) {
      setAccountsError(
        err instanceof Error ? err.message : "Failed to load accounts"
      );
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [connection?.accessToken, environment]);

  useEffect(() => {
    if (connection?.accessToken && !connection.accountAddress) {
      fetchAddresses();
    }
  }, [connection?.accessToken, connection?.accountAddress, fetchAddresses]);

  const emitConnectionChange = (nextConnection) => {
    if (typeof onConnectionChange === "function") {
      onConnectionChange(nextConnection);
    }
    window.dispatchEvent(new Event("monerium-connection-updated"));
  };

  useEffect(() => {
    const handleReconnect = () => {
      if (!clientId) {
        setError(
          "MONERIUM_CLIENT_ID is not configured on the server. Please set the environment variable."
        );
        return;
      }
      const connectFlow = async () => {
        try {
          setLoading(true);
          setError(null);

          if (config?.hasClientSecret) {
            const response = await fetch("/api/monerium/authenticate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data.error || "Failed to authenticate with client credentials"
              );
            }

            const token = data.access_token;
            if (!token) {
              throw new Error("No access token received");
            }

            const expiresIn = data.expires_in;
            const expiresAt = expiresIn
              ? Date.now() + (expiresIn * 1000)
              : null;

            const savedAccount = getSelectedMoneriumAccount();
            const newConnection = {
              accessToken: token,
              environment,
              accountAddress: savedAccount,
              expiresAt,
            };

            localStorage.setItem(
              getStorageKey("monerium_connection"),
              JSON.stringify(newConnection)
            );
            emitConnectionChange(newConnection);
            setLoading(false);
            return;
          }

          const { codeVerifier, codeChallenge } = await generatePKCE();

          localStorage.setItem(
            getStorageKey("monerium_oauth"),
            JSON.stringify({
              codeVerifier,
              clientId,
              environment,
              accountAddress: getSelectedMoneriumAccount(),
            })
          );

          const baseUrl =
            environment === "production"
              ? "https://api.monerium.app"
              : "https://api.monerium.dev";
          const authUrl = new URL(`${baseUrl}/auth`);
          authUrl.searchParams.set("client_id", clientId);
          authUrl.searchParams.set(
            "redirect_uri",
            window.location.origin + "/monerium"
          );
          authUrl.searchParams.set("code_challenge", codeChallenge);
          authUrl.searchParams.set("code_challenge_method", "S256");
          authUrl.searchParams.set("response_type", "code");

          window.location.href = authUrl.toString();
        } catch (err) {
          console.error("Authorization failed:", err);
          setError(err instanceof Error ? err.message : "Failed to connect");
          setLoading(false);
        }
      };
      connectFlow();
    };
    window.addEventListener("monerium-reconnect", handleReconnect);
    return () =>
      window.removeEventListener("monerium-reconnect", handleReconnect);
  }, [clientId, config, environment, onConnectionChange]);

  const handleConnect = async () => {
    if (!clientId) {
      setError(
        "MONERIUM_CLIENT_ID is not configured on the server. Please set the environment variable."
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (config?.hasClientSecret) {
        const response = await fetch("/api/monerium/authenticate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to authenticate with client credentials"
          );
        }

        const token = data.access_token;
        if (!token) {
          throw new Error("No access token received");
        }

        const expiresIn = data.expires_in;
        const expiresAt = expiresIn
          ? Date.now() + (expiresIn * 1000)
          : null;

        const savedAccount = getSelectedMoneriumAccount();
        const newConnection = {
          accessToken: token,
          environment,
          accountAddress: savedAccount,
          expiresAt,
        };

        localStorage.setItem(
          getStorageKey("monerium_connection"),
          JSON.stringify(newConnection)
        );
        emitConnectionChange(newConnection);
        setLoading(false);
        return;
      }

      const { codeVerifier, codeChallenge } = await generatePKCE();

      localStorage.setItem(
        getStorageKey("monerium_oauth"),
        JSON.stringify({
          codeVerifier,
          clientId,
          environment,
          accountAddress: getSelectedMoneriumAccount(),
        })
      );

      const baseUrl =
        environment === "production"
          ? "https://api.monerium.app"
          : "https://api.monerium.dev";
      const authUrl = new URL(`${baseUrl}/auth`);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set(
        "redirect_uri",
        window.location.origin + "/monerium"
      );
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("response_type", "code");

      window.location.href = authUrl.toString();
    } catch (err) {
      console.error("Authorization failed:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem(getStorageKey("monerium_connection"));
    localStorage.removeItem(getStorageKey("monerium_oauth"));
    setAccounts([]);
    setAccountsError(null);
    emitConnectionChange(null);
  };

  const handleSelectAccount = (account) => {
    if (!connection?.accessToken || !account?.address) return;
    setSelectedMoneriumAccount(account.address);
    const updatedConnection = {
      ...connection,
      accountAddress: account.address,
      accountChain: account.chain || null,
      accountSignatories: account.signatories || null,
    };
    localStorage.setItem(
      getStorageKey("monerium_connection"),
      JSON.stringify(updatedConnection)
    );
    emitConnectionChange(updatedConnection);
  };

  const renderAccounts = () => {
    if (accountsLoading) {
      return (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <LoaderIcon />
          <span>Loading accounts...</span>
        </div>
      );
    }

    if (accountsError) {
      return (
        <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded">
          {accountsError}
        </div>
      );
    }

    if (!accounts?.length) {
      return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 text-sm text-yellow-800 rounded">
          No accounts available for this Monerium connection.
        </div>
      );
    }

    return (
      <ul className="space-y-2">
        {accounts.map((account) => {
          const isSelected = connection?.accountAddress === account.address;
          return (
            <li
              key={account.address}
              onClick={() => !isSelected && handleSelectAccount(account)}
              className={`flex items-center justify-between rounded-lg px-4 py-3 transition-colors ${
                isSelected
                  ? "bg-blue-50 border-2 border-blue-300"
                  : "border border-gray-200 hover:border-blue-200 hover:bg-gray-50 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? "bg-blue-500" : "bg-gray-300"}`} />
                <div className="min-w-0">
                  <CopyableAddress address={account.address} chain={account.chain} />
                  <span className="text-xs text-gray-400 ml-2">{account.chain}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700">{account.balance} &euro;</span>
                {isSelected && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  // When embedded in onboarding, skip the outer container
  const Wrapper = embedded ? "div" : ({ children }) => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">{children}</div>
  );

  return (
    <Wrapper>
      {!embedded && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Monerium Connection</h2>
            <p className="text-sm text-gray-600">
              {configLoading
                ? "Loading configuration..."
                : `Environment: ${
                    environment === "production" ? "Production" : "Sandbox"
                  }`}
            </p>
          </div>
          {connection?.accessToken && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      )}

      {configError && (
        <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded mb-4">
          {configError}
        </div>
      )}

      {!connection?.accessToken && (
        <div className="space-y-4">
          {!embedded && (
            <p className="text-sm text-gray-600">
              Connect your Monerium account to enable automated invoice payments.
            </p>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || configLoading || !clientId}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Connecting..." : "Connect with Monerium"}
          </button>
        </div>
      )}

      {connection?.accessToken && !connection.accountAddress && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Select which account should fund payments.
            </p>
            <button
              type="button"
              onClick={fetchAddresses}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>
          {renderAccounts()}
        </div>
      )}

      {connection?.accessToken && connection.accountAddress && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Using account{" "}
              <CopyableAddress
                address={connection.accountAddress}
                chain={connection.accountChain || "gnosis"}
              />
            </div>
            {embedded && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </Wrapper>
  );
}
