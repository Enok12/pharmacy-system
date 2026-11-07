import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * @param {{ label: string, href?: string }[]} items
 * Last item (no href) renders as the current page, non-clickable.
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-[var(--color-brand-700)]">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "font-medium text-[var(--color-text-primary)]" : ""}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
