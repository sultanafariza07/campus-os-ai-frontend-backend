export function Spinner({ className = "h-5 w-5", label }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <svg className={`animate-spin text-current ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label && <span className="text-xs text-[#94A3B8]">{label}</span>}
    </span>
  );
}

// Full-page variant — used for the rare case where an entire page has
// nothing meaningful to skeleton yet (most pages prefer Skeleton/SkeletonRow
// so the layout doesn't jump once data arrives).
export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F]">
      <Spinner className="h-8 w-8 text-[#6C63FF]" label={label} />
    </div>
  );
}
