import { NextRequest, NextResponse } from "next/server";
import { listSamplingMarkets } from "@/lib/polymarket/client";
import { getOrSet } from "@/lib/cache";

const MARKETS_LIST_CACHE_TTL_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

  try {
    const page = await getOrSet(`markets:${cursor ?? "start"}`, MARKETS_LIST_CACHE_TTL_MS, () =>
      listSamplingMarkets(cursor)
    );
    return NextResponse.json(page);
  } catch (err) {
    return NextResponse.json({ error: `Failed to list markets: ${(err as Error).message}` }, { status: 502 });
  }
}
