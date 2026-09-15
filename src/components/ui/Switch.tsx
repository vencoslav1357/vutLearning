"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Viditelný popisek vlevo. Bez něj předej `aria-label`. */
  label?: ReactNode;
  /** Doplňující věta pod popiskem – proč to uživatel chce zapnout. */
  description?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: SwitchProps) {
  const labelId = useId();
  const descriptionId = `${labelId}-desc`;

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border",
        "transition-colors duration-150 ease-out-soft",
        "disabled:pointer-events-none disabled:opacity-50",
        checked
          ? "border-accent bg-accent"
          : "border-border-strong bg-bg-subtle hover:border-text-faint",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0.5 size-4.5 rounded-full bg-surface shadow-card",
          // Tailwind 4 posouvá vlastností `translate`, ne `transform`;
          // animuje se tedy přesně ona a nic jiného.
          "transition-[translate] duration-150 ease-out-soft motion-reduce:transition-none",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );

  if (!label && !description) {
    return <span className={className}>{control}</span>;
  }

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <span className="flex flex-col gap-0.5">
        {label ? (
          <span id={labelId} className="text-sm font-medium text-text">
            {label}
          </span>
        ) : null}
        {description ? (
          <span id={descriptionId} className="text-xs leading-relaxed text-text-muted">
            {description}
          </span>
        ) : null}
      </span>
      {control}
    </div>
  );
}
