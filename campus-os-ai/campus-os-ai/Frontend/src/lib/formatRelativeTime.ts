// Formats an ISO/date string as a short relative time (e.g. "5 min ago").
// Falls back to a generic label for missing/invalid input so callers never
// have to null-check before rendering.
export function formatRelativeTime(isoOrDate?: string | null, fallback = "recently"): string {
  if (!isoOrDate) return fallback;

  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return fallback;

  const diffMs = Date.now() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}
