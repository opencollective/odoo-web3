# odoo-web3

Web app to sync blockchain token transfers (EURe on Gnosis) into Odoo bank journals, enrich them with Monerium SEPA metadata, and auto-reconcile with invoices.

## Features

- Sync ERC-20 token transfers from blockchain to Odoo bank statement lines
- Incremental sync (only fetches new transfers since last block)
- Enrich transactions with Monerium counterparty data (name, IBAN, memo)
- Auto-reconcile bank statement lines with matching invoices
- Web UI for managing invoices, bills, and transactions
- Batch payments via Gnosis Safe

## Quick Start

```bash
# Install dependencies
bun install

# Copy and edit environment variables
cp .env.example .env.test   # for development/sandbox
cp .env.example .env         # for production

# Start dev server (sandbox mode, watches for changes)
bun dev

# Start production server
bun run server

# Run tests
bun test
```

The server runs at `http://localhost:8000`.

## Environment Variables

Only `ENV` is required to start the server. Everything else is optional or configurable via the browser UI.

| Variable | Required | Description |
|---|---|---|
| `ENV` | No | `production` or `sandbox` (default: `sandbox`). Controls which blockchain and Monerium environment to use. |
| `MONERIUM_CLIENT_ID` | For sync | Monerium API client ID for SEPA metadata enrichment. |
| `MONERIUM_CLIENT_SECRET` | For sync | Monerium API client secret. |
| `PRIVATE_KEY_ENCRYPTED` | For payments | Encrypted private key for server-side signing. See [Security](#security). |
| `ODOO_URL` | No | Odoo instance URL. Falls back to browser localStorage. |
| `ODOO_DATABASE` | No | Odoo database name. Falls back to browser localStorage. |
| `ODOO_USERNAME` | No | Odoo username. Falls back to browser localStorage. |
| `ODOO_PASSWORD` | No | Odoo password. Falls back to browser localStorage. |
| `ETHEREUM_ETHERSCAN_API_KEY` | No | Only needed for Etherscan v2 API. Blockscout (default for Gnosis/Chiado) doesn't require it. |
| `SAFE_ADDRESS` | For payments | Gnosis Safe contract address. |
| `SAFE_RPC_URL` | No | RPC endpoint override (defaults to public Gnosis/Chiado RPC). |

**Odoo credentials** can be provided three ways (in order of precedence):
1. Query parameters on API requests
2. Environment variables
3. Browser localStorage (set via the Settings page in the UI)

See `.env.example` for a documented template.

## Docker

```bash
# Build
docker build -t odoo-web3 .

# Run
docker run -d --name odoo-web3 -p 8000:8000 --env-file .env odoo-web3

# Check logs
docker logs -f odoo-web3
```

See [docs/deploy.md](docs/deploy.md) for Coolify deployment instructions.

## How It Works

See [docs/odoo/sync.md](docs/odoo/sync.md) for a detailed technical guide on the sync pipeline (blockchain sync, Monerium enrichment, invoice reconciliation).

### Architecture

```
public/js/          # React frontend (JSX, transpiled server-side via SWC)
src/
  lib/
    odoo.ts         # Odoo JSON-RPC client (sync, enrichment, reconciliation)
    etherscan.ts    # Blockchain explorer API client (Etherscan/Blockscout)
    monerium.ts     # Monerium API client
    safe.ts         # Gnosis Safe transaction signing
    cache.ts        # File-based cache for API responses
  server/
    index.ts        # HTTP server + static file serving
    api/
      odoo/         # Odoo API endpoints (invoices, sync, reconcile, etc.)
      monerium/     # Monerium API endpoints (orders, transfers, etc.)
      opencollective/ # Open Collective API proxy
tests/              # Bun test suite (uses sandbox environment)
```

## Testing

```bash
# Run all tests (uses .env.test / sandbox environment)
bun test

# Run a specific test
bun test tests/get-invoices.test.ts
```

## Security

### Private key (encrypted at rest)

The private key is **never stored in plaintext**. It is encrypted at rest using AES-256-GCM with a passphrase-derived key (PBKDF2, 100k iterations), and only decrypted into memory when an admin submits the passphrase after each server start.

```bash
# 1. Encrypt your private key (interactive prompt)
bun run scripts/encrypt-key.ts
# Outputs: base64salt:base64iv:base64ciphertext:base64tag

# 2. Set the encrypted value as an env var
PRIVATE_KEY_ENCRYPTED=<output from step 1>

# 3. Start the server — it starts in "locked" mode
bun run server
# 🔒 Signing: PRIVATE_KEY_ENCRYPTED configured — unlock required via /api/unlock

# 4. Unlock by submitting the passphrase over HTTPS
curl -X POST https://yourapp.com/api/unlock \
  -H 'Content-Type: application/json' \
  -d '{"passphrase": "your-passphrase"}'

# 5. On process restart, the key is wiped from memory — unlock again
```

**Two signing modes**:
1. **WalletConnect** -- no server key at all, browser wallet signs each transaction
2. **Encrypted key** (`PRIVATE_KEY_ENCRYPTED`) -- encrypted at rest, decrypted on demand after passphrase unlock, wiped on restart

API endpoints:
- `GET /api/unlock` -- check lock status (`{ locked, needsUnlock }`)
- `POST /api/unlock` -- submit `{ "passphrase": "..." }` to decrypt the key into memory
- `POST /api/lock` -- wipe the decrypted key from memory

When locked, signing endpoints return HTTP 423.

### Odoo credentials in localStorage

Odoo credentials entered via the Settings page are stored in the browser's `localStorage`. This means:
- They persist across sessions (convenient for a self-hosted internal tool)
- They are readable by any JavaScript running on the same origin

This is acceptable because the app serves no third-party scripts (no analytics, ads, or CDN dependencies), so there is no XSS vector. If you're embedding this in a context with untrusted scripts, consider moving Odoo credentials to server-side env vars instead.

## License

MIT
