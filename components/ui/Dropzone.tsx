import { DragEvent, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onFiles: (files: FileList | File[]) => void;
  hint?: string;
  title?: string;
  compact?: boolean;
};

export default function Dropzone({
  disabled,
  onFiles,
  title = "انتخاب یا رها کردن عکس‌ها",
  hint,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (disabled) return;
    setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`af-focusable relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--af-radius-lg)] border border-dashed text-center transition ${
        compact ? "px-3 py-4 sm:py-5" : "px-4 py-10 sm:py-14"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${
        dragging
          ? "border-[var(--af-accent)] bg-[var(--af-accent-soft)]"
          : "border-[var(--af-border-strong)] bg-[var(--af-surface)] shadow-[var(--af-shadow-sm)] hover:border-[var(--af-accent)]/60"
      }`}
    >
      <span
        className={`font-semibold text-[var(--af-text)] ${
          compact ? "text-sm" : "text-lg"
        }`}
      >
        {dragging ? "رها کنید" : title}
      </span>
      {hint && (
        <span
          className={`max-w-md leading-5 text-[var(--af-muted)] ${
            compact ? "text-[11px]" : "text-xs"
          }`}
        >
          {hint}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        multiple
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
