import clsx from "clsx";

const VARIANTS = {
  primary:
    "bg-[var(--color-brand-700)] text-white hover:bg-[var(--color-brand-800)] focus-visible:outline-[var(--color-brand-700)]",
  secondary:
    "bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] focus-visible:outline-[var(--color-brand-700)]",
  outline:
    "border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] focus-visible:outline-[var(--color-brand-700)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:opacity-90 focus-visible:outline-[var(--color-danger)]",
  ghost:
    "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] focus-visible:outline-[var(--color-brand-700)]",
};

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

export default function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}) {
  return (
    <Tag
      className={clsx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
