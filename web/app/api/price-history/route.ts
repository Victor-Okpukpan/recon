import { NextRequest, NextResponse } from "next/server";
import { getPriceHistory } from "@/lib/polymarket/client";
import { getOrSet } from "@/lib/cache";

const PRICE_HISTORY_CACHE_TTL_MS = 60 * 1000;
const VALID_INTERVALS = new Set(["1h", "6h", "1d", "1w", "max"]);

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get("tokenId");
  const intervalParam = request.nextUrl.searchParams.get("interval") ?? "1w";

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId query param is required" }, { status: 400 });
  }
  if (!VALID_INTERVALS.has(intervalParam)) {
    return NextResponse.json({ error: "interval must be one of 1h, 6h, 1d, 1w, max" }, { status: 400 });
  }
  const interval = intervalParam as "1h" | "6h" | "1d" | "1w" | "max";

  try {
    const history = await getOrSet(`price-history:${tokenId}:${interval}`, PRICE_HISTORY_CACHE_TTL_MS, () =>
      getPriceHistory(tokenId, interval)
    );
    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch price history: ${(err as Error).message}` }, { status: 502 });
  }
}
