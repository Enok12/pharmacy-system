import Breadcrumbs from "./Breadcrumbs";

/**
 * Standard page wrapper used by every route inside the app shell.
 *
 * @example
 * <PageLayout
 *   title="Products"
 *   description="Manage your product catalog"
 *   breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Products" }]}
 *   actions={<Button>Add Product</Button>}
 * >
 *   ...page content...
 * </PageLayout>
 */
export default function PageLayout({ title, description, breadcrumbs, actions, children }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      {breadcrumbs && (
        <div className="print:hidden">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      {(title || actions) && (
        <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}

      {children}
    </div>
  );
}
