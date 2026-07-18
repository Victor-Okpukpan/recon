import { cn } from "@/lib/utils";

export function OutcomeBadge({ outcome, price }: { outcome: string; price: number }) {
  const pct = Math.round(price * 100);
  const favored = price >= 0.5;
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
        favored ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
      )}
    >
      {outcome} {pct}%
    </span>
  );
}
