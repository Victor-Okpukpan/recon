"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { OutcomeBadge } from "@/components/OutcomeBadge";
import { PriceHistoryChart, type PriceSeries } from "@/components/PriceHistoryChart";
import { MarketPageSkeleton } from "@/components/MarketPageSkeleton";
import { cn } from "@/lib/utils";
import { usePayForAccess } from "@/lib/contracts/usePayForAccess";
import { recordPaidMarket } from "@/lib/sessions";
import { showErrorToast } from "@/lib/toast";
import type { PolymarketMarket, PricePoint } from "@/lib/polymarket/client";
import type { ThresholdResult } from "@/lib/digest/threshold";
import type { MarketDigest, DigestSourceSummary } from "@/lib/digest/getMarketDigest";

interface SourcesPreview {
  category: "sports" | "general";
  sourceCount: number;
  status: ThresholdResult["status"];
  reason?: string;
}

type Stage = "loading" | "error" | "preview" | "paying" | "unlocked";

function SourceList({ sources }: { sources: DigestSourceSummary[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {sources.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-sm">
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
              {s.label}
            </a>
          ) : (
            <span className="truncate">{s.label}</span>
          )}
          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
            {new Date(s.publishedAt).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function MarketSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conditionId } = use(params);
  const { address, isConnected } = useAccount();
  const { authenticated, login } = usePrivy();
  const { payForAccess, isPending: isPaying } = usePayForAccess();

  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<PolymarketMarket | null>(null);
  const [preview, setPreview] = useState<SourcesPreview | null>(null);
  const [priceSeries, setPriceSeries] = useState<PriceSeries[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  // Set as soon as the real onchain hasAccess() check comes back true — independent of
  // whether the Digest fetch itself then succeeds, so a wallet that has genuinely paid
  // is never shown "Pay to unlock Digest" again just because that follow-up load failed
  // (which would risk a second, reverting payForAccess transaction if clicked).
  const [accessConfirmed, setAccessConfirmed] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [payingLong, setPayingLong] = useState(false);
  const [digest, setDigest] = useState<MarketDigest | null>(null);

  const loadPreview = useCallback(async () => {
    setStage("loading");
    setError(null);
    try {
      const [marketRes, sourcesRes] = await Promise.all([
        fetch(`/api/market?conditionId=${conditionId}`),
        fetch(`/api/sources?conditionId=${conditionId}`),
      ]);
      if (!marketRes.ok) throw new Error((await marketRes.json()).error ?? "Failed to load market");
      if (!sourcesRes.ok) throw new Error((await sourcesRes.json()).error ?? "Failed to load sources");

      const marketData: PolymarketMarket = await marketRes.json();
      setMarket(marketData);
      setPreview(await sourcesRes.json());
      setStage("preview");

      const tokens = marketData.tokens ?? [];
      if (tokens.length > 0) {
        const colors: PriceSeries["color"][] = ["emerald", "rose"];
        Promise.all(
          tokens.slice(0, 2).map((t) =>
            fetch(`/api/price-history?tokenId=${t.token_id}&interval=1w`)
              .then((r) => (r.ok ? r.json() : { history: [] }))
              .then((d: { history?: PricePoint[] }) => d.history ?? [])
              .catch(() => [] as PricePoint[])
          )
        ).then((histories) => {
          setPriceSeries(
            tokens.slice(0, 2).map((t, i) => ({ label: t.outcome, color: colors[i], points: histories[i] }))
          );
        });
      }
    } catch (err) {
      setError((err as Error).message);
      setStage("error");
    }
  }, [conditionId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const loadDigest = useCallback(async () => {
    if (!address) return;
    setDigestLoading(true);
    try {
      const res = await fetch(`/api/digest?conditionId=${conditionId}&wallet=${address}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load Digest");
      }
      setDigest(await res.json());
      setHasAccess(true);
      setStage("unlocked");
    } catch (err) {
      // A wallet that has genuinely paid must never be silently left staring at
      // "Pay to unlock Digest" with no explanation — surface the real failure so a
      // transient network hiccup reads as "something went wrong, try again" instead
      // of looking like the payment didn't count.
      showErrorToast(err);
    } finally {
      setDigestLoading(false);
    }
  }, [conditionId, address]);

  useEffect(() => {
    if (!isConnected || !address || stage === "loading" || stage === "error") return;
    fetch(`/api/access?conditionId=${conditionId}&wallet=${address}`)
      .then((r) => r.json())
      .then((d: { hasAccess?: boolean }) => {
        if (d.hasAccess) {
          setAccessConfirmed(true);
          recordPaidMarket(address, conditionId);
          loadDigest();
        }
      })
      .catch((err) => showErrorToast(err));
  }, [isConnected, address, conditionId, stage, loadDigest]);

  async function handlePay() {
    if (!address) return;
    setStage("paying");
    setPayingLong(false);
    setError(null);
    // Confirmation is usually near-instant, but occasionally takes longer than expected
    // (network conditions, RPC latency) — swap in a more honest message rather than
    // leaving the same static text up indefinitely, which reads as broken.
    const longWaitTimer = setTimeout(() => setPayingLong(true), 6000);
    try {
      await payForAccess(conditionId as `0x${string}`);
      recordPaidMarket(address, conditionId);
      await loadDigest();
    } catch (err) {
      showErrorToast(err);
      setStage("preview");
    } finally {
      clearTimeout(longWaitTimer);
    }
  }

  if (stage === "loading") {
    return <MarketPageSkeleton />;
  }

  if (stage === "error") {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <p className="text-sm text-destructive">Error: {error}</p>
        <Button className="rounded-full" onClick={loadPreview}>
          Retry
        </Button>
      </main>
    );
  }

  const statusColor = preview?.status === "sufficient" ? "text-emerald-400" : "text-amber-400";
  const dotColor = preview && preview.sourceCount > 0 ? "bg-emerald-400" : "bg-rose-400";
  const sourcesById = new Map((digest?.sources ?? []).map((s) => [s.id, s]));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-xl font-bold tracking-tight">{market?.question}</h1>
          {market?.market_slug && (
            <a
              href={`https://polymarket.com/market/${market.market_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start shrink-0"
            >
              <Button variant="secondary" size="sm" className="rounded-full">
                Trade ↗
              </Button>
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{market?.description}</p>
        <div className="flex flex-wrap gap-2">
          {market?.tokens?.map((t) => (
            <OutcomeBadge key={t.token_id} outcome={t.outcome} price={t.price} />
          ))}
        </div>
      </div>

      {priceSeries.some((s) => s.points.length > 0) && (
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <PriceHistoryChart series={priceSeries} />
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{preview?.category} market</p>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium">
            <span className={cn("h-2 w-2 rounded-full", dotColor)} />
            {preview?.sourceCount} source{preview?.sourceCount === 1 ? "" : "s"} found
          </span>
        </div>
        <p className="mt-2 text-sm">
          <span className={cn("font-semibold capitalize", statusColor)}>{preview?.status}</span>
        </p>
        {preview?.reason && <p className="mt-1 text-sm text-muted-foreground">{preview.reason}</p>}
      </div>

      {stage === "unlocked" && digest ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-card p-4">
          <p className={cn("text-sm font-semibold capitalize", digest.threshold.status === "sufficient" ? "text-emerald-400" : "text-amber-400")}>
            Digest: {digest.threshold.status}
          </p>
          {digest.threshold.status === "inconclusive" ? (
            <p className="text-sm text-muted-foreground">{digest.threshold.reason}</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed">{digest.summary}</p>
              {digest.leaning && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recon&apos;s read</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                        digest.leaning.confidence === "high"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : digest.leaning.confidence === "medium"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-white/10 text-muted-foreground"
                      )}
                    >
                      {digest.leaning.confidence} confidence
                    </span>
                  </div>
                  <p className="mt-1.5 text-base font-semibold">{digest.leaning.outcome}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{digest.leaning.reasoning}</p>
                  <p className="mt-2 text-xs text-muted-foreground/70 italic">
                    Not financial advice — an AI-generated read of public sources, not a recommendation to trade.
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sources</p>
                <SourceList sources={digest.sources} />
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Claims by source</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {digest.claims.map((c, i) => {
                    const source = sourcesById.get(c.sourceId);
                    return (
                      <li key={i} className="rounded-md bg-white/5 px-3 py-2">
                        {source?.url ? (
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">
                            [{source.label}]
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">[{source?.label ?? c.sourceId}]</span>
                        )}{" "}
                        {c.text}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {digest.contradictions.length > 0 && (
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Contradictions</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {digest.contradictions.map((c, i) => (
                      <li key={i} className="rounded-md bg-rose-500/10 px-3 py-2 text-rose-200">
                        {c.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      ) : !isConnected ? (
        <Button className="rounded-full" disabled={authenticated} onClick={login}>
          {authenticated ? "Connecting…" : "Connect wallet to unlock Digest"}
        </Button>
      ) : accessConfirmed ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {hasAccess
              ? "Loading your unlocked Digest…"
              : digestLoading
                ? "Loading Digest — markets with many sources can take a minute…"
                : "This market is unlocked, but the Digest failed to load."}
          </p>
          {!hasAccess && (
            <Button variant="secondary" size="sm" className="rounded-full" onClick={loadDigest} disabled={digestLoading}>
              {digestLoading ? "Retrying…" : "Retry"}
            </Button>
          )}
        </div>
      ) : (
        <Button className="rounded-full" onClick={handlePay} disabled={isPaying || stage === "paying"}>
          {isPaying || stage === "paying"
            ? payingLong
              ? "Still confirming — this can take a moment…"
              : "Confirming payment…"
            : "Pay to unlock Digest"}
        </Button>
      )}
    </main>
  );
}
