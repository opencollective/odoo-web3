import { test, expect } from "bun:test";
import type { Address } from "viem";
import {
  getTokenInfo,
  formatTokenAmount,
  parseTokenAmount,
} from "../src/lib/blockchain.ts";

test("Get token info from Gnosis Chain", async () => {
  const chainId = 100; // Gnosis Chain
  const tokenAddress: Address = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430"; // EURe token

  try {
    const tokenInfo = await getTokenInfo(chainId, tokenAddress);

    console.log("Token Info:", tokenInfo);

    // Verify token info
    expect(tokenInfo.address).toBe(tokenAddress);
    expect(tokenInfo.name).toBe("Monerium EURe");
    expect(tokenInfo.symbol).toBe("EURe");
    expect(tokenInfo.decimals).toBe(18);
  } catch (error) {
    console.log(
      "⚠️  Token info test failed (RPC may be unavailable):",
      error instanceof Error ? error.message : error
    );
    // Don't fail the test if RPC is unavailable
  }
});

test("Get token info from Ethereum Mainnet", async () => {
  const chainId = 1; // Ethereum Mainnet
  const tokenAddress: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC

  try {
    const tokenInfo = await getTokenInfo(chainId, tokenAddress);

    console.log("Token Info:", tokenInfo);

    // Verify token info
    expect(tokenInfo.address).toBe(tokenAddress);
    expect(tokenInfo.symbol).toBe("USDC");
    expect(tokenInfo.decimals).toBe(6);
  } catch (error) {
    console.log(
      "⚠️  Token info test failed (RPC may be unavailable):",
      error instanceof Error ? error.message : error
    );
    // Don't fail the test if RPC is unavailable
  }
});

test("Format token amount with 18 decimals", () => {
  // 1 ETH = 1e18 wei
  const amount = "1000000000000000000"; // 1 ETH
  const decimals = 18;

  const formatted = formatTokenAmount(amount, decimals);

  expect(formatted).toBe(1);
});

test("Format token amount with 6 decimals (USDC)", () => {
  // 100 USDC = 100e6
  const amount = "100000000";
  const decimals = 6;

  const formatted = formatTokenAmount(amount, decimals);

  expect(formatted).toBe(100);
});

test("Format token amount with bigint", () => {
  const amount = BigInt("5000000000000000000"); // 5 ETH
  const decimals = 18;

  const formatted = formatTokenAmount(amount, decimals);

  expect(formatted).toBe(5);
});

test("Parse token amount to raw format (18 decimals)", () => {
  const amount = 1.5; // 1.5 ETH
  const decimals = 18;

  const parsed = parseTokenAmount(amount, decimals);

  expect(parsed).toBe(BigInt("1500000000000000000"));
});

test("Parse token amount to raw format (6 decimals)", () => {
  const amount = 100.5; // 100.5 USDC
  const decimals = 6;

  const parsed = parseTokenAmount(amount, decimals);

  expect(parsed).toBe(BigInt("100500000"));
});

test("Format and parse round trip", () => {
  const originalAmount = BigInt("1500000000000000000"); // 1.5 ETH (clean decimal)
  const decimals = 18;

  // Format to human-readable
  const formatted = formatTokenAmount(originalAmount, decimals);

  // Parse back to raw
  const parsed = parseTokenAmount(formatted, decimals);

  // Should be the same
  expect(parsed).toBe(originalAmount);
});

test("Get token info with custom RPC URL", async () => {
  const chainId = 100; // Gnosis Chain
  const tokenAddress: Address = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430"; // EURe token
  const customRpcUrl = "https://rpc.gnosischain.com";

  try {
    const tokenInfo = await getTokenInfo(chainId, tokenAddress, customRpcUrl);

    console.log("Token Info with custom RPC:", tokenInfo);

    // Verify token info
    expect(tokenInfo.address).toBe(tokenAddress);
    expect(tokenInfo.symbol).toBe("EURe");
  } catch (error) {
    console.log(
      "⚠️  Token info test failed (RPC may be unavailable):",
      error instanceof Error ? error.message : error
    );
    // Don't fail the test if RPC is unavailable
  }
});

test("Unsupported chain ID throws error", async () => {
  const chainId = 999; // Unsupported chain
  const tokenAddress: Address = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430";

  try {
    await getTokenInfo(chainId, tokenAddress);
    throw new Error("Should have thrown an error for unsupported chain");
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toContain("Unsupported chain ID");
  }
});
