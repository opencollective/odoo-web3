/**
 * Simple file-based cache for API responses.
 *
 * Cache files are stored in the `cache/` directory at the project root.
 * To refresh cached data, delete the relevant file(s) under `cache/`:
 *
 *   rm cache/etherscan-*.json      # refresh all Etherscan/Blockscout data
 *   rm cache/monerium-*.json       # refresh all Monerium data
 *   rm -rf cache/                  # refresh everything
 */

import { mkdir, unlink } from "fs/promises";

const CACHE_DIR = "cache";

/**
 * Read a JSON value from the file cache.
 * Returns null on cache miss or any read error.
 */
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const data = await Bun.file(`${CACHE_DIR}/${key}.json`).text();
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON value to the file cache.
 * Silently ignores write errors.
 */
/**
 * Delete a cached value by key.
 * Silently ignores errors (e.g. file doesn't exist).
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await unlink(`${CACHE_DIR}/${key}.json`);
  } catch {
    // ignore
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await Bun.write(
      `${CACHE_DIR}/${key}.json`,
      JSON.stringify(value, null, 2)
    );
  } catch (error) {
    console.warn(`Cache write failed for ${key}:`, error);
  }
}
