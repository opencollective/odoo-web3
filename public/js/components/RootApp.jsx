import { App } from "./App.jsx";
import { InvoiceDetailsView } from "./InvoiceDetailsView.jsx";
import { MonthlyInvoicesView } from "./MonthlyInvoicesView.jsx";
import { SettingsPage } from "./SettingsPage.jsx";
import { CollectiveExpensesPage } from "./CollectiveExpensesPage.jsx";
import { CollectivesPage } from "./CollectivesPage.jsx";
import { HomePage } from "./HomePage.jsx";
import { TransactionsPage } from "./TransactionsPage.jsx";
import { OdooSyncPage } from "./OdooSyncPage.jsx";
import { OdooDoctorPage } from "./OdooDoctorPage.jsx";
import { SandboxBanner } from "./SandboxBanner.js";
import { Router } from "./Router.js";
import { getStorageKey, ENV } from "../config.js";

const { useState, useCallback } = React;

export function RootApp() {
  // Load connection settings from localStorage
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

  const [connectionSettings] = useState(loadConnectionSettings);
  const [sessionId] = useState(null);
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = useCallback(async (alsoLockServer) => {
    if (alsoLockServer) {
      try {
        await fetch("/api/lock", { method: "POST" });
      } catch {}
    }
    // Clear all localStorage for the current environment
    const env = ENV.environment || "sandbox";
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith(`_${env}`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    window.location.href = "/";
  }, []);

  return (
    <>
      <SandboxBanner />
      <Router>
        {({ currentPath, navigate }) => {
          // Match /settings
          if (currentPath === "/settings") {
            return <SettingsPage navigate={navigate} />;
          }

          // Match /bills - Odoo invoices
          if (currentPath === "/bills") {
            return <App />;
          }

          // Match /transactions or /transactions/:address
          if (currentPath === "/transactions") {
            return <TransactionsPage navigate={navigate} />;
          }
          const txMatch = currentPath.match(/^\/transactions\/(0x[a-fA-F0-9]+)$/);
          if (txMatch) {
            return (
              <TransactionsPage
                navigate={navigate}
                account={txMatch[1]}
              />
            );
          }

          // Match /odoo/sync - Blockchain sync testing page
          if (currentPath === "/odoo/sync") {
            return <OdooSyncPage navigate={navigate} />;
          }

          // Match /odoo/doctor - Journal health check
          if (currentPath === "/odoo/doctor") {
            return <OdooDoctorPage navigate={navigate} />;
          }

          // Match /collectives - List of hosted collectives
          if (currentPath === "/collectives") {
            return <CollectivesPage navigate={navigate} />;
          }

          // Match /oc/:slug pattern for Open Collective expenses
          const collectiveMatch = currentPath.match(/^\/oc\/(.+)$/);
          if (collectiveMatch) {
            const [, slug] = collectiveMatch;
            return (
              <CollectiveExpensesPage slug={slug} navigate={navigate} />
            );
          }

          // Match /invoices/:id pattern
          const invoiceDetailsMatch = currentPath.match(/^\/invoices\/(\d+)$/);
          if (invoiceDetailsMatch) {
            const invoiceId = invoiceDetailsMatch[1];
            return (
              <InvoiceDetailsView
                invoiceId={invoiceId}
                connectionSettings={connectionSettings}
                sessionId={sessionId}
                navigate={navigate}
              />
            );
          }

          // Match /:year/:month pattern
          const monthlyMatch = currentPath.match(/^\/(\d{4})\/(\d{1,2})$/);
          if (monthlyMatch) {
            const [, year, month] = monthlyMatch;
            return (
              <MonthlyInvoicesView
                year={year}
                month={month}
                connectionSettings={connectionSettings}
                sessionId={sessionId}
                navigate={navigate}
              />
            );
          }

          // Default: show homepage
          return <HomePage navigate={navigate} />;
        }}
      </Router>

      {/* Footer */}
      <footer className="py-6 text-center">
        <button
          onClick={() => setShowLogout(true)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      </footer>

      {/* Logout confirmation dialog */}
      {showLogout && (
        <LogoutDialog
          onCancel={() => setShowLogout(false)}
          onConfirm={handleLogout}
        />
      )}
    </>
  );
}

function LogoutDialog({ onCancel, onConfirm }) {
  const [lockServer, setLockServer] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Logout</h3>
        <p className="text-sm text-gray-600 mb-4">
          This will clear all saved settings (Odoo credentials, Monerium
          connection, selected accounts) from this browser.
        </p>

        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={lockServer}
            onChange={(e) => setLockServer(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Also lock the server signing key
            <span className="block text-xs text-gray-500 mt-0.5">
              The passphrase will need to be re-entered after this.
            </span>
          </span>
        </label>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(lockServer)}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
