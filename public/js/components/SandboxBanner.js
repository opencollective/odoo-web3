// React is available as a global
const React = window.React;
import { ENV, getStorageKey } from "../config.js";

const { useEffect, useState } = React;

function readMoneriumEnvironment() {
  try {
    const stored = localStorage.getItem(getStorageKey("monerium_connection"));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.environment) return parsed.environment;
    }
  } catch (_err) {
    // ignore
  }
  return ENV.environment === "production" ? "production" : "sandbox";
}

function moneriumDomain(env) {
  return env === "production" ? "monerium.com" : "monerium.dev";
}

function looksLikeTestDatabase(db) {
  if (!db) return false;
  return /(-|_)(test|sandbox|staging|dev)\b/i.test(db);
}

export function SandboxBanner() {
  const [moneriumEnv, setMoneriumEnv] = useState(readMoneriumEnvironment);

  useEffect(() => {
    const refresh = () => setMoneriumEnv(readMoneriumEnvironment());
    window.addEventListener("monerium-connection-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("monerium-connection-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isSandboxEnv = ENV.environment === "sandbox";
  const odooLooksTest = looksLikeTestDatabase(ENV.odooDatabase);

  // Config mismatch: ENV=production but Odoo points at a test DB.
  // Render a red banner so a silently-misconfigured deploy can't write
  // production data into the test database.
  if (!isSandboxEnv && odooLooksTest) {
    return React.createElement(
      "div",
      {
        className: "bg-red-600 border-b border-red-700 px-4 py-2 text-center",
      },
      React.createElement(
        "p",
        { className: "text-sm font-semibold text-white" },
        `⚠️ CONFIG MISMATCH — ENV=production but Odoo database is "${ENV.odooDatabase}". Writes will hit the test DB.`
      )
    );
  }

  if (!isSandboxEnv) {
    return null;
  }

  const parts = ["⚠️ SANDBOX ENVIRONMENT"];
  if (ENV.odooDatabase) {
    parts.push(`Odoo: ${ENV.odooDatabase}`);
  }
  parts.push(`Monerium: ${moneriumDomain(moneriumEnv)}`);

  return React.createElement(
    "div",
    {
      className: "bg-yellow-400 border-b border-yellow-500 px-4 py-2 text-center",
    },
    React.createElement(
      "p",
      { className: "text-sm font-semibold text-yellow-900" },
      parts.join(" · ")
    )
  );
}
