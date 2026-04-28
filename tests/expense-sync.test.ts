import { test, expect } from "bun:test";
import { OdooClient, type OdooConfig } from "../src/lib/odoo.ts";

const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

const OC_EXPENSE_LEGACY_ID = 286461;
const ODOO_EMPLOYEE_ID = 8;

function isConfigured(): boolean {
  return !!(
    process.env.OC_API_KEY &&
    process.env.ODOO_URL &&
    process.env.ODOO_DATABASE &&
    process.env.ODOO_USERNAME &&
    process.env.ODOO_PASSWORD
  );
}

// Fetch expense with full payout details + collective admins
const EXPENSE_WITH_ADMINS_QUERY = `
query GetExpenseWithAdmins($legacyId: Int!) {
  expense(expense: { legacyId: $legacyId }) {
    id
    legacyId
    description
    status
    amount
    currency
    createdAt
    account {
      name
      slug
      type
      ... on AccountWithParent {
        parent {
          name
          slug
        }
      }
      members(role: [ADMIN], limit: 1) {
        nodes {
          account {
            name
            slug
          }
        }
      }
    }
    payee {
      name
      slug
      ... on Individual {
        email
      }
    }
    payoutMethod {
      type
      data
    }
    items {
      id
      description
      amount
      url
    }
    attachedFiles {
      id
      url
      name
    }
  }
}
`;

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": process.env.OC_API_KEY!,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }
  return json.data as T;
}

function createOdooClient(): OdooClient {
  return new OdooClient({
    url: process.env.ODOO_URL!,
    database: process.env.ODOO_DATABASE!,
    username: process.env.ODOO_USERNAME!,
    password: process.env.ODOO_PASSWORD!,
  });
}

test("fetch OC expense 286461 and inspect payout data", async () => {
  if (!isConfigured()) {
    console.log("⏭️  Skipping: env vars not configured");
    return;
  }

  const data = await graphqlRequest<{ expense: any }>(
    EXPENSE_WITH_ADMINS_QUERY,
    { legacyId: OC_EXPENSE_LEGACY_ID }
  );

  const expense = data.expense;
  expect(expense).toBeDefined();
  expect(expense.legacyId).toBe(OC_EXPENSE_LEGACY_ID);

  console.log("\n📋 Expense details:");
  console.log(`  Description: ${expense.description}`);
  console.log(`  Amount: ${expense.amount / 100} ${expense.currency}`);
  console.log(`  Payee: ${expense.payee.name} (${expense.payee.slug})`);
  console.log(`  Email: ${expense.payee.email || "N/A"}`);
  console.log(`  Collective: ${expense.account.name} (${expense.account.slug})`);

  // Admins
  const admins = expense.account.members?.nodes || [];
  console.log(`  Admins (${admins.length}):`);
  for (const m of admins) {
    console.log(`    - ${m.account.name} (${m.account.slug})`);
  }

  // Payout method
  console.log(`\n💳 Payout method: ${expense.payoutMethod.type}`);
  const payoutData = typeof expense.payoutMethod.data === "string"
    ? JSON.parse(expense.payoutMethod.data)
    : expense.payoutMethod.data;
  console.log(`  Raw data: ${JSON.stringify(payoutData, null, 2)}`);

  // Extract IBAN, BIC, address (fields may be uppercase or lowercase)
  const details = payoutData.details || {};
  const iban = details.IBAN || details.iban || payoutData.IBAN || payoutData.iban;
  const bic = details.BIC || details.bic || payoutData.BIC || payoutData.bic;
  const address = details.address || payoutData.address || {};
  const accountHolderName = payoutData.accountHolderName || details.accountHolderName;

  console.log(`\n  Account Holder: ${accountHolderName}`);
  console.log(`  IBAN: ${iban}`);
  console.log(`  BIC: ${bic}`);
  console.log(`  Address: ${JSON.stringify(address)}`);

  expect(iban).toBeDefined();
  expect(accountHolderName).toBeDefined();
});

test("sync employee in Odoo from OC expense 286461", async () => {
  if (!isConfigured()) {
    console.log("⏭️  Skipping: env vars not configured");
    return;
  }

  // 1. Fetch expense data from OC
  const data = await graphqlRequest<{ expense: any }>(
    EXPENSE_WITH_ADMINS_QUERY,
    { legacyId: OC_EXPENSE_LEGACY_ID }
  );
  const expense = data.expense;

  const payoutData = typeof expense.payoutMethod.data === "string"
    ? JSON.parse(expense.payoutMethod.data)
    : expense.payoutMethod.data;

  const details = payoutData.details || {};
  const iban = details.IBAN || details.iban || payoutData.IBAN || payoutData.iban;
  const bic = details.BIC || details.bic || payoutData.BIC || payoutData.bic;
  const accountHolderName = payoutData.accountHolderName || details.accountHolderName;
  const address = details.address || payoutData.address || {};
  const email = expense.payee?.email || details.email || payoutData.email;
  const firstAdmin = (expense.account.members?.nodes || [])[0]?.account;
  const parentCollective = expense.account.parent;
  const department = parentCollective
    ? `${parentCollective.name} › ${expense.account.name}`
    : expense.account.name;

  console.log("\n📦 Data to sync to Odoo:");
  console.log(`  Employee name: ${accountHolderName}`);
  console.log(`  Email: ${email}`);
  console.log(`  IBAN: ${iban}`);
  console.log(`  BIC: ${bic}`);
  console.log(`  Address: ${address.firstLine}, ${address.postCode} ${address.city}, ${address.country}`);
  console.log(`  Account type: ${expense.account.type}`);
  console.log(`  Parent: ${parentCollective?.name || "none"}`);
  console.log(`  Department: ${department}`);
  console.log(`  Manager (first admin): ${firstAdmin?.name || "N/A"}`);

  // 2. Connect to Odoo
  const odooClient = createOdooClient();
  const authenticated = await odooClient.authenticate();
  expect(authenticated).toBe(true);
  console.log("\n✅ Odoo authenticated");

  // 3. Sync employee
  const result = await odooClient.syncEmployee(ODOO_EMPLOYEE_ID, {
    email,
    iban,
    bic,
    accountHolderName,
    address: {
      street: address.firstLine,
      city: address.city,
      postCode: address.postCode,
      country: address.country,
    },
    department,
    managerName: firstAdmin?.name,
  });

  console.log("\n✅ Employee synced:");
  console.log(`  ID: ${result.id}`);
  console.log(`  Name: ${result.name}`);
  console.log(`  Bank account: ${result.bank_account_number || "N/A"}`);

  expect(result.id).toBe(ODOO_EMPLOYEE_ID);
  expect(result.bank_account_number).toBe(iban);

  // 4. Verify private address was set
  const rpc = (odooClient as any).callRPC.bind(odooClient);
  const config = (odooClient as any).config;
  const uid = (odooClient as any).uid;
  const empCheck = (await rpc("object", "execute_kw", [
    config.database, uid, config.password,
    "hr.employee", "read", [[ODOO_EMPLOYEE_ID]],
    { fields: ["private_street", "private_city", "private_zip", "private_country_id", "private_email"] },
  ]))[0];

  console.log("\n🏠 Private address in Odoo:");
  console.log(`  Street: ${empCheck.private_street}`);
  console.log(`  City: ${empCheck.private_city}`);
  console.log(`  Zip: ${empCheck.private_zip}`);
  console.log(`  Country: ${JSON.stringify(empCheck.private_country_id)}`);
  console.log(`  Email: ${empCheck.private_email}`);

  expect(empCheck.private_street).toBe("Neuköllnische Allee 85");
  expect(empCheck.private_city).toBe("Berlin");
  expect(empCheck.private_zip).toBe("12057");
  expect(empCheck.private_email).toBe("aleksandra.lewtak@gmail.com");

  // 5. Verify bank account is linked via primary_bank_account_id
  const empBank = (await rpc("object", "execute_kw", [
    config.database, uid, config.password,
    "hr.employee", "read", [[ODOO_EMPLOYEE_ID]],
    { fields: ["primary_bank_account_id", "bank_account_ids"] },
  ]))[0];

  console.log("\n🏦 Bank account linkage:");
  console.log(`  primary_bank_account_id: ${JSON.stringify(empBank.primary_bank_account_id)}`);
  console.log(`  bank_account_ids: ${JSON.stringify(empBank.bank_account_ids)}`);

  expect(empBank.bank_account_ids.length).toBeGreaterThan(0);
  expect(empBank.primary_bank_account_id).toBeTruthy();

  // Verify BIC on the bank account
  const bankRecord = (await rpc("object", "execute_kw", [
    config.database, uid, config.password,
    "res.partner.bank", "read", [[empBank.primary_bank_account_id[0]]],
    { fields: ["acc_number", "bank_bic", "bank_id"] },
  ]))[0];

  console.log(`  IBAN: ${bankRecord.acc_number}`);
  console.log(`  BIC: ${bankRecord.bank_bic}`);
  console.log(`  Bank: ${JSON.stringify(bankRecord.bank_id)}`);

  expect(bankRecord.bank_bic).toBe("BMPBBEBBVOD");
});
