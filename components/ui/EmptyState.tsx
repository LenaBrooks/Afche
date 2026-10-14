import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--af-radius-lg)] border border-dashed border-[var(--af-border)] bg-[var(--af-surface)]/60 px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--af-accent-soft)] text-[var(--af-accent)]">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-[var(--af-text)]">
        {title}
      </h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-[var(--af-muted)]">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
