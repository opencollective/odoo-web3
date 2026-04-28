import { getStorageKey, ENV } from "../config.js";
import {
  loadMoneriumConnectionState,
  getSelectedMoneriumAccount,
} from "../utils/storage.js";
import { MoneriumConnectPanel } from "./MoneriumConnectPanel.jsx";

const { useState, useEffect } = React;

function getSetupState() {
  // Step 1: Odoo connection
  let odooConfigured = false;
  try {
    const stored = localStorage.getItem(getStorageKey("odoo_connection"));
    if (stored) {
      const conn = JSON.parse(stored);
      odooConfigured = Boolean(
        conn.url && conn.db && conn.username && conn.password
      );
    }
  } catch {}

  // Step 2: Monerium connection
  const monerium = loadMoneriumConnectionState();
  const moneriumConnected = Boolean(monerium?.accessToken);

  // Step 3: Account selected
  const accountSelected = Boolean(monerium?.accountAddress);

  // Keystore verification (persisted per environment)
  const keystoreVerified = localStorage.getItem(getStorageKey("keystore_verified")) === "true";

  return { odooConfigured, moneriumConnected, accountSelected, monerium, keystoreVerified };
}

function OdooSetupStep({ onComplete }) {
  const [settings, setSettings] = useState({
    url: "",
    db: "",
    username: "",
    password: "",
  });
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...settings, [name]: value };
    if (name === "url") {
      const match = value.match(/^https?:\/\/([^.]+)\.odoo\.com/);
      if (match) next.db = match[1];
    }
    setSettings(next);
  };

  const allFilled = Boolean(
    settings.url && settings.db && settings.username && settings.password
  );

  const handleSave = async () => {
    if (!allFilled) return;
    setTesting(true);
    setError(null);
    try {
      const params = new URLSearchParams(settings);
      const response = await fetch(
        `/api/odoo/authenticate?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Authentication failed");

      localStorage.setItem(
        getStorageKey("odoo_connection"),
        JSON.stringify(settings)
      );
      onComplete();
    } catch (err) {
      setError(err.message || "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Connect to Odoo
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Enter your Odoo credentials to access your invoices and accounting data.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Odoo URL
          </label>
          <input
            type="text"
            name="url"
            placeholder="https://yourcompany.odoo.com"
            value={settings.url}
            onChange={handleChange}
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
            value={settings.db}
            onChange={handleChange}
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
            placeholder="Username or email"
            value={settings.username}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Password / API Key
          </label>
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={settings.password}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={!allFilled || testing}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
      >
        {testing ? "Connecting..." : "Connect & Continue"}
      </button>
    </div>
  );
}

function MoneriumSetupStep({ onComplete }) {
  const [connection, setConnection] = useState(loadMoneriumConnectionState);

  useEffect(() => {
    const handleUpdate = () => {
      const next = loadMoneriumConnectionState();
      setConnection(next);
      if (next?.accountAddress) {
        onComplete();
      }
    };
    window.addEventListener("monerium-connection-updated", handleUpdate);
    return () =>
      window.removeEventListener("monerium-connection-updated", handleUpdate);
  }, [onComplete]);

  // If connected and account selected, auto-advance
  useEffect(() => {
    if (connection?.accessToken && connection?.accountAddress) {
      onComplete();
    }
  }, [connection?.accessToken, connection?.accountAddress, onComplete]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Connect to Monerium
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Link your Monerium account to pay invoices with EURe on Gnosis chain.
      </p>
      <MoneriumConnectPanel
        connection={connection}
        onConnectionChange={(next) => {
          setConnection(next ?? loadMoneriumConnectionState());
        }}
        embedded
      />
    </div>
  );
}

function KeystoreSetupStep({ onComplete, onSkip, selectedAccount }) {
  const [passphrase, setPassphrase] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  const handleVerify = async () => {
    if (!passphrase) return;
    setVerifying(true);
    setResult(null);
    try {
      const response = await fetch("/api/unlock/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const data = await response.json();
      if (data.ok) {
        localStorage.setItem(getStorageKey("keystore_verified"), "true");

        // Check if derived address is a signer on the selected Safe account
        let isSigner = false;
        if (selectedAccount) {
          const addr = data.address.toLowerCase();
          if (selectedAccount.address.toLowerCase() === addr) {
            isSigner = true;
          } else if (selectedAccount.signatories?.length) {
            isSigner = selectedAccount.signatories.some(
              (s) => s.toLowerCase() === addr
            );
          }
        }

        setResult({ success: true, address: data.address, isSigner });
      } else {
        setResult({ success: false, message: data.error || "Verification failed" });
      }
    } catch (err) {
      setResult({ success: false, message: err.message || "Connection failed" });
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && passphrase && !verifying) {
      handleVerify();
    }
  };

  const safeSettingsUrl = selectedAccount
    ? `https://app.safe.global/settings/setup?safe=${
        selectedAccount.chain === "gnosis" ? "gno" : "chiado"
      }:${selectedAccount.address}`
    : null;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Unlock Signing Key
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Your server has an encrypted private key for signing transactions.
        Enter the passphrase to decrypt it.
      </p>
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Passphrase
        </label>
        <input
          type="password"
          placeholder="Enter your passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {result && result.success && (
        <div className="mb-4 space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
            <p className="font-medium mb-1">Passphrase verified.</p>
            <p>
              Wallet address:{" "}
              <code className="bg-green-100 px-1.5 py-0.5 rounded text-xs font-mono select-all">
                {result.address}
              </code>
            </p>
          </div>

          {result.isSigner ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              This address is a signer on the selected Safe account.
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              <p className="font-medium mb-1">
                This address is not yet a signer on the selected Safe account.
              </p>
              <p>
                Make sure this wallet address is able to sign transactions in the
                Safe multisig of your account.{" "}
                {safeSettingsUrl && (
                  <a
                    href={safeSettingsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium text-amber-900 hover:text-amber-700"
                  >
                    Add it as a signer in Safe settings &rarr;
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {result && !result.success && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {result.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        {result?.success ? (
          <button
            onClick={onComplete}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleVerify}
            disabled={!passphrase || verifying}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {verifying ? "Verifying..." : "Verify"}
          </button>
        )}
        <button
          onClick={onSkip}
          className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700"
        >
          Skip — use WalletConnect instead
        </button>
      </div>
    </div>
  );
}

function Dashboard({ navigate }) {
  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Finance Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Manage invoices and collective expenses
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-6">
        <button
          onClick={() => navigate("/bills")}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Bills</h2>
          </div>
          <p className="text-gray-600 mb-4">
            View and pay Odoo invoices using Monerium
          </p>
          <div className="flex items-center text-blue-600 font-medium">
            Go to Bills
            <svg
              className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </button>

        <button
          onClick={() => navigate("/transactions")}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-lg bg-green-100 text-green-600 group-hover:bg-green-200 transition-colors">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Monerium transactions with Odoo reconciliation status
          </p>
          <div className="flex items-center text-green-600 font-medium">
            View Transactions
            <svg
              className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </button>

        <button
          onClick={() => navigate("/collectives")}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-lg bg-purple-100 text-purple-600 group-hover:bg-purple-200 transition-colors">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Collectives</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Browse hosted collectives and manage their expenses
          </p>
          <div className="flex items-center text-purple-600 font-medium">
            View Collectives
            <svg
              className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </button>

        <button
          onClick={() => navigate("/contacts")}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-lg bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200 transition-colors">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h3m4-6a4 4 0 11-8 0 4 4 0 018 0zm7 2a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Search Odoo contacts and pay saved bank accounts
          </p>
          <div className="flex items-center text-cyan-700 font-medium">
            View Contacts
            <svg
              className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </button>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => navigate("/settings")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isDone ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-xs mt-1.5 ${
                  isActive
                    ? "text-blue-600 font-medium"
                    : isDone
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 mb-5 ${
                  isDone ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HomePage({ navigate }) {
  const [setup, setSetup] = useState(getSetupState);
  const [step, setStep] = useState(null);
  // Whether server has PRIVATE_KEY_ENCRYPTED (fetched once on mount)
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false);

  // Check if server needs keystore unlock
  useEffect(() => {
    fetch("/api/unlock")
      .then((r) => r.json())
      .then((data) => {
        // needsUnlock means PRIVATE_KEY_ENCRYPTED is set but not yet decrypted
        // If it's already unlocked, it also means there's an encrypted key configured
        setHasEncryptedKey(data.needsUnlock || !data.locked);
      })
      .catch(() => {});
  }, []);

  // Determine current step from setup state
  // Steps: 1=Odoo, 2=Monerium, 3=Keystore (if applicable), last=Ready
  useEffect(() => {
    const s = getSetupState();
    setSetup(s);
    if (!s.odooConfigured) {
      setStep(1);
    } else if (!s.moneriumConnected || !s.accountSelected) {
      setStep(2);
    } else if (hasEncryptedKey && !s.keystoreVerified) {
      setStep(3);
    } else {
      setStep("done");
    }
  }, [hasEncryptedKey]);

  const stepLabels = hasEncryptedKey
    ? ["Odoo", "Monerium", "Signing Key", "Ready"]
    : ["Odoo", "Monerium", "Ready"];

  const doneStep = hasEncryptedKey ? 4 : 3;
  const currentStepNum =
    step === "done" ? doneStep : step;

  const isFullySetup = step === "done";

  if (isFullySetup) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <Dashboard navigate={navigate} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Finance Dashboard
          </h1>
          <p className="text-gray-600">
            Let's set up your connections to get started.
          </p>
        </div>

        <StepIndicator
          currentStep={currentStepNum || 1}
          steps={stepLabels}
        />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {step === 1 && (
            <OdooSetupStep
              onComplete={() => {
                setSetup((prev) => ({ ...prev, odooConfigured: true }));
                setStep(2);
              }}
            />
          )}
          {step === 2 && (
            <MoneriumSetupStep
              onComplete={() => {
                const s = getSetupState();
                setSetup(s);
                if (hasEncryptedKey && !s.keystoreVerified) {
                  setStep(3);
                } else {
                  setStep("done");
                }
              }}
            />
          )}
          {step === 3 && (
            <KeystoreSetupStep
              onComplete={() => {
                setSetup((prev) => ({ ...prev, keystoreVerified: true }));
                setStep("done");
              }}
              onSkip={() => {
                setStep("done");
              }}
              selectedAccount={
                setup.monerium?.accountAddress
                  ? {
                      address: setup.monerium.accountAddress,
                      chain: setup.monerium.accountChain || null,
                      signatories: setup.monerium.accountSignatories || null,
                    }
                  : null
              }
            />
          )}
        </div>

        {step === 1 && setup.odooConfigured && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip — Odoo already configured
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
