import { toFaDigits } from "../../utils/fa";

type Item<T extends string> = {
  id: T;
  label: string;
  count?: number | null;
};

type Props<T extends string> = {
  items: Item<T>[];
  value: T;
  onChange: (id: T) => void;
};

export default function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: Props<T>) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] p-1 shadow-[var(--af-shadow-sm)] scrollbar-none">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`af-focusable inline-flex shrink-0 items-center gap-1.5 rounded-[var(--af-radius-sm)] px-2.5 py-2 text-sm transition sm:gap-2 sm:px-3 ${
              active
                ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)] shadow-[var(--af-ctl-active-glow)] ring-1 ring-[var(--af-ctl-active-ring)]"
                : "text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
            }`}
          >
            <span className="whitespace-nowrap">{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={`fa-num rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active
                    ? "bg-[var(--af-accent)]/25 text-[var(--af-ctl-active-fg)]"
                    : "bg-[var(--af-chip)] text-[var(--af-muted)]"
                }`}
              >
                {toFaDigits(item.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
