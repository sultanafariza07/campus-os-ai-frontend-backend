// Small reusable skeleton block. Renders a pulsing rounded bar matching the
// existing CampusOS dark theme, so any page needing a loading state can
// compose one out of this instead of writing its own ad-hoc placeholder.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

// A row shaped like a single notification/activity item, for list loading states.
export function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2 py-0.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
    </div>
  );
}
