# odoo-web3

Sync blockchain token transfers to Odoo Bank Journals with automatic de-duplication and monthly statement grouping.

## Features

- 🔍 **Fetch token transfers** from blockchain explorers (Etherscan, GnosisScan, etc.)
- 🪙 **Retrieve token metadata** (name, symbol, decimals) directly from blockchain using viem
- 🏦 **Auto-create bank journals** in Odoo for each token/wallet combination
- 📅 **Monthly statement grouping** - organize transactions by month
- ✅ **Perfect de-duplication** using `txHash:logIndex:tokenAddress` as unique reference
- 🔒 **Smart validation** - keeps current month open, validates past months
- 💰 **Accurate balances** - properly handles incoming/outgoing transfers

## Setup

### Environment Variables

Create a `.env` file with:

```bash
# Ethereum Etherscan API Key
ETHEREUM_ETHERSCAN_API_KEY=your_etherscan_api_key

# Odoo Configuration
ODOO_URL=https://your-odoo-instance.com
ODOO_DATABASE=your_database
ODOO_USERNAME=your_username
ODOO_API_KEY=your_api_key
```

### Installation

```bash
# This is a Deno project, no installation needed
deno --version
```

## Usage

### Basic Example

```typescript
import { recordTokenTransfers } from "./src/lib/odoo.ts";
import { EtherscanClient } from "./src/lib/etherscan.ts";

const chainId = 100; // Gnosis Chain
const walletAddress = "0x6fDF0AaE33E313d9C98D2Aa19Bcd8EF777912CBf";
const tokenAddress = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430"; // EURe

// Fetch transfers from blockchain
const client = new EtherscanClient(chainId);
const transfers = await client.getAllTokenTransfers(
  walletAddress,
  { EURe: { address: tokenAddress } }
);

// Record to Odoo
await recordTokenTransfers({
  chainId,
  walletAddress,
  tokenAddress,
  transfers,
});
```

### With Existing Journal

```typescript
await recordTokenTransfers({
  chainId,
  walletAddress,
  tokenAddress,
  transfers,
  journalId: 42, // Use existing journal
});
```

## How It Works

### 1. Token Metadata Retrieval

The library automatically fetches token information from the blockchain:

```typescript
const tokenInfo = await getTokenInfo(chainId, tokenAddress);
// Returns: { address, name, symbol, decimals }
```

### 2. Journal Management

- Automatically creates journals with code: `{SYMBOL}_{wallet_prefix}`
- Example: `EURe_0x6fDF` for EURe token at wallet 0x6fDF...
- Reuses existing journals on subsequent runs

### 3. Monthly Statement Grouping

Transfers are organized into monthly statements:

- **Statement naming**: `{SYMBOL} - YYYY-MM`
- **Example**: "EURe - 2024-09" for September 2024 transfers
- **Current month**: Kept open for new transactions
- **Past months**: Automatically validated/posted

### 4. De-duplication

Each transfer is uniquely identified using:

```
{transactionHash}:{transactionIndex}:{tokenAddress}
```

This ensures:
- ✅ No duplicate entries
- ✅ Safe to run multiple times
- ✅ Handles re-orgs properly

### 5. Amount Calculation

- **Incoming transfers**: Positive amounts
- **Outgoing transfers**: Negative amounts
- **Decimals**: Properly handled (e.g., 1e18 for 18-decimal tokens)

## Testing

Run the test suite:

```bash
# Test token info retrieval
deno test tests/lib.odoo.test.ts --allow-net --allow-env

# Test Etherscan integration
deno test tests/lib.etherscan.test.ts --allow-net --allow-env
```

Test coverage:
- ✅ Token metadata from blockchain
- ✅ Odoo authentication
- ✅ Journal creation
- ✅ Transfer recording with de-duplication
- ✅ Monthly statement grouping
- ✅ Current month validation logic
- ✅ Balance calculations

## Architecture

```
src/
├── lib/
│   ├── etherscan.ts    # Blockchain explorer API client
│   └── odoo.ts         # Odoo XML-RPC client + recording logic
tests/
├── lib.etherscan.test.ts  # Etherscan tests
└── lib.odoo.test.ts       # Odoo integration tests
```

## Odoo Models Used

### `account.journal`
- Type: `bank`
- Code: `{SYMBOL}_{wallet_prefix}`
- Auto-created per token/wallet

### `account.bank.statement`
- Name: `{SYMBOL} - YYYY-MM`
- One per month per journal
- Auto-validated for past months

### `account.bank.statement.line`
- **payment_ref**: Unique identifier for de-duplication
- **date**: Transaction timestamp
- **amount**: Signed amount (+ incoming, - outgoing)
- **partner_name**: Sender/recipient address
- **narration**: Human-readable description with tx hash

## Supported Chains

Currently configured for:
- ✅ Gnosis Chain (chainId: 100)

To add more chains, update the `chainMap` in `getTokenInfo()`:

```typescript
const chainMap: Record<number, typeof gnosis> = {
  100: gnosis,
  1: mainnet, // Add Ethereum mainnet
  137: polygon, // Add Polygon
};
```

## Error Handling

The library handles:
- ❌ Missing environment variables → Throws clear error
- ❌ Invalid token address → Viem contract error
- ❌ Odoo authentication failure → XML-RPC fault
- ❌ Duplicate transfers → Silently skips with log
- ❌ API rate limits → Built-in delays (Etherscan)

## Web Server & Invoice Viewer

This project includes a web server with a React-based UI for viewing and managing Odoo invoices.

### Running the Server

```bash
# Start the server
deno task server

# Or with custom port
PORT=3000 deno run --allow-net --allow-read --allow-env server.ts
```

The server will start at `http://localhost:8000`

### API Endpoints

#### GET `/api/invoices`

Fetch invoices from Odoo with optional filters.

#### GET `/api/odoo/authenticate`

Authenticate with Odoo and obtain a `session_id` for subsequent requests.

**Security**: Only allows URLs from `*.odoo.com` domains.

**Query Parameters:**
- `url` - Odoo URL (required, must be from *.odoo.com)
- `db` - Database name (required)
- `username` - Odoo username (required)
- `password` - Odoo password (required)

**Example:**
```bash
curl "http://localhost:8000/api/odoo/authenticate?url=https://yourcompany.odoo.com&db=mydb&username=user&password=pass"
```

**Returns:**
```json
{
  "success": true,
  "session_id": "abc123...",
  "user_context": {...},
  "uid": 2
}
```

---

#### GET `/api/pdf/view`

PDF proxy endpoint to work around CORS restrictions when displaying PDFs inline.

**Security**: Only allows URLs from `*.odoo.com` domains.

**Query Parameters:**
- `url` - The Odoo PDF URL to proxy (required, must be from *.odoo.com)
- `session_id` - Odoo session ID from `/api/odoo/authenticate` (required)

**Example:**
```bash
# First, authenticate
SESSION_ID=$(curl -s "http://localhost:8000/api/odoo/authenticate?url=https://yourcompany.odoo.com&db=mydb&username=user&password=pass" | jq -r '.session_id')

# Then, fetch the PDF
curl "http://localhost:8000/api/pdf/view?url=https://yourcompany.odoo.com/report/pdf/account.report_invoice/123&session_id=$SESSION_ID"
```

**Returns**: PDF file with CORS headers enabled

---

#### GET `/api/invoices` - Parameters

**Query Parameters:**
- `type` - Invoice direction: `all`, `incoming`, or `outgoing` (default: `all`)
- `limit` - Number of invoices to fetch (default: `10`)
- `since` - Filter by start date (inclusive from 00:00:00, accepts both `YYYYMMDD` and `YYYY-MM-DD` formats)
- `until` - Filter by end date (inclusive until 23:59:59, accepts both `YYYYMMDD` and `YYYY-MM-DD` formats)
- `url` - Odoo URL (optional if `ODOO_URL` env var is set)
- `db` - Database name (optional if `ODOO_DATABASE` env var is set)
- `username` - Username (optional if `ODOO_USERNAME` env var is set)
- `password` - Password (optional if `ODOO_PASSWORD` env var is set)

**Examples:**
```bash
# Using YYYY-MM-DD format with since
curl "http://localhost:8000/api/invoices?type=incoming&limit=20&since=2025-01-01"

# Using YYYYMMDD format with until
curl "http://localhost:8000/api/invoices?type=incoming&limit=20&until=20241231"

# Date range with both since and until
curl "http://localhost:8000/api/invoices?since=20241001&until=20241231"
```

**Response:**
```json
{
  "invoices": [
    {
      "id": 123,
      "name": "BILL/2025/001",
      "ref": "INV-2025-001",
      "date": "2025-01-15",
      "invoice_date": "2025-01-15",
      "invoice_date_due": "2025-02-14",
      "state": "posted",
      "payment_state": "paid",
      "move_type": "in_invoice",
      "partner_name": "Supplier Name",
      "bank_account_number": "BE12345678901234",
      "amount_total": 1234.56,
      "amount_residual": 0,
      "pdf_url": "https://odoo.com/web/content/12345",
      "invoice_line_ids": [
        {
          "id": 456,
          "name": "Product or Service Description",
          "quantity": 2.0,
          "price_unit": 100.0,
          "price_subtotal": 200.0,
          "price_total": 210.0,
          "product_id": [789, "Product Name"],
          "account_id": [100, "Revenue Account"],
          "tax_ids": [10],
          "discount": 0
        }
      ]
    }
  ]
}
```

### Web Interface Features

The web interface provides:

- 📋 **Invoice List View** - Grid layout with invoice cards
- 🔍 **Smart Filtering** - Filter by type (incoming/outgoing), date range (since/until), and limit
- 💰 **Payment Status** - Visual indicators for payment state (paid, partial, not_paid, etc.)
- 📅 **Due Date Tracking** - Displays invoice due dates when available
- 👁️ **PDF Preview** - Inline PDF viewer with CORS proxy support for seamless viewing
- 📥 **Download PDFs** - Direct download links for invoices
- 🔗 **Open in Odoo** - Direct links to view invoices in Odoo web interface from sidebar and cards
- 📦 **Line Items Display** - Shows line items directly on invoice cards with description and amount
- 🎨 **Modern UI** - Tailwind CSS with responsive design
- 🔐 **Flexible Auth** - Use environment variables or manual input
- 💾 **Connection Persistence** - Settings saved to browser localStorage
- 🔒 **Secure Storage** - Connection settings hidden after first setup

### Environment Variables

```bash
# Required for API access
ODOO_URL=https://your-odoo-instance.com
ODOO_DATABASE=your_database
ODOO_USERNAME=your_username
ODOO_PASSWORD=your_password
```

If these are not set, you can provide them via the web interface or API query parameters.

### Connection Settings Management

The web interface automatically saves your connection settings to browser localStorage:

1. **First Visit**: Connection settings panel is displayed
2. **Enter Credentials**: Fill in URL, database, username, and password
3. **Save & Connect**: Settings are saved to localStorage
4. **Next Visits**: Settings are automatically loaded, panel is hidden
5. **Edit Settings**: Click the "Edit" button in the header to modify
6. **Disconnect**: Click "Disconnect" to clear saved settings

**Note**: Connection settings are stored in your browser's localStorage and never sent to any third-party servers. They are only used for direct API calls to your Odoo instance.

### Invoice Card Details

Each invoice card displays:
- Invoice number and status badge
- Invoice date and due date (when available)
- **Payment status** with color-coded badge:
  - 🟢 Green: Paid
  - 🟡 Yellow: Partial payment
  - 🔴 Red: Not paid
  - ⚪ Gray: Other states
- Partner name
- Bank account number (for incoming invoices only)
- **Line items** - Each line shows description and amount
  - Scrollable list if there are many items
  - Compact display with item name (truncated) and total amount
- Total invoice amount (bold)
- Quick "Open in Odoo" link icon
- "View PDF" button for accessing the invoice document

### Date Filtering

The `since` and `until` parameters support two date formats for flexibility:

1. **YYYYMMDD** (compact format): `20250101`
2. **YYYY-MM-DD** (ISO format): `2025-01-01`

Both formats work identically and filter invoices based on their date:
- **`since`**: Show invoices on or after this date (inclusive from 00:00:00)
- **`until`**: Show invoices on or before this date (inclusive until 23:59:59)
- **Date Range**: Use both parameters together to get invoices within a specific period (both boundaries included)

**Usage Examples:**

```typescript
// TypeScript/Deno - Since date only
const invoices = await odooClient.getLatestInvoices(50, "incoming", "20250101");

// Until date only
const invoices = await odooClient.getLatestInvoices(50, "incoming", undefined, "20241231");

// Date range (both since and until)
const invoices = await odooClient.getLatestInvoices(100, "all", "20241001", "20241231");

// ISO format also works
const invoices = await odooClient.getLatestInvoices(50, "incoming", "2025-01-01", "2025-12-31");
```

```bash
# API calls - Since only
curl "http://localhost:8000/api/invoices?since=20250101"

# Until only
curl "http://localhost:8000/api/invoices?until=20241231"

# Date range
curl "http://localhost:8000/api/invoices?since=20241001&until=20241231"

# ISO format
curl "http://localhost:8000/api/invoices?since=2024-10-01&until=2024-12-31"
```

**Important**: The filters use the invoice's `date` field (not `invoice_date`) and are **inclusive on both ends**:
- An invoice dated `2024-10-01` will be included when `since=2024-10-01`
- An invoice dated `2024-12-31` will be included when `until=2024-12-31`
- Date range queries include all invoices from the start of `since` date through the end of `until` date

### Invoice Types

- **Incoming** (`in_invoice`, `in_refund`) - Supplier bills with attached PDFs
- **Outgoing** (`out_invoice`, `out_refund`) - Customer invoices with generated reports

### PDF Handling

- **Incoming invoices**: Links to uploaded PDF attachments
- **Outgoing invoices**: Links to Odoo-generated PDF reports
- **Fallback**: If no attachment exists, falls back to generated report
- **CSP Workaround**: Due to Odoo's Content Security Policy, PDFs cannot be embedded in iframes. The interface provides multiple options:
  - **Open in Odoo** (Purple button) - Opens the invoice in Odoo's web interface
  - **Open PDF in New Tab** (Blue button) - Opens the PDF directly
  - **Download PDF** (Gray button) - Downloads the PDF file
  - **Quick Link** - Small external link icon next to invoice name on cards

## License

MIT