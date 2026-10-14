import Link from "next/link";
import { ReactNode } from "react";

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
  backLabel = "گالری",
  trailing,
}: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
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
      <div className="flex flex-wrap items-center gap-2">
        {trailing}
        <Link
          href={backHref}
          prefetch
          className="af-focusable rounded-[var(--af-radius-md)] border border-[var(--af-border)] px-3 py-2 text-sm text-[var(--af-muted)] transition hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
        >
          {backLabel}
        </Link>
      </div>
    </header>
  );
}
