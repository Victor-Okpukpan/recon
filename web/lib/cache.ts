import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Upstash Redis (via Vercel's marketplace integration — env vars keep the legacy
// KV_ prefix for backward compatibility with @vercel/kv) when connected; this is the
// real, shared-across-invocations cache for a serverless deployment, where neither an
// in-memory Map nor the local disk cache below survives between function invocations.
const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

// Local-dev-only fallback, used when no Redis connection is configured: a fresh Digest
// recompute is several real Claude API calls (classification, claim extraction +
// consistency, summary, leaning), so losing that cache to a `next dev` restart burns
// real API credits for no reason. This does NOT help in a serverless production
// deployment without Redis configured — there's no persistent filesystem between
// invocations there, so it would silently degrade to in-memory-only in that case.
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

/** Per-key cache with a staleness timer. Checks memory first (fast path within a single
 * warm instance), then Redis if connected, otherwise the local disk cache — then
 * recomputes via `fn` and writes the result back to whichever backend is active. */
export async function getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const memEntry = store.get(key) as CacheEntry<T> | undefined;
  if (memEntry && memEntry.expiresAt > Date.now()) {
    return memEntry.value;
  }

  if (redis) {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      store.set(key, { value: cached, expiresAt: Date.now() + ttlMs });
      return cached;
    }

    const value = await fn();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    await redis.set(key, value, { px: ttlMs });
    return value;
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
  if (redis) void redis.del(key);
}
