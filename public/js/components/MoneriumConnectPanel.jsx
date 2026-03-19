import { generatePKCE } from "../utils/crypto.js";
import { getStorageKey } from "../config.js";
import { getSelectedMoneriumAccount, setSelectedMoneriumAccount } from "../utils/storage.js";
import { LoaderIcon } from "./icons.jsx";

const { useState, useEffect, useCallback } = React;

export function MoneriumConnectPanel({ connection, onConnectionChange }) {
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
      console.log("🔍 Addresses:", data);
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
      // Trigger the connect flow
      const connectFlow = async () => {
        try {
          setLoading(true);
          setError(null);

          // Try client credentials flow first if available
          if (config?.hasClientSecret) {
            console.log("🔐 Using client credentials authentication");
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

            // Calculate expiration timestamp
            const expiresIn = data.expires_in; // seconds until expiration
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

          // Fall back to PKCE flow
          console.log("🔐 Using PKCE authentication flow");
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

          console.log("🚀 Redirecting to Monerium Auth", authUrl.toString());
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

      // Try client credentials flow first if available
      if (config?.hasClientSecret) {
        console.log("🔐 Using client credentials authentication");
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

        // Calculate expiration timestamp
        const expiresIn = data.expires_in; // seconds until expiration
        const expiresAt = expiresIn
          ? Date.now() + (expiresIn * 1000)
          : null;

        // Save connection, restoring previously selected account if any
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

      // Fall back to PKCE flow if no client secret
      console.log("🔐 Using PKCE authentication flow");
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

      console.log("🚀 Redirecting to Monerium Auth", authUrl.toString());
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
          <span>Loading accounts…</span>
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
        {accounts.map((account) => (
          <li
            key={account.address}
            className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="font-mono text-sm text-gray-900">
                {account.address}
              </span>
              <span className="text-xs text-gray-500">on {account.chain} </span>
            </div>
            <span className="text-xs text-gray-500">{account.balance} €</span>
            {connection?.accountAddress === account.address ? (
              <span className="text-xs font-semibold text-green-600">
                Selected
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSelectAccount(account)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Use this account
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">💳 Monerium Connection</h2>
          <p className="text-sm text-gray-600">
            {configLoading
              ? "Loading configuration…"
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

      {configError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded">
          {configError}
        </div>
      )}

      {!connection?.accessToken && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-600">
            Connect your Monerium account to enable automated invoice payments.
            You&apos;ll be redirected to Monerium to authorize access.
          </p>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || configLoading || !clientId}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? "Connecting..." : "Connect with Monerium"}
          </button>
        </div>
      )}

      {connection?.accessToken && (
        <div className="mt-4 space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, "", "/monerium");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="text-green-800 hover:text-green-900 underline font-medium"
            >
              Connected to Monerium
            </button>
            . Select which account should fund payments.
          </div>
          {!connection.accountAddress && (
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                Available accounts
              </h3>
              <button
                type="button"
                onClick={fetchAddresses}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Refresh
              </button>
            </div>
          )}
          {renderAccounts()}
          {connection.accountAddress && (
            <div className="text-sm text-gray-700">
              Payments will use account{" "}
              <span className="font-mono text-xs">
                {connection.accountAddress}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
