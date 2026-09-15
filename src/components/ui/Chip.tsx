import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { SubjectAccent } from "./Badge";

export interface ChipProps {
  children: ReactNode;
  /** Stav přepínatelného štítku. Spolu s `onToggle` dělá z čipu filtr. */
  selected?: boolean;
  onToggle?: () => void;
  /** Totéž co `onToggle` – kvůli obvyklému zvyku psát u tlačítek `onClick`. */
  onClick?: () => void;
  /** Když je zadané, přibude křížek pro odebrání. */
  onRemove?: () => void;
  /** Popisek křížku pro odečítač obrazovky, např. „Odebrat filtr IZP“. */
  removeLabel?: string;
  /** Barva vybraného stavu podle předmětu. Bez ní se použije hlavní akcent. */
  accent?: SubjectAccent;
  /** Číslo vpravo – např. počet otázek v kategorii. */
  count?: number;
  disabled?: boolean;
  className?: string;
}

const SHELL =
  "inline-flex h-7 items-center gap-1.5 rounded-chip border px-2.5 text-xs font-medium transition-[background-color,border-color,color] duration-150 ease-out-soft";

const OFF =
  "border-border-base bg-surface text-text-muted hover:border-border-strong hover:text-text";
const ON = "border-accent/35 bg-accent-soft text-accent";

const ON_ACCENT: Record<SubjectAccent, string> = {
  slate: "border-accent-slate/40 bg-accent-slate/12 text-accent-slate",
  indigo: "border-accent-indigo/40 bg-accent-indigo/12 text-accent-indigo",
  violet: "border-accent-violet/40 bg-accent-violet/12 text-accent-violet",
  teal: "border-accent-teal/40 bg-accent-teal/12 text-accent-teal",
  amber: "border-accent-amber/40 bg-accent-amber/12 text-accent-amber",
  rose: "border-accent-rose/40 bg-accent-rose/12 text-accent-rose",
};

export function Chip({
  children,
  selected = false,
  onToggle,
  onClick,
  onRemove,
  removeLabel = "Odebrat",
  accent,
  count,
  disabled = false,
  className,
}: ChipProps) {
  const toggle = onToggle ?? onClick;
  const tone = selected ? (accent ? ON_ACCENT[accent] : ON) : OFF;

  const body = (
    <>
      <span className="whitespace-nowrap">{children}</span>
      {typeof count === "number" ? (
        <span className={cn("tabular-nums", selected ? "opacity-70" : "text-text-faint")}>
          {count}
        </span>
      ) : null}
    </>
  );

  // Křížek je samostatné tlačítko, takže obal nesmí být taky tlačítko –
  // vnořená tlačítka prohlížeč neumí a klávesnice by se do křížku nedostala.
  if (onRemove) {
    return (
      <span className={cn(SHELL, tone, "pr-1", className)}>
        {toggle ? (
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            aria-pressed={selected}
            className="inline-flex items-center gap-1.5 rounded-sm disabled:opacity-50"
          >
            {body}
          </button>
        ) : (
          body
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel}
          className="ml-0.5 grid size-5 place-items-center rounded-sm opacity-70 transition-[opacity,background-color] duration-150 hover:bg-bg-subtle hover:opacity-100 disabled:opacity-40"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </span>
    );
  }

  if (toggle) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          SHELL,
          tone,
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        {body}
      </button>
    );
  }

  return <span className={cn(SHELL, tone, className)}>{body}</span>;
}
