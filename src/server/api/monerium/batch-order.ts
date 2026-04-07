import { privateKeyToAccount } from "viem/accounts";
import { signMessage } from "../../../lib/safe.ts";
import { corsHeaders } from "../shared.ts";
import { normalizeIban, getBalance } from "./utils.ts";

interface PaymentItem {
  name: string;
  type: "organisation" | "individual";
  iban: string;
  amount: number;
  description: string;
}

interface BatchOrderRequest {
  accessToken: string;
  environment: "sandbox" | "production";
  accountAddress: string;
  signature?: string;
  payments: PaymentItem[];
}

interface PaymentResult {
  index: number;
  name: string;
  amount: number;
  status: "success" | "failed";
  orderId?: string;
  error?: string;
}

export async function handleBatchOrder(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = (await req.json()) as BatchOrderRequest;
    const {
      accessToken,
      environment,
      accountAddress,
      signature: providedSignature,
      payments,
    } = body;

    // Validate required fields
    if (!accessToken || !environment || !accountAddress || !payments) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: accessToken, environment, accountAddress, payments",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      return new Response(
        JSON.stringify({
          error: "payments must be a non-empty array",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate each payment
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const errors: string[] = [];

      if (!payment.name || typeof payment.name !== "string") {
        errors.push("name is required");
      } else if (payment.name.length > 100) {
        errors.push("name must be 100 characters or less");
      }

      if (
        !payment.type ||
        !["organisation", "individual"].includes(payment.type.toLowerCase())
      ) {
        errors.push('type must be "organisation" or "individual"');
      }

      if (!payment.iban || typeof payment.iban !== "string") {
        errors.push("iban is required");
      }

      if (typeof payment.amount !== "number" || payment.amount <= 0) {
        errors.push("amount must be a positive number");
      }

      if (payment.description && payment.description.length > 140) {
        errors.push("description must be 140 characters or less");
      }

      if (errors.length > 0) {
        return new Response(
          JSON.stringify({
            error: `Invalid payment at index ${i}: ${errors.join(", ")}`,
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    const chainName = environment === "production" ? "gnosis" : "chiado";

    // Calculate total amount and check balance
    const totalAmount = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    console.log(
      `📊 Batch payment total: €${totalAmount.toFixed(2)} (${
        payments.length
      } payments)`
    );

    try {
      const balance = await getBalance(
        accountAddress as `0x${string}`,
        chainName
      );
      console.log(`💰 Account balance: €${balance}`);

      if (parseFloat(balance) < totalAmount) {
        console.warn(
          `⚠️ Insufficient balance: €${balance} < €${totalAmount.toFixed(2)}`
        );
        // Don't block, just warn
      }
    } catch (error) {
      console.error("Failed to check balance:", error);
      // Continue anyway
    }

    // Generate signature for batch
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const batchMessage = `Batch payment: ${
      payments.length
    } transactions, total €${totalAmount.toFixed(2)} at ${timestamp}`;

    let batchSignature: string;

    if (providedSignature && typeof providedSignature === "string") {
      console.log("✍️ Using signature from frontend (WalletConnect)");
      batchSignature = providedSignature;
    } else {
      // Sign with server private key or Safe
      let privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        return new Response(
          JSON.stringify({
            error:
              "Server configuration error: PRIVATE_KEY not set. Please connect a wallet to sign.",
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (!privateKey.startsWith("0x")) {
        privateKey = `0x${privateKey}`;
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const normalizedAccountAddress = accountAddress.toLowerCase();
      const signerAddress = account.address.toLowerCase();

      if (normalizedAccountAddress === signerAddress) {
        batchSignature = await account.signMessage({
          message: batchMessage,
        });
        console.log("✍️ Batch signature using signer account");
      } else {
        console.log(
          "🔄 Using Safe SDK for batch signing with address:",
          accountAddress
        );
        batchSignature = await signMessage(
          batchMessage,
          accountAddress,
          chainName
        );
        console.log("✍️ Batch signature via Safe SDK");
      }
    }

    // Process payments sequentially
    const results: PaymentResult[] = [];
    const baseUrl =
      environment === "sandbox"
        ? "https://api.monerium.dev"
        : "https://api.monerium.app";

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      console.log(
        `\n📤 Processing payment ${i + 1}/${payments.length}: ${
          payment.name
        } - €${payment.amount}`
      );

      try {
        // Prepare counterpart details
        const counterpartDetails: Record<string, unknown> = {};

        if (payment.type.toLowerCase() === "organisation") {
          counterpartDetails.companyName = payment.name;
        } else {
          // Individual
          const nameParts = payment.name.trim().split(/\s+/);
          if (nameParts.length === 1) {
            counterpartDetails.firstName = nameParts[0];
            counterpartDetails.lastName = "";
          } else {
            counterpartDetails.firstName = nameParts[0];
            counterpartDetails.lastName = nameParts.slice(1).join(" ");
          }
        }

        // Create order message (unique for each payment)
        const orderMessage = `Send EUR ${payment.amount} to ${
          payment.iban
        } at ${timestamp}`;

        const orderPayload = {
          amount: payment.amount.toString(),
          currency: "eur",
          message: orderMessage,
          signature: batchSignature, // Reuse batch signature
          address: accountAddress,
          chain: chainName,
          counterpart: {
            identifier: {
              standard: "iban",
              iban: normalizeIban(payment.iban),
            },
            details: counterpartDetails,
          },
          memo: payment.description || "",
          kind: "redeem",
        };

        console.log("  Order payload:", JSON.stringify(orderPayload, null, 2));

        const orderResponse = await fetch(`${baseUrl}/orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.monerium.api-v2+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderPayload),
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
          console.error("  ❌ Order failed:", orderData);
          results.push({
            index: i,
            name: payment.name,
            amount: payment.amount,
            status: "failed",
            error:
              orderData.error ||
              orderData.message ||
              `HTTP ${orderResponse.status}`,
          });
        } else {
          console.log("  ✅ Order placed successfully:", orderData.id);
          results.push({
            index: i,
            name: payment.name,
            amount: payment.amount,
            status: "success",
            orderId: orderData.id,
          });
        }
      } catch (error) {
        console.error(`  ❌ Exception processing payment ${i}:`, error);
        results.push({
          index: i,
          name: payment.name,
          amount: payment.amount,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Calculate summary
    const successful = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;

    console.log(
      `\n📊 Batch complete: ${successful} successful, ${failed} failed`
    );

    return new Response(
      JSON.stringify({
        total: payments.length,
        successful,
        failed,
        results,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Batch order error:", error);
    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
