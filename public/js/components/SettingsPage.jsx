import { getStorageKey, ENV } from "../config.js";
import { MoneriumConnectPanel } from "./MoneriumConnectPanel.jsx";
import {
  loadMoneriumConnectionState,
  getOpenCollectiveApiKey,
  setOpenCollectiveApiKey,
  getOpenCollectiveCollective,
  setOpenCollectiveCollective,
} from "../utils/storage.js";
import { testConnection as testOCConnection } from "../services/opencollective.js";
import { LoaderIcon, ExternalLinkIcon } from "./icons.jsx";

const { useState, useEffect } = React;

export function SettingsPage({ navigate }) {
  // Odoo connection state
  const loadConnectionSettings = () => {
    try {
      const stored = localStorage.getItem(getStorageKey("odoo_connection"));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.error("Failed to load connection settings:", err);
    }
    return { url: "", db: "", username: "", password: "" };
  };

  const [odooSettings, setOdooSettings] = useState(loadConnectionSettings);
  const [odooTestStatus, setOdooTestStatus] = useState(null);
  const [odooTestLoading, setOdooTestLoading] = useState(false);

  // Monerium connection state
  const [moneriumConnection, setMoneriumConnection] = useState(
    loadMoneriumConnectionState
  );

  // Open Collective state
  const [ocApiKey, setOcApiKey] = useState(getOpenCollectiveApiKey);
  const [ocCollective, setOcCollective] = useState(getOpenCollectiveCollective);
  const [showApiKey, setShowApiKey] = useState(false);
  const [ocTestStatus, setOcTestStatus] = useState(null);
  const [ocTestLoading, setOcTestLoading] = useState(false);
  const [ocUser, setOcUser] = useState(null);

  // Listen for Monerium connection updates
  useEffect(() => {
    const handleConnectionUpdate = () => {
      setMoneriumConnection(loadMoneriumConnectionState());
    };
    window.addEventListener("monerium-connection-updated", handleConnectionUpdate);
    return () =>
      window.removeEventListener("monerium-connection-updated", handleConnectionUpdate);
  }, []);

  // Odoo handlers
  const handleOdooChange = (e) => {
    setOdooSettings({
      ...odooSettings,
      [e.target.name]: e.target.value,
    });
  };

  const saveOdooSettings = () => {
    try {
      localStorage.setItem(
        getStorageKey("odoo_connection"),
        JSON.stringify(odooSettings)
      );
      setOdooTestStatus({ success: true, message: "Settings saved" });
    } catch (err) {
      setOdooTestStatus({ success: false, message: "Failed to save settings" });
    }
  };

  const testOdooConnection = async () => {
    setOdooTestLoading(true);
    setOdooTestStatus(null);
    try {
      const params = new URLSearchParams({
        url: odooSettings.url,
        db: odooSettings.db,
        username: odooSettings.username,
        password: odooSettings.password,
      });

      const response = await fetch(`/api/odoo/authenticate?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setOdooTestStatus({ success: true, message: "Connection successful" });
    } catch (err) {
      setOdooTestStatus({
        success: false,
        message: err.message || "Connection failed",
      });
    } finally {
      setOdooTestLoading(false);
    }
  };

  const clearOdooSettings = () => {
    localStorage.removeItem(getStorageKey("odoo_connection"));
    setOdooSettings({ url: "", db: "", username: "", password: "" });
    setOdooTestStatus(null);
  };

  const isOdooConfigured = () => {
    return (
      odooSettings.url &&
      odooSettings.db &&
      odooSettings.username &&
      odooSettings.password
    );
  };

  // Open Collective handlers
  const handleOcApiKeyChange = (e) => {
    const value = e.target.value;
    setOcApiKey(value);
    setOpenCollectiveApiKey(value);
    setOcTestStatus(null);
    setOcUser(null);
  };

  const handleOcCollectiveChange = (e) => {
    const value = e.target.value;
    setOcCollective(value);
    setOpenCollectiveCollective(value);
  };

  const testOcConnection = async () => {
    if (!ocApiKey) {
      setOcTestStatus({ success: false, message: "Please enter an API key" });
      return;
    }

    setOcTestLoading(true);
    setOcTestStatus(null);
    try {
      const user = await testOCConnection(ocApiKey);
      setOcUser(user);
      setOcTestStatus({
        success: true,
        message: `Connected as ${user.name || user.email}`,
      });
    } catch (err) {
      setOcTestStatus({
        success: false,
        message: err.message || "Connection failed",
      });
      setOcUser(null);
    } finally {
      setOcTestLoading(false);
    }
  };

  const clearOcSettings = () => {
    setOpenCollectiveApiKey("");
    setOpenCollectiveCollective("");
    setOcApiKey("");
    setOcCollective("");
    setOcTestStatus(null);
    setOcUser(null);
  };

  const goToExpenses = () => {
    if (ocCollective) {
      navigate(`/oc/${ocCollective}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block"
          >
            &larr; Back to Invoices
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              ENV.environment === "production"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {ENV.environment}
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            Configure your connections to Odoo, Monerium, and Open Collective.
            <span className="text-xs text-gray-400 ml-1">(stored per environment)</span>
          </p>
        </div>

        {/* Odoo Connection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Odoo Connection</h2>
              <p className="text-sm text-gray-600">
                Connect to your Odoo instance to fetch invoices.
              </p>
            </div>
            {isOdooConfigured() && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                  Connected to {odooSettings.db}
                </span>
                <button
                  onClick={clearOdooSettings}
                  className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Odoo URL
              </label>
              <input
                type="text"
                name="url"
                placeholder="https://yourcompany.odoo.com"
                value={odooSettings.url}
                onChange={handleOdooChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Database
              </label>
              <input
                type="text"
                name="db"
                placeholder="Database name"
                value={odooSettings.db}
                onChange={handleOdooChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={odooSettings.username}
                onChange={handleOdooChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={odooSettings.password}
                onChange={handleOdooChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {odooTestStatus && (
            <div
              className={`mb-4 p-3 rounded text-sm ${
                odooTestStatus.success
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {odooTestStatus.message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={saveOdooSettings}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              onClick={testOdooConnection}
              disabled={odooTestLoading || !isOdooConfigured()}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {odooTestLoading ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>

        {/* Monerium Connection */}
        <MoneriumConnectPanel
          connection={moneriumConnection}
          onConnectionChange={(next) =>
            setMoneriumConnection(next ?? loadMoneriumConnectionState())
          }
        />

        {/* Open Collective Connection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Open Collective</h2>
              <p className="text-sm text-gray-600">
                Connect to Open Collective to manage expenses.
              </p>
            </div>
            {ocUser && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                  Connected as {ocUser.name || ocUser.email}
                </span>
                <button
                  onClick={clearOcSettings}
                  className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your Open Collective API key"
                  value={ocApiKey}
                  onChange={handleOcApiKeyChange}
                  className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <a
                href="https://opencollective.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-700"
              >
                Get your API key from Open Collective Dashboard
                <ExternalLinkIcon />
              </a>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Collective Slug
              </label>
              <input
                type="text"
                placeholder="e.g., opencollective"
                value={ocCollective}
                onChange={handleOcCollectiveChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                The slug is the collective's URL path (e.g., opencollective.com/
                <strong>your-collective</strong>)
              </p>
            </div>
          </div>

          {ocTestStatus && (
            <div
              className={`mb-4 p-3 rounded text-sm ${
                ocTestStatus.success
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {ocTestStatus.message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={testOcConnection}
              disabled={ocTestLoading || !ocApiKey}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {ocTestLoading ? "Testing..." : "Test Connection"}
            </button>
            {ocCollective && ocUser && (
              <button
                onClick={goToExpenses}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                View Expenses
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
