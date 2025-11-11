/**
 * Example: Sync token transfers to Odoo Bank Journal
 */
import type { Address } from "viem";
import { EtherscanClient } from "./src/lib/etherscan.ts";
import { recordTokenTransfers } from "./src/lib/odoo.ts";

async function main() {
  // Configuration
  const chainId = 100; // Gnosis Chain
  const walletAddress: Address = "0x6fDF0AaE33E313d9C98D2Aa19Bcd8EF777912CBf";
  const tokenAddress: Address = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430"; // EURe token

  // Optional: specify block range
  const startBlock = 35656892;
  const endBlock = 36296724;

  console.log("🚀 odoo-web3: Blockchain to Odoo Sync");
  console.log("=".repeat(60));
  console.log(`Chain ID: ${chainId} (Gnosis Chain)`);
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Token: ${tokenAddress}`);
  console.log("=".repeat(60));

  try {
    // Step 1: Fetch token transfers from blockchain explorer
    console.log("\n📡 Step 1: Fetching transfers from blockchain explorer...");
    const etherscanClient = new EtherscanClient(chainId);
    const transfers = await etherscanClient.getTokenTransfers(
      walletAddress,
      tokenAddress,
      startBlock,
      endBlock
    );
    console.log(`✅ Found ${transfers.length} transfers`);

    if (transfers.length === 0) {
      console.log("⚠️  No transfers found. Exiting.");
      return;
    }

    // Step 2: Record transfers to Odoo
    console.log("\n💾 Step 2: Recording transfers to Odoo...");
    await recordTokenTransfers({
      chainId,
      walletAddress,
      tokenAddress,
      transfers,
      // Optional: specify existing journal ID
      // journalId: 42,
    });

    console.log("\n✅ Sync complete!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error:", error);
    Deno.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  await main();
}
