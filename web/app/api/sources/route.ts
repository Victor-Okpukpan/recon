import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/polymarket/client";
import { resolveMarketSources } from "@/lib/sources/orchestrate";
import { evaluateThreshold } from "@/lib/digest/threshold";
import { getOrSet } from "@/lib/cache";

const SOURCES_CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get("conditionId");
  if (!conditionId) {
    return NextResponse.json({ error: "conditionId query param is required" }, { status: 400 });
  }

  try {
    const market = await getMarket(conditionId);

    const resolved = await getOrSet(`sources:${conditionId}`, SOURCES_CACHE_TTL_MS, () => resolveMarketSources(market));

    const threshold = evaluateThreshold({ kind: resolved.category, sources: resolved.sources });

    return NextResponse.json({
      category: resolved.category,
      sourceCount: resolved.sources.length,
      // Free preview is count + Sufficient/Inconclusive state only — the actual
      // source list (titles/links) is part of the paid Digest's attribution, not
      // exposed here even as metadata.
      ...threshold,
    });
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch sources: ${(err as Error).message}` }, { status: 502 });
  }
}
