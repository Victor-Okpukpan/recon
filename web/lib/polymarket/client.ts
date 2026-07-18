import { fetchWithRetry } from "../net";

/**
 * Read-only Polymarket client. Polymarket is on Polygon; Monad is where Recon
 * Access lives. This file must never import anything from lib/contracts to
 * keep that seam explicit. Uses direct `fetch()` against the CLOB REST API
 * rather than the `@polymarket/clob-client-v2` SDK, which isn't a dependency here.
 */
const CLOB_HOST = "https://clob.polymarket.com";
const INITIAL_CURSOR = "MA==";

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketMarket {
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time?: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  tags?: string[];
  tokens: PolymarketToken[];
}

export interface PolymarketPage {
  limit: number;
  count: number;
  next_cursor: string;
  data: PolymarketMarket[];
}

/** Browse markets eligible for sampling/liquidity rewards — a reasonable live "trending markets" feed. */
export async function listSamplingMarkets(nextCursor?: string): Promise<PolymarketPage> {
  const url = new URL(`${CLOB_HOST}/sampling-markets`);
  url.searchParams.set("next_cursor", nextCursor ?? INITIAL_CURSOR);

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Polymarket sampling-markets failed: ${res.status} ${await res.text()}`);
  }
  const page = (await res.json()) as Partial<PolymarketPage>;
  if (!Array.isArray(page.data)) {
    throw new Error("Polymarket sampling-markets response was missing its data array");
  }
  return page as PolymarketPage;
}

/** Full detail for a single market once the user selects one, keyed by Polymarket's conditionId. */
export async function getMarket(conditionId: string): Promise<PolymarketMarket> {
  const res = await fetchWithRetry(`${CLOB_HOST}/markets/${conditionId}`);
  if (!res.ok) {
    throw new Error(`Polymarket markets/${conditionId} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as PolymarketMarket;
}

export interface PricePoint {
  t: number;
  p: number;
}

// Minute-granularity fidelity per interval. Polymarket enforces a hard minimum for
// "1w" (5) — confirmed live, it 400s without an explicit fidelity at that range.
// The others don't require one but get a default here anyway to bound response size
// (e.g. "max" without one returns raw per-trade points across the market's whole life).
const FIDELITY_MINUTES: Record<"1h" | "6h" | "1d" | "1w" | "max", number> = {
  "1h": 1,
  "6h": 5,
  "1d": 5,
  "1w": 60,
  max: 1440,
};

/** Historical price series for one outcome token — same data Polymarket's own price chart plots. */
export async function getPriceHistory(tokenId: string, interval: "1h" | "6h" | "1d" | "1w" | "max" = "1w"): Promise<PricePoint[]> {
  const url = new URL(`${CLOB_HOST}/prices-history`);
  url.searchParams.set("market", tokenId);
  url.searchParams.set("interval", interval);
  url.searchParams.set("fidelity", String(FIDELITY_MINUTES[interval]));

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Polymarket prices-history failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { history?: PricePoint[] };
  if (!Array.isArray(body.history)) {
    throw new Error("Polymarket prices-history response was missing its history array");
  }
  return body.history;
}
