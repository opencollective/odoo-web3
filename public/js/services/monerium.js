import { getStorageKey, ENV } from "../config.js";
import { isInvoicePaid, markInvoiceAsPaid } from "../utils/storage.js";

// Monerium payment service
export const handlePay = async (
  invoice,
  memo,
  accountAddressOverride,
  walletSignMessage,
  recipientInfo = null, // { type: 'partner' | 'employee', name: string }
  force = false
) => {
  if (!invoice?.bank_account_number) {
    throw new Error("This invoice does not have a bank account number.");
  }

  // Check if invoice was already paid
  if (!force && isInvoicePaid(invoice.id)) {
    throw new Error("This invoice has already been paid.");
  }

  const storedConnection = localStorage.getItem(
    getStorageKey("monerium_connection")
  );

  if (!storedConnection) {
    throw new Error(
      "Connect to Monerium first from the Monerium page and set your payer account."
    );
  }

  let connection;
  try {
    connection = JSON.parse(storedConnection);
  } catch (err) {
    console.error("Failed to parse Monerium connection:", err);
    throw new Error(
      "Stored Monerium connection looks invalid. Please reconnect from the Monerium page."
    );
  }

  // Check if token is expired
  if (connection.expiresAt && Date.now() >= connection.expiresAt) {
    console.log("⏰ Token expired, clearing connection");
    localStorage.removeItem(getStorageKey("monerium_connection"));
    localStorage.removeItem(getStorageKey("monerium_oauth"));
    window.dispatchEvent(new Event("monerium-connection-updated"));
    throw new Error(
      "Your Monerium session has expired. Please reconnect from the Monerium page."
    );
  }

  const {
    accessToken,
    environment = "sandbox",
    accountAddress: storedAccountAddress,
  } = connection || {};

  // Determine expected environment from server config
  const expectedEnv =
    ENV.environment === "production" ? "production" : "sandbox";

  console.log(
    `🔗 Monerium payment - stored env: ${environment}, server env: ${expectedEnv}, accountAddress: ${
      storedAccountAddress || accountAddressOverride
    }`
  );

  // Validate environment matches server configuration
  if (environment !== expectedEnv) {
    throw new Error(
      `Environment mismatch: Monerium was connected in ${environment} mode, but server is running in ${expectedEnv} mode. ` +
        `Please disconnect and reconnect to Monerium from the Monerium page.`
    );
  }

  if (!accessToken) {
    throw new Error(
      "Missing Monerium access token. Reconnect from the Monerium page."
    );
  }

  const accountAddress = accountAddressOverride || storedAccountAddress;

  if (!accountAddress) {
    throw new Error(
      "Missing Monerium payer account. Set it from the Monerium page."
    );
  }

  // Use amount_residual (amount due) if available, otherwise fall back to amount_total
  const amountToPay = invoice.amount_residual ?? invoice.amount_total;

  // Prepare order payload
  const messageToSign = `Send EUR ${amountToPay} to ${
    invoice.bank_account_number
  } at ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`;

  // Sign message with wallet if walletSignMessage is provided
  let signature = null;
  if (walletSignMessage && typeof walletSignMessage === "function") {
    try {
      signature = await walletSignMessage(messageToSign);
      console.log("✍️ Message signed with wallet:", signature);
    } catch (err) {
      console.error("Failed to sign with wallet:", err);
      throw new Error("Failed to sign message with wallet. Please try again.");
    }
  }

  // Determine recipient details based on payment type
  let companyName = "";
  let firstName = "";
  let lastName = "";

  if (recipientInfo && recipientInfo.type === "company") {
    // Company / organisation payment
    companyName = recipientInfo.name || invoice.partner_name || "Unknown";
    console.log(`🏢 Paying company: ${companyName}`);
  } else if (recipientInfo && (recipientInfo.type === "individual" || recipientInfo.type === "employee")) {
    // Individual / employee payment – split the account holder name
    const nameParts = (recipientInfo.name || "").trim().split(/\s+/);
    if (nameParts.length === 1) {
      firstName = nameParts[0];
      lastName = "";
    } else if (nameParts.length >= 2) {
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(" ");
    }
    console.log(`👤 Paying individual: ${firstName} ${lastName}`);
  } else {
    // No recipientInfo – fall back to invoice partner name (Odoo invoices)
    companyName = invoice.partner_name || "Unknown";
    console.log(`🏢 Paying company: ${companyName}`);
  }

  const response = await fetch("/api/monerium/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountToPay,
      iban: invoice.bank_account_number,
      memo,
      environment,
      accessToken,
      accountAddress,
      companyName,
      firstName,
      lastName,
      signature: signature || undefined,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    let msg = data.error || data.message || "Failed to place order";
    if (data.errors && data.errors.amount) {
      msg = `${data.errors.amount} (balance: €${data.errors.balance})`;
    }
    const error = new Error(msg);
    error.status = response.status;
    throw error;
  }

  // Mark invoice as paid in localStorage
  markInvoiceAsPaid(invoice.id);

  return data;
};
