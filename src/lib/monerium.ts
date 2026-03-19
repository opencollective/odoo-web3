/**
 * Monerium API client for fetching order metadata.
 */
import { readCache, writeCache } from "./cache.ts";

export interface MoneriumOrder {
  id: string;
  kind: "redeem" | "issue"; // redeem = outgoing SEPA, issue = incoming mint
  profile: string;
  address: string;
  chain: string;
  currency: string;
  amount: string;
  counterpart: {
    identifier: {
      standard: string;
      iban?: string;
    };
    details: {
      name?: string;
      companyName?: string;
      firstName?: string;
      lastName?: string;
      country?: string;
    };
  };
  memo?: string;
  state: string;
  meta: {
    placedAt: string;
    processedAt?: string;
    txHashes?: string[];
  };
}

export interface MoneriumAddress {
  profile: string;
  address: string;
  chains: string[];
  redeemable: string[];
}

export class MoneriumClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private clientId: string;
  private clientSecret: string;
  private environment: string;

  constructor(
    clientId: string,
    clientSecret: string,
    environment: "production" | "sandbox" = "sandbox"
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.environment = environment;
    this.baseUrl =
      environment === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";
  }

  async authenticate(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Monerium auth failed: ${error.error || response.statusText}`
      );
    }

    const data = await response.json();
    this.accessToken = data.access_token;
  }

  /**
   * Get all addresses linked to this Monerium account.
   */
  async getAddresses(): Promise<MoneriumAddress[]> {
    const cacheKey = `monerium-addresses-${this.environment}`;
    const cached = await readCache<MoneriumAddress[]>(cacheKey);
    if (cached) {
      console.log(`[cache] Using cached Monerium addresses (${cached.length} entries)`);
      return cached;
    }

    if (!this.accessToken) throw new Error("Not authenticated");

    const response = await fetch(`${this.baseUrl}/addresses`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.monerium.api-v2+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch addresses: ${response.statusText}`);
    }

    const data = await response.json();
    const addresses = data.addresses || [];
    await writeCache(cacheKey, addresses);
    return addresses;
  }

  /**
   * Check if an address is linked to this Monerium account.
   */
  async hasAddress(address: string): Promise<boolean> {
    const addresses = await this.getAddresses();
    return addresses.some(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    );
  }

  /**
   * Fetch all orders for a given address.
   */
  async getOrders(address: string): Promise<MoneriumOrder[]> {
    const cacheKey = `monerium-orders-${this.environment}-${address.toLowerCase()}`;
    const cached = await readCache<MoneriumOrder[]>(cacheKey);
    if (cached) {
      console.log(`[cache] Using cached Monerium orders (${cached.length} entries) for ${address}`);
      return cached;
    }

    if (!this.accessToken) throw new Error("Not authenticated");

    const url = new URL(`${this.baseUrl}/orders`);
    url.searchParams.set("address", address);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.monerium.api-v2+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const data = await response.json();
    const orders = Array.isArray(data) ? data : data.orders || [];
    await writeCache(cacheKey, orders);
    return orders;
  }

  /**
   * Build a map from tx hash → order for quick lookup.
   */
  async getOrdersByTxHash(
    address: string
  ): Promise<Map<string, MoneriumOrder>> {
    const orders = await this.getOrders(address);
    const map = new Map<string, MoneriumOrder>();

    for (const order of orders) {
      if (order.meta.txHashes) {
        for (const txHash of order.meta.txHashes) {
          map.set(txHash.toLowerCase(), order);
        }
      }
    }

    return map;
  }
}
