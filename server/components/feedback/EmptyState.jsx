import { Inbox } from "lucide-react";

/**
 * Shown when a list/table genuinely has zero items (not an error).
 * Treated as an invitation to act, per the design system's writing guidance —
 * pair with an actionLabel/onAction whenever there's a clear next step.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  message,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-muted)]">
        <Icon className="h-6 w-6 text-[var(--color-text-muted)]" />
      </div>
      <div>
        <p className="font-semibold text-[var(--color-text-primary)]">{title}</p>
        {message && (
          <p className="mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">{message}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
