#!/bin/bash
set -e

# Odoo
mkdir -p src/server/api/odoo/invoices
mv src/server/api/odoo/invoices.ts src/server/api/odoo/invoices/index.ts

mkdir -p src/server/api/odoo/invoices/\[id\]
mv src/server/api/odoo/invoice-details.ts src/server/api/odoo/invoices/\[id\]/index.ts

mkdir -p src/server/api/odoo/authenticate
mv src/server/api/odoo/authenticate.ts src/server/api/odoo/authenticate/index.ts

mkdir -p src/server/api/odoo/transactions
mv src/server/api/odoo/transactions.ts src/server/api/odoo/transactions/index.ts

mkdir -p src/server/api/pdf/view
mv src/server/api/odoo/pdf.ts src/server/api/pdf/view/index.ts

# Monerium
mkdir -p src/server/api/monerium/token
mv src/server/api/monerium/token.ts src/server/api/monerium/token/index.ts

mkdir -p src/server/api/monerium/config
mv src/server/api/monerium/config.ts src/server/api/monerium/config/index.ts

mkdir -p src/server/api/monerium/authenticate
mv src/server/api/monerium/authenticate.ts src/server/api/monerium/authenticate/index.ts

mkdir -p src/server/api/monerium/addresses
mv src/server/api/monerium/addresses.ts src/server/api/monerium/addresses/index.ts

mkdir -p src/server/api/monerium/order
mv src/server/api/monerium/order.ts src/server/api/monerium/order/index.ts

mkdir -p src/server/api/monerium/orders
mv src/server/api/monerium/orders.ts src/server/api/monerium/orders/index.ts

mkdir -p src/server/api/monerium/signer-address
mv src/server/api/monerium/signer-address.ts src/server/api/monerium/signer-address/index.ts
