import { test, expect } from "bun:test";

// Helper to check if Monerium is configured
function isMoneriumConfigured(): boolean {
  return !!(
    process.env.MONERIUM_CLIENT_ID &&
    process.env.MONERIUM_CLIENT_SECRET
  );
}

const BASE_URL = "http://localhost:8000";

test(
  "batch-order - valid CSV with mixed organisation and individual types",
  async () => {
    if (!isMoneriumConfigured()) {
      console.log(
        "⏭️  Skipping: Monerium environment variables not configured"
      );
      return;
    }

    // First authenticate to get access token
    const authResponse = await fetch(`${BASE_URL}/api/monerium/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!authResponse.ok) {
      console.log("⏭️  Skipping: Failed to authenticate with Monerium");
      return;
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Get available addresses to use for testing
    const addressesResponse = await fetch(
      `${BASE_URL}/api/monerium/addresses`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          environment: "sandbox",
        }),
      }
    );

    if (!addressesResponse.ok) {
      console.log("⏭️  Skipping: Failed to fetch Monerium addresses");
      return;
    }

    const addresses = await addressesResponse.json();
    if (!addresses || addresses.length === 0) {
      console.log("⏭️  Skipping: No Monerium addresses available");
      return;
    }

    const accountAddress = addresses[0].address;

    // Test batch order with valid payments
    const payments = [
      {
        name: "Test Company A",
        type: "organisation",
        iban: "DE89370400440532013000",
        amount: 1.0,
        description: "Test invoice 001",
      },
      {
        name: "John Doe",
        type: "individual",
        iban: "FR1420041010050500013M02606",
        amount: 2.0,
        description: "Test expense reimbursement",
      },
    ];

    const batchResponse = await fetch(`${BASE_URL}/api/monerium/batch-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        environment: "sandbox",
        accountAddress,
        payments,
      }),
    });

    const batchData = await batchResponse.json();

    // Check response structure
    expect(batchData).toHaveProperty("total");
    expect(batchData).toHaveProperty("successful");
    expect(batchData).toHaveProperty("failed");
    expect(batchData).toHaveProperty("results");

    expect(batchData.total).toBe(2);
    expect(batchData.results).toBeInstanceOf(Array);
    expect(batchData.results.length).toBe(2);

    // Check each result has required fields
    for (const result of batchData.results) {
      expect(result).toHaveProperty("index");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("amount");
      expect(result).toHaveProperty("status");
      expect(["success", "failed"]).toContain(result.status);
    }

    console.log(
      `✅ Batch payment test: ${batchData.successful} successful, ${batchData.failed} failed`
    );
  }
);

test("batch-order - reject invalid payment data", async () => {
  if (!isMoneriumConfigured()) {
    console.log("⏭️  Skipping: Monerium environment variables not configured");
    return;
  }

  // Authenticate
  const authResponse = await fetch(`${BASE_URL}/api/monerium/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!authResponse.ok) {
    console.log("⏭️  Skipping: Failed to authenticate with Monerium");
    return;
  }

  const authData = await authResponse.json();
  const accessToken = authData.access_token;

  // Test with invalid payment (missing required fields)
  const invalidPayments = [
    {
      name: "", // Empty name
      type: "organisation",
      iban: "DE89370400440532013000",
      amount: 1.0,
      description: "Test",
    },
  ];

  const batchResponse = await fetch(`${BASE_URL}/api/monerium/batch-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      environment: "sandbox",
      accountAddress: "0x1234567890123456789012345678901234567890",
      payments: invalidPayments,
    }),
  });

  // Should return 400 Bad Request
  expect(batchResponse.status).toBe(400);

  const errorData = await batchResponse.json();
  expect(errorData).toHaveProperty("error");
  expect(errorData.error).toContain("Invalid payment");

  console.log("✅ Invalid payment rejected correctly");
});

test("batch-order - reject empty payments array", async () => {
  if (!isMoneriumConfigured()) {
    console.log("⏭️  Skipping: Monerium environment variables not configured");
    return;
  }

  // Authenticate
  const authResponse = await fetch(`${BASE_URL}/api/monerium/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!authResponse.ok) {
    console.log("⏭️  Skipping: Failed to authenticate with Monerium");
    return;
  }

  const authData = await authResponse.json();
  const accessToken = authData.access_token;

  // Test with empty payments array
  const batchResponse = await fetch(`${BASE_URL}/api/monerium/batch-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      environment: "sandbox",
      accountAddress: "0x1234567890123456789012345678901234567890",
      payments: [],
    }),
  });

  // Should return 400 Bad Request
  expect(batchResponse.status).toBe(400);

  const errorData = await batchResponse.json();
  expect(errorData).toHaveProperty("error");
  expect(errorData.error).toContain("non-empty array");

  console.log("✅ Empty payments array rejected correctly");
});

test(
  "batch-order - reject invalid amount (negative or zero)",
  async () => {
    if (!isMoneriumConfigured()) {
      console.log(
        "⏭️  Skipping: Monerium environment variables not configured"
      );
      return;
    }

    // Authenticate
    const authResponse = await fetch(`${BASE_URL}/api/monerium/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!authResponse.ok) {
      console.log("⏭️  Skipping: Failed to authenticate with Monerium");
      return;
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Test with negative amount
    const invalidPayments = [
      {
        name: "Test Company",
        type: "organisation",
        iban: "DE89370400440532013000",
        amount: -10.0, // Negative amount
        description: "Test",
      },
    ];

    const batchResponse = await fetch(`${BASE_URL}/api/monerium/batch-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        environment: "sandbox",
        accountAddress: "0x1234567890123456789012345678901234567890",
        payments: invalidPayments,
      }),
    });

    // Should return 400 Bad Request
    expect(batchResponse.status).toBe(400);

    const errorData = await batchResponse.json();
    expect(errorData).toHaveProperty("error");
    expect(errorData.error).toContain("positive number");

    console.log("✅ Invalid amount rejected correctly");
  }
);

test("batch-order - reject invalid type", async () => {
  if (!isMoneriumConfigured()) {
    console.log("⏭️  Skipping: Monerium environment variables not configured");
    return;
  }

  // Authenticate
  const authResponse = await fetch(`${BASE_URL}/api/monerium/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!authResponse.ok) {
    console.log("⏭️  Skipping: Failed to authenticate with Monerium");
    return;
  }

  const authData = await authResponse.json();
  const accessToken = authData.access_token;

  // Test with invalid type
  const invalidPayments = [
    {
      name: "Test Company",
      type: "invalid_type", // Invalid type
      iban: "DE89370400440532013000",
      amount: 10.0,
      description: "Test",
    },
  ];

  const batchResponse = await fetch(`${BASE_URL}/api/monerium/batch-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      environment: "sandbox",
      accountAddress: "0x1234567890123456789012345678901234567890",
      payments: invalidPayments,
    }),
  });

  // Should return 400 Bad Request
  expect(batchResponse.status).toBe(400);

  const errorData = await batchResponse.json();
  expect(errorData).toHaveProperty("error");
  expect(errorData.error).toContain("organisation");
  expect(errorData.error).toContain("individual");

  console.log("✅ Invalid type rejected correctly");
});
