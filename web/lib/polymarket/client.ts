import { ClobClient, Chain } from "@polymarket/clob-client-v2";

/**
 * Read-only Polymarket client. Polymarket is on Polygon; Monad is where Recon
 * Access lives. This file must never import anything from lib/contracts to
 * keep that seam explicit.
 */
const CLOB_HOST = "https://clob.polymarket.com";

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

let clobClient: ClobClient | null = null;

function getClobClient(): ClobClient {
  if (!clobClient) {
    clobClient = new ClobClient({ host: CLOB_HOST, chain: Chain.POLYGON });
  }
  return clobClient;
}

/** Browse markets eligible for sampling/liquidity rewards — a reasonable live "trending markets" feed. */
export async function listSamplingMarkets(nextCursor?: string): Promise<PolymarketPage> {
  const page = await getClobClient().getSamplingMarkets(nextCursor);
  return page as unknown as PolymarketPage;
}

/** Full detail for a single market once the user selects one, keyed by Polymarket's conditionId. */
export async function getMarket(conditionId: string): Promise<PolymarketMarket> {
  const market = await getClobClient().getMarket(conditionId);
  return market as PolymarketMarket;
}
