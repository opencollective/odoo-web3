import { test, expect } from "bun:test";
import { EtherscanClient } from "../src/lib/etherscan.ts";
import type { Address } from "viem";

// Helper to check if Etherscan is configured
function isEtherscanConfigured(): boolean {
  return !!process.env.ETHEREUM_ETHERSCAN_API_KEY;
}

test("Fetch token transfers from Gnosis Chain", async () => {
  if (!isEtherscanConfigured()) {
    console.log("⏭️  Skipping: Etherscan API key not configured");
    return;
  }

  const chainId = 100; // Gnosis Chain
  const walletAddress: Address = "0x6fDF0AaE33E313d9C98D2Aa19Bcd8EF777912CBf";
  const tokenAddress: Address = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430"; // EURe token
  const startBlock = 35656892;
  const endBlock = 36296724;

  // Create Etherscan client for Gnosis Chain
  const client = new EtherscanClient(chainId);

  // Fetch token transfers
  const transfers = await client.getTokenTransfers(
    walletAddress,
    tokenAddress,
    startBlock,
    endBlock
  );

  // Verify we got exactly 5 transactions
  expect(transfers.length).toBe(5);

  // Calculate running balance
  let runningBalance = 0;

  // Sort transfers by timestamp (ascending order to calculate balance correctly)
  const sortedTransfers = [...transfers].sort(
    (a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp)
  );

  console.log("\n📊 Token Transfer History:");
  console.log("=".repeat(100));

  for (const transfer of sortedTransfers) {
    const value = parseInt(transfer.value);
    const decimals = parseInt(transfer.tokenDecimal);
    const amount = value / Math.pow(10, decimals);

    // Determine if this is incoming or outgoing
    const isIncoming =
      transfer.to.toLowerCase() === walletAddress.toLowerCase();
    const displayAmount = isIncoming ? amount : -amount;

    runningBalance += displayAmount;

    const date = new Date(parseInt(transfer.timeStamp) * 1000).toISOString();
    const direction = isIncoming ? "IN  ⬇️" : "OUT ⬆️";

    console.log(
      `${direction} | Block: ${transfer.blockNumber.padStart(
        10
      )} | ${date} | ${displayAmount.toFixed(2).padStart(12)} ${
        transfer.tokenSymbol
      } | Balance: ${runningBalance.toFixed(2).padStart(12)} ${
        transfer.tokenSymbol
      }`
    );
    console.log(`     Hash: ${transfer.hash}`);
    console.log(`     From: ${transfer.from}`);
    console.log(`     To:   ${transfer.to}`);
    console.log("-".repeat(100));
  }

  console.log(
    `\n✅ Final running balance: ${runningBalance.toFixed(2)} ${
      sortedTransfers[0].tokenSymbol
    }`
  );
  console.log("=".repeat(100));

  // Verify the running balance matches expected value
  expect(runningBalance.toFixed(2)).toBe("43751.37");

  // Additional assertions to verify data integrity
  expect(sortedTransfers[0].tokenSymbol).toBe("EURe");
  expect(sortedTransfers[0].contractAddress.toLowerCase()).toBe(
    tokenAddress.toLowerCase()
  );
});
