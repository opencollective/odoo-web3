import {
  getOpenCollectiveApiKey,
  getOCExpenseImportedId,
  isOCExpenseImported,
  markOCExpenseImported,
} from "../utils/storage.js";
import {
  fetchHostExpenses,
  getExpenseIBAN,
  getExpenseAccountHolder,
  getExpensePayoutAddress,
  getExpenseBIC,
  getExpensePayoutEmail,
  formatExpenseAmount,
  getStatusColor,
} from "../services/opencollective.js";
import { ExternalLinkIcon, LoaderIcon } from "./icons.jsx";

const { useState, useEffect, useCallback, useMemo } = React;

function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString();
}

export function ImportOpenCollectivePage({ navigate }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [odooUrl, setOdooUrl] = useState("");

  // Per-expense import state: { [ocId]: { status: "idle"|"running"|"done"|"error", error?, odooExpenseId?, odooEmployeeId? } }
  const [importState, setImportState] = useState({});

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHostExpenses({
        hostSlug: "citizenspring-asbl",
        limit: 100,
        offset: 0,
        status: "APPROVED",
      });
      setExpenses(result.expenses?.nodes || []);
    } catch (err) {
      console.error("Failed to fetch OC expenses:", err);
      setError(err.message || "Failed to fetch expenses");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Pre-seed importState from localStorage so already-imported rows render with
  // the Odoo link on mount.
  useEffect(() => {
    setImportState((prev) => {
      const next = { ...prev };
      for (const exp of expenses) {
        if (next[exp.id]) continue;
        const odooId = getOCExpenseImportedId(exp.id);
        if (odooId) {
          next[exp.id] = { status: "done", odooExpenseId: odooId };
        }
      }
      return next;
    });
  }, [expenses]);

  // Ready-to-pay (has IBAN + sufficient balance). Imported ones render at the bottom.
  const { pending, imported, skipped } = useMemo(() => {
    const pending = [];
    const imported = [];
    const skipped = [];
    for (const exp of expenses) {
      const iban = getExpenseIBAN(exp);
      const balance = exp.account?.stats?.balance?.valueInCents || 0;
      if (!iban || balance < (exp.amount || 0)) {
        skipped.push(exp);
        continue;
      }
      if (isOCExpenseImported(exp.id)) {
        imported.push(exp);
      } else {
        pending.push(exp);
      }
    }
    return { pending, imported, skipped };
  }, [expenses]);

  const setRowState = (ocId, patch) => {
    setImportState((prev) => ({
      ...prev,
      [ocId]: { ...(prev[ocId] || { status: "idle" }), ...patch },
    }));
  };

  const handleImport = async (expense, collectiveName, parentCollective) => {
    const ocId = expense.id;
    setRowState(ocId, { status: "running", error: null });

    try {
      const accountHolder = getExpenseAccountHolder(expense);
      const lookupName = accountHolder?.name || expense.payee?.name || "";
      const ocLegacyId = expense.legacyId || expense.id;
      const iban = getExpenseIBAN(expense);

      // 1) Lookup existing employee + expense in Odoo.
      const lookupParams = new URLSearchParams({
        payeeName: lookupName,
        ocExpenseId: String(ocLegacyId),
      });
      const lookupRes = await fetch(`/api/odoo/expense-sync?${lookupParams}`);
      if (!lookupRes.ok) {
        const data = await lookupRes.json();
        throw new Error(data.error || "Odoo lookup failed");
      }
      const lookup = await lookupRes.json();
      if (!odooUrl && lookup.odooUrl) setOdooUrl(lookup.odooUrl);

      let employeeId = lookup.employee?.id;

      // 2) Create the employee if missing.
      if (!employeeId) {
        const address = getExpensePayoutAddress(expense);
        const department = collectiveName
          ? parentCollective
            ? `${parentCollective.name} › ${collectiveName}`
            : collectiveName
          : undefined;
        const createEmployeeRes = await fetch("/api/odoo/expense-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create-employee",
            name: lookupName,
            iban: iban || undefined,
            bic: getExpenseBIC(expense) || undefined,
            accountHolderName: lookupName,
            department,
            email: getExpensePayoutEmail(expense) || expense.payee?.email || undefined,
            address: address || undefined,
          }),
        });
        const employeeData = await createEmployeeRes.json();
        if (!createEmployeeRes.ok)
          throw new Error(employeeData.error || "Failed to create employee");
        employeeId = employeeData.employee?.id;
        if (!employeeId) throw new Error("Employee creation returned no id");
      }

      // 3) Create the expense in Odoo. Skip if already exists (409 → reuse id).
      const items = (expense.items && expense.items.length > 0)
        ? expense.items.map((item) => ({
            description: item.description || expense.description,
            amount: item.amount || expense.amount,
            date: expense.createdAt?.split("T")[0],
            attachments: item.url
              ? [{ url: item.url, name: item.description || "Receipt" }]
              : [],
          }))
        : [
            {
              description: expense.description,
              amount: expense.amount,
              date: expense.createdAt?.split("T")[0],
              attachments: [],
            },
          ];
      const attachments = (expense.attachedFiles || [])
        .filter((f) => f.url)
        .map((f) => ({ url: f.url, name: f.name || "Attachment" }));

      const slug = expense.account?.slug || "";
      const ocExpenseUrl = slug
        ? `https://opencollective.com/${slug}/expenses/${ocLegacyId}`
        : undefined;
      const createExpenseRes = await fetch("/api/odoo/expense-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-expense",
          employeeId,
          description: expense.description,
          ocExpenseId: ocLegacyId,
          ocExpenseUrl,
          items,
          attachments,
          currency: expense.currency,
          ocApiKey: getOpenCollectiveApiKey(),
        }),
      });
      const expenseData = await createExpenseRes.json();
      const isConflict = createExpenseRes.status === 409;
      if (!createExpenseRes.ok && !isConflict)
        throw new Error(expenseData.error || "Failed to create expense");

      const odooExpenseId =
        expenseData.expense?.id || expenseData.expenseIds?.[0];
      if (!odooExpenseId) throw new Error("Expense creation returned no id");

      markOCExpenseImported(ocId, odooExpenseId);
      setRowState(ocId, {
        status: "done",
        odooExpenseId,
        odooEmployeeId: employeeId,
      });
    } catch (err) {
      console.error("Import failed:", err);
      setRowState(ocId, { status: "error", error: err.message || String(err) });
    }
  };

  const resolvedOdooUrl = odooUrl || "";

  const renderRow = (expense) => {
    const ocId = expense.id;
    const row = importState[ocId] || { status: "idle" };
    const accountHolder = getExpenseAccountHolder(expense);
    const collective = expense.account;
    const collectiveName = collective?.name;
    const parentCollective = collective?.parent;
    const odooExpenseUrl =
      resolvedOdooUrl && row.odooExpenseId
        ? `${resolvedOdooUrl}/web#id=${row.odooExpenseId}&model=hr.expense&view_type=form`
        : null;
    const ocExpenseUrl = `https://opencollective.com/${collective?.slug || ""}/expenses/${expense.legacyId}`;

    return (
      <div
        key={ocId}
        className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate max-w-xs md:max-w-md">
              {accountHolder?.name || expense.payee?.name || "Unknown payee"}
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(expense.status)}`}
            >
              {expense.status}
            </span>
            {collectiveName && (
              <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                {parentCollective ? `${parentCollective.name} › ` : ""}
                {collectiveName}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>{formatDate(expense.createdAt)}</span>
            <span className="truncate max-w-[400px]">{expense.description}</span>
          </div>
        </div>
        <span className="font-semibold text-gray-900 whitespace-nowrap">
          {formatExpenseAmount(expense)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={ocExpenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 px-2 py-1 border border-blue-100 rounded"
          >
            <ExternalLinkIcon />
            <span>OC</span>
          </a>
          {row.status === "done" ? (
            <a
              href={odooExpenseUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-800 border border-green-200 px-3 py-1.5 rounded font-medium hover:bg-green-100"
            >
              <span>Imported</span>
              {odooExpenseUrl && <ExternalLinkIcon />}
            </a>
          ) : row.status === "running" ? (
            <span className="inline-flex items-center gap-2 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded">
              <LoaderIcon />
              <span>Importing...</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleImport(expense, collectiveName, parentCollective)}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Import
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate("/expenses")}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            &larr; Back to Expenses
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Import from Open Collective
          </h1>
          <p className="text-gray-600 mt-1">
            Create employee + expense in Odoo for each ready-to-pay Open
            Collective expense.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoaderIcon />
          </div>
        )}

        {!loading && pending.length === 0 && imported.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No approved expenses ready to import from Open Collective.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              To import ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map((exp) => renderRow(exp))}
              {pending
                .map((exp) => importState[exp.id])
                .filter((row) => row?.status === "error")
                .map((row, i) => (
                  <div
                    key={`err-${i}`}
                    className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2"
                  >
                    {row.error}
                  </div>
                ))}
            </div>
          </div>
        )}

        {imported.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Already imported ({imported.length})
            </h2>
            <div className="space-y-2">
              {imported.map((exp) => renderRow(exp))}
            </div>
          </div>
        )}

        {skipped.length > 0 && (
          <p className="mt-6 text-xs text-gray-500">
            {skipped.length} approved expense{skipped.length !== 1 ? "s" : ""}{" "}
            skipped — missing IBAN or insufficient collective balance.
          </p>
        )}
      </div>
    </div>
  );
}
