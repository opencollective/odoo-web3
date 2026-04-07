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
import { getStorageKey } from "../config.js";

const { useState } = React;

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
    </>
  );
}
