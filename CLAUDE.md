This app is about showing the invoices and expense reports that should be paid using Odoo API (https://www.odoo.com/documentation/19.0/developer/reference/external_api.html) and Monerium API (https://monerium.dev/api-docs/v2)

Use Bun test APIs (`import { test, expect } from "bun:test"`) in tests/.

We store the credential in localStorage in the browser.

There is a sandbox environment when running `bun dev` using a different odoo database and the monerium sandbox environment.

Tests should always use the sandbox environment.
