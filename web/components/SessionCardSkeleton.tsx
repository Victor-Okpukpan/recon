import { Skeleton } from "@/components/ui/skeleton";

export function SessionCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-1 h-3 w-12" />
    </div>
  );
}
