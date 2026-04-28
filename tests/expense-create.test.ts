import { test, expect } from "bun:test";
import { OdooClient, type OdooConfig } from "../src/lib/odoo.ts";

const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

const OC_EXPENSE_LEGACY_ID = 286461;
const ODOO_EMPLOYEE_ID = 8; // Aleksandra Lewtak

function isConfigured(): boolean {
  return !!(
    process.env.OC_API_KEY &&
    process.env.ODOO_URL &&
    process.env.ODOO_DATABASE &&
    process.env.ODOO_USERNAME &&
    process.env.ODOO_PASSWORD
  );
}

const EXPENSE_QUERY = `
query GetExpense($legacyId: Int!) {
  expense(expense: { legacyId: $legacyId }) {
    id
    legacyId
    description
    amount
    currency
    createdAt
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
  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };
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

test("create expense in Odoo from OC expense 286461 with attachments", async () => {
  if (!isConfigured()) {
    console.log("⏭️  Skipping: env vars not configured");
    return;
  }

  // 1. Fetch expense from OC
  const data = await graphqlRequest<{ expense: any }>(EXPENSE_QUERY, {
    legacyId: OC_EXPENSE_LEGACY_ID,
  });
  const expense = data.expense;
  expect(expense).toBeDefined();

  console.log(`\n📋 OC Expense #${expense.legacyId}: ${expense.description}`);
  console.log(`  Amount: ${expense.amount / 100} ${expense.currency}`);
  console.log(`  Items (${expense.items?.length || 0}):`);
  for (const item of expense.items || []) {
    console.log(
      `    - ${item.description || "no desc"}: ${item.amount / 100} ${expense.currency} ${item.url ? "(has receipt)" : "(no receipt)"}`
    );
  }
  console.log(`  Attached files (${expense.attachedFiles?.length || 0}):`);
  for (const file of expense.attachedFiles || []) {
    console.log(`    - ${file.name} (${file.url ? "has URL" : "no URL"})`);
  }

  const itemUrls = (expense.items || []).filter((i: any) => i.url).length;
  const fileCount = expense.attachedFiles?.length || 0;
  const totalAttachments = itemUrls + fileCount;
  console.log(`\n  Total attachments to upload: ${totalAttachments}`);

  // 2. Connect to Odoo
  const odooClient = createOdooClient();
  const authenticated = await odooClient.authenticate();
  expect(authenticated).toBe(true);
  console.log("✅ Odoo authenticated");

  const rpc = (odooClient as any).callRPC.bind(odooClient);
  const config = (odooClient as any).config;
  const uid = (odooClient as any).uid;

  // 3. Delete existing expense with this reference (so test is idempotent)
  const ocRef = `OC-${OC_EXPENSE_LEGACY_ID}`;
  const existing = await odooClient.findExpenseByRef(ocRef);
  if (existing) {
    console.log(
      `🗑️  Deleting existing expense ${existing.id} with ref ${ocRef}`
    );
    // Delete attachments first
    const existingAttachments = (await rpc("object", "execute_kw", [
      config.database,
      uid,
      config.password,
      "ir.attachment",
      "search_read",
      [[["res_model", "=", "hr.expense"], ["res_id", "=", existing.id]]],
      { fields: ["id"] },
    ])) as Record<string, unknown>[];
    if (existingAttachments.length > 0) {
      await rpc("object", "execute_kw", [
        config.database,
        uid,
        config.password,
        "ir.attachment",
        "unlink",
        [existingAttachments.map((a: any) => a.id)],
      ]);
    }
    await rpc("object", "execute_kw", [
      config.database,
      uid,
      config.password,
      "hr.expense",
      "unlink",
      [[existing.id]],
    ]);
    console.log("  Deleted.");
  }

  // 4. Create expense with attachments
  const items = (expense.items && expense.items.length > 0)
    ? expense.items.map((item: any) => ({
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
    .filter((f: any) => f.url)
    .map((f: any) => ({ url: f.url, name: f.name || "Attachment" }));

  console.log(
    `\n📤 Creating expense with ${items.length} item(s), ${attachments.length} file attachment(s)...`
  );

  const result = await odooClient.createExpenseReport({
    employeeId: ODOO_EMPLOYEE_ID,
    description: expense.description,
    reference: ocRef,
    items,
    attachments,
    currency: expense.currency,
    ocApiKey: process.env.OC_API_KEY!,
  });

  console.log(`✅ Created expense(s): ${result.expenseIds}`);
  if (result.sheetId) {
    console.log(`  Sheet ID: ${result.sheetId}`);
  }
  expect(result.expenseIds.length).toBeGreaterThan(0);

  // 5. Verify expense in Odoo
  const expenseId = result.expenseIds[0];
  const odooExpense = (
    await rpc("object", "execute_kw", [
      config.database,
      uid,
      config.password,
      "hr.expense",
      "read",
      [[expenseId]],
      {
        fields: [
          "id",
          "name",
          "description",
          "employee_id",
          "total_amount",
          "currency_id",
        ],
      },
    ])
  )[0];

  console.log(`\n🔍 Verifying Odoo expense ${expenseId}:`);
  console.log(`  Name: ${odooExpense.name}`);
  console.log(`  Description (OC ref): ${odooExpense.description}`);
  console.log(`  Employee: ${JSON.stringify(odooExpense.employee_id)}`);
  console.log(`  Amount: ${odooExpense.total_amount}`);
  console.log(`  Currency: ${JSON.stringify(odooExpense.currency_id)}`);

  expect(odooExpense.description).toBe(ocRef);
  expect(odooExpense.employee_id[0]).toBe(ODOO_EMPLOYEE_ID);
  expect(odooExpense.total_amount).toBe(expense.amount / 100);

  // 6. Verify attachments
  const odooAttachments = (await rpc("object", "execute_kw", [
    config.database,
    uid,
    config.password,
    "ir.attachment",
    "search_read",
    [[["res_model", "=", "hr.expense"], ["res_id", "=", expenseId]]],
    { fields: ["id", "name", "mimetype", "file_size"] },
  ])) as Record<string, unknown>[];

  console.log(`\n📎 Attachments on expense ${expenseId} (${odooAttachments.length}):`);
  for (const att of odooAttachments) {
    console.log(
      `  - ${att.name} (${att.mimetype}, ${att.file_size} bytes)`
    );
    expect((att.file_size as number) > 0).toBe(true);
  }

  expect(odooAttachments.length).toBe(totalAttachments);
  console.log(
    `\n✅ All ${totalAttachments} attachments uploaded successfully`
  );

  // 7. Verify findExpenseByRef works
  const found = await odooClient.findExpenseByRef(ocRef);
  expect(found).toBeDefined();
  expect(found!.id).toBe(expenseId);
  console.log(`✅ findExpenseByRef("${ocRef}") → expense ${found!.id}`);
}, 60000);
