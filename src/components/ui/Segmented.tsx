"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Nepovinná ikona vlevo od popisku. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Popisek celé skupiny pro odečítač obrazovky, např. „Režim tréninku“. */
  label?: string;
  "aria-label"?: string;
  size?: "sm" | "md";
  /** Roztáhne přepínač na šířku rodiče a rozdělí místo rovnoměrně. */
  block?: boolean;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  "aria-label": ariaLabel,
  size = "md",
  block = false,
  className,
}: SegmentedProps<T>) {
  const indicatorId = useId();
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Šipky přepínají rovnou (automatická aktivace) – u dvou až čtyř
  // možností je to rychlejší než potvrzovat mezerníkem.
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const enabled = options
      .map((option, i) => ({ option, i }))
      .filter(({ option }) => !option.disabled);
    if (enabled.length === 0) return;

    const position = enabled.findIndex(({ i }) => i === index);
    let next = -1;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = enabled[(position + 1) % enabled.length].i;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = enabled[(position - 1 + enabled.length) % enabled.length].i;
    } else if (event.key === "Home") {
      next = enabled[0].i;
    } else if (event.key === "End") {
      next = enabled[enabled.length - 1].i;
    } else {
      return;
    }

    event.preventDefault();
    onChange(options[next].value);
    tabsRef.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label ?? ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "relative inline-flex items-center gap-1 rounded-control border border-border-base bg-bg-subtle p-1",
        block && "flex w-full",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              tabsRef.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKey(event, index)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 rounded-[0.5rem] font-medium",
              "transition-colors duration-150 ease-out-soft",
              "disabled:pointer-events-none disabled:opacity-40",
              block && "flex-1",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
              selected ? "text-text" : "text-text-muted hover:text-text",
            )}
          >
            {selected ? (
              // layoutId přesune jedno a totéž pozadí mezi položkami,
              // takže se nemusí nic prolínat ani překreslovat dvakrát.
              <motion.span
                layoutId={indicatorId}
                aria-hidden
                className="absolute inset-0 rounded-[0.5rem] bg-surface shadow-card"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            ) : null}
            {option.icon ? (
              <span className="relative z-10 grid place-items-center [&_svg]:size-4">
                {option.icon}
              </span>
            ) : null}
            <span className="relative z-10 whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
