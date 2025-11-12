import { expect } from "@std/expect";

import { signMessage } from "../src/lib/safe.ts";

Deno.test("signMessage signs message with Safe", async () => {
  const privateKey = Deno.env.get("PRIVATE_KEY");
  const safeAddress =
    Deno.env.get("SAFE_ADDRESS") ||
    "0xaF64295dc6BDD7eA310465AdB0f8Ac99Ae0Fe0C4";

  if (!privateKey || !safeAddress) {
    console.warn(
      "⚠️  Skipping Safe signing test because PRIVATE_KEY or SAFE_ADDRESS is not set"
    );
    return;
  }

  const message = "Hello from Safe test";
  const signature = await signMessage(message, safeAddress);

  expect(typeof signature).toBe("string");
  expect(signature.length).toBeGreaterThan(0);

  console.log("✅ Safe signature:", signature);
});
