import { Loader2 } from "lucide-react";

/**
 * Full-panel loading indicator for a page section or table.
 * Use <TableSkeleton /> instead when the surrounding layout (columns) is
 * already known, so the page doesn't jump once data arrives.
 */
export default function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-text-muted)]">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-600)]" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="w-full animate-pulse">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-3.5 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-3.5 flex-1 rounded bg-[var(--color-surface-muted)]"
              style={{ maxWidth: colIndex === 0 ? "40%" : "100%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
