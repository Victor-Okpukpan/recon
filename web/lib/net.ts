import { setDefaultResultOrder } from "node:dns";

// This host environment's outbound IPv6 route is intermittently unavailable. Node's
// fetch/undici tries IPv6 first (Happy Eyeballs) and only falls back to IPv4 after a
// timeout; when IPv6 is down that surfaces as a raw connection failure even though a
// plain `curl` (which tries IPv4 first) succeeds at the exact same moment — confirmed
// directly and repeatably. This is a process-wide, one-time setting (this module only
// needs to be imported once, anywhere), and it's Node's own documented API for the
// situation. Kept alongside fetchWithRetry below since that handles a separate failure
// mode (the connection is merely slow, not unreachable) — the two aren't redundant.
setDefaultResultOrder("ipv4first");

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;

/**
 * This sandbox's outbound connections to external APIs (Polymarket, Exa, API-Football)
 * can be slow enough — confirmed directly, several seconds to establish a connection
 * even when it ultimately succeeds — that a plain `fetch()`'s default timeout gives up
 * before a request that would have succeeded completes. A longer explicit timeout plus
 * a couple of retries fixes this without masking a real, sustained outage.
 */
export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  opts: { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}
