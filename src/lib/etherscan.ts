import type { Address, Hash } from "viem";

export type EtherscanTransaction = {
  blockNumber: string;
  timeStamp: string;
  hash: Hash;
  nonce: string;
  blockHash: Hash;
  transactionIndex: string;
  from: Address;
  to: Address;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
};

export type EtherscanTokenTransfer = {
  blockNumber: string;
  timeStamp: string;
  hash: Hash;
  nonce: string;
  blockHash: Hash;
  from: Address;
  contractAddress: Address;
  to: Address;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
};

export type EtherscanConfig = {
  apiUrl: string;
  apiKey?: string;
};

/**
 * Client for interacting with Etherscan-compatible APIs (Etherscan, GnosisScan, etc.)
 */
export class EtherscanClient {
  private apiUrl: string;
  private apiKey?: string;
  private chainId: number;
  private rateLimitDelay: number = 200; // 200ms between requests (5 req/sec)

  constructor(chainId: number) {
    this.apiUrl = "https://api.etherscan.io/v2/api";
    this.apiKey = Deno.env.get("ETHEREUM_ETHERSCAN_API_KEY");
    this.chainId = chainId;

    if (!this.apiKey) {
      throw new Error("Etherscan API key is required");
    }
  }

  /**
   * Make a rate-limited API request
   */
  private async request<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(this.apiUrl);

    // Add API key if available
    if (this.apiKey) {
      params.apikey = this.apiKey;
    }

    params.chainid = this.chainId.toString();

    // Add all parameters to URL
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Etherscan API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === "0" && data.message !== "No transactions found") {
      throw new Error(`Etherscan API error: ${data.message || data.result}`);
    }

    return data.result;
  }

  /**
   * Get normal transactions for an address
   * @param address - The address to get transactions for
   * @param startBlock - Starting block number (optional)
   * @param endBlock - Ending block number (optional)
   * @param page - Page number for pagination (optional)
   * @param offset - Number of transactions per page (optional, max 10000)
   */
  async getTransactions(
    address: Address,
    startBlock?: number,
    endBlock?: number,
    page: number = 1,
    offset: number = 10000
  ): Promise<EtherscanTransaction[]> {
    const params: Record<string, string> = {
      module: "account",
      action: "txlist",
      address,
      sort: "desc",
      page: page.toString(),
      offset: offset.toString(),
    };

    if (startBlock !== undefined) {
      params.startblock = startBlock.toString();
    }
    if (endBlock !== undefined) {
      params.endblock = endBlock.toString();
    }

    try {
      const result = await this.request<EtherscanTransaction[]>(params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      // If no transactions found, return empty array
      if (
        error instanceof Error &&
        error.message.includes("No transactions found")
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get all normal transactions for an address (handles pagination automatically)
   * @param address - The address to get transactions for
   * @param startBlock - Starting block number (optional)
   * @param endBlock - Ending block number (optional)
   * @param limit - Maximum number of transactions to return (optional)
   */
  async getAllTransactions(
    address: Address,
    startBlock?: number,
    endBlock?: number,
    limit?: number
  ): Promise<EtherscanTransaction[]> {
    const allTransactions: EtherscanTransaction[] = [];
    let page = 1;
    const offset = 10000; // Max allowed by API

    while (true) {
      console.log(`📥 Fetching normal transactions page ${page}...`);
      const transactions = await this.getTransactions(
        address,
        startBlock,
        endBlock,
        page,
        offset
      );

      if (transactions.length === 0) {
        break;
      }

      allTransactions.push(...transactions);

      if (limit && allTransactions.length >= limit) {
        console.log(`✅ Reached limit of ${limit} transactions`);
        return allTransactions.slice(0, limit);
      }

      // If we got fewer than offset, we've reached the end
      if (transactions.length < offset) {
        break;
      }

      page++;
    }

    return allTransactions;
  }

  /**
   * Get ERC20 token transfer events for an address
   * @param address - The address to get token transfers for
   * @param contractAddress - Filter by token contract address (optional)
   * @param startBlock - Starting block number (optional)
   * @param endBlock - Ending block number (optional)
   * @param page - Page number for pagination (optional)
   * @param offset - Number of transfers per page (optional, max 10000)
   */
  async getTokenTransfers(
    address: Address,
    contractAddress?: Address,
    startBlock?: number,
    endBlock?: number,
    page: number = 1,
    offset: number = 10000
  ): Promise<EtherscanTokenTransfer[]> {
    const params: Record<string, string> = {
      module: "account",
      action: "tokentx",
      address,
      sort: "desc",
      page: page.toString(),
      offset: offset.toString(),
    };

    if (contractAddress) {
      params.contractaddress = contractAddress;
    }
    if (startBlock !== undefined) {
      params.startblock = startBlock.toString();
    }
    if (endBlock !== undefined) {
      params.endblock = endBlock.toString();
    }

    try {
      const result = await this.request<EtherscanTokenTransfer[]>(params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      // If no transactions found, return empty array
      if (
        error instanceof Error &&
        error.message.includes("No transactions found")
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get all ERC20 token transfers for an address (handles pagination automatically)
   * @param address - The address to get token transfers for
   * @param tokenConfigs - Token configurations with addresses and block ranges
   * @param startBlock - Starting block number (optional)
   * @param endBlock - Ending block number (optional)
   */
  async getAllTokenTransfers(
    address: Address,
    tokenConfigs?: Record<
      string,
      { address: Address; startBlock?: number; endBlock?: number }
    >,
    startBlock?: number,
    endBlock?: number
  ): Promise<EtherscanTokenTransfer[]> {
    // If specific token configs are provided, fetch for each one
    if (tokenConfigs) {
      const allTransfers: EtherscanTokenTransfer[] = [];

      for (const [tokenName, config] of Object.entries(tokenConfigs)) {
        const tokenStartBlock = config.startBlock || startBlock;
        const tokenEndBlock = config.endBlock || endBlock;

        console.log(
          `🪙 Fetching token transfers for ${tokenName} (${config.address})...`
        );
        let page = 1;
        const offset = 10000;

        while (true) {
          const transfers = await this.getTokenTransfers(
            address,
            config.address,
            tokenStartBlock,
            tokenEndBlock,
            page,
            offset
          );

          if (transfers.length === 0) {
            break;
          }

          allTransfers.push(...transfers);

          if (transfers.length < offset) {
            break;
          }

          page++;
        }
      }

      return allTransfers;
    }

    // Otherwise, fetch all token transfers
    const allTransfers: EtherscanTokenTransfer[] = [];
    let page = 1;
    const offset = 10000;

    while (true) {
      console.log(`🪙 Fetching all token transfers page ${page}...`);
      const transfers = await this.getTokenTransfers(
        address,
        undefined,
        startBlock,
        endBlock,
        page,
        offset
      );

      if (transfers.length === 0) {
        break;
      }

      allTransfers.push(...transfers);

      if (transfers.length < offset) {
        break;
      }

      page++;
    }

    return allTransfers;
  }
}

/**
 * Create an Etherscan client from chain configuration
 * @param chainConfig - Chain configuration object with explorer_api URL
 * @param apiKey - Optional API key for higher rate limits
 */
export function createEtherscanClient(chainId: number): EtherscanClient {
  return new EtherscanClient(chainId);
}
