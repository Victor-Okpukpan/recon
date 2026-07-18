/**
 * Dev/tester allowlist — wallets in RECON_ALLOWLISTED_WALLETS (comma-separated,
 * server-only env var) get Digest access without paying on-chain. This is layered
 * on top of the real hasAccess() check at each call site, not baked into it, so
 * the on-chain check stays the actual source of truth and this bypass stays
 * visible and easy to remove (empty the env var to disable it entirely).
 */
export function isAllowlisted(wallet: string): boolean {
  const raw = process.env.RECON_ALLOWLISTED_WALLETS;
  if (!raw) return false;
  const allowlist = raw.split(",").map((a) => a.trim().toLowerCase());
  return allowlist.includes(wallet.toLowerCase());
}
