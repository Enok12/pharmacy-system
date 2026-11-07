import clsx from "clsx";

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={clsx("flex items-center justify-between px-5 pt-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={clsx("p-5", className)} {...props}>
      {children}
    </div>
  );
}
