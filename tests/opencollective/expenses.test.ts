import { test, expect } from "bun:test";

const GRAPHQL_ENDPOINT = "https://api.opencollective.com/graphql/v2";

// Helper to check if OpenCollective API key is configured
function isOpenCollectiveConfigured(): boolean {
  return !!process.env.OC_API_KEY;
}

// GraphQL mutation to mark expense as paid with manual: true
const PROCESS_EXPENSE_MUTATION = `
mutation ProcessExpense($expenseId: String!, $action: ExpenseProcessAction!, $totalAmountPaidInHostCurrency: Int!) {
  processExpense(expense: { id: $expenseId }, action: $action, paymentParams: { forceManual: true, totalAmountPaidInHostCurrency: $totalAmountPaidInHostCurrency }) {
    id
    legacyId
    status
    description
  }
}
`;

// Query to get expense details by legacyId
const GET_EXPENSE_QUERY = `
query GetExpense($legacyId: Int!) {
  expense(expense: { legacyId: $legacyId }) {
    id
    legacyId
    status
    description
    amount
    currency
    payee {
      name
      slug
    }
    payoutMethod {
      type
      data
    }
  }
}
`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

interface Expense {
  id: string;
  legacyId: number;
  status: string;
  description: string;
  amount?: number;
  currency?: string;
  payee?: {
    name: string;
    slug: string;
  };
  payoutMethod?: {
    type: string;
    data: unknown;
  };
}

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  apiKey: string
): Promise<GraphQLResponse<T>> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  return await response.json();
}

test("markExpenseAsPaid - mark expense as paid with manual: true", async () => {
  if (!isOpenCollectiveConfigured()) {
    console.log(
      "⏭️  Skipping: OC_API_KEY environment variable not configured"
    );
    return;
  }

  const apiKey = process.env.OC_API_KEY!;
  const collectiveSlug = "ls-learning-journey";
  const expenseLegacyId = 284429;

  console.log(
    `\n📋 Testing mark expense as paid for expense #${expenseLegacyId} in ${collectiveSlug}`
  );
  console.log("=".repeat(60));

  // First, get the expense details to retrieve the GraphQL ID
  console.log("\n🔍 Fetching expense details...");
  const expenseResult = await graphqlRequest<{ expense: Expense }>(
    GET_EXPENSE_QUERY,
    { legacyId: expenseLegacyId },
    apiKey
  );

  if (expenseResult.errors) {
    console.error("❌ GraphQL errors:", expenseResult.errors);
    throw new Error(
      `Failed to fetch expense: ${expenseResult.errors[0]?.message}`
    );
  }

  const expense = expenseResult.data?.expense;
  if (!expense) {
    throw new Error(`Expense #${expenseLegacyId} not found in ${collectiveSlug}`);
  }

  console.log(`✓ Found expense:`);
  console.log(`  ID: ${expense.id}`);
  console.log(`  Legacy ID: ${expense.legacyId}`);
  console.log(`  Description: ${expense.description}`);
  console.log(`  Status: ${expense.status}`);
  if (expense.amount) {
    console.log(`  Amount: ${expense.amount / 100} ${expense.currency}`);
  }
  if (expense.payee) {
    console.log(`  Payee: ${expense.payee.name} (${expense.payee.slug})`);
  }
  if (expense.payoutMethod) {
    console.log(`  Payout Method: ${expense.payoutMethod.type}`);
  }

  // Check if expense is in a state that can be marked as paid
  if (expense.status === "PAID") {
    console.log("\n⚠️  Expense is already marked as PAID");
    return;
  }

  if (expense.status !== "APPROVED") {
    console.log(
      `\n⚠️  Expense status is ${expense.status}, expected APPROVED to mark as paid`
    );
    console.log("   Cannot proceed with marking as paid");
    return;
  }

  // Mark the expense as paid with manual: true
  console.log("\n💰 Marking expense as paid (manual: true)...");
  const payResult = await graphqlRequest<{ processExpense: Expense }>(
    PROCESS_EXPENSE_MUTATION,
    {
      expenseId: expense.id,
      action: "PAY",
      totalAmountPaidInHostCurrency: expense.amount
    },
    apiKey
  );

  if (payResult.errors) {
    console.error("❌ GraphQL errors:", payResult.errors);
    throw new Error(
      `Failed to mark expense as paid: ${payResult.errors[0]?.message}`
    );
  }

  const paidExpense = payResult.data?.processExpense;
  expect(paidExpense).toBeDefined();
  expect(paidExpense?.status).toBe("PAID");

  console.log(`✓ Expense marked as paid successfully!`);
  console.log(`  New Status: ${paidExpense?.status}`);
  console.log(`  ID: ${paidExpense?.id}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test completed successfully");
});

test("getExpenseDetails - fetch expense details by legacyId", async () => {
  if (!isOpenCollectiveConfigured()) {
    console.log(
      "⏭️  Skipping: OC_API_KEY environment variable not configured"
    );
    return;
  }

  const apiKey = process.env.OC_API_KEY!;
  const collectiveSlug = "ls-learning-journey";
  const expenseLegacyId = 284429;

  console.log(
    `\n📋 Fetching expense #${expenseLegacyId} from ${collectiveSlug}`
  );
  console.log("=".repeat(60));

  const result = await graphqlRequest<{ expense: Expense }>(
    GET_EXPENSE_QUERY,
    { legacyId: expenseLegacyId },
    apiKey
  );

  if (result.errors) {
    console.error("❌ GraphQL errors:", result.errors);
    throw new Error(`Failed to fetch expense: ${result.errors[0]?.message}`);
  }

  const expense = result.data?.expense;
  expect(expense).toBeDefined();
  expect(expense?.legacyId).toBe(expenseLegacyId);

  console.log(`✓ Expense details:`);
  console.log(`  ID: ${expense?.id}`);
  console.log(`  Legacy ID: ${expense?.legacyId}`);
  console.log(`  Description: ${expense?.description}`);
  console.log(`  Status: ${expense?.status}`);
  if (expense?.amount) {
    console.log(`  Amount: ${expense.amount / 100} ${expense.currency}`);
  }
  if (expense?.payee) {
    console.log(`  Payee: ${expense.payee.name} (${expense.payee.slug})`);
  }
  if (expense?.payoutMethod) {
    console.log(`  Payout Method: ${expense.payoutMethod.type}`);
    console.log(`  Payout Data: ${JSON.stringify(expense.payoutMethod.data)}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test completed successfully");
});
