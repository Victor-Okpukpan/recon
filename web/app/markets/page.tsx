"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OutcomeBadge } from "@/components/OutcomeBadge";
import { MarketCardSkeleton } from "@/components/MarketCardSkeleton";
import { cn } from "@/lib/utils";
import type { PolymarketMarket, PolymarketPage } from "@/lib/polymarket/client";

// Recon's demo scope is sports + politics (depth over breadth) — Polymarket applies
// these two tags consistently as top-level categories, confirmed against live data.
const SCOPE_TAGS = ["Politics", "Sports"];

type CategoryFilter = "all" | "Politics" | "Sports";

function isInScope(market: PolymarketMarket): boolean {
  return SCOPE_TAGS.some((t) => market.tags?.includes(t));
}

// Polymarket's sampling-markets page can return up to ~1000 raw markets in one batch,
// far more in-scope (politics/sports) results than should ever render at once. Display
// pages out of what's already been fetched before hitting the API again for more.
const DISPLAY_BATCH = 51;

export default function MarketsPage() {
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [visibleCount, setVisibleCount] = useState(DISPLAY_BATCH);

  // Re-syncs whenever the URL's ?category= actually changes (e.g. a footer link
  // clicked while already on this page) — a lazy useState initializer only runs on
  // first mount, so it can't react to a same-route navigation with new search params.
  useEffect(() => {
    const fromUrl = searchParams.get("category");
    setCategory(fromUrl === "Politics" || fromUrl === "Sports" ? fromUrl : "all");
  }, [searchParams]);

  const loadPage = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = nextCursor ? `/api/markets?cursor=${encodeURIComponent(nextCursor)}` : "/api/markets";
      const res = await fetch(url);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load markets");
      const page: PolymarketPage = await res.json();
      if (!Array.isArray(page.data)) {
        throw new Error("Markets response was missing its data array");
      }
      const inScope = page.data.filter(isInScope);
      setMarkets((prev) => (nextCursor ? [...prev, ...inScope] : inScope));
      // Polymarket doesn't document a fixed "end of list" cursor sentinel — treat an
      // empty page as the real end signal instead of guessing at the cursor's shape.
      setCursor(page.data.length > 0 ? page.next_cursor : undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const filtered = useMemo(() => {
    return markets.filter((m) => {
      if (category !== "all" && !m.tags?.includes(category)) return false;
      if (query && !m.question.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [markets, category, query]);

  // Changing filters restarts pagination — otherwise a narrower filter could leave
  // "Load more" permanently hidden if it happens to already satisfy the old count.
  useEffect(() => {
    setVisibleCount(DISPLAY_BATCH);
  }, [category, query]);

  const visible = filtered.slice(0, visibleCount);
  const hasMoreToShow = visibleCount < filtered.length || Boolean(cursor);

  async function handleLoadMore() {
    if (visibleCount < filtered.length) {
      setVisibleCount((v) => v + DISPLAY_BATCH);
      return;
    }
    if (cursor) {
      await loadPage(cursor);
      setVisibleCount((v) => v + DISPLAY_BATCH);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
        <p className="text-sm text-muted-foreground">Live from Polymarket — sports and politics. Open a market to preview and unlock Recon Digest.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search markets…"
        className="w-full rounded-lg border border-white/10 bg-card px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
      />

      <div className="flex flex-wrap gap-2">
        {(["all", "Politics", "Sports"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              category === c ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:text-foreground"
            )}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && markets.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <Link
              key={m.condition_id}
              href={`/market/${m.condition_id}`}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <p className="line-clamp-3 text-sm font-medium">{m.question}</p>
              <div className="flex flex-wrap gap-2">
                {m.tokens?.slice(0, 2).map((t) => (
                  <OutcomeBadge key={t.token_id} outcome={t.outcome} price={t.price} />
                ))}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {m.tags?.filter((t) => SCOPE_TAGS.includes(t)).map((t) => (
                  <span key={t} className="rounded-full border border-white/10 px-2 py-0.5">
                    {t}
                  </span>
                ))}
                <span className={m.closed ? "" : "text-emerald-400"}>{m.closed ? "Closed" : m.active ? "Active" : "Inactive"}</span>
                <span className="ml-auto font-mono">{new Date(m.end_date_iso).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && markets.length > 0 && (
        <p className="text-sm text-muted-foreground">No markets match your filters.</p>
      )}
      {!loading && markets.length === 0 && !cursor && (
        <p className="text-sm text-muted-foreground">No sports or political markets found in this batch.</p>
      )}

      {hasMoreToShow && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" className="rounded-full px-6" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </main>
  );
}
