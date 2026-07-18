import { NextRequest, NextResponse } from "next/server";
import { checkHasAccess } from "@/lib/contracts/reconAccess";
import { isAllowlisted } from "@/lib/allowlist";

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]+$/;

/** Cheap on-chain read so the client can decide whether to show "Pay" or fetch the Digest directly. */
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
    return NextResponse.json({ hasAccess });
  } catch (err) {
    return NextResponse.json({ error: `Failed to read access status: ${(err as Error).message}` }, { status: 502 });
  }
}
