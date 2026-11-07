import { AlertTriangle } from "lucide-react";
import Button from "../ui/Button";

/**
 * Shown when a request fails. Copy stays factual — what happened and what
 * to do next, no apologetic filler (see writing guidance in design system).
 */
export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again.",
  onRetry,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger-bg)]">
        <AlertTriangle className="h-6 w-6 text-[var(--color-danger)]" />
      </div>
      <div>
        <p className="font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}
