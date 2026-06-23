import { test, expect } from "bun:test";

import { buildOrderMessage } from "../src/server/api/monerium/safe-message.ts";
import { getSafeMessagesUrl } from "../src/lib/safe-message.ts";

test("buildOrderMessage uses full RFC3339 with the seconds zeroed (':00')", () => {
  // Monerium normalizes to the minute before hashing (so real seconds break
  // EIP-1271 verification), but the seconds field must still be present (dropping
  // it is "invalid timestamp format"). So seconds must be exactly "00".
  const message = buildOrderMessage(12.5, "EE127310138155512606682602");
  expect(message).toMatch(
    /^Send EUR 12\.5 to EE127310138155512606682602 at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/
  );
});

test("buildOrderMessage timestamp is the current minute (within 5 min, not future)", () => {
  const message = buildOrderMessage(1, "EE127310138155512606682602");
  const ts = Date.parse(message.match(/ at (.+)$/)![1]);
  const deltaMs = ts - Date.now();
  // Truncated to the minute, so it can be up to ~60s behind now, never ahead.
  expect(deltaMs).toBeLessThanOrEqual(1_000);
  expect(deltaMs).toBeGreaterThan(-61_000);
});

test("buildOrderMessage normalizes the IBAN (strips spaces, uppercases)", () => {
  const message = buildOrderMessage(100.91, "be86 0688 9108 3150");
  expect(message).toContain("to BE86068891083150 at");
  expect(message).not.toContain(" 0688 ");
});

test("getSafeMessagesUrl points at the Safe web app messages tab per chain", () => {
  const safe = "0xaF64295dc6BDD7eA310465AdB0f8Ac99Ae0Fe0C4";
  expect(getSafeMessagesUrl(safe, "gnosis")).toBe(
    `https://app.safe.global/transactions/messages?safe=gno:${safe}`
  );
  expect(getSafeMessagesUrl(safe, "chiado")).toBe(
    `https://app.safe.global/transactions/messages?safe=chiado:${safe}`
  );
});
