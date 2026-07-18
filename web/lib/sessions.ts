"use client";

/**
 * Client-side convenience index of markets this browser has paid to unlock —
 * NOT the source of truth for access. Every read of this list is re-verified
 * on-chain (see /api/sessions + filterMarketsWithAccess) before anything is
 * shown as unlocked. This exists only because Monad testnet's RPC caps
 * eth_getLogs to a 100-block range, making a full AccessPaid history scan
 * impractical without a dedicated indexer.
 */

function storageKey(wallet: string): string {
  return `recon:paid-markets:${wallet.toLowerCase()}`;
}

export function recordPaidMarket(wallet: string, conditionId: string): void {
  if (typeof window === "undefined") return;
  const key = storageKey(wallet);
  const existing = getPaidMarketCandidates(wallet);
  if (!existing.includes(conditionId)) {
    window.localStorage.setItem(key, JSON.stringify([...existing, conditionId]));
  }
}

export function getPaidMarketCandidates(wallet: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(wallet));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
