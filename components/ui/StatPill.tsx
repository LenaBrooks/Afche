import { toFaDigits } from "../../utils/fa";

export default function StatPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--af-accent)]/30 bg-[var(--af-accent-soft)] px-2.5 py-1 text-xs text-[var(--af-accent)]">
      <span className="fa-num font-semibold">{toFaDigits(value)}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
