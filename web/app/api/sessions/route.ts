import { NextRequest, NextResponse } from "next/server";
import { filterMarketsWithAccess } from "@/lib/contracts/reconAccess";
import { getMarket } from "@/lib/polymarket/client";
import { getOrSet } from "@/lib/cache";

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]+$/;
const SESSION_MARKET_CACHE_TTL_MS = 60 * 1000;

export interface SessionSummary {
  conditionId: string;
  question: string;
  closed: boolean;
}

/**
 * `candidates` comes from the client's localStorage cache of markets it has paid
 * for (see lib/sessions.ts) — this route is what actually decides which of those
 * are real: each candidate is re-checked against the contract's hasAccess, and only
 * the ones that pass come back. The client-side list is a convenience index, never
 * trusted on its own.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  const candidates = request.nextUrl.searchParams.getAll("conditionId");

  if (!wallet || !HEX_ADDRESS_RE.test(wallet)) {
    return NextResponse.json({ error: "wallet query param (0x-prefixed address) is required" }, { status: 400 });
  }
  if (candidates.some((c) => !HEX_ADDRESS_RE.test(c))) {
    return NextResponse.json({ error: "conditionId query params must be 0x-prefixed hex" }, { status: 400 });
  }

  try {
    const confirmed = await filterMarketsWithAccess(candidates as `0x${string}`[], wallet as `0x${string}`);

    const sessions: SessionSummary[] = [];
    for (const conditionId of confirmed) {
      try {
        const market = await getOrSet(`market:${conditionId}`, SESSION_MARKET_CACHE_TTL_MS, () => getMarket(conditionId));
        sessions.push({ conditionId, question: market.question, closed: market.closed });
      } catch {
        sessions.push({ conditionId, question: "(market data unavailable)", closed: false });
      }
    }

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json({ error: `Failed to load sessions: ${(err as Error).message}` }, { status: 502 });
  }
}
