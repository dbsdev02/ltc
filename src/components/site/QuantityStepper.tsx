import { Minus, Plus } from "lucide-react";
import { MAX_QUANTITY_PER_LINE } from "@/lib/pricing";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  size = "md",
  label = "Quantity",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  size?: "sm" | "md";
  label?: string;
}) {
  const button = size === "sm" ? "size-8" : "size-11";
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-full border border-border bg-background"
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        className={`${button} flex items-center justify-center rounded-full text-foreground hover:bg-secondary disabled:opacity-40`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" />
      </button>
      <span
        aria-live="polite"
        className={`${size === "sm" ? "w-6 text-sm" : "w-8 text-base"} text-center font-extrabold tabular-nums`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className={`${button} flex items-center justify-center rounded-full text-foreground hover:bg-secondary disabled:opacity-40`}
        disabled={value >= MAX_QUANTITY_PER_LINE}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
