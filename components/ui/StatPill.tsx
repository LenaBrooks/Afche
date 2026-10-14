import { toFaDigits } from "../../utils/fa";

export default function StatPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--af-accent-soft)] px-2.5 py-1 text-xs text-[var(--af-accent)] shadow-[var(--af-ctl-active-glow)]">
      <span className="fa-num font-semibold">{toFaDigits(value)}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
