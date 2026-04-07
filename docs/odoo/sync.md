# Syncing a Web3 Account with an Odoo Journal

This document explains how to sync ERC-20 token transfers from a blockchain wallet into an Odoo accounting journal, enrich them with off-chain metadata (e.g. from Monerium), and automatically reconcile the resulting bank statement lines with invoices. The goal is to give another LLM or developer enough context to re-implement this pattern in other contexts.

## Overview

The sync pipeline has three sequential steps:

1. **Blockchain Sync** -- Fetch on-chain token transfers and import them as Odoo bank statement lines.
2. **Metadata Enrichment** (optional) -- Match statement lines to off-chain payment metadata (Monerium SEPA orders) to attach counterparty names, IBANs, and memos.
3. **Invoice Reconciliation** -- Match unreconciled statement lines to posted invoices and reconcile them in Odoo's accounting engine.

```
Blockchain (Etherscan/Blockscout)
        |
        v
  ERC-20 Token Transfers
        |
        v
  Odoo Bank Statement Lines  <-- Monerium orders (partner, IBAN, memo)
        |
        v
  Reconciled with Invoices
```

---

## Prerequisites

### Odoo Setup

- **Bank Journal**: Create a journal of type `bank` in Odoo. Link a `res.partner.bank` record whose `acc_number` is the wallet's Ethereum address (e.g. `0xabc...def`). The system finds the journal by looking up this bank account.
- **Suspense Account**: The journal needs a suspense account (`suspense_account_id`). The system auto-assigns one from `res.company.account_journal_suspense_account_id` if missing.
- **Currency**: The journal should use the same currency as the token (e.g. EUR for EURe).

### External Services

- **Etherscan-compatible API**: For fetching token transfers. The implementation uses Blockscout for Gnosis/Chiado chains, but any Etherscan-compatible API works.
- **Monerium API** (optional): For enriching on-chain transactions with SEPA counterparty data. Requires OAuth2 client credentials (`client_id`, `client_secret`).

### Odoo API Access

All Odoo interaction uses the **JSON-RPC** external API at `/jsonrpc`. The request format:

```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [database, uid, password, model, method, [domain], {options}]
  },
  "id": 1
}
```

Authentication uses `service: "common"`, `method: "login"`, returning a `uid` (user ID) used in all subsequent calls.

---

## Step 1: Blockchain Sync

### Fetching Transfers

Use an Etherscan-compatible API to get ERC-20 token transfers for the wallet address. The key API call:

```
GET /api?module=account&action=tokentx&address={wallet}&contractaddress={token}&startblock={block}&sort=asc
```

Parameters:
- `address`: The wallet address
- `contractaddress`: The ERC-20 token contract (e.g. EURe on Gnosis: `0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430`)
- `startblock`: For incremental sync, start from the last synced block

Each transfer has: `hash`, `from`, `to`, `value`, `timeStamp`, `tokenDecimal`, `logIndex`, `blockNumber`.

### Incremental vs Full Sync

- **First sync**: Fetch all transfers, create statement lines for each.
- **Subsequent syncs**: Read the latest synced block number from Odoo (stored in `narration` as `block:NNNNN`), fetch only transfers after that block.
- **Force re-sync**: Delete existing entries and re-import everything.

### Deduplication Key

Each transfer gets a unique key: `{chain}:{walletAddress}:{txHash}:{logIndex}`

Example: `gnosis:0xabc...def:0x123...789:42`

This key is stored in two places:
- `unique_import_id` on `account.bank.statement.line` -- Odoo's built-in dedup field for bank imports
- `ref` on the parent `account.move` -- visible as "Reference" in the UI

The `logIndex` is critical because a single transaction can contain multiple ERC-20 transfers (e.g. a swap). The wallet address is included so the same on-chain transfer can appear in two journals if both wallets are managed (e.g. internal transfer).

Before creating lines, batch-load all existing `unique_import_id` and `ref` values from the journal to skip duplicates without per-transfer queries.

### Creating Statement Lines

Each transfer becomes a line on `account.bank.statement.line`:

```typescript
{
  statement_id: monthlyStatementId,  // grouped by YYYY-MM
  journal_id: journalId,
  date: "2025-03-15",                // from transfer timestamp
  payment_ref: "EURe to 0xabc...def", // human-readable label
  amount: -150.00,                   // negative = outgoing, positive = incoming
  unique_import_id: "gnosis:0xwallet:0xtxhash:0",  // dedup key
  narration: "block:12345678",       // for incremental sync tracking
}
```

After creating the line, also write `ref` on the parent `account.move` (Odoo auto-creates a move for each statement line).

### Monthly Bank Statements

Statement lines are grouped into monthly `account.bank.statement` records (one per YYYY-MM). Find-or-create:

```
search account.bank.statement where journal_id = ? AND name = "2025-03"
```

If not found, create with `balance_start` set to the running balance at that point. After sync, update `balance_end_real` on each monthly statement.

### Direction and Amount

- Compare `tx.from` with the wallet address (case-insensitive)
- If `from == wallet`: outgoing, amount is negative
- If `from != wallet`: incoming, amount is positive
- Convert from token units: `parseFloat(value) / 10^decimals`, rounded to 2 decimals

---

## Step 2: Monerium Enrichment (Optional)

[Monerium](https://monerium.dev) is an e-money issuer that bridges SEPA bank transfers to EURe stablecoin minting/burning. When a SEPA transfer is sent via Monerium, they create an "order" that links the on-chain transaction hash to the SEPA counterparty details.

### Fetching Monerium Orders

```
GET /orders?address={walletAddress}
Authorization: Bearer {accessToken}
```

Each order contains:
- `kind`: `"redeem"` (outgoing SEPA/burn) or `"issue"` (incoming mint)
- `counterpart.identifier.iban`: counterparty IBAN
- `counterpart.details.name` / `companyName` / `firstName` + `lastName`: counterparty name
- `memo`: payment reference (often contains the invoice number)
- `meta.txHashes[]`: on-chain transaction hashes linked to this order

Build a `Map<txHash, Order>` for O(1) lookup during enrichment.

### Matching Orders to Statement Lines

For each statement line, extract the tx hash from `unique_import_id`:
- New format: `chain:address:0xhash:logIndex` -> extract `parts[2]`
- Old format: `chain:0xhash:logIndex` -> extract `parts[1]`
- Raw: `0xhash`

Also check `payment_ref` and `narration` for embedded `0x[a-fA-F0-9]{64}` hashes.

### Partner Resolution

When a Monerium order has counterparty info (name and/or IBAN):

1. **Find by IBAN**: Search `res.partner.bank` where `acc_number` matches the IBAN, get the `partner_id`.
2. **Find by name**: Search `res.partner` where `name` matches.
3. **Create if not found**: Create a new `res.partner` with the name, and optionally a `res.partner.bank` record with their IBAN.

Cache partner lookups (keyed by IBAN or name) to avoid repeated searches within the same sync run.

### Writing Enrichment Data

Update the statement line:
```typescript
{
  partner_id: resolvedPartnerId,     // link to Odoo partner
  payment_ref: order.memo,           // e.g. "BILL/2025/00042"
  transaction_details: JSON.stringify(order),  // full Monerium order as JSON
}
```

Only enrich lines that don't already have a `partner_id` set.

---

## Step 3: Invoice Reconciliation

Reconciliation links a bank statement line (a payment) to an invoice, marking the invoice as paid in Odoo's accounting.

### Finding Matching Invoices

For each **unreconciled** statement line (`is_reconciled = false`), attempt to find a matching invoice using a cascade of strategies, from most to least selective. Only match when exactly **one** invoice matches (ambiguous matches are skipped):

1. **IBAN + reference + amount**: Partner (resolved from IBAN via `res.partner.bank`) + invoice name/ref match + amount match within 0.01
2. **Reference + amount**: Invoice `name` or `ref` field matches a reference extracted from the memo + amount match
3. **Reference only**: Just the invoice name/ref match (useful when amounts differ slightly)
4. **IBAN + amount**: Partner match + amount match
5. **Amount only** (last resort): Exact amount match, limited to invoices from the last 60 days to avoid false positives

Reference extraction from memo supports Odoo sequence patterns like:
- `CHB-S/2025/12/0026` (with month segment)
- `CHB/2026/00187`, `BILL/2026/0042`, `INV/2026/0042`
- Vendor reference after ` - ` separator

Each strategy runs in two passes: first for **unpaid** invoices (`payment_state != "paid"`), then for **already-paid** invoices (if `forceReconcile` is enabled). This handles the case where an invoice was manually marked as paid but should be reconciled with the actual bank transaction.

### The Reconciliation Mechanism

Odoo's reconciliation works by matching journal entry lines (move lines) on receivable/payable accounts. Here's what happens under the hood:

#### 1. Get the invoice's receivable/payable lines

```
search account.move.line where
  move_id = {invoiceId}
  AND account_type IN ["asset_receivable", "liability_payable"]
  AND reconciled = false
```

These are the lines that represent "money owed" on the invoice.

#### 2. Get the statement line's suspense lines

When Odoo creates a bank statement line, it auto-generates a journal entry (`account.move`) with two lines:
- A **bank account line** (debit or credit on the bank account)
- A **suspense account line** (the counterpart, on the suspense account)

Find the suspense line:

```
search account.move.line where
  move_id = {statementMoveId}
  AND account_type NOT IN ["asset_cash", "liability_credit_card"]
  AND reconciled = false
```

#### 3. Rewrite the suspense line's account

Change the suspense line's `account_id` to match the invoice's receivable/payable account. This is necessary because Odoo can only reconcile lines on the **same account**.

```
write account.move.line [{suspenseLineId}] { account_id: invoiceAccountId }
```

#### 4. Call reconcile

```
account.move.line.reconcile([...invoiceLineIds, ...suspenseLineIds])
```

This creates a `account.full.reconcile` record linking the lines together, marks the invoice as paid, and marks the statement line as reconciled.

### Force Reconciliation

If an invoice is already marked as paid (e.g. manually or by a different payment), and `forceReconcile` is true:

1. Find reconciled lines on the invoice: `account.move.line` where `move_id = invoiceId` and `reconciled = true`
2. Call `account.move.line.remove_move_reconcile([lineIds])` to undo the existing reconciliation
3. Proceed with normal reconciliation against the bank statement line

### Reading Reconciliation Status

To check which statement lines are reconciled and what invoices they're linked to:

1. Fetch reconciled statement lines: `account.bank.statement.line` where `is_reconciled = true`
2. For each, get its `move_id` (the journal entry)
3. Find the move's receivable/payable lines with `full_reconcile_id` set
4. Find counterpart lines in the same reconciliation group (`full_reconcile_id`) but on a different move
5. Filter counterpart moves to actual invoices (`move_type IN ["in_invoice", "out_invoice"]`)

This gives you a `txHash -> invoice` mapping for display.

---

## Odoo Data Model Reference

### Key Models

| Model | Purpose |
|---|---|
| `account.journal` | Bank journal (type=bank), linked to a `res.partner.bank` |
| `account.bank.statement` | Monthly container for statement lines |
| `account.bank.statement.line` | Individual bank transaction (one per on-chain transfer) |
| `account.move` | Journal entry (auto-created for each statement line, also used for invoices) |
| `account.move.line` | Individual debit/credit line within a journal entry |
| `account.full.reconcile` | Links reconciled move lines together |
| `res.partner` | Counterparty (vendor/customer) |
| `res.partner.bank` | Bank account (IBAN or wallet address) linked to a partner |
| `ir.attachment` | File attachments on invoices (PDFs, etc.) |

### Key Fields

**`account.bank.statement.line`**:
- `unique_import_id`: Dedup key (`chain:address:txHash:logIndex`)
- `payment_ref`: Human-readable label, later overwritten with Monerium memo
- `amount`: Signed amount (negative = outgoing)
- `partner_id`: Link to counterparty (set during enrichment)
- `narration`: Stores `block:NNNNN` for incremental sync tracking
- `is_reconciled`: Whether this line has been matched to an invoice
- `move_id`: The auto-generated journal entry
- `transaction_details`: JSON blob with full Monerium order data

**`account.move`** (for invoices):
- `move_type`: `in_invoice` (vendor bill) or `out_invoice` (customer invoice)
- `state`: `posted` (confirmed), `draft`, `cancel`
- `payment_state`: `not_paid`, `paid`, `partial`, etc.
- `amount_total`: Total invoice amount
- `amount_residual`: Remaining unpaid amount
- `partner_id`: The vendor/customer
- `name`: Odoo sequence name (e.g. `BILL/2026/0042`)
- `ref`: External/vendor reference

**`account.move.line`** (for reconciliation):
- `account_type`: `asset_receivable`, `liability_payable`, `asset_cash`, etc.
- `reconciled`: Whether this line is part of a reconciliation
- `full_reconcile_id`: Links to `account.full.reconcile` when reconciled
- `balance`: Signed amount (debit - credit)

---

## Sync Modes

| Mode | When | Behavior |
|---|---|---|
| **Incremental** | `statementLines > 0` and no force flags | Reads latest `block:N` from narration, fetches transfers from that block onward |
| **Full** | First sync, `forceResync`, or `emptyJournal` | Fetches all transfers, optionally deletes existing entries first |
| **Dry run** | `dryRun: true` | Logs what would happen without writing to Odoo |

---

## Server-Sent Events (SSE) Protocol

The sync endpoint streams progress via SSE (`Content-Type: text/event-stream`). Event types:

| Event type | When |
|---|---|
| `status` | Status messages (authenticating, fetching, etc.) |
| `progress` | Per-transfer sync progress (`current`, `total`, `synced`, `skipped`) |
| `monerium-progress` | Per-line Monerium enrichment progress |
| `reconcile-progress` | Per-line reconciliation progress |
| `done` | Final summary with all counts |
| `error` | Fatal error |

The `done` event contains the full result:
```json
{
  "type": "done",
  "synced": 42,
  "skipped": 3,
  "moneriumEnriched": 30,
  "moneriumReconciled": 15,
  "reconciled": 8,
  "reconciledTotal": 20,
  "totalMoves": 45,
  "totalStatementLines": 45,
  "balance": "1234.56",
  "journal": { "id": 44, "name": "Gnosis Safe" }
}
```

---

## Implementation Checklist

If re-implementing this for a different context:

- [ ] **Dedup key format**: Decide on a unique key that handles multiple transfers per transaction (logIndex) and multiple wallets watching the same chain (wallet address in key).
- [ ] **Incremental sync**: Store the latest block number somewhere recoverable (we use `narration` on statement lines with `block:N`).
- [ ] **Monthly statements**: Odoo expects statement lines to belong to a `account.bank.statement`. Group by month.
- [ ] **Balance tracking**: Maintain `balance_start` and `balance_end_real` on statements for Odoo's balance verification.
- [ ] **Suspense account**: Ensure the journal has one, or reconciliation will fail silently.
- [ ] **Reconciliation account rewrite**: The suspense line's account must be changed to match the invoice's receivable/payable account before calling `reconcile`.
- [ ] **Unambiguous matching only**: Never auto-reconcile when multiple invoices match -- skip and let the user reconcile manually.
- [ ] **Force reconcile**: Support undoing existing reconciliations when re-reconciling with the correct bank transaction.
- [ ] **Rate limiting**: Etherscan/Blockscout APIs have rate limits. Add delays between requests.
- [ ] **Caching**: Cache blockchain API responses and Monerium orders to avoid re-fetching during retries.
