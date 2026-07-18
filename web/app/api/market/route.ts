import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/polymarket/client";
import { getOrSet } from "@/lib/cache";

const MARKET_CACHE_TTL_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get("conditionId");
  if (!conditionId) {
    return NextResponse.json({ error: "conditionId query param is required" }, { status: 400 });
  }

  try {
    const market = await getOrSet(`market:${conditionId}`, MARKET_CACHE_TTL_MS, () => getMarket(conditionId));
    return NextResponse.json(market);
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch market: ${(err as Error).message}` }, { status: 502 });
  }
}
