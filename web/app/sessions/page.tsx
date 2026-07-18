"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { SessionCardSkeleton } from "@/components/SessionCardSkeleton";
import type { SessionSummary } from "@/app/api/sessions/route";
import { getPaidMarketCandidates } from "@/lib/sessions";

export default function SessionsPage() {
  const { address, isConnected } = useAccount();
  const { authenticated, login } = usePrivy();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true);
    setError(null);
    const candidates = getPaidMarketCandidates(address);
    const params = new URLSearchParams({ wallet: address });
    for (const c of candidates) params.append("conditionId", c);
    fetch(`/api/sessions?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load sessions");
        return res.json();
      })
      .then((d: { sessions: SessionSummary[] }) => setSessions(d.sessions))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [isConnected, address]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">My Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Markets you&apos;ve unlocked — verified directly against on-chain payment receipts, no repayment needed.
        </p>
      </div>

      {!isConnected ? (
        <Button className="rounded-full" disabled={authenticated} onClick={login}>
          {authenticated ? "Connecting…" : "Connect wallet"}
        </Button>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unlocked markets yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sessions.map((s) => (
            <Link
              key={s.conditionId}
              href={`/market/${s.conditionId}`}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <p className="line-clamp-3 text-sm font-medium">{s.question}</p>
              <p className={`text-xs ${s.closed ? "text-muted-foreground" : "text-emerald-400"}`}>{s.closed ? "Closed" : "Active"}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
