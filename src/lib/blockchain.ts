import type { Address, Chain } from "viem";
import { createPublicClient, http } from "viem";
import { gnosis, mainnet } from "viem/chains";

/**
 * ERC20 token ABI for reading metadata
 */
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

/**
 * Token information
 */
export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Get cache file path for token info
 */
function getCacheFilePath(chainId: number, tokenAddress: Address): string {
  return `cache/getTokenInfo-${chainId}-${tokenAddress.toLowerCase()}.json`;
}

/**
 * Read token info from cache
 */
async function readFromCache(
  chainId: number,
  tokenAddress: Address
): Promise<TokenInfo | null> {
  try {
    const cacheFile = getCacheFilePath(chainId, tokenAddress);
    const data = await Deno.readTextFile(cacheFile);
    const cached = JSON.parse(data) as TokenInfo;
    console.log(`✅ Retrieved from cache: ${cached.symbol}`);
    return cached;
  } catch (error) {
    console.log(
      `❌ No cache found for ${tokenAddress} on chain ${chainId}`,
      error instanceof Error ? error.message : String(error)
    );
    // Cache miss or error reading
    return null;
  }
}

/**
 * Write token info to cache
 */
async function writeToCache(
  chainId: number,
  tokenAddress: Address,
  tokenInfo: TokenInfo
): Promise<void> {
  try {
    // Ensure cache directory exists
    await Deno.mkdir("cache", { recursive: true });

    const cacheFile = getCacheFilePath(chainId, tokenAddress);
    await Deno.writeTextFile(cacheFile, JSON.stringify(tokenInfo, null, 2));
    console.log(`💾 Cached token info to ${cacheFile}`);
  } catch (error) {
    // Log error but don't fail if caching fails
    console.warn(`⚠️  Failed to cache token info: ${error}`);
  }
}

/**
 * Get token information from the blockchain using viem
 * @param chainId - Chain ID (e.g., 100 for Gnosis, 1 for Ethereum Mainnet)
 * @param tokenAddress - Token contract address
 * @param rpcUrl - Optional custom RPC URL (uses chain default if not provided)
 * @returns Token information (name, symbol, decimals)
 */
export async function getTokenInfo(
  chainId: number,
  tokenAddress: Address,
  rpcUrl?: string
): Promise<TokenInfo> {
  console.log(
    `🪙 Fetching token info for ${tokenAddress} on chain ${chainId}...`
  );

  // Check cache first
  const cached = await readFromCache(chainId, tokenAddress);
  if (cached) {
    console.log(`✅ Retrieved from cache: ${cached.symbol}`);
    return cached;
  }

  // Map chainId to viem chain
  const chainMap: Record<number, Chain> = {
    1: mainnet,
    100: gnosis,
  };

  const chain = chainMap[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  // Create public client
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl), // Uses chain default if rpcUrl is undefined
  });

  // Fetch token metadata using client.readContract
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "name",
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
  ]);

  // Validate types
  if (
    typeof name !== "string" ||
    typeof symbol !== "string" ||
    typeof decimals !== "number"
  ) {
    throw new Error("Invalid token metadata returned from contract");
  }

  const tokenInfo: TokenInfo = {
    address: tokenAddress,
    name,
    symbol,
    decimals: Number(decimals),
  };

  console.log(`✅ Token: ${name} (${symbol}), Decimals: ${decimals}`);

  // Cache the result
  await writeToCache(chainId, tokenAddress, tokenInfo);

  return tokenInfo;
}

/**
 * Format token amount with proper decimals
 * @param amount - Raw token amount (e.g., from blockchain)
 * @param decimals - Token decimals
 * @returns Formatted amount as number
 */
export function formatTokenAmount(
  amount: string | bigint,
  decimals: number
): number {
  const value = typeof amount === "string" ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  return Number(value) / Number(divisor);
}

/**
 * Parse human-readable amount to raw token amount
 * @param amount - Human-readable amount (e.g., 1.5)
 * @param decimals - Token decimals
 * @returns Raw amount as bigint
 */
export function parseTokenAmount(amount: number, decimals: number): bigint {
  const amountStr = amount.toFixed(decimals);
  const [whole, fraction = ""] = amountStr.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0");
  return BigInt(whole + paddedFraction);
}
