import { privateKeyToAccount } from "viem/accounts";
import { signMessage } from "../../../lib/safe.ts";
import { corsHeaders } from "../shared.ts";
import { normalizeIban } from "./utils.ts";

export async function handleMoneriumOrderPlacement(
  req: Request
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      companyName,
      amount,
      iban,
      memo,
      environment,
      accessToken,
      accountAddress,
      signature: providedSignature,
    } = body;

    if (!amount || !iban || !environment || !accessToken || !accountAddress) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: amount, iban, environment, accessToken, accountAddress",
        }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!companyName && !(firstName && lastName)) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: companyName or firstName and lastName",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const chainName = environment === "production" ? "gnosis" : "chiado";

    const counterpartDetails: Record<string, unknown> = {};

    if (companyName) {
      counterpartDetails.companyName = companyName;
    } else if (firstName || lastName) {
      counterpartDetails.firstName = firstName;
      counterpartDetails.lastName = lastName;
    }

    const orderPayload = {
      amount: amount.toString(),
      currency: "eur",
      message: `Send EUR ${amount} to ${iban} at ${new Date()
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z")}`,
      signature: "0x",
      address: accountAddress,
      chain: chainName,
      counterpart: {
        identifier: {
          standard: "iban",
          iban: normalizeIban(iban),
        },
        details: counterpartDetails,
      },
      memo: memo || "",
      kind: "redeem",
    };

    const messageToSign = orderPayload.message;
    console.log("📝 Message to sign:", messageToSign);

    let signature: string;

    // If signature is provided from frontend (WalletConnect), use it
    if (providedSignature && typeof providedSignature === "string") {
      console.log("✍️ Using signature from frontend (WalletConnect)");
      signature = providedSignature;
    } else {
      // Otherwise, use server-side signing with PRIVATE_KEY
      let privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        console.error(
          "❌ PRIVATE_KEY environment variable not set and no signature provided"
        );
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

      console.log(
        "🔑 Using private key (first 10 chars):",
        privateKey.substring(0, 10) + "..."
      );

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      console.log("🔑 Signing address:", account.address);

      const normalizedAccountAddress = accountAddress.toLowerCase();
      const signerAddress = account.address.toLowerCase();

      if (normalizedAccountAddress === signerAddress) {
        signature = await account.signMessage({
          message: messageToSign,
        });
        console.log("✍️ Signature using signer account:", signature);
      } else {
        console.log(
          "🔄 Using Safe SDK for signing with address:",
          accountAddress,
          "on chain:",
          chainName
        );

        signature = await signMessage(messageToSign, accountAddress, chainName);

        console.log("✍️ Signature via Safe SDK:", signature);
      }
    }

    const fullPayload = {
      ...orderPayload,
      signature: signature,
    };

    const baseUrl =
      environment === "sandbox"
        ? "https://api.monerium.dev"
        : "https://api.monerium.app";

    console.log("🔄 Posting order to Monerium:");
    console.log("  URL:", `${baseUrl}/orders`);
    console.log(
      "  Access token:",
      accessToken[0] +
        (accessToken.length - 2) +
        accessToken[accessToken.length - 1]
    );
    console.log("  Full payload:", JSON.stringify(fullPayload, null, 2));

    const orderResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.monerium.api-v2+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fullPayload),
    });

    console.log("📥 Order Response Status:", orderResponse.status);

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("❌ Order Error Response:", orderData);
      return new Response(JSON.stringify(orderData), {
        status: orderResponse.status,
        headers: corsHeaders,
      });
    }

    console.log("✅ Order placed successfully:", orderData.id);

    return new Response(JSON.stringify(orderData), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Order placement error:", error);
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
