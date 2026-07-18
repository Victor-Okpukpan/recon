import { getMarket } from "../polymarket/client";
import { resolveMarketSources } from "../sources/orchestrate";
import { getOrSet } from "../cache";
import { evaluateThreshold, type ThresholdResult } from "./threshold";
import { extractClaimsAndConsistency } from "./extractClaimsAndConsistency";
import { summarizeDigest } from "./summarize";
import { deriveLeaning, type Leaning } from "./leaning";
import type { Claim, ContradictionPair } from "./types";

// Deliberately generous: a Digest recompute costs several real Claude API calls, and
// news/market sentiment doesn't meaningfully shift minute-to-minute for most markets.
const MARKET_CACHE_TTL_MS = 60 * 60 * 1000;
const SOURCES_CACHE_TTL_MS = 30 * 60 * 1000;
const DIGEST_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export interface DigestSourceSummary {
  id: string;
  kind: "sports" | "general";
  label: string;
  url?: string;
  publishedAt: string;
}

export interface MarketDigest {
  category: "sports" | "general";
  sourceCount: number;
  sources: DigestSourceSummary[];
  threshold: ThresholdResult;
  claims: Claim[];
  contradictions: ContradictionPair[];
  summary: string;
  /** Null when Inconclusive — there isn't enough evidence to lean either way. */
  leaning: Leaning | null;
}

function toSourceSummary(s: { id: string; kind: "sports" | "general"; label: string; url?: string; publishedAt: string }): DigestSourceSummary {
  return { id: s.id, kind: s.kind, label: s.label, url: s.url, publishedAt: s.publishedAt };
}

/**
 * Full Digest: source resolution (cached, cheap) → count-based threshold check
 * (skips the LLM claim-extraction cost entirely if already Inconclusive) →
 * claim extraction + consistency check → final threshold (contradiction rate
 * included for the general category) → plain-language summary. The whole result
 * is cached separately from raw sources since claim extraction/summarization is
 * the expensive step. `sources` is carried through so the UI can resolve a
 * claim's `sourceId` back to a real title/link instead of showing an opaque id.
 */
export async function getMarketDigest(conditionId: string): Promise<MarketDigest> {
  return getOrSet(`digest:${conditionId}`, DIGEST_CACHE_TTL_MS, async () => {
    // Was an uncached, fresh Polymarket call on every single digest attempt (including
    // every retry) — one more real point of failure exposure to this sandbox's network
    // flakiness for data that barely changes. Caching it removes that entirely once any
    // one attempt succeeds.
    const market = await getOrSet(`market:${conditionId}`, MARKET_CACHE_TTL_MS, () => getMarket(conditionId));
    const resolved = await getOrSet(`sources:${conditionId}`, SOURCES_CACHE_TTL_MS, () => resolveMarketSources(market));
    const sources = resolved.sources.map(toSourceSummary);

    const countThreshold = evaluateThreshold({ kind: resolved.category, sources: resolved.sources });
    if (countThreshold.status === "inconclusive") {
      return {
        category: resolved.category,
        sourceCount: resolved.sources.length,
        sources,
        threshold: countThreshold,
        claims: [],
        contradictions: [],
        summary: "",
        leaning: null,
      };
    }

    const { claims, contradictions, contradictionRate } = await extractClaimsAndConsistency(resolved.sources);
    const finalThreshold = evaluateThreshold({
      kind: resolved.category,
      sources: resolved.sources,
      contradictionRate,
    });

    let summary = "";
    let leaning: Leaning | null = null;
    if (finalThreshold.status === "sufficient") {
      const outcomes = market.tokens.map((t) => t.outcome);
      [summary, leaning] = await Promise.all([
        summarizeDigest(market.question, claims, contradictions),
        deriveLeaning(market.question, outcomes, claims, contradictions),
      ]);
    }

    return {
      category: resolved.category,
      sourceCount: resolved.sources.length,
      sources,
      threshold: finalThreshold,
      claims,
      contradictions,
      summary,
      leaning,
    };
  });
}
