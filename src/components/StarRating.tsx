import { clsx } from "clsx";

export function StarRating({
  value,
  max = 5,
  compact = false,
}: {
  value: number;
  max?: number;
  compact?: boolean;
}) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
  const full = Math.floor(v);
  const hasHalf = v - full >= 0.5;

  return (
    <div className={clsx("flex items-center gap-1", compact && "gap-0.5")}>
      {Array.from({ length: max }).map((_, i) => {
        const idx = i + 1;
        const filled = idx <= full;
        const half = !filled && hasHalf && idx === full + 1;
        return (
          <span
            key={idx}
            className={clsx(
              "inline-flex select-none",
              compact ? "text-[13px]" : "text-sm",
              filled ? "text-amber-500" : half ? "text-amber-400/70" : "text-neutral-300",
            )}
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
      <span className={clsx("ml-1 tabular-nums", compact ? "text-[12px]" : "text-xs", "text-neutral-600")}>
        {v.toFixed(1)}
      </span>
    </div>
  );
}


