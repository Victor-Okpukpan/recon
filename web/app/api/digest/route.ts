import { NextRequest, NextResponse } from "next/server";
import { checkHasAccess } from "@/lib/contracts/reconAccess";
import { getMarketDigest } from "@/lib/digest/getMarketDigest";
import { isAllowlisted } from "@/lib/allowlist";
import { describeAnthropicError } from "@/lib/anthropicClient";

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]+$/;

// A fresh Digest chains several sequential Claude calls (classification, claim
// extraction, consistency check, summary + leaning) and can genuinely take
// 30-90s+ for a content-heavy market — well past a serverless platform's default
// function timeout. 60s is the ceiling Vercel allows on its Hobby plan; raise this
// if deployed on a plan that allows more.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get("conditionId");
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!conditionId || !HEX_ADDRESS_RE.test(conditionId)) {
    return NextResponse.json({ error: "conditionId query param (0x-prefixed hex) is required" }, { status: 400 });
  }
  if (!wallet || !HEX_ADDRESS_RE.test(wallet)) {
    return NextResponse.json({ error: "wallet query param (0x-prefixed address) is required" }, { status: 400 });
  }

  try {
    const hasAccess = isAllowlisted(wallet) || (await checkHasAccess(conditionId as `0x${string}`, wallet as `0x${string}`));
    if (!hasAccess) {
      return NextResponse.json(
        { error: "This wallet has not unlocked this market's Digest yet — call payForAccess first." },
        { status: 402 }
      );
    }

    const digest = await getMarketDigest(conditionId);
    return NextResponse.json(digest);
  } catch (err) {
    return NextResponse.json({ error: `Failed to build digest: ${describeAnthropicError(err)}` }, { status: 502 });
  }
}
