// React is available as a global
const React = window.React;
import { ENV } from "../config.js";

export function SandboxBanner() {
  if (ENV.environment !== "sandbox") {
    return null;
  }

  return React.createElement(
    "div",
    {
      className: "bg-yellow-400 border-b border-yellow-500 px-4 py-2 text-center",
    },
    React.createElement(
      "p",
      { className: "text-sm font-semibold text-yellow-900" },
      "⚠️ SANDBOX ENVIRONMENT - This is a test environment"
    )
  );
}

