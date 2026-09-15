import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export type ProgressTone = "accent" | "ok" | "warn" | "bad" | "neutral";
export type ProgressSize = "sm" | "md" | "lg";

const TONES: Record<ProgressTone, string> = {
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  neutral: "bg-text-faint",
};

const HEIGHTS: Record<ProgressSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3.5",
};

export interface ProgressSegment {
  /** Podíl z celku, 0–1. Součet segmentů by neměl přesáhnout 1. */
  value: number;
  tone: ProgressTone;
  /** Popisek do title/legendy, např. "zvládnuté". */
  label?: string;
}

export interface ProgressBarProps {
  /** Vyplněný podíl, 0–1. Řídí i `aria-valuenow`. */
  value: number;
  size?: ProgressSize;
  tone?: ProgressTone;
  /** Popisek nad pruhem. Když chybí, předej aspoň `aria-label`. */
  label?: string;
  /** Vypíše procenta vpravo nad pruhem. */
  showValue?: boolean;
  /**
   * Rozpad podle stavu zvládnutí. Nahradí jednolitou výplň;
   * `value` dál nese přístupnostní hodnotu.
   */
  segments?: readonly ProgressSegment[];
  "aria-label"?: string;
  className?: string;
}

const clamp = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Posun je 400 ms, aby dojezd šel vnímat, ale nezdržoval. */
const MOVE = "transition-transform duration-[400ms] ease-out-soft motion-reduce:transition-none";

export function ProgressBar({
  value,
  size = "md",
  tone = "accent",
  label,
  showValue = false,
  segments,
  className,
  "aria-label": ariaLabel,
}: ProgressBarProps) {
  const safe = clamp(value);
  const percent = Math.round(safe * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          {label ? <span className="font-medium text-text-muted">{label}</span> : <span />}
          {showValue ? (
            <span className="tabular-nums text-text-faint">{percent} %</span>
          ) : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={ariaLabel ?? (label ? undefined : "Postup")}
        aria-valuetext={`${percent} %`}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-bg-subtle",
          "inset-ring inset-ring-border-base",
          HEIGHTS[size],
        )}
      >
        {/* Animuje se výhradně `transform` – měnit `width` by nutilo
            prohlížeč přepočítat layout při každém snímku. */}
        {segments ? (
          segments.map((segment, index) => {
            const offset = segments
              .slice(0, index)
              .reduce((sum, s) => sum + clamp(s.value), 0);
            const style: CSSProperties = {
              transform: `translateX(${clamp(offset) * 100}%) scaleX(${clamp(segment.value)})`,
            };
            return (
              <div
                key={`${segment.tone}-${index}`}
                aria-hidden
                title={segment.label}
                style={style}
                className={cn(
                  "absolute inset-0 origin-left rounded-full",
                  TONES[segment.tone],
                  MOVE,
                )}
              />
            );
          })
        ) : (
          <div
            aria-hidden
            style={{ transform: `scaleX(${safe})` }}
            className={cn(
              "absolute inset-0 origin-left rounded-full",
              TONES[tone],
              MOVE,
            )}
          />
        )}
      </div>
    </div>
  );
}
