import { createPublicClient, http, type Address } from "viem";
import { gnosis, gnosisChiado } from "viem/chains";
import { formatTokenAmount } from "../../../lib/blockchain.ts";

export const MONERIUM_CLIENT_ID = process.env.MONERIUM_CLIENT_ID || "";
export const MONERIUM_CLIENT_SECRET =
  process.env.MONERIUM_CLIENT_SECRET || "";
export const ENV =
  process.env.ENV === "production" ? "production" : "sandbox";

export function normalizeIban(iban: string): string {
  return iban.toUpperCase().replace(/\s/g, "");
}

const ERC20_BALANCE_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;

const EURE_TOKEN_ADDRESSES: Record<string, Address> = {
  gnosis: "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430" as Address,
  chiado: "0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71" as Address,
  ethereum: "0x39b8B6385416f4cA36a20319F70D28621895279D" as Address,
  polygon: "0xE0aEa583266584DafBB3f9C3211d5588c73fEa8d" as Address,
  arbitrum: "0x0c06cCF38114ddfc35e07427B9424adcca9F44F8" as Address,
  sepolia: "0x67b34b93ac295c985e856E5B8A20D83026b580Eb" as Address,
  arbitrumSepolia: "0xFdEed5cE7E281B4e0F163B70eBe2Cf0B10803b7B" as Address,
};

const SAFE_ABI = [
  {
    constant: true,
    inputs: [],
    name: "getOwners",
    outputs: [{ name: "", type: "address[]" }],
    type: "function",
  },
] as const;

const chainMap: Record<string, typeof gnosis | typeof gnosisChiado> = {
  gnosis: gnosis,
  chiado: gnosisChiado,
};

export async function getBalance(
  address: Address,
  chain: string
): Promise<string> {
  console.log(`Getting balance of ${address} on ${chain}`);
  const viemChain = chainMap[chain.toLowerCase()];
  if (!viemChain) {
    throw new Error(
      `Unsupported chain: ${chain}. Supported chains: gnosis, chiado`
    );
  }

  const eureAddress = EURE_TOKEN_ADDRESSES[chain.toLowerCase()];
  if (!eureAddress) {
    throw new Error(`EURe token address not configured for chain: ${chain}`);
  }

  const client = createPublicClient({
    chain: viemChain,
    transport: http(),
  });

  const balance = (await client.readContract({
    address: eureAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;

  const formattedBalance = formatTokenAmount(balance, 18).toFixed(2);

  return formattedBalance;
}

export async function getSafeSignatories(
  address: Address,
  chain: string
): Promise<Address[] | null> {
  const viemChain = chainMap[chain.toLowerCase()];
  if (!viemChain) {
    return null;
  }

  const client = createPublicClient({
    chain: viemChain,
    transport: http(),
  });

  try {
    const owners = (await client.readContract({
      address: address,
      abi: SAFE_ABI,
      functionName: "getOwners",
    })) as Address[];

    return Array.isArray(owners) ? owners : null;
  } catch (error) {
    // If the contract doesn't have getOwners or is not a Safe, return null
    console.log(
      `Address ${address} on ${chain} is not a Safe contract or getOwners failed:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
