import clsx from "clsx";

const TONES = {
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info)]",
  purple: "bg-[var(--color-purple-bg)] text-[var(--color-purple)]",
};

export default function Badge({ tone = "neutral", className, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
