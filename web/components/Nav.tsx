"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Nav() {
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  const { ready, authenticated, login, logout } = usePrivy();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-background/95 px-3 py-3 backdrop-blur sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-6">
        <Link href="/" className="shrink-0 text-sm font-bold tracking-widest uppercase">
          Recon
        </Link>
        <Link href="/markets" className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground">
          Markets
        </Link>
        {isConnected && (
          <Link href="/sessions" className="shrink-0 truncate text-sm text-muted-foreground transition-colors hover:text-foreground">
            <span className="hidden sm:inline">My Sessions</span>
            <span className="sm:hidden">Sessions</span>
          </Link>
        )}
      </div>
      {isConnected && address ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pr-1 pl-2.5 text-sm transition-colors sm:gap-2 sm:pl-3",
              "hover:border-primary/50 hover:bg-primary/10"
            )}
          >
            <span className="hidden font-mono text-xs whitespace-nowrap text-muted-foreground sm:inline">
              {balance ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(2)} ${balance.symbol}` : "…"}
            </span>
            <span className="hidden h-4 w-px bg-primary/20 sm:block" />
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-xs font-medium whitespace-nowrap text-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 z-20 mt-2 w-52 space-y-1 rounded-xl border border-white/10 bg-card p-1.5 shadow-lg">
              <div className="space-y-0.5 px-3 py-2 text-xs">
                <p className="text-muted-foreground">{chain?.name ?? "Unknown network"}</p>
                <p className="font-semibold text-foreground">
                  {balance
                    ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`
                    : "Loading balance…"}
                </p>
              </div>
              <div className="h-px bg-white/10" />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(address);
                  setMenuOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                Copy address
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-white/5"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : authenticated ? (
        <Button size="sm" className="rounded-full" disabled>
          Connecting…
        </Button>
      ) : (
        <Button size="sm" className="rounded-full" disabled={!ready} onClick={login}>
          Connect
        </Button>
      )}
    </nav>
  );
}
