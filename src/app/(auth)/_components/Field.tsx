"use client";

/**
 * Vstupní pole pro přihlašovací formuláře.
 *
 * V `src/components/ui` zatím žádný `Input` není, takže si ho tu drží
 * auth stránky samy. Kdyby ho ui někdy dodalo, tenhle soubor zmizí.
 */

import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const INPUT = [
  "w-full rounded-control border bg-surface px-3 py-2.5 text-sm text-text",
  "placeholder:text-text-faint",
  "transition-[border-color,box-shadow] duration-150 ease-out-soft",
  "disabled:opacity-50",
].join(" ");

interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  label: string;
  /** Vysvětlivka pod popiskem. Pravidla patří sem, ne až do chyby po odeslání. */
  hint?: ReactNode;
  /** Chyba u konkrétního pole. Přebíjí `hint`. */
  error?: string | null;
}

export function Field({ label, hint, error, ...input }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>

      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-text-muted">
          {hint}
        </p>
      ) : null}

      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          INPUT,
          error ? "border-bad-border" : "border-border-strong",
        )}
        {...input}
      />

      {error ? (
        <p id={`${id}-error`} className="text-xs leading-relaxed text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Hláška pro celý formulář (chyba ze serveru nebo potvrzení). */
export function FormMessage({
  tone = "bad",
  children,
}: {
  tone?: "bad" | "ok";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={cn(
        "rounded-control border px-3 py-2.5 text-sm leading-relaxed",
        tone === "bad"
          ? "border-bad-border bg-bad-soft text-bad"
          : "border-ok-border bg-ok-soft text-ok",
      )}
    >
      {children}
    </p>
  );
}
