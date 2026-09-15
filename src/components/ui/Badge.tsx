import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "accent" | "ok" | "bad" | "warn";
export type SubjectAccent =
  | "slate"
  | "indigo"
  | "violet"
  | "teal"
  | "amber"
  | "rose";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "border-border-base bg-bg-subtle text-text-muted",
  accent: "border-accent/25 bg-accent-soft text-accent",
  ok: "border-ok-border bg-ok-soft text-ok",
  bad: "border-bad-border bg-bad-soft text-bad",
  warn: "border-warn-border bg-warn-soft text-warn",
};

/* Barvy předmětů se odvozují průhledností z jednoho tokenu – vlastní
   "soft" odstíny pro šest předmětů by jen množily proměnné. */
const ACCENTS: Record<SubjectAccent, string> = {
  slate: "border-accent-slate/30 bg-accent-slate/12 text-accent-slate",
  indigo: "border-accent-indigo/30 bg-accent-indigo/12 text-accent-indigo",
  violet: "border-accent-violet/30 bg-accent-violet/12 text-accent-violet",
  teal: "border-accent-teal/30 bg-accent-teal/12 text-accent-teal",
  amber: "border-accent-amber/30 bg-accent-amber/12 text-accent-amber",
  rose: "border-accent-rose/30 bg-accent-rose/12 text-accent-rose",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Barva podle předmětu. Má přednost před `variant`. */
  accent?: SubjectAccent;
  size?: "sm" | "md";
  children?: ReactNode;
}

export function Badge({
  variant = "neutral",
  accent,
  size = "md",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-chip border font-medium whitespace-nowrap",
        size === "sm"
          ? "px-1.5 py-0.5 text-[0.6875rem]"
          : "px-2 py-0.5 text-xs",
        accent ? ACCENTS[accent] : VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
