import { getStorageKey } from "../config.js";

const { useState, useEffect } = React;

export function OdooDoctorPage({ navigate }) {
  const [journalId, setJournalId] = useState("");
  const [limit, setLimit] = useState("100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedLines, setExpandedLines] = useState({});

  // Load saved connection settings
  const getConnectionParams = () => {
    try {
      const stored = localStorage.getItem(getStorageKey("odoo_connection"));
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  };

  const runDiagnostic = async () => {
    const jid = parseInt(journalId, 10);
    if (!jid || jid <= 0) {
      setError("Enter a valid journal ID");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const conn = getConnectionParams();
    const params = new URLSearchParams();
    if (conn.url) params.set("url", conn.url);
    if (conn.db) params.set("db", conn.db);
    if (conn.username) params.set("username", conn.username);
    if (conn.password) params.set("password", conn.password);

    try {
      const res = await fetch(`/api/odoo/doctor?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalId: jid,
          limit: parseInt(limit, 10) || 0,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLine = (id) => {
    setExpandedLines((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const odooLink = (model, id) => {
    if (!result?.odooUrl) return null;
    return `${result.odooUrl}/web#id=${id}&model=${model}&view_type=form`;
  };

  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) return "—";
    const n = parseFloat(amount);
    const sign = n >= 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}`;
  };

  // Find which lines are duplicates
  const getDuplicateIds = () => {
    if (!result) return new Set();
    const ids = new Set();
    for (const lineIds of Object.values(result.duplicates.byImportId)) {
      for (const id of lineIds) ids.add(id);
    }
    for (const lineIds of Object.values(result.duplicates.byPaymentRef)) {
      for (const id of lineIds) ids.add(id);
    }
    return ids;
  };

  const duplicateIds = result ? getDuplicateIds() : new Set();

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: 20 }}>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          style={{ color: "#6366f1", textDecoration: "none" }}
        >
          ← Home
        </a>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>
        Journal Doctor
      </h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              marginBottom: 4,
              color: "#666",
            }}
          >
            Journal ID
          </label>
          <input
            type="number"
            value={journalId}
            onChange={(e) => setJournalId(e.target.value)}
            placeholder="e.g. 16"
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: 6,
              width: 120,
              fontSize: 14,
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              marginBottom: 4,
              color: "#666",
            }}
          >
            Limit (0 = all)
          </label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="100"
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: 6,
              width: 100,
              fontSize: 14,
            }}
          />
        </div>
        <button
          onClick={runDiagnostic}
          disabled={loading}
          style={{
            padding: "8px 20px",
            background: loading ? "#999" : "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          {loading ? "Checking..." : "Run Diagnostic"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div>
          {/* Summary */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>
              {result.journal.name}{" "}
              <span style={{ color: "#999", fontSize: 14 }}>
                (ID: {result.journal.id})
              </span>
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#666" }}>
                  Statement Lines
                </div>
                <div style={{ fontSize: 20, fontWeight: "bold" }}>
                  {result.totalStatementLines}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: "#666" }}>Total Moves</div>
                <div style={{ fontSize: 20, fontWeight: "bold" }}>
                  {result.totalMoves}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: "#666" }}>Fetched</div>
                <div style={{ fontSize: 20, fontWeight: "bold" }}>
                  {result.fetchedLines}
                  {result.limited && (
                    <span style={{ fontSize: 13, color: "#999" }}>
                      {" "}
                      (limited)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Duplicates */}
          {(result.duplicates.countByImportId > 0 ||
            result.duplicates.countByPaymentRef > 0) && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <h3
                style={{ fontSize: 16, marginBottom: 8, color: "#92400e" }}
              >
                Duplicates Found
              </h3>
              {result.duplicates.countByImportId > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <strong>By unique_import_id:</strong>{" "}
                  {result.duplicates.countByImportId} duplicate groups
                  <ul
                    style={{
                      margin: "4px 0",
                      paddingLeft: 20,
                      fontSize: 13,
                    }}
                  >
                    {Object.entries(result.duplicates.byImportId).map(
                      ([key, ids]) => (
                        <li key={key}>
                          <code>{key}</code> → IDs: {ids.join(", ")} (
                          {ids.length}x)
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
              {result.duplicates.countByPaymentRef > 0 && (
                <div>
                  <strong>By payment_ref:</strong>{" "}
                  {result.duplicates.countByPaymentRef} duplicate groups
                  <ul
                    style={{
                      margin: "4px 0",
                      paddingLeft: 20,
                      fontSize: 13,
                    }}
                  >
                    {Object.entries(result.duplicates.byPaymentRef).map(
                      ([key, ids]) => (
                        <li key={key}>
                          <code>{key}</code> → IDs: {ids.join(", ")} (
                          {ids.length}x)
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result.duplicates.countByImportId === 0 &&
            result.duplicates.countByPaymentRef === 0 && (
              <div
                style={{
                  background: "#d1fae5",
                  border: "1px solid #10b981",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 20,
                  color: "#065f46",
                }}
              >
                No duplicates found.
              </div>
            )}

          {/* Entries list */}
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>
            Entries ({result.fetchedLines})
          </h3>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {result.lines.map((line, idx) => {
              const isDuplicate = duplicateIds.has(line.id);
              const isExpanded = expandedLines[line.id];
              return (
                <div
                  key={line.id}
                  style={{
                    borderBottom:
                      idx < result.lines.length - 1
                        ? "1px solid #e2e8f0"
                        : "none",
                    background: isDuplicate
                      ? "#fef3c7"
                      : idx % 2 === 0
                      ? "#fff"
                      : "#f8fafc",
                  }}
                >
                  <div
                    onClick={() => toggleLine(line.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 14px",
                      cursor: "pointer",
                      gap: 12,
                      fontSize: 14,
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        fontSize: 11,
                        color: "#999",
                        flexShrink: 0,
                      }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <span
                      style={{
                        width: 80,
                        flexShrink: 0,
                        color: "#666",
                        fontSize: 13,
                      }}
                    >
                      {line.date}
                    </span>
                    <span
                      style={{
                        width: 80,
                        flexShrink: 0,
                        textAlign: "right",
                        fontWeight: "bold",
                        fontFamily: "monospace",
                        color:
                          parseFloat(line.amount) >= 0
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      {formatAmount(line.amount)}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {line.payment_ref || "—"}
                    </span>
                    {line.partner_id && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#6366f1",
                          flexShrink: 0,
                        }}
                      >
                        {line.partner_id[1]}
                      </span>
                    )}
                    {isDuplicate && (
                      <span
                        style={{
                          fontSize: 11,
                          background: "#f59e0b",
                          color: "#fff",
                          padding: "1px 6px",
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        DUP
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        color: "#999",
                        flexShrink: 0,
                      }}
                    >
                      #{line.id}
                    </span>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        padding: "8px 14px 14px 42px",
                        fontSize: 13,
                        background: "rgba(0,0,0,0.02)",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      <table
                        style={{
                          borderCollapse: "collapse",
                          width: "100%",
                        }}
                      >
                        <tbody>
                          <MetaRow
                            label="Statement Line ID"
                            value={line.id}
                            link={odooLink(
                              "account.bank.statement.line",
                              line.id
                            )}
                          />
                          <MetaRow label="Date" value={line.date} />
                          <MetaRow
                            label="Amount"
                            value={formatAmount(line.amount)}
                          />
                          <MetaRow
                            label="payment_ref"
                            value={line.payment_ref}
                            mono
                          />
                          <MetaRow
                            label="unique_import_id"
                            value={line.unique_import_id}
                            mono
                          />
                          {line.partner_id && (
                            <MetaRow
                              label="Partner"
                              value={`${line.partner_id[1]} (#${line.partner_id[0]})`}
                              link={odooLink(
                                "res.partner",
                                line.partner_id[0]
                              )}
                            />
                          )}
                          {line.move_id && (
                            <MetaRow
                              label="Move"
                              value={`${line.move_id[1]} (#${line.move_id[0]})`}
                              link={odooLink(
                                "account.move",
                                line.move_id[0]
                              )}
                            />
                          )}
                          {line.statement_id && (
                            <MetaRow
                              label="Statement"
                              value={`${line.statement_id[1] || ""} (#${line.statement_id[0]})`}
                              link={odooLink(
                                "account.bank.statement",
                                line.statement_id[0]
                              )}
                            />
                          )}
                          <MetaRow
                            label="Created"
                            value={line.create_date}
                          />
                          {line.narration && (
                            <MetaRow label="Narration" value={line.narration} />
                          )}
                          {line.transaction_details && (
                            <MetaRow
                              label="Transaction Details"
                              value={line.transaction_details}
                              pre
                            />
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {result.lines.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", color: "#999" }}>
                No entries found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, link, mono, pre }) {
  if (value === null || value === undefined || value === false) return null;

  const displayValue = pre ? (
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        fontSize: 12,
        maxHeight: 200,
        overflow: "auto",
        background: "#f1f5f9",
        padding: 8,
        borderRadius: 4,
      }}
    >
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  ) : mono ? (
    <code style={{ fontSize: 12, wordBreak: "break-all" }}>{value}</code>
  ) : (
    value
  );

  return (
    <tr>
      <td
        style={{
          padding: "3px 12px 3px 0",
          color: "#666",
          verticalAlign: "top",
          whiteSpace: "nowrap",
          width: 160,
        }}
      >
        {label}
      </td>
      <td style={{ padding: "3px 0", wordBreak: "break-word" }}>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#6366f1" }}
          >
            {displayValue}
          </a>
        ) : (
          displayValue
        )}
      </td>
    </tr>
  );
}
