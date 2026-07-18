import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Local-dev-only persistence: a fresh Digest recompute is several real Claude API
// calls (classification, claim extraction, consistency check, summary, leaning), so
// losing that cache to a `next dev` restart burns real API credits for no reason.
// This does NOT help in a serverless production deployment — there's no persistent
// filesystem between invocations there, so it silently degrades to in-memory-only in
// that environment. A KV store (Vercel KV, Upstash Redis) would be the real fix if
// this ships to serverless production.
const CACHE_DIR = join(process.cwd(), ".cache");

function cacheFilePath(key: string): string {
  return join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

async function readFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    return JSON.parse(await readFile(cacheFilePath(key), "utf-8")) as CacheEntry<T>;
  } catch {
    return null;
  }
}

async function writeToDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFilePath(key), JSON.stringify(entry), "utf-8");
  } catch {
    // Best-effort — an in-memory-only cache still works fine if the disk write fails.
  }
}

/** Per-key cache with a staleness timer. Returns the cached value if still fresh (checking
 * memory first, then disk), otherwise recomputes via `fn` and caches the result both ways. */
export async function getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const memEntry = store.get(key) as CacheEntry<T> | undefined;
  if (memEntry && memEntry.expiresAt > Date.now()) {
    return memEntry.value;
  }

  const diskEntry = await readFromDisk<T>(key);
  if (diskEntry && diskEntry.expiresAt > Date.now()) {
    store.set(key, diskEntry);
    return diskEntry.value;
  }

  const value = await fn();
  const entry = { value, expiresAt: Date.now() + ttlMs };
  store.set(key, entry);
  await writeToDisk(key, entry);
  return value;
}

export function invalidate(key: string): void {
  store.delete(key);
}
