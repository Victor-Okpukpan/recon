import { Skeleton } from "@/components/ui/skeleton";

export function MarketPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card p-4">
        <Skeleton className="h-44 w-full" />
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-card p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      <Skeleton className="h-10 w-48 rounded-full" />
    </main>
  );
}
