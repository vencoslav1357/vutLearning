"use client";

/**
 * Jediný kousek panelu s kódem, který musí do prohlížeče – schránka je browser API.
 * Panel kolem něj zůstává Server Component.
 */
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type CopyButtonProps = {
  /** Text, který se zkopíruje (původní zdroják, ne zvýrazněné HTML). */
  value: string;
  className?: string;
};

export function CopyButton({ value, className }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("done");
    } catch {
      // Bez HTTPS nebo bez povolení schránka není. Uživateli to aspoň řekneme.
      setState("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  }

  const label =
    state === "done" ? "Zkopírováno" : state === "error" ? "Nepovedlo se" : "Kopírovat";

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-chip border border-border-base px-2 py-1",
        "text-xs text-text-muted transition-colors duration-150",
        "hover:bg-surface-hover hover:text-text",
        state === "done" && "border-ok-border text-ok",
        state === "error" && "border-bad-border text-bad",
        className,
      )}
    >
      {state === "done" ? (
        <Check aria-hidden className="size-3.5" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
      {label}
    </button>
  );
}
