import { test, expect } from "bun:test";

import { buildOrderMessage } from "../src/server/api/monerium/safe-message.ts";
import { getSafeMessagesUrl } from "../src/lib/safe-message.ts";

test("buildOrderMessage produces the Monerium order format with a UTC timestamp", () => {
  const message = buildOrderMessage(12.5, "EE127310138155512606682602");
  expect(message).toMatch(
    /^Send EUR 12\.5 to EE127310138155512606682602 at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );
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
