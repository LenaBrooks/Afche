import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { ReactNode } from "react";
import AdminNavLink from "../AdminNavLink";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  trailing?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  backHref = "/",
  backLabel = "بازگشت",
  trailing,
}: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <AdminNavLink
          href={backHref}
          title={backLabel}
          aria-label={backLabel}
          className="af-focusable mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] transition hover:bg-[var(--af-chip)] hover:text-[var(--af-text)]"
        >
          {/* RTL: بازگشت به سمت راست — فلش به راست */}
          <ArrowRightIcon className="h-4 w-4" />
        </AdminNavLink>
        <div className="min-w-0">
          <p className="af-brand mb-2 text-xs font-semibold text-[var(--af-accent)]">
            AFCHE
          </p>
          <h1 className="text-2xl font-bold text-[var(--af-text)] sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--af-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {trailing ? (
        <div className="flex flex-wrap items-center gap-1.5">{trailing}</div>
      ) : null}
    </header>
  );
}
