import { test, expect } from "bun:test";

import {
  buildOrderMessage,
  SIGNATURE_VALIDITY_BUFFER_MS,
} from "../src/server/api/monerium/safe-message.ts";
import { getSafeMessagesUrl } from "../src/lib/safe-message.ts";

test("buildOrderMessage produces the Monerium order format with a UTC timestamp", () => {
  const message = buildOrderMessage(12.5, "EE127310138155512606682602");
  expect(message).toMatch(
    /^Send EUR 12\.5 to EE127310138155512606682602 at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );
});

test("buildOrderMessage stamps the timestamp ~5 minutes ahead for signing headroom", () => {
  expect(SIGNATURE_VALIDITY_BUFFER_MS).toBe(5 * 60 * 1000);
  const message = buildOrderMessage(1, "EE127310138155512606682602");
  const ts = Date.parse(message.match(/ at (.+)$/)![1]);
  const aheadMs = ts - Date.now();
  // Should be close to +5min (allow a few seconds of slack for execution time).
  expect(aheadMs).toBeGreaterThan(SIGNATURE_VALIDITY_BUFFER_MS - 10_000);
  expect(aheadMs).toBeLessThanOrEqual(SIGNATURE_VALIDITY_BUFFER_MS + 1_000);
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
